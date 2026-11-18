import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,StyleSheet,Text,View} from 'react-native';
import {CalendarClock,Check,Clock3,X} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {MotionPressable} from './Motion';
import {theme} from './theme';
import {APPOINTMENT_TIMES,formatUKDateTime,nextUKDays,ukSlotToISO,advanceISOByMinutes} from './lib/scheduling';

type Change={id:string;job_id:string;proposer_id:string;proposed_start:string;
 proposed_end:string;status:'pending'|'accepted'|'declined'|'withdrawn';note:string|null};
type Props={jobId:string;currentStart:string|null;currentEnd:string|null;
 onUpdated?:()=>void;};

export default function BookingReschedulePanel({jobId,currentStart,currentEnd,onUpdated}:Props){
 const onUpdatedRef=useRef(onUpdated);
 onUpdatedRef.current=onUpdated;
 const [userId,setUserId]=useState('');
 const [change,setChange]=useState<Change|null>(null);
 const [expanded,setExpanded]=useState(false);
 const [date,setDate]=useState(nextUKDays(1)[0]);
 const [time,setTime]=useState('09:00');
 const [duration,setDuration]=useState(60);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);

 const load=useCallback(async()=>{
  const [{data:{user}},{data,error}]=await Promise.all([
   supabase.auth.getUser(),
   supabase.from('trade_appointment_changes').select('id,job_id,proposer_id,proposed_start,proposed_end,status,note')
     .eq('job_id',jobId).eq('status','pending').order('created_at',{ascending:false}).limit(1)
  ]);
  setUserId(user?.id||'');
  if(!error)setChange((data?.[0]||null) as Change|null);
  setLoading(false);
 },[jobId]);

 useEffect(()=>{
  void load();
  const channel=supabase.channel('appointment-change-'+jobId)
    .on('postgres_changes',{event:'*',schema:'public',table:'trade_appointment_changes',
     filter:'job_id=eq.'+jobId},()=>{void load();onUpdatedRef.current?.()})
    .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[jobId,load]);

 const propose=async()=>{
  if(busy||!userId)return;
  const start=ukSlotToISO(date,time);
  const end=start?advanceISOByMinutes(start,duration):null;
  if(!start||!end||Date.parse(start)<=Date.now()+10*60000){
   Alert.alert('Choose a future time','Pick a valid time at least 10 minutes from now (UK time).');
   return;
  }
  if(start===currentStart&&end===currentEnd){
   Alert.alert('Already booked','That is already the agreed appointment time.');return;
  }
  setBusy(true);
  const {error}=await supabase.from('trade_appointment_changes').insert({
   job_id:jobId,proposer_id:userId,proposed_start:start,proposed_end:end,
   note:'Time change proposed in Tradarr'
  });
  setBusy(false);
  if(error){Alert.alert('Could not propose a new time',error.message);return;}
  setExpanded(false);void load();
 };

 const decide=async(next:'accepted'|'declined'|'withdrawn')=>{
  if(busy||!change)return;
  setBusy(true);
  const {data,error}=await supabase.from('trade_appointment_changes')
    .update({status:next})
    .eq('id',change.id).eq('status','pending').select('id').maybeSingle();
  setBusy(false);
  if(error||!data){
   Alert.alert('Could not update booking',
    error?.message||'The booking has changed. Refreshing the latest status.');
   void load();return;
  }
  void load();onUpdatedRef.current?.();
  if(next==='accepted')Alert.alert('Appointment rescheduled','Both sides can now see the agreed time in Tradarr.');
 };

 if(!currentStart||!currentEnd)return null;
 const days=nextUKDays(10);
 const pending=Boolean(change);
 return <View style={s.card}>
  <View style={s.head}><CalendarClock size={22} color={theme.colors.teal}/>
   <View style={{flex:1}}><Text style={s.title}>Confirmed appointment</Text>
    <Text style={s.detail}>{formatUKDateTime(currentStart)} · {Math.round((Date.parse(currentEnd)-Date.parse(currentStart))/60000)} minutes</Text>
   </View>
  </View>
  {loading?<ActivityIndicator color={theme.colors.teal} />:pending&&change?(
   <View style={s.request}>
    <Text style={s.status}>{change.proposer_id===userId?'Waiting for the other person':'New time requested'}</Text>
    <Text style={s.detail}>{formatUKDateTime(change.proposed_start)} to {new Date(change.proposed_end).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}</Text>
    <Text style={s.note}>Your existing appointment remains confirmed unless both sides agree to this change.</Text>
    <View style={s.buttons}>
     {change.proposer_id===userId?
       <MotionPressable onPress={()=>{void decide('withdrawn')}} disabled={busy} style={s.secondary}>
        <X size={15} color={theme.colors.teal}/><Text style={s.secondaryText}>Withdraw request</Text>
       </MotionPressable>:
       <>
        <MotionPressable onPress={()=>{void decide('declined')}} disabled={busy} style={s.secondary}>
         <Text style={s.secondaryText}>Keep original time</Text>
        </MotionPressable>
        <MotionPressable onPress={()=>{void decide('accepted')}} disabled={busy} style={s.primary}>
         <Check size={15} color="#FFFFFF"/><Text style={s.primaryText}>Accept new time</Text>
        </MotionPressable>
       </>}
    </View>
   </View>
  ):<>
   <MotionPressable style={s.secondary} onPress={()=>setExpanded(x=>!x)} accessibilityRole="button">
    <Clock3 size={16} color={theme.colors.teal}/>
    <Text style={s.secondaryText}>{expanded?'Close time options':'Request a different time'}</Text>
   </MotionPressable>
   {expanded?<View style={{gap:11,marginTop:12}}>
    <Text style={s.note}>A new time must be accepted by the other person. All times are UK local time.</Text>
    <Text style={s.label}>Select a day</Text>
    <View style={s.row}>{days.map(d=><MotionPressable key={d} onPress={()=>setDate(d)}
      style={[s.chip,date===d&&s.selected]}><Text style={[s.chipText,date===d&&s.selectedText]}>
      {new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}
     </Text></MotionPressable>)}</View>
    <Text style={s.label}>Start time</Text>
    <View style={s.row}>{APPOINTMENT_TIMES.map(t=><MotionPressable key={t} onPress={()=>setTime(t)}
      style={[s.chip,time===t&&s.selected]}><Text style={[s.chipText,time===t&&s.selectedText]}>{t}</Text>
     </MotionPressable>)}</View>
    <Text style={s.label}>Duration</Text>
    <View style={s.row}>{[30,60,90,120,180].map(d=><MotionPressable key={d} onPress={()=>setDuration(d)}
      style={[s.chip,duration===d&&s.selected]}><Text style={[s.chipText,duration===d&&s.selectedText]}>
       {d} min</Text></MotionPressable>)}</View>
    <MotionPressable disabled={busy} onPress={()=>{void propose()}} style={s.primary}>
     {busy?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Send time-change request</Text>}
    </MotionPressable>
   </View>:null}
  </>}
 </View>
}
const s=StyleSheet.create({
 card:{backgroundColor:'#FFFFFF',borderRadius:19,borderWidth:1,borderColor:'#E0E8E5',padding:15,marginVertical:12,gap:9},
 head:{flexDirection:'row',alignItems:'center',gap:10},title:{fontSize:15,fontWeight:'800',color:theme.colors.ink},
 detail:{fontSize:12,color:theme.colors.muted,marginTop:5,lineHeight:19},
 label:{fontSize:12,color:theme.colors.ink,fontWeight:'800'},
 note:{color:theme.colors.muted,fontSize:12,lineHeight:19},
 status:{color:theme.colors.teal,fontSize:13,fontWeight:'800'},
 request:{backgroundColor:'#F2F8F6',borderRadius:13,padding:11,gap:8},
 row:{flexDirection:'row',flexWrap:'wrap',gap:6},
 chip:{paddingHorizontal:10,paddingVertical:10,backgroundColor:'#F2F4F1',borderRadius:11,minWidth:64,alignItems:'center'},
 chipText:{fontSize:11,fontWeight:'800',color:theme.colors.ink},selected:{backgroundColor:theme.colors.darkTeal},
 selectedText:{color:'#FFFFFF'},
 buttons:{flexDirection:'row',gap:8,flexWrap:'wrap'},primary:{backgroundColor:theme.colors.darkTeal,
  paddingHorizontal:14,minHeight:44,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 primaryText:{fontWeight:'800',fontSize:12,color:'#FFFFFF'},
 secondary:{backgroundColor:'#ECF2EF',paddingHorizontal:12,minHeight:42,borderRadius:13,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 secondaryText:{fontWeight:'800',fontSize:12,color:theme.colors.teal}
});
