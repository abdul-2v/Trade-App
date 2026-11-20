const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const nodeCrypto=require('node:crypto');
const source=fs.readFileSync('supabase/functions/tradarr-store-webhook/index.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;

const config={
 REVENUECAT_WEBHOOK_SIGNING_SECRET:'test-private-hmac-phrase',
 REVENUECAT_WEBHOOK_AUTHORIZATION:'Bearer test-private-auth',
 REVENUECAT_SECRET_API_KEY:'sk_test_private',
 REVENUECAT_ALLOWED_APP_IDS:'rc_apple_123,rc_google_456',
 SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'test-server-only-key'
};
let exposedHandler=null,ready=true,applied=[],requests=0,lookupCalls=0;
const user='c884200a-3e39-4c15-8843-d2ceaa312999';
const expires=new Date(Date.now()+29*86400*1000).toISOString();
const mockClient={
 from(table){
  const chain={
   select(){return chain;},eq(){return chain;},
   async maybeSingle(){
    if(table==='tradarr_billing_controls')
      return {data:{receipt_verifier_ready:ready,checkout_live:ready},error:null};
    if(table==='tradarr_store_product_catalog')
      return {data:{product_id:'tradarr.pro.monthly',kind:'subscription',tier:'pro'},error:null};
    throw Error('Unexpected read model '+table);
   }
  };return chain;
 },
 async rpc(name,args){
  assert.equal(name,'tradarr_finalize_verified_store_event');
  applied.push(args);return {data:'processed',error:null};
 }
};
let latestSubscriber={
 subscriptions:{'tradarr.pro.monthly':{store:'app_store'}},
 entitlements:{'tradarr_pro':{
  product_identifier:'tradarr.pro.monthly',expires_date:expires
 }}
};
const fakeRequire=name=>{
 if(name==='npm:@supabase/supabase-js@2.118.0')return {createClient:()=>mockClient};
 throw Error('Unexpected import '+name);
};
const Deno={
 env:{get:key=>config[key]},
 serve:handler=>{exposedHandler=handler;}
};
async function mockFetch(url){
 requests++;
 assert.match(url,/api.revenuecat.com\/v1\/subscribers\//);
 return {ok:true,async json(){return {subscriber:latestSubscriber};}};
}
const moduleRef={exports:{}};
new Function('require','module','exports','Deno','crypto','fetch',
 compiled)(fakeRequire,moduleRef,moduleRef.exports,Deno,nodeCrypto.webcrypto,mockFetch);
assert.equal(typeof exposedHandler,'function');
function request(body,{auth=config.REVENUECAT_WEBHOOK_AUTHORIZATION,
 badSignature=false,old=false,signature=true}={}){
 const raw=JSON.stringify(body);
 const t=Math.floor(Date.now()/1000)-(old?601:0);
 const mac=nodeCrypto.createHmac('sha256','test-private-hmac-phrase')
  .update(t+'.'+raw).digest('hex');
 return new Request('https://example.supabase.co/functions/v1/tradarr-store-webhook',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':auth,
   ...(signature?{'X-RevenueCat-Webhook-Signature':`t=${t},v1=${badSignature?'0'.repeat(64):mac}`}:{})},
  body:raw
 });
}
const event=(type='INITIAL_PURCHASE')=>({
 api_version:'1.0',
 event:{
  type,id:'event-real-test-001',app_id:'rc_apple_123',app_user_id:user,
  event_timestamp_ms:Date.now(),product_id:'tradarr.pro.monthly',
  transaction_id:'store-tx-123456789',original_transaction_id:'store-origin-123456789',
  environment:'PRODUCTION',store:'APP_STORE'
 }
});
(async()=>{
 const missing=config.REVENUECAT_WEBHOOK_SIGNING_SECRET;
 delete config.REVENUECAT_WEBHOOK_SIGNING_SECRET;
 assert.equal((await exposedHandler(request(event()))).status,503);
 config.REVENUECAT_WEBHOOK_SIGNING_SECRET=missing;
 assert.equal((await exposedHandler(request(event(),{auth:'Bearer wrong'}))).status,401);
 assert.equal((await exposedHandler(request(event(),{badSignature:true}))).status,401);
 assert.equal((await exposedHandler(request(event(),{old:true}))).status,401);
 assert.equal((await exposedHandler(request(event('TEST')))).status,200);
 assert.equal(applied.length,0,'Test webhooks must never grant Pro');
 ready=false;
 assert.equal((await exposedHandler(request(event()))).status,503);
 assert.equal(applied.length,0,'Disabled checkout must not grant Pro');
 ready=true;
 const response=await exposedHandler(request(event()));
 assert.equal(response.status,200);
 assert.equal(applied.length,1);
 assert.equal(applied[0].p_user_id,user);
 assert.equal(applied[0].p_event_type,'subscription_active');
 assert.equal(applied[0].p_product_id,'tradarr.pro.monthly');
 assert.equal(applied[0].p_provider,'apple');
 assert.ok(applied[0].p_verified_expiry);
 const bad=event();bad.event.app_user_id='user-chosen-string';
 assert.equal((await exposedHandler(request(bad))).status,422);
 const sandbox=event();sandbox.event.environment='SANDBOX';
 assert.equal((await exposedHandler(request(sandbox))).status,200);
 assert.equal(applied.length,1);
 const refund=event('CANCELLATION');
 refund.event.id='event-refund-test-002';
 refund.event.cancel_reason='CUSTOMER_SUPPORT';
 assert.equal((await exposedHandler(request(refund))).status,200);
 assert.equal(applied[1].p_event_type,'subscription_revoked',
  'A store-verified refund must not leave a future Pro subscription active');
 assert.equal(lookupCalls,0);
 console.log('Store webhook tests passed: missing secrets, HMAC, replay, disabled checkout, test/sandbox, provider sync and refund revocation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
