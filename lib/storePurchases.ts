import Constants from 'expo-constants';
import {Platform} from 'react-native';
import type {PurchasesPackage} from 'react-native-purchases';
import {supabase} from './supabase';

export type StoreOffer={
 id:string;
 productId:string;
 name:string;
 description:string;
 price:string;
 package:PurchasesPackage;
};
export type StoreBillingState={
 supported:boolean;
 configured:boolean;
 message:string;
};

const APPLE_PUBLIC_KEY=process.env.EXPO_PUBLIC_RC_IOS_KEY?.trim();
const GOOGLE_PUBLIC_KEY=process.env.EXPO_PUBLIC_RC_ANDROID_KEY?.trim();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let identityQueue:Promise<unknown>=Promise.resolve();

export function nativeStoreAvailability():StoreBillingState{
 if(Platform.OS!=='ios'&&Platform.OS!=='android')
  return {supported:false,configured:false,message:'Purchases require the iOS or Android app.'};
 if(Constants.appOwnership==='expo')
  return {supported:false,configured:false,
    message:'Real purchases and restoration require a native Tradarr development or store build, not Expo Go.'};
 const key=Platform.OS==='ios'?APPLE_PUBLIC_KEY:GOOGLE_PUBLIC_KEY;
 if(!key)
  return {supported:true,configured:false,
   message:'Store purchases are not configured for this phone yet.'};
 if(!key.startsWith(Platform.OS==='ios'?'appl_':'goog_'))
  return {supported:true,configured:false,
   message:'The public store configuration is invalid.'};
 return {supported:true,configured:true,message:'Store SDK is configured for this platform.'};
}
function ensureUUID(userId:string){
 if(!UUID.test(userId))throw Error('A signed-in Tradarr account is required for purchases.');
}
async function verifyCurrentUser(userId:string){
 ensureUUID(userId);
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||user?.id!==userId)throw Error('The signed-in account changed. Please sign in again.');
}
async function ensureStoreIdentity(userId:string){
 const check=nativeStoreAvailability();
 if(!check.supported||!check.configured)throw Error(check.message);
 await verifyCurrentUser(userId);
 // Serialise configure/logIn calls so switching accounts cannot attach a
 // transaction to the previous account's cached RevenueCat identity.
 const task=identityQueue.then(async()=>{
  const {default:Purchases}=await import('react-native-purchases');
  const key=Platform.OS==='ios'?APPLE_PUBLIC_KEY!:GOOGLE_PUBLIC_KEY!;
  if(!(await Purchases.isConfigured()))Purchases.configure({
    apiKey:key,appUserID:userId
  });
  else if((await Purchases.getAppUserID())!==userId){
    await Purchases.logIn(userId);
  }
  if((await Purchases.getAppUserID())!==userId)
    throw Error('Could not verify the store account identity.');
  await verifyCurrentUser(userId);
  return Purchases;
 });
 identityQueue=task.then(()=>undefined,()=>undefined);
 return task;
}
export async function getStoreOfferings(userId:string):Promise<StoreOffer[]>{
 const Purchases=await ensureStoreIdentity(userId);
 const {data,error}=await supabase.rpc('tradarr_my_pro_dashboard');
 const status=Array.isArray(data)?data[0]:null;
 if(error||!status?.checkout_live)return [];
 const offerings=await Purchases.getOfferings();
 const packages=offerings.current?.availablePackages||[];
 return packages.map(pkg=>({
  id:pkg.identifier,
  productId:pkg.product.identifier,
  name:pkg.product.title||'Tradarr membership',
  description:pkg.product.description||'',
  price:pkg.product.priceString,
  package:pkg
 }));
}
export async function purchaseStorePackage(userId:string,offer:StoreOffer):Promise<'submitted'|'cancelled'>{
 if(!offer?.package||!offer.productId)throw Error('Select a valid product.');
 await verifyCurrentUser(userId);
 // NEVER show a native checkout if Supabase says billing is closed, even if
 // old RevenueCat offerings remain cached.
 const {data,error}=await supabase.rpc('tradarr_my_pro_dashboard');
 const status=Array.isArray(data)?data[0]:null;
 if(error||!status?.checkout_live)throw Error('Payments are not enabled for Tradarr yet.');
 const Purchases=await ensureStoreIdentity(userId);
 try{
  await Purchases.purchasePackage(offer.package);
 }catch(e:any){
  if(e?.userCancelled===true)return 'cancelled';
  throw Error(e?.message||'The purchase could not be completed.');
 }
 // A store SDK response is never a trusted entitlement. Only the existing
 // server-verified event handler can update tradarr_memberships.
 await verifyCurrentUser(userId);
 return 'submitted';
}
export async function restoreStorePurchases(userId:string):Promise<'submitted'>{
 const Purchases=await ensureStoreIdentity(userId);
 await Purchases.restorePurchases();
 await verifyCurrentUser(userId);
 // Do not infer success from RevenueCat's local CustomerInfo. The server's
 // verified subscription record remains the single source for Pro access.
 return 'submitted';
}
