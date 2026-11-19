import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,AppState,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CheckCircle2,KeyRound,LockKeyhole,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import TradarrAdminHub from './TradarrAdminHub';

type Step='loading'|'denied'|'setup'|'enrolling'|'challenge'|'ready';
const C=theme.colors;

/**
 * Staff status is checked against the current auth.users record by RLS, and
 * sensitive reads/writes require aal2 (a fresh verified authenticator factor).
 * The password is never handled here; TOTP setup secrets stay only in memory.
 */
export default function TradarrAdminGateway({goBack,goToCustomer,goToTradesperson}:{
 goBack:()=>void;goToCustomer?:()=>void;goToTradesperson?:()=>void;
}){
 const [step,setStep]=useState<Step>('loading');
 const [factorId,setFactorId]=useState('');
 const [secret,setSecret]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const check=useCallback(async()=>{
  setError('');setStep('loading');
  try{
   const {data:{user},error:userError}=await supabase.auth.getUser();
   if(userError||user?.app_metadata?.tradarr_staff!==true){
    setStep('denied');return;
   }
   const [{data:aal,error:aalError},{data:factors,error:factorsError}]=await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors()
   ]);
   if(aalError||factorsError)throw aalError||factorsError;
   if(aal?.currentLevel==='aal2'){
    setCode('');setSecret('');setStep('ready');return;
   }
   const verified=factors?.totp?.[0];
   if(verified){setFactorId(verified.id);setSecret('');setStep('challenge');}
   else{setFactorId('');setSecret('');setStep('setup');}
  }catch(e:any){setError(e?.message||'Could not verify administrator access.');setStep('denied');}
 },[]);
 useEffect(()=>{void check();},[check]);
 // Revalidate staff status and MFA on return from the background. A revoked
 // administrator must not keep a previously mounted, privileged screen.
 useEffect(()=>{
  if(step!=='ready')return;
  const sub=AppState.addEventListener('change',state=>{
   if(state==='active')void check();
  });
  return()=>sub.remove();
 },[step,check]);
 const enroll=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.auth.mfa.enroll({
    factorType:'totp',friendlyName:'Tradarr Admin Gateway'
   });
   if(e||!data?.id||!data?.totp?.secret)throw e||new Error('Authenticator setup failed.');
   setFactorId(data.id);setSecret(data.totp.secret);setCode('');setStep('enrolling');
  }catch(e:any){setError(e?.message||'Could not start authenticator setup.');}
  finally{setBusy(false);}
 };
 const verify=async()=>{
  if(busy)return;
  const otp=code.trim();
  if(!/^\d{6}$/.test(otp)){
   Alert.alert('Invalid code','Enter the six digits shown in your authenticator app.');
   return;
  }
  setBusy(true);setError('');
  try{
   const {data:challenge,error:challengeError}=await supabase.auth.mfa.challenge({factorId});
   if(challengeError||!challenge?.id)
    throw challengeError||new Error('Could not create the security challenge.');
   const {error:e}=await supabase.auth.mfa.verify({
    factorId,challengeId:challenge.id,code:otp
   });
   if(e)throw e;
   const {data:aal,error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(aalError||aal?.currentLevel!=='aal2')
    throw aalError||new Error('Your second factor was not confirmed. Retry.');
   setCode('');setSecret('');setStep('ready');
  }catch(e:any){setCode('');setError(e?.message||'Incorrect code. Please try a fresh code.');}
  finally{setBusy(false);}
 };
 if(step==='ready')return <TradarrAdminHub goBack={goBack} goToCustomer={goToCustomer} goToTradesperson={goToTradesperson}/>;
 return <View style={s.root}>
  <View style={s.head}>
   <MotionPressable style={s.back} onPress={goBack} accessibilityRole="button" accessibilityLabel="Leave Admin Gateway">
    <ArrowLeft size={22} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.eyebrow}>TRADARR · RESTRICTED</Text>
    <Text style={s.heading}>Admin Gateway</Text>
   </View>
   <ShieldCheck color={C.teal} size={25}/>
  </View>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   <View style={s.hero}>
    <LockKeyhole size={30} color="#DDF1E9"/>
    <Text style={s.heroTitle}>Protected administration</Text>
    <Text style={s.heroText}>Your normal customer and tradesperson views remain available. Reviewing private evidence and support cases requires an extra authenticator check.</Text>
   </View>
   {error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null}
   {step==='loading'?<ActivityIndicator size="large" color={C.teal} style={{marginTop:34}}/>:null}
   {step==='denied'?<View style={s.card}>
    <Text style={s.cardTitle}>Staff access unavailable</Text>
    <Text style={s.muted}>This account either does not have an administrator role or access could not be verified. Your ordinary Tradarr account is unaffected.</Text>
    <MotionPressable style={s.secondary} onPress={()=>{void check()}}>
     <Text style={s.secondaryText}>Check access again</Text>
    </MotionPressable>
   </View>:null}
   {step==='setup'?<View style={s.card}>
    <Text style={s.cardTitle}>Secure your administrator access</Text>
    <Text style={s.muted}>Set up a six-digit authenticator on your iPhone or in a trusted password manager. Your account password alone cannot open the admin tools.</Text>
    <MotionPressable disabled={busy} style={s.primary} onPress={()=>{void enroll()}}>
     <KeyRound size={18} color="#FFFFFF"/>
     <Text style={s.primaryText}>{busy?'Preparing…':'Set up authenticator'}</Text>
    </MotionPressable>
   </View>:null}
   {step==='enrolling'?<View style={s.card}>
    <Text style={s.cardTitle}>Add Tradarr to your authenticator</Text>
    <Text style={s.muted}>Choose Add account, then Enter setup key manually. Use the name “Tradarr Admin”. This private key is shown only during setup.</Text>
    <View style={s.secret}>
     <Text style={s.eyebrow}>PRIVATE ONE-TIME SETUP KEY</Text>
     <Text selectable style={s.secretValue}>{secret}</Text>
    </View>
    <Text style={s.muted}>Enter the current six-digit code from the authenticator to finish enrollment.</Text>
   </View>:null}
   {(step==='enrolling'||step==='challenge')?<View style={s.card}>
    <Text style={s.cardTitle}>{step==='challenge'?'Confirm it’s you':'Confirm authenticator setup'}</Text>
    <TextInput value={code} onChangeText={v=>setCode(v.replace(/\D/g,'').slice(0,6))}
     keyboardType="number-pad" maxLength={6} style={s.code} placeholder="000000"
     placeholderTextColor="#9EAFA6" accessibilityLabel="Six-digit authenticator code"/>
    <MotionPressable disabled={busy||code.length!==6} onPress={()=>{void verify()}}
     style={[s.primary,(busy||code.length!==6)&&{opacity:.55}]}>
     {busy?<ActivityIndicator color="#FFFFFF"/>:<CheckCircle2 color="#FFFFFF" size={18}/>}
     <Text style={s.primaryText}>Verify and open gateway</Text>
    </MotionPressable>
    <MotionPressable disabled={busy} style={s.secondary} onPress={()=>{void check()}}>
     <Text style={s.secondaryText}>Restart security check</Text>
    </MotionPressable>
   </View>:null}
   <Text style={s.footer}>Never share an authenticator code, setup key or password with another person. This gateway is separate from customer and tradesperson testing.</Text>
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 head:{flexDirection:'row',gap:12,alignItems:'center',padding:18},
 back:{width:44,height:44,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',borderRadius:16},
 eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1,color:theme.colors.teal},
 heading:{fontSize:23,fontWeight:'900',color:theme.colors.ink},
 page:{paddingHorizontal:18,paddingBottom:110,gap:15},
 hero:{borderRadius:23,backgroundColor:theme.colors.darkTeal,padding:22,gap:13},
 heroTitle:{fontSize:22,fontWeight:'900',color:'#FFFFFF'},
 heroText:{fontSize:12,lineHeight:20,color:'#DEF0E9'},
 card:{padding:18,borderRadius:20,backgroundColor:'#FFFFFF',gap:15},
 cardTitle:{fontSize:16,fontWeight:'900',color:theme.colors.ink},
 muted:{fontSize:12,lineHeight:20,color:theme.colors.muted},
 primary:{minHeight:49,borderRadius:15,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',padding:12,backgroundColor:theme.colors.darkTeal},
 primaryText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},
 secondary:{minHeight:44,borderRadius:14,backgroundColor:'#EDF4F0',alignItems:'center',justifyContent:'center',padding:12},
 secondaryText:{fontSize:12,fontWeight:'800',color:theme.colors.teal},
 code:{borderWidth:1,borderColor:'#C8D9D1',borderRadius:14,minHeight:53,textAlign:'center',letterSpacing:8,fontSize:23,color:theme.colors.ink},
 secret:{padding:15,borderRadius:14,backgroundColor:'#F1F5F2',gap:9},
 secretValue:{fontWeight:'900',fontSize:17,color:theme.colors.ink,letterSpacing:1},
 error:{backgroundColor:'#FFF0E4',padding:13,borderRadius:14},
 errorText:{fontSize:12,color:'#9C4B34'},
 footer:{fontSize:11,lineHeight:19,color:theme.colors.muted,paddingHorizontal:8}
});
