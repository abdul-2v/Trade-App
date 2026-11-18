import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import {CalendarClock,ChevronDown,ChevronRight,BriefcaseBusiness} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {formatUKDateTime} from './lib/scheduling';
import {MotionPressable} from './Motion';
import {theme} from './theme';
import BookingReschedulePanel from './BookingReschedulePanel';

type Job={id:string;issue:string;status:string;requested_start:string|null;
 requested_end:string|null;appointment_id:string|null;created_at:string};
type Props={conversationId:string;role:'customer'|'tradesperson';onOpenJob:(jobId:string)=>void};
const active=(status:string)=>['accepted','en_route','arrived','in_progress'].includes(status);
export default function ConversationJobCards({conversationId,role,onOpenJob}:Props){
 const [jobs,setJobs]=useState<Job[]>([]);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{
  const {data:conversation}=await supabase.from('conversations')
   .select('id,customer_id,tradesperson_id').eq('id',conversationId).maybeSingle();
  if(!conversation){setJobs([]);setLoading(false);return;}
  const {data,error}=await supabase.from('jobs')
   .select('id,issue,status,requested_start,requested_end,appointment_id,created_at')
   .eq('customer_id',conversation.customer_id)
   .or('accepted_tradesperson_id.eq.'+conversation.tradesperson_id+
       ',preferred_tradesperson_id.eq.'+conversation.tradesperson_id)
   .order('created_at',{ascending:false}).limit(4);
  if(!error)setJobs((data||[]) as Job[]);
  setLoading(false);
 },[conversationId]);

 useEffect(()=>{
  let alive=true;
  void reload();
  const timer=setInterval(()=>{if(alive)void reload()},45000);
  return()=>{alive=false;clearInterval(timer);};
 },[reload]);

 if(loading)return <ActivityIndicator color={theme.colors.teal} style={{padding:8}}/>;
 if(!jobs.length)return null;
 return <View style={s.root}>
  {jobs.map(job=>{
   const open=expanded===job.id;
   const confirmed=Boolean(job.appointment_id&&job.requested_start&&job.requested_end);
   const mayArrange=job.status==='accepted'||job.status==='en_route';
   return <View key={job.id} style={s.card}>
    <MotionPressable onPress={()=>setExpanded(open?null:job.id)} style={s.line}
     accessibilityRole="button" accessibilityLabel={'Booking details: '+job.issue}>
     <CalendarClock size={17} color={theme.colors.teal}/>
     <View style={{flex:1}}>
      <Text style={s.title} numberOfLines={1}>{job.issue}</Text>
      <Text style={s.sub}>
       {confirmed&&job.requested_start?'Confirmed · '+formatUKDateTime(job.requested_start):
        active(job.status)?'Time awaiting agreement':
        job.status==='cancelled'?'Cancelled':
        job.requested_start?'Requested · '+formatUKDateTime(job.requested_start):
        'Request · '+job.status.replace(/_/g,' ')}
      </Text>
     </View>
     {open?<ChevronDown size={18} color={theme.colors.teal}/>:<ChevronRight size={18} color={theme.colors.teal}/>}
    </MotionPressable>
    {open?<View style={s.detail}>
      <Text style={s.note}>
       {confirmed?'This appointment is reserved in the professional diary.':
        active(job.status)?'You can propose a visit time. It must be agreed by both people.':
        'A requested time is not a confirmed booking.'}
      </Text>
      {mayArrange?<BookingReschedulePanel jobId={job.id}
       currentStart={confirmed?job.requested_start:null}
       currentEnd={confirmed?job.requested_end:null} onUpdated={()=>{void reload()}}/>:null}
      <MotionPressable style={s.action} onPress={()=>onOpenJob(job.id)} accessibilityRole="button">
       <BriefcaseBusiness size={15} color="#FFFFFF"/>
       <Text style={s.actionText}>{role==='customer'?'Open my job':'Open job details'}</Text>
      </MotionPressable>
    </View>:null}
   </View>
  })}
 </View>;
}
const s=StyleSheet.create({
 root:{paddingHorizontal:12,paddingVertical:7,backgroundColor:'#EDF4F0',gap:7,maxHeight:300},
 card:{backgroundColor:'#FFFFFF',borderColor:'#DDE9E4',borderWidth:1,borderRadius:13},
 line:{padding:11,minHeight:54,flexDirection:'row',alignItems:'center',gap:9},
 title:{fontSize:12,fontWeight:'800',color:theme.colors.ink},
 sub:{fontSize:10,color:theme.colors.muted,marginTop:3},
 detail:{paddingHorizontal:10,paddingBottom:11},
 note:{color:theme.colors.muted,fontSize:11,lineHeight:17},
 action:{backgroundColor:theme.colors.darkTeal,minHeight:39,borderRadius:11,
 justifyContent:'center',alignItems:'center',flexDirection:'row',gap:7,marginTop:6},
 actionText:{fontSize:11,fontWeight:'800',color:'#FFFFFF'}
});
