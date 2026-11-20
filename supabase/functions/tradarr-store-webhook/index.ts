// Optional RevenueCat receipt-verification adapter for Tradarr.
// NEVER trust a mobile user to set a tier/boost or send a transaction directly.
// This endpoint is deliberately non-functional until the private RevenueCat
// HMAC, authorisation token, secret API key, app ID and store catalog exist.
// Direct Apple/Google verifier adapters can call the same service-only database
// finaliser without RevenueCat. No checkout is enabled by deploying this.
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';

const respond=(status:number,data:Record<string,unknown>)=>
 new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json','Cache-Control':'no-store'
 }});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const encode=new TextEncoder();
const object=(x:unknown):Record<string,unknown>=>x && typeof x==='object'&&!Array.isArray(x)
 ?x as Record<string,unknown>:{};
const string=(x:unknown)=>typeof x==='string'?x:'';
const timestamp=(x:unknown):number|null=>typeof x==='number'&&Number.isFinite(x)
 &&x>0?x:null;
function equalBytes(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)return false;
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
 return mismatch===0;
}
async function verifiedHmac(raw:Uint8Array,header:string,secret:string){
 const m=/^t=(\d{10,11}),v1=([a-f0-9]{64})$/i.exec(header.trim());
 if(!m)return false;
 const t=Number(m[1]);
 if(!Number.isSafeInteger(t)||Math.abs(Date.now()/1000-t)>300)return false;
 const key=await crypto.subtle.importKey('raw',encode.encode(secret),{
  name:'HMAC',hash:'SHA-256'
 },false,['sign']);
 const prefix=encode.encode(m[1]+'.');
 const data=new Uint8Array(prefix.length+raw.length);
 data.set(prefix);data.set(raw,prefix.length);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
 const got=Uint8Array.from(m[2].match(/../g)!.map(pair=>parseInt(pair,16)));
 return equalBytes(expected,got);
}
function expireValue(x:unknown){
 const ms=Date.parse(string(x));return Number.isFinite(ms)?ms:null;
}
async function lookupSubscriber(id:string,secret:string){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(id),{
   headers:{Authorization:'Bearer '+secret,Accept:'application/json'},
   signal:controller.signal
  });
  if(!response.ok)throw Error('Could not verify current purchase state with store provider');
  const data=await response.json();
  const subscriber=object(object(data).subscriber);
  if(!Object.keys(subscriber).length)throw Error('Missing verified subscriber record');
  return subscriber;
 }finally{clearTimeout(timeout);}
}
Deno.serve(async req=>{
 if(req.method!=='POST')return respond(405,{error:'POST required'});
 const signingSecret=Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET');
 const authToken=Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
 const apiKey=Deno.env.get('REVENUECAT_SECRET_API_KEY');
 const appId=Deno.env.get('REVENUECAT_APP_ID');
 const url=Deno.env.get('SUPABASE_URL');
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!signingSecret||!authToken||!apiKey||!appId||!url||!serviceKey)
   return respond(503,{error:'Store verification is not configured'});
 const auth=req.headers.get('Authorization')||'';
 if(!equalBytes(encode.encode(auth),encode.encode(authToken)))
   return respond(401,{error:'Unauthorised'});
 const raw=new Uint8Array(await req.arrayBuffer());
 if(raw.length===0||raw.length>65536)return respond(413,{error:'Invalid webhook payload'});
 if(!(await verifiedHmac(raw,req.headers.get('X-RevenueCat-Webhook-Signature')||'',signingSecret)))
   return respond(401,{error:'Webhook signature was not verified'});
 let payload:Record<string,unknown>;
 try{payload=object(JSON.parse(new TextDecoder().decode(raw)));}
 catch{return respond(400,{error:'Invalid JSON'});}
 const event=object(payload.event);
 const eventType=string(event.type),eventId=string(event.id),appUser=string(event.app_user_id);
 const productId=string(event.product_id),store=string(event.store);
 const source=string(event.environment);
 if(eventType==='TEST')return respond(200,{ok:true,test:true});
 // Never grant via revenuecat anonymous IDs, web billing, a different app,
 // an unknown store, unconfigured store product or a signed SANDBOX event
 // when the explicit test-only switch is off.
 if(string(event.app_id)!==appId)return respond(403,{error:'Unexpected store app'});
 if(!uuid.test(appUser)||eventId.length<6||eventId.length>200||productId.length>160)
   return respond(422,{error:'Unrecognised subscriber or event'});
 if(source!=='PRODUCTION'&&!(source==='SANDBOX'&&Deno.env.get('REVENUECAT_ALLOW_SANDBOX')==='true'))
   return respond(200,{ok:true,ignored:'sandbox'});
 const provider=store==='APP_STORE'?'apple':store==='PLAY_STORE'?'google':null;
 if(!provider)return respond(200,{ok:true,ignored:'non_mobile_store'});
 const eventAt=timestamp(event.event_timestamp_ms);
 const original=string(event.original_transaction_id)||string(event.transaction_id);
 if(!eventAt||!original||original.length<8||original.length>200)
   return respond(422,{error:'Invalid store event fields'});
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:billing,error:billingError}=await admin.from('tradarr_billing_controls')
  .select('receipt_verifier_ready,checkout_live').eq('singleton',true).maybeSingle();
 if(billingError||!billing?.receipt_verifier_ready||!billing?.checkout_live)
   return respond(503,{error:'Verified purchasing is not enabled'});
 const {data:product,error:productError}=await admin.from('tradarr_store_product_catalog')
  .select('product_id,kind,tier').eq('provider',provider).eq('product_id',productId)
  .eq('enabled',true).maybeSingle();
 if(productError)return respond(503,{error:'Store catalogue unavailable'});
 if(!product)return respond(200,{ok:true,ignored:'unknown_product'});
 // RevenueCat recommends confirming CURRENT subscriber state via the API,
 // rather than trusting lifecycle event order. No client payload is accepted.
 let subscriber:Record<string,unknown>;
 try{subscriber=await lookupSubscriber(appUser,apiKey);}
 catch{return respond(503,{error:'Could not verify subscriber with purchase provider'});}
 let normalized:string|null=null,expiry:string|null=null,purchasedAt:string|null=null;
 if(product.kind==='subscription'){
  if(['PRODUCT_CHANGE','TRANSFER','BILLING_ISSUE','SUBSCRIPTION_PAUSED'].includes(eventType))
    return respond(200,{ok:true,ignored:'non_entitlement_change'});
  if(!['INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','CANCELLATION',
     'EXPIRATION','SUBSCRIPTION_EXTENDED'].includes(eventType))
    return respond(200,{ok:true,ignored:'unhandled_subscription_event'});
  const sub=object(object(subscriber.subscriptions)[productId]);
  const expectedStore=provider==='apple'?'app_store':'play_store';
  if(sub.store && string(sub.store).toLowerCase()!==expectedStore)
    return respond(422,{error:'Subscription store mismatch'});
  const entitlementName=product.tier==='business'?
    (Deno.env.get('REVENUECAT_BUSINESS_ENTITLEMENT')||'tradarr_business'):
    (Deno.env.get('REVENUECAT_PRO_ENTITLEMENT')||'tradarr_pro');
  const entitlement=object(object(subscriber.entitlements)[entitlementName]);
  const currentExpiry=expireValue(entitlement.expires_date);
  const currentlyVerified=string(entitlement.product_identifier)===productId
    &&currentExpiry!==null&&currentExpiry>Date.now();
  if(['INITIAL_PURCHASE','RENEWAL','UNCANCELLATION','SUBSCRIPTION_EXTENDED'].includes(eventType)){
   if(!currentlyVerified)return respond(503,{error:'Subscription not yet confirmed by provider'});
   normalized='subscription_active';expiry=new Date(currentExpiry!).toISOString();
  }else if(eventType==='CANCELLATION'){
   const reason=string(event.cancel_reason);
   if(['CUSTOMER_SUPPORT','DEVELOPER_INITIATED','FRAUD'].includes(reason)){
    normalized='subscription_revoked';
   }else if(currentlyVerified){
    normalized='subscription_cancelled';expiry=new Date(currentExpiry!).toISOString();
   }else normalized='subscription_expired';
  }else{
   // An old expiration must not revoke a currently verified entitlement.
   if(currentlyVerified)return respond(200,{ok:true,ignored:'superseded_expiration'});
   normalized='subscription_expired';
  }
 }else if(product.kind==='boost'){
  if(eventType==='NON_RENEWING_PURCHASE'){
   const purchases=object(subscriber.non_subscriptions)[productId];
   const records=Array.isArray(purchases)?purchases:[];
   const transaction=string(event.transaction_id)||original;
   const matched=records.some(record=>{
    const r=object(record);
    return string(r.id)===transaction||string(r.transaction_id)===transaction;
   });
   if(!matched)return respond(503,{error:'Boost transaction is not verified in store history'});
   const purchaseMs=timestamp(event.purchased_at_ms);
   if(!purchaseMs)return respond(422,{error:'No verified boost purchase date'});
   purchasedAt=new Date(purchaseMs).toISOString();
   normalized='boost_purchased';
  }else if(eventType==='CANCELLATION'&&string(event.cancel_reason)==='CUSTOMER_SUPPORT'){
   normalized='boost_refunded';
  }else return respond(200,{ok:true,ignored:'not_a_boost_purchase'});
 }else return respond(200,{ok:true,ignored:'unrecognised_kind'});
 // Store event timestamps are supplied by RevenueCat, which was verified by
 // a private HMAC, and subscriber state was retrieved with a server-only key.
 const digest=await crypto.subtle.digest('SHA-256',raw);
 const payloadDigest=Array.from(new Uint8Array(digest))
  .map(x=>x.toString(16).padStart(2,'0')).join('');
 const {data:result,error:applyError}=await admin.rpc('tradarr_finalize_verified_store_event',{
  p_user_id:appUser,p_provider:provider,p_product_id:productId,
  p_transaction_id:product.kind==='boost'?(string(event.transaction_id)||original):original,
  p_event_id:eventId,p_event_type:normalized,
  p_provider_event_at:new Date(eventAt).toISOString(),
  p_verified_expiry:expiry,p_store_purchase_at:purchasedAt,
  p_payload_sha256:payloadDigest
 });
 if(applyError){
  console.error('Store finalizer failed',applyError.code);
  return respond(503,{error:'Verified event could not be processed'});
 }
 return respond(200,{ok:true,status:result});
});
