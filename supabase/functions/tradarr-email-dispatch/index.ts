import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {renderEmail,retryableStatus} from './templates.mjs';
type Row={outbox_id:string;claim_token:string;recipient_email:string;event_kind:string;attempt_number:number};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
async function sameSecret(actual:string,expected:string){
 if(!actual||!expected)return false;
 const encode=new TextEncoder();
 const [a,b]=await Promise.all([actual,expected].map(x=>crypto.subtle.digest('SHA-256',encode.encode(x))));
 const av=new Uint8Array(a),bv=new Uint8Array(b);let diff=0;
 for(let i=0;i<av.length;i++)diff|=av[i]^bv[i];return diff===0;
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const dispatch=Deno.env.get('TRADARR_EMAIL_DISPATCH_SECRET')||'';
 if(!(await sameSecret(req.headers.get('x-tradarr-dispatch')||'',dispatch)))return json({error:'Unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const apiKey=Deno.env.get('TRADARR_RESEND_API_KEY'),from=Deno.env.get('TRADARR_EMAIL_FROM'),origin=Deno.env.get('TRADARR_SITE_ORIGIN');
 if(!url||!key||!apiKey||!from||!origin||Deno.env.get('TRADARR_EMAIL_ENABLED')!=='true')return json({error:'Email delivery is disabled or not configured'},503);
 try{renderEmail('job_status',origin);}catch{return json({error:'Invalid site origin'},503);}
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await admin.rpc('tradarr_claim_email_batch',{p_limit:5});
 if(error)return json({error:'Claim failed'},503);
 const counts={accepted:0,retry:0,failed:0,settlementErrors:0};
 for(const row of (data||[]) as Row[]){
  let status:'accepted'|'retry'|'failed'='retry',code='network_or_timeout',providerId:string|null=null;
  try{
   const template=renderEmail(row.event_kind,origin);
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'tradarr-email/'+row.outbox_id},
    body:JSON.stringify({from,to:[row.recipient_email],...template}),signal:AbortSignal.timeout(8000)
   });
   const result=await response.json().catch(()=>({}));
   if(response.ok&&typeof result.id==='string'){status='accepted';code='provider_accepted';providerId=result.id;}
   else if(response.ok){status='retry';code='ambiguous_provider_response';}
   else {status=retryableStatus(response.status,result.name)?'retry':'failed';code='http_'+response.status;}
  }catch{ /* retry with same idempotency key; no recipient data in logs */ }
  const settled=await admin.rpc('tradarr_settle_email',{p_id:row.outbox_id,p_token:row.claim_token,p_status:status,p_code:code,p_provider_id:providerId});
  if(settled.error||settled.data!==true)counts.settlementErrors++;
  else counts[status]++;
 }
 return json(counts,counts.settlementErrors?503:200);
});
