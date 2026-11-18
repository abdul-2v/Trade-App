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
  return json({claimed:rows.length,sent,skipped,retry,failed});
});
