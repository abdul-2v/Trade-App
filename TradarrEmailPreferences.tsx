import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Modal,SafeAreaView,ScrollView,StyleSheet,Switch,Text,View} from 'react-native';
import {Mail,ChevronRight,X} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const fields=[["booking_updates","Bookings & reminders","Appointment confirmations, changes and reminders",true],["job_updates","Job updates","Job progress and Crew updates",true],["document_updates","Quotes & invoices","Updates to quotes and invoices",true],["message_reminders","Unread messages","Occasional reminders for unread chats",false],["opportunity_updates","Job opportunities","Relevant job invitations and journey matches",false]] as const;
type Key=typeof fields[number][0];
type Prefs=Record<Key,boolean>;
const defaults=Object.fromEntries(fields.map(([key,,,value])=>[key,value])) as Prefs;
export default function TradarrEmailPreferences(){
 const [open,setOpen]=useState(false),[prefs,setPrefs]=useState<Prefs|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const owner=useRef(''),version=useRef(0),saving=useRef(false);
 const load=async()=>{
  const v=++version.current;setPrefs(null);setError('');
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(v!==version.current)return;
  if(authError||!user){setError('Sign in to manage email preferences.');return;}
  owner.current=user.id;
  const {data,error}=await supabase.from('tradarr_email_preferences').select('booking_updates,job_updates,document_updates,message_reminders,opportunity_updates').eq('user_id',user.id).maybeSingle();
  if(v!==version.current)return;
  if(error){setError('Could not load preferences. Try again.');return;}
  setPrefs({...defaults,...data});
 };
 const close=()=>{version.current++;owner.current='';setOpen(false);setPrefs(null);};
 useEffect(()=>{
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){version.current++;owner.current='';setOpen(false);setPrefs(null);}});
  return()=>{version.current++;subscription.unsubscribe();};
 },[]);
 const save=async(key:Key,value:boolean)=>{
  if(saving.current||!prefs)return;
  const v=version.current,uid=owner.current;
  saving.current=true;setBusy(true);setError('');
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||user?.id!==uid||version.current!==v)throw new Error('Account changed. Reopen settings.');
   const {data,error}=await supabase.from('tradarr_email_preferences').upsert({user_id:uid,[key]:value},{onConflict:'user_id'}).select(key).single();
   if(error||!data)throw new Error('Could not save your email preference.');
   if(version.current===v)setPrefs(old=>old?{...old,[key]:value}:old);
  }catch(e:any){if(version.current===v)setError(e.message||'Could not save preference.');}
  finally{saving.current=false;setBusy(false);}
 };
 return <>
  <MotionPressable style={s.entry} onPress={()=>{setOpen(true);void load();}} accessibilityRole="button" accessibilityLabel="Email preferences">
   <Mail size={19} color={theme.colors.teal}/><Text style={s.title}>Email preferences</Text><ChevronRight size={18} color={theme.colors.teal}/>
  </MotionPressable>
  <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
   <SafeAreaView style={s.page}><View style={s.head}><Text style={s.heading}>Email preferences</Text><MotionPressable style={s.close} onPress={close} accessibilityRole="button" accessibilityLabel="Close email preferences"><X size={22} color={theme.colors.teal}/></MotionPressable></View>
    <ScrollView contentContainerStyle={{padding:18,gap:14}}>
     <Text style={s.note}>Choose which service updates you want by email. Changes apply to your app and website account. Important security and support notices are separate.</Text>
     {!prefs&&!error?<ActivityIndicator color={theme.colors.teal}/>:null}
     {error?<Text accessibilityRole="alert" style={s.note}>{error}</Text>:null}
     {!prefs&&error?<MotionPressable onPress={()=>void load()} style={s.entry} accessibilityRole="button"><Text style={s.title}>Try again</Text></MotionPressable>:null}
     {prefs?fields.map(([key,label,detail])=><View key={key} style={s.row}><View style={{flex:1,gap:4}}><Text style={s.title}>{label}</Text><Text style={s.note}>{detail}</Text></View><Switch accessibilityLabel={label} value={prefs[key]} disabled={busy} onValueChange={value=>void save(key,value)} trackColor={{true:theme.colors.teal}}/></View>):null}
     <Text style={s.note}>Email delivery depends on service availability. Activity remains available inside Tradarr.</Text>
    </ScrollView>
   </SafeAreaView>
  </Modal>
 </>;
}
const s=StyleSheet.create({
 entry:{marginHorizontal:16,marginBottom:12,minHeight:44,borderRadius:15,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.colors.white},
 title:{fontSize:14,fontWeight:'800',color:theme.colors.ink,flexShrink:1,flexGrow:1},
 page:{flex:1,backgroundColor:theme.colors.proBackground},
 head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18,paddingVertical:10,backgroundColor:theme.colors.white},
 heading:{fontSize:21,fontWeight:'800',color:theme.colors.ink},
 close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 row:{backgroundColor:theme.colors.white,borderRadius:17,padding:14,flexDirection:'row',alignItems:'center',gap:12},
 note:{fontSize:13,lineHeight:19,color:theme.colors.muted}
});
