import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

type Pending = {
  outbox_id:string; notification_id:string; recipient_id:string;
  title:string; body:string; kind:string; payload:Record<string,unknown>;
  attempts:number; read_at:string|null;
};
type Ticket = {status:'ok'|'error'; id?:string; message?:string; details?:{error?:string}};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});
const EXPO_TOKEN=/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const maxAttempts=5;
const pause=(tries:number)=>new Date(Date.now()+Math.min(60,2**Math.max(0,tries))*60_000).toISOString();

Deno.serve(async (req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(!req.headers.get('authorization')?.startsWith('Bearer ')){
    return json({error:'Authentication required'},401);
  }
  // Gateway verifies the JWT. The request body is ignored: the server chooses
  // which already-authorised database events to deliver.
  const url=Deno.env.get('SUPABASE_URL');
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return json({error:'Server notification credentials unavailable'},503);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:claimed,error:claimError}=await admin.rpc('tradarr_claim_push_batch',{p_limit:20});
  if(claimError){
    console.error('push batch claim failed',claimError.code,claimError.message);
    return json({error:'Unable to claim pending notifications'},503);
  }
  const rows=(claimed||[]) as Pending[];
  let sent=0,skipped=0,retry=0,failed=0;
  const accessToken=Deno.env.get('EXPO_ACCESS_TOKEN');
  async function settle(row:Pending,status:'sent'|'skipped'|'retry'|'failed',
    lastError?:string,details?:unknown){
    const patch:Record<string,unknown>={
      status,
      processed_at:new Date().toISOString(),
      last_error:lastError?.slice(0,500)||null,
    };
    if(status==='retry')patch.next_attempt_at=pause(row.attempts);
    if(details)patch.ticket_details=details;
    const {error}=await admin.from('tradarr_push_outbox')
      .update(patch).eq('id',row.outbox_id).eq('status','processing');
    if(error)console.error('push settlement failed',row.outbox_id,error.code);
  }
  for(const row of rows){
    try{
      // Read notifications even when push is disabled. Respect the preference
      // only for the *remote* delivery.
      if(row.read_at){
        skipped++;
        await settle(row,'skipped','Notification already read');
        continue;
      }
      const {data:pref,error:prefError}=await admin.from('profiles')
        .select('notifications_enabled').eq('id',row.recipient_id).maybeSingle();
      if(prefError)throw new Error('Cannot check recipient preferences');
      if(pref?.notifications_enabled===false){
        skipped++;
        await settle(row,'skipped','User disabled push');
        continue;
      }
      const {data:devices,error:deviceError}=await admin.from('tradarr_push_devices')
        .select('expo_token').eq('user_id',row.recipient_id).eq('enabled',true).limit(15);
      if(deviceError)throw new Error('Unable to read device registry');
      const tokens=[...new Set((devices||[]).map(d=>d.expo_token)
        .filter((t):t is string=>typeof t==='string'&&EXPO_TOKEN.test(t)))];
      if(!tokens.length){
        skipped++;
        await settle(row,'skipped','No registered enabled devices');
        continue;
      }
      const body=tokens.map(to=>({
        to,title:row.title,body:row.body,sound:'default',
        priority:row.kind==='job_offer'?'high':'default',
        data:{
          notificationId:row.notification_id,
          kind:row.kind,
          ...Object.fromEntries(Object.entries(row.payload||{}).filter(
            ([name,val])=>['screen','conversationId','jobId'].includes(name)
              &&typeof val==='string'
          ))
        }
      }));
      const headers:Record<string,string>={'Content-Type':'application/json','Accept':'application/json'};
      if(accessToken)headers.Authorization='Bearer '+accessToken;
      const response=await fetch('https://exp.host/--/api/v2/push/send',{
        method:'POST',headers,body:JSON.stringify(body),
        signal:AbortSignal.timeout(14000)
      });
      if(!response.ok)throw new Error('Expo push service returned HTTP '+response.status);
      const output=await response.json() as {data?:Ticket[];errors?:unknown[]};
      if(!Array.isArray(output.data)||output.data.length!==tokens.length)
        throw new Error('Unexpected Expo push response');
      const tickets=output.data.map((ticket,i)=>({
        token:tokens[i],ticketId:ticket.id||null,
        status:ticket.status,
        error:ticket.details?.error||ticket.message||null
      }));
      for(const ticket of tickets){
        if(ticket.error==='DeviceNotRegistered'){
          const {error}=await admin.from('tradarr_push_devices')
            .update({enabled:false}).eq('expo_token',ticket.token);
          if(error)console.error('Could not disable stale push token',error.code);
        }
      }
      const accepted=tickets.filter(ticket=>ticket.status==='ok').length;
      const permanent=tickets.every(ticket=>ticket.error==='DeviceNotRegistered');
      if(accepted){
        sent++;
        await settle(row,'sent',undefined,tickets);
      }else if(permanent){
        skipped++;
        await settle(row,'skipped','All devices unregistered',tickets);
      }else if(row.attempts>=maxAttempts){
        failed++;
        await settle(row,'failed','Expo rejected delivery after retries',tickets);
      }else{
        retry++;
        await settle(row,'retry','Expo did not accept any device notifications',tickets);
      }
    }catch(err){
      const message=err instanceof Error?err.message:String(err);
      console.error('push dispatch failure',row.outbox_id,message);
      if(row.attempts>=maxAttempts){
        failed++;await settle(row,'failed',message);
      }else{
        retry++;await settle(row,'retry',message);
      }
    }
  }
  // Ticket acceptance is not delivery. Run the receipt poll after the send
  // batch; the existing five-minute cron also invokes this on quiet periods.
  let receiptsChecked=0,receiptsPending=0,receiptErrors=0;
  try {
    type ReceiptClaim={outbox_id:string;recipient_id:string;tickets:Array<{
      ticketId?:string|null;token?:string;status?:string;error?:string|null
    }>;check_attempts:number};
    type Receipt={status:'ok'|'error';message?:string;details?:{error?:string}};
    const {data:pending,error:receiptClaimError}=await admin.rpc('tradarr_claim_push_receipts',{p_limit:10});
    if(receiptClaimError)throw receiptClaimError;
    const receiptRows=(pending||[]) as ReceiptClaim[];
    const ids=[...new Set(receiptRows.flatMap(row=>
      (Array.isArray(row.tickets)?row.tickets:[])
       .filter(t=>t.status==='ok'&&typeof t.ticketId==='string')
       .map(t=>t.ticketId!)))];
    let results:Record<string,Receipt>={};
    if(ids.length){
      const receiptHeaders:Record<string,string>={'Content-Type':'application/json','Accept':'application/json'};
      if(accessToken)receiptHeaders.Authorization='Bearer '+accessToken;
      const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{
        method:'POST',headers:receiptHeaders,body:JSON.stringify({ids}),
        signal:AbortSignal.timeout(12000)
      });
      if(!response.ok)throw new Error('Expo receipt service returned HTTP '+response.status);
      const output=await response.json() as {data?:Record<string,Receipt>};
      if(!output.data||typeof output.data!=='object'||Array.isArray(output.data))
        throw new Error('Invalid Expo receipts response');
      results=output.data;
    }
    for(const row of receiptRows){
      const tickets=Array.isArray(row.tickets)?row.tickets:[];
      const statuses=tickets.map(t=>{
        if(t.status!=='ok'||!t.ticketId)return {
          ticketId:t.ticketId||null,status:'rejected',
          error:t.error||'Push ticket not accepted'
        };
        const receipt=results[t.ticketId];
        if(!receipt)return {ticketId:t.ticketId,status:'pending'};
        return {
          ticketId:t.ticketId,status:receipt.status,
          error:receipt.details?.error||receipt.message||null
        };
      });
      // Expo's DeviceNotRegistered response invalidates that exact device.
      for(let i=0;i<statuses.length;i++){
        const result=statuses[i],ticket=tickets[i];
        if(result.error==='DeviceNotRegistered'&&typeof ticket.token==='string'){
          const {error:deviceError}=await admin.from('tradarr_push_devices')
           .update({enabled:false}).eq('user_id',row.recipient_id).eq('expo_token',ticket.token);
          if(deviceError)console.error('stale token cleanup failed',deviceError.code);
        }
      }
      const unfinished=statuses.some(x=>x.status==='pending');
      // Receipts are retained at most 24h by Expo. Stop after bounded checks;
      // an unresolved status is explicitly NOT treated as delivered.
      const completed=!unfinished||row.check_attempts>=4;
      const hasErrors=statuses.some(x=>x.status==='error'||x.status==='rejected');
      const {error:saveError}=await admin.from('tradarr_push_outbox').update({
        receipt_details:{results:statuses,provider:'Expo',complete:completed,
          checked_at:new Date().toISOString()},
        receipt_complete_at:completed?new Date().toISOString():null,
        ...(hasErrors?{last_error:'Expo push receipt reported delivery-service error'}:{})
       }).eq('id',row.outbox_id).eq('status','sent');
      if(saveError)throw saveError;
      receiptsChecked++;
      if(unfinished)receiptsPending++;
      if(hasErrors)receiptErrors++;
    }
  }catch(err){
    const message=err instanceof Error?err.message:String(err);
    // A failed receipt lookup must not prevent new notifications from sending.
    console.error('push receipts unavailable',message);
  }
  return json({claimed:rows.length,sent,skipped,retry,failed,
    receiptsChecked,receiptsPending,receiptErrors});
});
