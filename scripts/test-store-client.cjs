// Purchase checks must never make the server's subscription enforcement
// depend on the RevenueCat SDK's locally cached entitlement.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
process.env.EXPO_PUBLIC_RC_IOS_KEY='appl_test_tradarr_public';
const source=fs.readFileSync('lib/storePurchases.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020
}}).outputText;
let currentUser='c884200a-3e39-4c15-8843-d2ceaa312999';
let checkoutLive=false,configureCalls=0,buyCalls=0,restoreCalls=0;
let configured=false,identity=null;
const pkg={identifier:'monthly',product:{
 identifier:'tradarr.pro.monthly',title:'Tradarr Pro Monthly',
 priceString:'£29.99',description:'Subscription product'
}};
const sdk={
 async isConfigured(){return configured;},
 configure(opts){configured=true;identity=opts.appUserID;configureCalls++;},
 async getAppUserID(){return identity;},
 async logIn(id){identity=id;},
 async getOfferings(){return {current:{availablePackages:[pkg]}};},
 async purchasePackage(){buyCalls++;return {customerInfo:{entitlements:{active:{
  tradarr_pro:{isActive:true}
 }}}};},
 async restorePurchases(){restoreCalls++;return {};}
};
const db={
 auth:{async getUser(){return {data:{user:{id:currentUser}},error:null};}},
 async rpc(name){assert.equal(name,'tradarr_my_pro_dashboard');
  return {data:[{checkout_live:checkoutLive}],error:null};}
};
const mod={exports:{}};
const requireMock=name=>{
 if(name==='expo-constants')return {__esModule:true,default:{appOwnership:'standalone'}};
 if(name==='react-native')return {Platform:{OS:'ios'}};
 if(name==='./supabase')return {supabase:db};
 if(name==='react-native-purchases')return {__esModule:true,default:sdk};
 throw Error('Unexpected module '+name);
};
new Function('require','module','exports',output)(requireMock,mod,mod.exports);
const {nativeStoreAvailability,getStoreOfferings,purchaseStorePackage,
 restoreStorePurchases}=mod.exports;
(async()=>{
 assert.equal(nativeStoreAvailability().configured,true);
 const disabled=await getStoreOfferings(currentUser);
 assert.deepEqual(disabled,[]);
 assert.equal(buyCalls,0);
 await assert.rejects(()=>purchaseStorePackage(currentUser,{productId:pkg.product.identifier,
 package:pkg}),/Payments are not enabled/);
 assert.equal(buyCalls,0,'No native charge when server billing switch is off');
 checkoutLive=true;
 const offers=await getStoreOfferings(currentUser);
 assert.equal(offers.length,1);
 assert.equal(offers[0].price,'£29.99','Price must come from store offering');
 assert.equal(configureCalls,1);
 const result=await purchaseStorePackage(currentUser,offers[0]);
 assert.equal(result,'submitted');
 assert.equal(buyCalls,1);
 const wrongAccount='a212331b-6820-44e1-a5d1-ecb541e10a21';
 await assert.rejects(()=>purchaseStorePackage(wrongAccount,offers[0]),/account changed/);
 assert.equal(buyCalls,1);
 const restore=await restoreStorePurchases(currentUser);
 assert.equal(restore,'submitted');
 assert.equal(restoreCalls,1);
 currentUser=wrongAccount;
 const other=await getStoreOfferings(currentUser);
 assert.equal(other.length,1,'Account switch is reconfigured without reusing prior account');
 assert.equal(identity,wrongAccount);
 assert.equal(buyCalls,1,'Switching identities does not make purchases');
 console.log('Store client tests passed: closed checkout, store price, actual purchase, restore and account isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
