import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,BadgeCheck,Check,ChevronRight,Crown,LockKeyhole,RefreshCw,Rocket,ShieldCheck,Sparkles} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {
 getStoreOfferings,nativeStoreAvailability,purchaseStorePackage,
 restoreStorePurchases,getStoreBoosts,purchaseStoreBoost,type StoreOffer,type StoreBoost
} from './lib/storePurchases';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type ProStatus={
 tier:'free'|'pro'|'business';
 membership_status:string;
 expires_at:string|null;
 pro_access:boolean;
 checkout_live:boolean;
 enforcement_live:boolean;
 free_monthly_accepts:number;
 accepts_used:number;
 accepts_remaining:number;
 boosts_live:boolean;
 active_boosts:number;
 next_boost_expires_at:string|null;
};
const C=theme.colors;
const FREE_ITEMS=['Basic public business profile','Keep verified reviews and business details',
 'Explore opportunities and manage your account'];
const PRO_ITEMS=['Full access to matched opportunities','Enhanced business visibility',
 'Advanced job planning, diary and business tools','Business performance insights'];
/**
 * A deliberately honest sales-readiness screen: no simulated subscriptions,
 * no direct Stripe shortcut inside the iOS app, no purchases until platform
 * products and server receipt verification are configured.
 */
export default function TradarrProScreen({goBack}:{goBack:()=>void}){
 const [status,setStatus]=useState<ProStatus|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const requestSerial=useRef(0);
 const [offers,setOffers]=useState<StoreOffer[]>([]);
 const [boostOffers,setBoostOffers]=useState<StoreBoost[]>([]);
 const [offersBusy,setOffersBusy]=useState(false);
 const [checkoutBusy,setCheckoutBusy]=useState(false);
 const [storeError,setStoreError]=useState('');
 const [storeMessage,setStoreMessage]=useState('');
 const storeAvailability=nativeStoreAvailability();
 const refresh=useCallback(async()=>{
  const request=++requestSerial.current;
  // A sign-out or account switch must never display the prior user's tier.
  setStatus(null);setOffers([]);setBoostOffers([]);setBusy(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw new Error('Sign in to check your account.');
   const {data,error:queryError}=await supabase.rpc('tradarr_my_pro_dashboard');
   if(queryError)throw queryError;
   const row=Array.isArray(data)?data[0] as ProStatus|undefined:undefined;
   if(!row)throw new Error('Your membership could not be checked. Try again.');
   const {data:{user:stillSignedIn}}=await supabase.auth.getUser();
   if(request!==requestSerial.current || stillSignedIn?.id!==user.id)return;
   setStatus(row);setError('');
  }catch(e:any){
   if(request===requestSerial.current)setError(e?.message||'Unable to load your subscription status.');
  }finally{if(request===requestSerial.current)setBusy(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const sub=AppState.addEventListener('change',v=>{if(v==='active')void refresh();});
  return()=>{sub.remove();requestSerial.current++;};
 },[refresh]);
 useEffect(()=>{
  if(!status?.checkout_live)return;
  let mounted=true;
  setOffersBusy(true);setOffers([]);setBoostOffers([]);setStoreError('');
  void (async()=>{
   try{
    if(!storeAvailability.supported||!storeAvailability.configured)
      throw Error(storeAvailability.message);
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)throw Error('Sign in to view purchase options.');
    const [results,boostResults]=await Promise.all([
      getStoreOfferings(user.id),
      status.boosts_live?getStoreBoosts(user.id):Promise.resolve([])
    ]);
    const {data:{user:stillCurrent}}=await supabase.auth.getUser();
    if(!mounted||stillCurrent?.id!==user.id)return;
    setOffers(results);setBoostOffers(boostResults);
    if(!results.length)setStoreError('No store products are currently available. Purchases have not been enabled for this device.');
   }catch(e:any){
    if(mounted)setStoreError(e?.message||'Could not load App Store products.');
   }finally{if(mounted)setOffersBusy(false);}
  })();
  return()=>{mounted=false;};
 },[status?.checkout_live,status?.boosts_live,storeAvailability.supported,storeAvailability.configured]);
 const processPurchase=async(offer:StoreOffer)=>{
  if(checkoutBusy)return;
  setCheckoutBusy(true);setStoreError('');setStoreMessage('');
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw Error('Sign in to purchase.');
   const result=await purchaseStorePackage(user.id,offer);
   if(result==='cancelled')setStoreMessage('Purchase cancelled. No change to your membership.');
   else{
    setStoreMessage('Purchase submitted. Your Pro access will update once the secure store confirmation reaches Tradarr.');
    void refresh();
   }
  }catch(e:any){setStoreError(e?.message||'Could not complete the purchase.');}
  finally{setCheckoutBusy(false);}
 };
 const processBoost=async(boost:StoreBoost)=>{
  if(checkoutBusy)return;
  setCheckoutBusy(true);setStoreError('');setStoreMessage('');
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw Error('Sign in before buying a boost.');
   const result=await purchaseStoreBoost(user.id,boost);
   if(result==='cancelled')setStoreMessage('Boost purchase cancelled.');
   else{
    setStoreMessage('Boost purchase submitted. Paid visibility only begins when the store verifies it on the Tradarr server.');
    void refresh();
   }
  }catch(e:any){setStoreError(e?.message||'Could not purchase the profile boost.');}
  finally{setCheckoutBusy(false);}
 };
 const processRestore=async()=>{
  if(checkoutBusy)return;
  setCheckoutBusy(true);setStoreError('');setStoreMessage('');
  try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw Error('Sign in to restore purchases.');
   await restoreStorePurchases(user.id);
   setStoreMessage('Store purchase history checked. Eligible access will appear after secure verification. Tap refresh to check again.');
   void refresh();
  }catch(e:any){setStoreError(e?.message||'Could not restore store purchases.');}
  finally{setCheckoutBusy(false);}
 };
 const active=Boolean(status?.pro_access);
 const current=active?(status?.tier==='business'?'Tradarr Business':'Tradarr Pro'):'Free account';
 return <View style={S.root}>
  <View style={S.header}>
   <MotionPressable style={S.back} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back to trade profile">
    <ArrowLeft size={22} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={S.eyebrow}>TRADARR · MEMBERSHIPS</Text>
    <Text style={S.title}>Grow with Pro</Text>
   </View>
   <MotionPressable style={S.back} onPress={()=>{void refresh()}} disabled={busy}
    accessibilityRole="button" accessibilityLabel="Refresh membership status">
    {busy?<ActivityIndicator size="small" color={C.teal}/>:<RefreshCw size={19} color={C.teal}/>}
   </MotionPressable>
  </View>
  <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
   <View style={S.hero}>
    <View style={S.heroTop}><Crown size={24} color="#EED2A2"/><Text style={S.heroEyebrow}>TRADARR PRO</Text></View>
    <Text style={S.heroTitle}>Your business. More opportunities.</Text>
    <Text style={S.heroText}>A simple subscription for serious tradespeople, with no Tradarr commission on completed jobs.</Text>
    <View style={S.heroInset}>
     <Text style={S.heroInsetLabel}>YOUR CURRENT ACCESS</Text>
     <Text style={S.heroInsetTitle}>{busy?'Checking…':current}</Text>
     {status?.expires_at&&active?<Text style={S.heroInsetNote}>Access valid until {new Date(status.expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</Text>:null}
     {!active&&!busy?<Text style={S.heroInsetNote}>No active Pro subscription on this account.</Text>:null}
    </View>
   </View>
   {error?<View style={S.warning}><Text style={S.warningText}>{error}</Text>
     <MotionPressable style={S.retry} onPress={()=>{void refresh()}} accessibilityRole="button">
       <Text style={S.retryText}>Retry membership check</Text>
     </MotionPressable></View>:null}
   <Text style={S.sectionTitle}>Membership options</Text>
   <View style={S.free}>
    <View style={S.cardHeading}><View style={S.freeIcon}><BadgeCheck size={21} color={C.teal}/></View>
     <View style={{flex:1}}><Text style={S.cardTitle}>Free tradesperson</Text>
       <Text style={S.small}>A basic presence on Tradarr</Text></View>
     <Text style={S.price}>£0</Text>
    </View>
    {FREE_ITEMS.map(item=><View key={item} style={S.item}><Check size={16} color={C.teal}/><Text style={S.itemText}>{item}</Text></View>)}
    <View style={S.allowanceBox}>
      <Text style={S.allowanceHeading}>New job acceptance allowance</Text>
      <Text style={S.allowanceText}>
        {status?.enforcement_live
          ? active?'Unlimited with your active membership':
            `${status.accepts_remaining} of ${status.free_monthly_accepts} acceptances remaining this UTC month`
          : `Proposed free tier: ${status?.free_monthly_accepts??3} new job acceptances per month. Not enforced during development.`}
      </Text>
      {status?.enforcement_live&&!active&&status.free_monthly_accepts>0?
        <View style={S.progressTrack}><View style={[S.progressFill,{
          width:`${Math.min(100,100*status.accepts_used/status.free_monthly_accepts)}%`
        }]}/></View>:null}
    </View>
    <Text style={S.foot}>Accepting an urgent, normal or flexible offer uses the same monthly allowance once restrictions launch. Declining offers is free. Existing bookings, messages, reviews and account safety remain available.</Text>
   </View>
   <View style={S.pro}>
    <View style={S.cardHeading}><View style={S.proIcon}><Sparkles size={22} color="#FFFFFF"/></View>
     <View style={{flex:1}}><Text style={S.cardTitle}>Tradarr Pro</Text>
      <Text style={S.small}>Designed to help your business grow</Text></View>
     <Rocket size={22} color={C.coral}/>
    </View>
    {PRO_ITEMS.map(item=><View key={item} style={S.item}><Check size={16} color={C.teal}/><Text style={S.itemText}>{item}</Text></View>)}
    {status?.checkout_live ? (
      <View style={{gap:10}}>
       <Text style={S.small}>Subscription products and prices below are loaded directly from your app store. Your account will only be upgraded after Tradarr verifies payment on its server.</Text>
       {offersBusy?<ActivityIndicator color={C.teal} size="small"/>:null}
       {offers.map(offer=>(
        <MotionPressable key={offer.id} onPress={()=>{void processPurchase(offer)}}
         accessibilityRole="button" accessibilityLabel={'Purchase '+offer.name+' for '+offer.price}
         disabled={checkoutBusy||offersBusy||busy}
         style={S.storeOffer}>
          <View style={{flex:1,gap:3}}>
           <Text style={S.cardTitle}>{offer.name}</Text>
           <Text style={S.small}>{offer.description||'Subscription product from your app store'}</Text>
           <Text style={S.foot}>Auto-renewal and final billing terms appear in the store confirmation.</Text>
          </View>
          <Text style={S.offerPrice}>{offer.price}</Text>
          <ChevronRight size={18} color="#FFFFFF"/>
        </MotionPressable>
       ))}
      </View>
     ):(
      <View style={S.status}>
       <LockKeyhole size={18} color={C.teal}/>
       <Text style={S.statusText}>Subscriptions are not on sale yet. Confirmed prices and App Store / Google Play checkout will appear when secure purchasing is enabled.</Text>
      </View>
     )}
    {(storeError||storeMessage)?<View style={S.warning}>
      <Text style={S.warningText}>{storeError||storeMessage}</Text>
    </View>:null}
    <MotionPressable onPress={()=>{void processRestore()}} disabled={checkoutBusy||busy||
     !storeAvailability.supported||!storeAvailability.configured}
     accessibilityRole="button" accessibilityLabel="Restore purchases linked to your store account"
     style={[S.restore,{opacity:storeAvailability.supported&&storeAvailability.configured?1:.55}]}>
      {checkoutBusy?<ActivityIndicator size="small" color={C.teal}/>:<RefreshCw size={16} color={C.teal}/>}
      <Text style={S.restoreText}>Restore purchases</Text>
    </MotionPressable>
    {!storeAvailability.supported||!storeAvailability.configured?
      <Text style={S.foot}>{storeAvailability.message}</Text>:null}
   </View>
   <View style={S.extras}>
    <View style={S.extrasTitle}><Sparkles color={C.coral} size={20}/>
     <Text style={S.cardTitle}>Profile Boosts</Text></View>
    <Text style={S.small}>Optional, clearly labelled promoted visibility is planned as a separate purchase. Tradarr will never deduct commission from the money you earn on jobs.</Text>
    <View style={S.allowanceBox}>
      <Text style={S.allowanceHeading}>Your active boosts</Text>
      <Text style={S.allowanceText}>{status?.boosts_live?
        `${status.active_boosts} active`:'Not available to purchase yet · no boosts running'}</Text>
      {status?.boosts_live&&status.next_boost_expires_at?
        <Text style={S.foot}>Next boost expires {new Date(status.next_boost_expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</Text>:null}
    </View>
    {status?.boosts_live&&boostOffers.length ? boostOffers.map(boost=>(
      <MotionPressable key={boost.productId} onPress={()=>{void processBoost(boost)}}
        disabled={checkoutBusy||busy||offersBusy}
        accessibilityRole="button"
        accessibilityLabel={'Purchase a '+boost.days+'-day profile boost for '+boost.price}
        style={S.storeOffer}>
        <View style={{flex:1,gap:4}}>
         <Text style={{color:'#FFFFFF',fontSize:13,fontWeight:'900'}}>{boost.name}</Text>
         <Text style={{color:'#D6E9E2',fontSize:11}}>{boost.days} days · Promoted label · no guaranteed job enquiries</Text>
        </View>
        <Text style={S.offerPrice}>{boost.price}</Text>
        <ChevronRight size={18} color="#FFFFFF"/>
      </MotionPressable>
    )):null}
    <Text style={S.foot}>{status?.boosts_live
      ? 'Only approved verified boost products can be purchased. Store confirmation and server verification are required.'
      : 'Boost prices and durations still need approval. No profile receives paid positioning until purchases are verified and the launch switch is enabled.'}</Text>
   </View>
   <View style={S.disclaimer}>
    <ShieldCheck size={19} color={C.teal}/>
    <Text style={S.disclaimerText}>Your current tools remain usable while billing enforcement is off. No payment or upgrade will be recorded from this screen.</Text>
   </View>
  </ScrollView>
 </View>;
}
const S=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},
 header:{padding:16,flexDirection:'row',alignItems:'center',gap:12},
 back:{width:44,height:44,borderRadius:15,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:'900',color:C.teal},
 title:{fontSize:24,fontWeight:'900',color:C.ink},
 content:{paddingHorizontal:16,paddingBottom:80,gap:14},
 hero:{borderRadius:25,backgroundColor:C.darkTeal,padding:22,gap:14},
 heroTop:{flexDirection:'row',alignItems:'center',gap:9},
 heroEyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.1,color:'#EED2A2'},
 heroTitle:{fontSize:28,lineHeight:35,fontWeight:'900',color:'#FFFFFF',maxWidth:290},
 heroText:{fontSize:13,lineHeight:21,color:'#D5E7E1'},
 heroInset:{borderRadius:16,padding:14,backgroundColor:'#FFFFFF18',gap:5},
 heroInsetLabel:{fontSize:10,letterSpacing:1,fontWeight:'900',color:'#C8DFD7'},
 heroInsetTitle:{color:'#FFFFFF',fontWeight:'900',fontSize:17},
 heroInsetNote:{color:'#D5E7E1',fontSize:11,lineHeight:18},
 sectionTitle:{fontWeight:'900',fontSize:16,color:C.ink,marginTop:5},
 free:{backgroundColor:'#FFFFFF',padding:18,borderRadius:22,gap:12,borderWidth:1,borderColor:'#E3EBE7'},
 pro:{backgroundColor:'#FFFFFF',padding:18,borderRadius:22,gap:12,borderWidth:2,borderColor:C.teal},
 cardHeading:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:4},
 cardTitle:{color:C.ink,fontSize:16,fontWeight:'900'},
 small:{color:C.muted,fontSize:12,lineHeight:19},
 freeIcon:{width:42,height:42,borderRadius:14,backgroundColor:C.tealTint,justifyContent:'center',alignItems:'center'},
 proIcon:{width:42,height:42,borderRadius:14,backgroundColor:C.darkTeal,justifyContent:'center',alignItems:'center'},
 price:{color:C.ink,fontWeight:'900',fontSize:21},
 item:{flexDirection:'row',alignItems:'flex-start',gap:9},
 itemText:{fontSize:12,lineHeight:19,color:C.ink,flex:1},
 foot:{fontSize:11,lineHeight:18,color:C.muted},
 status:{flexDirection:'row',padding:13,backgroundColor:'#EAF4EF',borderRadius:14,gap:9,alignItems:'flex-start'},
 statusText:{fontSize:11,lineHeight:18,color:C.teal,flex:1},
 extras:{backgroundColor:'#FFFFFF',borderRadius:21,padding:18,gap:11},
 extrasTitle:{flexDirection:'row',alignItems:'center',gap:9},
 allowanceBox:{borderRadius:13,padding:13,backgroundColor:'#F1F7F4',gap:7},
 allowanceHeading:{fontWeight:'900',fontSize:12,color:C.ink},
 allowanceText:{fontSize:11,lineHeight:18,color:C.teal},
 progressTrack:{height:8,backgroundColor:'#D8E6E1',borderRadius:6,overflow:'hidden'},
 progressFill:{backgroundColor:C.teal,height:8,borderRadius:6},
 storeOffer:{backgroundColor:C.darkTeal,borderRadius:15,padding:14,gap:9,
  flexDirection:'row',alignItems:'center'},
 offerPrice:{color:'#FFFFFF',fontWeight:'900',fontSize:16},
 restore:{minHeight:43,borderRadius:13,borderWidth:1,borderColor:'#B7D4CC',
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:10},
 restoreText:{fontSize:12,fontWeight:'900',color:C.teal},
 disclaimer:{padding:12,flexDirection:'row',gap:9,alignItems:'flex-start'},
 disclaimerText:{fontSize:11,lineHeight:19,flex:1,color:C.muted},
 warning:{backgroundColor:'#FFF0E8',padding:14,borderRadius:15,gap:10},
 warningText:{color:C.coralDark,fontSize:12},
 retry:{alignSelf:'flex-start',backgroundColor:C.darkTeal,padding:11,borderRadius:12},
 retryText:{color:'#FFFFFF',fontSize:12,fontWeight:'800'}
});
