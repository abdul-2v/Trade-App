import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarClock,CheckCircle2,Clock3,Save} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

const C=theme.colors;
type Day={weekday:number;name:string;enabled:boolean;start:string;end:string};
const defaults:Day[]=[
 {weekday:1,name:'Monday',enabled:true,start:'08:00',end:'18:00'},
 {weekday:2,name:'Tuesday',enabled:true,start:'08:00',end:'18:00'},
 {weekday:3,name:'Wednesday',enabled:true,start:'08:00',end:'18:00'},
 {weekday:4,name:'Thursday',enabled:true,start:'08:00',end:'18:00'},
 {weekday:5,name:'Friday',enabled:true,start:'08:00',end:'18:00'},
 {weekday:6,name:'Saturday',enabled:false,start:'09:00',end:'15:00'},
 {weekday:0,name:'Sunday',enabled:false,start:'09:00',end:'15:00'},
];
const validTime=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const toMinute=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));

export default function TradeWorkingHoursScreen({goBack}:{goBack:()=>void}){
 const [userId,setUserId]=useState('');
 const [rows,setRows]=useState<Day[]>(defaults);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [published,setPublished]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [error,setError]=useState('');
 const [loadFailed,setLoadFailed]=useState(false);

 useEffect(()=>{let active=true;(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!active)return;
  if(!user){setError('Sign in to publish your availability.');setLoading(false);return;}
  setUserId(user.id);
  const {data,error:loadError}=await supabase.from('trade_working_hours')
   .select('weekday,enabled,start_local,end_local').eq('tradesperson_id',user.id);
  if(!active)return;
  if(loadError){setError('Your working hours could not be loaded: '+loadError.message);
   setLoadFailed(true);setLoading(false);return;}
  setLoadFailed(false);
  if(data?.length){
   const saved=new Map(data.map(v=>[Number(v.weekday),v]));
   setRows(defaults.map(day=>{
    const found=saved.get(day.weekday);
    return found?{...day,enabled:Boolean(found.enabled),
      start:String(found.start_local).slice(0,5),end:String(found.end_local).slice(0,5)}:day;
   }));
   setPublished(true);
  }
  setLoading(false);
 })().catch(e=>{if(active){setError(String(e));setLoading(false)}});
 return()=>{active=false};},[]);

 const update=(weekday:number,patch:Partial<Day>)=>{
  setRows(old=>old.map(day=>day.weekday===weekday?{...day,...patch}:day));
  setDirty(true);
  setError('');
 };
 const weekdayPreset=()=>{
   setRows(old=>old.map(d=>d.weekday>=1&&d.weekday<=5
     ?{...d,enabled:true,start:'08:00',end:'18:00'}:d));
   setDirty(true);setError('');
 };
 const save=async()=>{
  if(saving||!userId||loadFailed)return;
  for(const row of rows){
   // Closed days have no bookable interval; their saved example times are irrelevant.
   if(row.enabled&&(!validTime(row.start)||!validTime(row.end) || toMinute(row.end)<=toMinute(row.start))){
    Alert.alert('Check working hours',row.name+': enter HH:MM times and make sure closing time is after opening time.');return;
   }
  }
  setSaving(true);
  const {data:saved,error:saveError}=await supabase.from('trade_working_hours').upsert(
   rows.map(row=>({
    tradesperson_id:userId,weekday:row.weekday,enabled:row.enabled,
    start_local:row.start,end_local:row.end,updated_at:new Date().toISOString()
   })),{onConflict:'tradesperson_id,weekday'}
  ).select('weekday,enabled,start_local,end_local');
  setSaving(false);
  if(saveError||!saved||saved.length!==rows.length){
    Alert.alert('Could not confirm working hours',
      saveError?.message||'The full weekly schedule was not confirmed. Please try again.');
    return;
  }
  setPublished(true);setDirty(false);
  Alert.alert('Working hours saved','Customers can now see suggested openings around your existing confirmed bookings. Every appointment still needs your acceptance.');
 };

 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable style={s.back} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back to business tools">
    <ArrowLeft size={23} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.eyebrow}>YOUR DIARY</Text>
    <Text style={s.title}>Working hours</Text>
   </View>
   {published?<CheckCircle2 size={22} color={C.teal}/>:null}
  </View>
  {loading?<ActivityIndicator style={{marginTop:55}} color={C.teal} size="large"/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
   <View style={s.intro}>
    <CalendarClock size={26} color={C.teal}/>
    <View style={{flex:1,gap:5}}>
     <Text style={s.introTitle}>{dirty?'Unsaved schedule changes':published?'Availability is published':'Publish a weekly schedule'}</Text>
     <Text style={s.note}>Set the hours you normally accept appointments. Tradarr then suggests openings that do not overlap your confirmed diary bookings. These are requests, not automatic reservations.</Text>
    </View>
   </View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {loadFailed?<View style={s.errorCard}>
     <Text style={s.error}>The editor is disabled until saved hours can be checked, so nothing existing is overwritten accidentally.</Text>
     <MotionPressable onPress={goBack} style={s.smallAction} accessibilityRole="button">
       <Text style={s.smallActionText}>Back to Tools</Text>
     </MotionPressable>
    </View>:<>
   <View style={s.helpRow}>
     <Text style={s.note}>Use the toggles to mark days open or closed. Edit the hours for any open day.</Text>
     <MotionPressable onPress={weekdayPreset} style={s.smallAction} accessibilityRole="button"
       accessibilityLabel="Set Monday to Friday 8 am to 6 pm">
       <Text style={s.smallActionText}>Mon–Fri preset</Text>
     </MotionPressable>
   </View>
   <View style={s.card}>
    <View style={s.labels}>
     <Text style={s.heading}>Your weekly opening times</Text>
     <Text style={s.heading}>{rows.filter(x=>x.enabled).length} days on</Text>
    </View>
    {rows.map((day,index)=><View key={day.weekday}
      style={[s.day,index!==0&&{borderTopWidth:1,borderTopColor:C.line}]}>
      <View style={s.dayHead}>
       <Switch value={day.enabled} onValueChange={value=>update(day.weekday,{enabled:value})}
        trackColor={{false:'#B8C7C3',true:C.teal}} accessibilityLabel={day.name+' availability'}/>
       <View style={{flex:1}}>
        <Text style={[s.dayText,!day.enabled&&{color:C.muted}]}>{day.name}</Text>
        <Text style={s.daySub}>{day.enabled?'Taking enquiries':'Closed'}</Text>
       </View>
      </View>
      <View style={s.times}>
       <TextInput value={day.start} onChangeText={start=>update(day.weekday,{start})}
        editable={day.enabled} maxLength={5} keyboardType="numbers-and-punctuation"
        style={[s.timeInput,!day.enabled&&{opacity:.5}]} autoCorrect={false}
        accessibilityLabel={day.name+' opening time'} placeholder="08:00"/>
       <Text style={s.dash}>–</Text>
       <TextInput value={day.end} onChangeText={end=>update(day.weekday,{end})}
        editable={day.enabled} maxLength={5} keyboardType="numbers-and-punctuation"
        style={[s.timeInput,!day.enabled&&{opacity:.5}]} autoCorrect={false}
        accessibilityLabel={day.name+' closing time'} placeholder="18:00"/>
      </View>
     </View>)}
   </View>
   <View style={s.info}>
    <Clock3 size={20} color={C.teal}/>
    <View style={{flex:1}}>
     <Text style={s.infoTitle}>How appointment requests work</Text>
     <Text style={s.note}>Customers can see suggested free times, but must still send a request. When you accept it, the time is reserved and conflicting appointments cannot be accepted. Times use Europe/London, including British Summer Time.</Text>
    </View>
   </View>
   <MotionPressable onPress={()=>{void save()}} disabled={saving||!userId}
     style={[s.primary,(saving||!userId)&&{opacity:.55}]} accessibilityRole="button">
    {saving?<ActivityIndicator color="#FFFFFF"/>:<><Save size={19} color="#FFFFFF"/>
      <Text style={s.primaryText}>Save working hours</Text></>}
   </MotionPressable>
   </>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},
 header:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:18,paddingVertical:16},
 back:{height:44,width:44,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:C.teal},
 title:{fontSize:26,fontWeight:'900',color:C.ink},
 page:{padding:18,paddingBottom:55},
 intro:{borderRadius:20,backgroundColor:C.tealTint,padding:17,flexDirection:'row',gap:12,marginBottom:17},
 introTitle:{fontSize:15,color:C.ink,fontWeight:'900'},
 note:{fontSize:12,lineHeight:19,color:C.muted},error:{fontSize:12,fontWeight:'700',color:C.coralDark,marginBottom:10},
 card:{backgroundColor:'#FFFFFF',borderRadius:20,paddingHorizontal:13,...theme.shadow},
 labels:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
   paddingHorizontal:9,paddingTop:15,paddingBottom:7},
 heading:{fontSize:11,fontWeight:'800',color:C.muted},
 day:{paddingVertical:15,gap:10},
 dayHead:{flexDirection:'row',alignItems:'center',gap:9},
 dayText:{fontWeight:'800',fontSize:14,color:C.ink},daySub:{fontSize:11,color:C.muted,marginTop:3},
 times:{flexDirection:'row',alignItems:'center',gap:9,paddingLeft:14},
 timeInput:{flex:1,textAlign:'center',borderRadius:12,borderColor:C.line,borderWidth:1,
   backgroundColor:'#F8FAF8',minHeight:45,fontWeight:'800',fontSize:13,color:C.ink},
 dash:{color:C.muted,fontWeight:'700'},
 info:{borderRadius:18,padding:15,backgroundColor:'#EFF4F1',marginTop:20,
   flexDirection:'row',gap:11},infoTitle:{fontWeight:'900',color:C.ink,fontSize:13,marginBottom:5},
 primary:{backgroundColor:C.darkTeal,marginTop:20,borderRadius:17,minHeight:52,
   justifyContent:'center',alignItems:'center',flexDirection:'row',gap:10},
 primaryText:{color:'#FFFFFF',fontWeight:'900',fontSize:14},
 helpRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14,
   marginBottom:13},
 smallAction:{borderRadius:14,backgroundColor:C.tealTint,paddingHorizontal:12,
   paddingVertical:12,alignItems:'center',justifyContent:'center',minHeight:44},
 smallActionText:{color:C.teal,fontWeight:'800',fontSize:12},
 errorCard:{backgroundColor:'#FFFFFF',padding:18,borderRadius:18,gap:12}
});
