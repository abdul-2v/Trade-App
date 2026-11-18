import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarDays,Check,ChevronRight,MapPin,Navigation,Pause,Play,Plus,RefreshCw,Route,Users} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import {formatUKDateTime} from './lib/scheduling';
import type {RouteMode} from './lib/routeMatching';

type Appointment={id:string;title:string;starts_at:string;ends_at:string;address:string|null};
type Journey={id:string;anchor_appointment_id:string;mode:RouteMode;trade:string;start_area:string;end_area:string;
 starts_at:string;ends_at:string;status:string;max_deviation_miles:number;max_extra_visits:number};
type Stop={jobId:string;routePlanId:string;issue:string;status:string;
 requestedStart:string|null;requestedEnd:string|null;latitude:number|null;longitude:number|null};
type Props={goBack:()=>void;openDiary:()=>void;openMessages:()=>void};
const C=theme.colors;

async function postcodeArea(value:string){
 const code=value.trim().toUpperCase().replace(/\s+/g,'');
 if(!/^[A-Z]{1,2}\d[A-Z\d]?(?:\d[A-Z]{2})?$/.test(code))
  throw new Error('Enter a UK postcode or district such as LE1 or LE1 7RH.');
 const full=/\d[A-Z]{2}$/.test(code);
 const api=full?'postcodes':'outcodes';
 const response=await fetch('https://api.postcodes.io/'+api+'/'+encodeURIComponent(code));
 const result=(await response.json())?.result;
 if(!response.ok||!result||!Number.isFinite(Number(result.latitude))||
    !Number.isFinite(Number(result.longitude)))
  throw new Error('That postcode could not be located.');
 return {area:String(result.outcode||code.slice(0,-3)).toUpperCase(),
  latitude:Number(Number(result.latitude).toFixed(2)),
  longitude:Number(Number(result.longitude).toFixed(2))};
}

export default function TradeRoutePlannerScreen({goBack,openDiary,openMessages}:Props){
 const [uid,setUid]=useState('');
 const [trade,setTrade]=useState('');
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [journeys,setJourneys]=useState<Journey[]>([]);
 const [stops,setStops]=useState<Stop[]>([]);
 const [refreshing,setRefreshing]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [creating,setCreating]=useState(false);
 const [mode,setMode]=useState<RouteMode>('on_my_way');
 const [anchorId,setAnchorId]=useState('');
 const [startPostcode,setStartPostcode]=useState('');
 const [endPostcode,setEndPostcode]=useState('');
 const [distance,setDistance]=useState(3);
 const [capacity,setCapacity]=useState(1);

 const load=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoading(false);return;}
  setUid(user.id);
  const [prof,diary,plans,offers]=await Promise.all([
   supabase.from('tradesperson_profiles').select('primary_trade').eq('user_id',user.id).maybeSingle(),
   supabase.from('trade_appointments').select('id,title,starts_at,ends_at,address')
    .eq('tradesperson_id',user.id).eq('status','scheduled')
    .gte('starts_at',new Date().toISOString()).order('starts_at').limit(100),
   supabase.from('trade_route_plans').select('id,anchor_appointment_id,mode,trade,start_area,end_area,starts_at,ends_at,status,max_deviation_miles,max_extra_visits')
    .eq('tradesperson_id',user.id).order('created_at',{ascending:false}).limit(80),
   supabase.from('job_offers').select('route_plan_id,job_id,status')
    .eq('tradesperson_id',user.id).eq('status','accepted')
    .not('route_plan_id','is',null).limit(200)
  ]);
  if(diary.error||plans.error){
   Alert.alert('Journeys unavailable',diary.error?.message||plans.error?.message||'Please retry.');
  }
  setTrade(prof.data?.primary_trade||'');
  setAppointments((diary.data||[]) as Appointment[]);
  setJourneys((plans.data||[]) as Journey[]);
  if(offers.error){
   Alert.alert('Could not load your stops',offers.error.message);
  }
  const accepted=(offers.data||[]).filter(x=>x.route_plan_id&&x.job_id);
  if(accepted.length){
   const ids=[...new Set(accepted.map(x=>x.job_id))];
   const [booked,where]=await Promise.all([
    supabase.from('jobs').select('id,issue,status,requested_start,requested_end')
     .in('id',ids).eq('accepted_tradesperson_id',user.id),
    supabase.from('job_locations').select('job_id,latitude,longitude').in('job_id',ids)
   ]);
   if(booked.error||where.error){
    Alert.alert('Stops not fully available',
     booked.error?.message||where.error?.message||'Refresh to try again.');
   }
   const byId=new Map((booked.data||[]).map(x=>[x.id,x]));
   const position=new Map((where.data||[]).map(x=>[x.job_id,x]));
   const next:Stop[]=accepted.flatMap(a=>{
    const job=byId.get(a.job_id);
    if(!job||['cancelled','completed'].includes(job.status))return [];
    const location=position.get(a.job_id);
    return [{jobId:a.job_id,routePlanId:a.route_plan_id as string,
     issue:job.issue,status:job.status,
     requestedStart:job.requested_start,requestedEnd:job.requested_end,
     latitude:location?.latitude==null?null:Number(location.latitude),
     longitude:location?.longitude==null?null:Number(location.longitude)}];
   });
   setStops(next);
  }else setStops([]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);

 const reload=async()=>{
  if(refreshing)return;
  setRefreshing(true);try{await load()}finally{setRefreshing(false)}
 };
 const openStopDirections=(stop:Stop)=>{
  if(!Number.isFinite(stop.latitude)||!Number.isFinite(stop.longitude)||
    stop.latitude==null||stop.longitude==null){
   Alert.alert('Address needs confirming',
    'Ask the customer to confirm the exact address in Messages before travelling.');
   return;
  }
  const destination=encodeURIComponent(stop.latitude+','+stop.longitude);
  void Linking.openURL('https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+destination+'&dir_action=navigate')
    .catch(()=>Alert.alert('Could not open maps','Please check that a map app is available.'));
 };

 const openJourneyDirections=(plan:Journey)=>{
  const assigned=stops.filter(x=>x.routePlanId===plan.id);
  const scheduled=assigned.filter(x=>x.requestedStart&&
   x.latitude!=null&&x.longitude!=null&&
   Number.isFinite(x.latitude)&&Number.isFinite(x.longitude))
   .sort((a,b)=>Date.parse(a.requestedStart!)-Date.parse(b.requestedStart!));
  if(!scheduled.length){
   Alert.alert('No scheduled stops yet',
    'Agree appointment times with customers and confirm their addresses before opening directions.');return;
  }
  const max=4;
  const selected=scheduled.slice(0,plan.mode==='on_my_way'?1:max);
  const points=selected.map(x=>x.latitude+','+x.longitude);
  const anchor=appointments.find(x=>x.id===plan.anchor_appointment_id);
  const originalDestination=anchor?.address?.trim();
  // For On My Way, the extra stop is a waypoint before the original diary job.
  // Never navigate silently to a coarse area instead of a precise appointment address.
  if(plan.mode==='on_my_way'&&!originalDestination){
   Alert.alert('Original appointment address needed',
     'Add the exact destination to your diary appointment first. For now, directions will only show the accepted extra stop.',[
      {text:'Cancel',style:'cancel'},
      {text:'Navigate to extra stop',onPress:()=>openStopDirections(selected[0])}
     ]);
   return;
  }
  const destination=encodeURIComponent(plan.mode==='on_my_way'
    ? originalDestination! : points[points.length-1]);
  const routeWaypoints=plan.mode==='on_my_way'?points:points.slice(0,-1);
  const waypoints=routeWaypoints.length?
    '&waypoints='+encodeURIComponent(routeWaypoints.join('|')):'';
  const url='https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+
    destination+waypoints;
  if(scheduled.length>max){
   Alert.alert('Route shown in sections',
    'Mobile maps can display up to four stops in this link. The first four confirmed stops open now; use the individual Directions buttons for remaining visits. This is time order, not optimised road routing.',[
      {text:'Cancel',style:'cancel'},{text:'Open first stops',onPress:()=>{
        void Linking.openURL(url).catch(()=>Alert.alert('Maps unavailable','Try again from an individual stop.'));
      }}
    ]);
  }else{
   void Linking.openURL(url).catch(()=>Alert.alert('Maps unavailable','Try again from an individual stop.'));
  }
 };


 const create=async()=>{
  if(saving||!uid)return;
  const anchor=appointments.find(x=>x.id===anchorId);
  if(!anchor){Alert.alert('Choose an appointment','Select a confirmed diary booking to anchor your journey.');return;}
  if(!trade){Alert.alert('Choose your trade','Complete your tradesperson profile first.');return;}
  setSaving(true);
  try{
   const [start,end]=await Promise.all([postcodeArea(startPostcode),postcodeArea(endPostcode)]);
   const begins=mode==='on_my_way'
    ? new Date(Date.parse(anchor.starts_at)-75*60000)
    : new Date(anchor.ends_at);
   const finishes=mode==='on_my_way'
    ? new Date(anchor.starts_at)
    : new Date(Date.parse(anchor.ends_at)+180*60000);
   if(begins.getTime()<=Date.now()+60000)
    throw new Error('Choose a later diary appointment. This journey window would already have started.');
   if(mode==='on_my_way'&&capacity!==1)
     throw new Error('On My Way supports one extra visit. Choose Street Run for multiple stops.');
   const {error}=await supabase.from('trade_route_plans').insert({
    tradesperson_id:uid,anchor_appointment_id:anchor.id,mode,trade,
    start_area:start.area,end_area:end.area,
    start_latitude:start.latitude,start_longitude:start.longitude,
    end_latitude:end.latitude,end_longitude:end.longitude,
    starts_at:begins.toISOString(),ends_at:finishes.toISOString(),
    max_deviation_miles:distance,max_extra_visits:capacity,status:'open'
   });
   if(error)throw error;
   setCreating(false);setAnchorId('');setStartPostcode('');setEndPostcode('');
   await load();
   Alert.alert('Journey published','Matching flexible enquiries can be offered to you. No extra booking, price or detour is guaranteed until you review and accept a job.');
  }catch(error:any){Alert.alert('Could not publish journey',error?.message||'Try again.');}
  finally{setSaving(false)}
 };

 const changeStatus=async(j:Journey,status:'open'|'paused'|'closed')=>{
  if(saving)return;
  setSaving(true);
  const {error}=await supabase.from('trade_route_plans').update({status}).eq('id',j.id).eq('tradesperson_id',uid);
  setSaving(false);
  if(error){Alert.alert('Could not update journey',error.message);return;}
  void load();
 };
 const anchor=appointments.find(x=>x.id===anchorId)||null;
 const previewStart=anchor
  ? new Date(mode==='on_my_way'?Date.parse(anchor.starts_at)-75*60000:Date.parse(anchor.ends_at))
  : null;
 const previewEnd=anchor
  ? new Date(mode==='on_my_way'?Date.parse(anchor.starts_at):Date.parse(anchor.ends_at)+180*60000)
  : null;

 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={goBack} style={s.back}><ArrowLeft color={C.ink} size={23}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>ROUTE MATCHING</Text>
    <Text style={s.title}>My journeys</Text></View>
   <MotionPressable style={s.secondary} onPress={()=>{void reload()}} disabled={refreshing}
     accessibilityRole="button" accessibilityLabel="Refresh journeys and visits">
      {refreshing?<ActivityIndicator size="small" color={C.teal}/>:<RefreshCw color={C.teal} size={19}/>}
   </MotionPressable>
   <MotionPressable style={s.primarySmall} onPress={()=>setCreating(x=>!x)}>
    <Plus size={17} color="#FFFFFF"/><Text style={s.primaryText}>{creating?'Close':'Publish'}</Text>
   </MotionPressable>
  </View>
  {loading?<ActivityIndicator style={{marginTop:40}} color={C.teal}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   <View style={s.intro}>
    <Route color={C.teal} size={24}/>
    <View style={{flex:1}}>
     <Text style={s.cardTitle}>Real journeys, relevant jobs</Text>
     <Text style={s.note}>A journey must be linked to an upcoming confirmed appointment in your diary. Matching uses approximate geography and your chosen time window, not a verified driving route.</Text>
    </View>
   </View>
   {creating?<View style={s.card}>
    <Text style={s.section}>Choose the type of work</Text>
    <View style={s.row}>
     {([['on_my_way','On My Way'],['street_run','Street Run']] as const).map(([value,label])=>
      <MotionPressable key={value} onPress={()=>{setMode(value);setCapacity(value==='street_run'?3:1)}}
       style={[s.chip,mode===value&&s.chipActive]}>
       <Text style={[s.chipText,mode===value&&s.chipTextActive]}>{label}</Text>
      </MotionPressable>)}
    </View>
    <Text style={s.note}>{mode==='on_my_way'
     ? 'Offer one extra job that could fit the journey to an existing appointment.'
     : 'Plan up to four additional local visits near an appointment you already have.'}</Text>
    <Text style={s.section}>Anchor this to a confirmed diary appointment</Text>
    {appointments.length?appointments.map(a=><MotionPressable key={a.id}
      onPress={()=>setAnchorId(a.id)} style={[s.appt,anchorId===a.id&&s.apptActive]}>
      <CalendarDays color={C.teal} size={19}/>
      <View style={{flex:1}}>
       <Text style={s.cardTitle}>{a.title}</Text>
       <Text style={s.note}>{formatUKDateTime(a.starts_at)}</Text>
      </View>
      {anchorId===a.id?<Check color={C.teal} size={19}/>:<ChevronRight color={C.muted} size={18}/>}
     </MotionPressable>):<View style={s.hint}>
      <Text style={s.note}>You need a genuine upcoming diary appointment first.</Text>
      <MotionPressable onPress={openDiary} style={s.secondary}>
       <CalendarDays size={17} color={C.teal}/><Text style={s.secondaryText}>Go to diary</Text>
      </MotionPressable>
     </View>}
    {previewStart&&previewEnd?<View style={s.hint}>
     <Text style={s.cardTitle}>Proposed work window · UK time</Text>
     <Text style={s.note}>{formatUKDateTime(previewStart.toISOString())} to {new Date(previewEnd).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}</Text>
    </View>:null}
    <Text style={s.section}>Route start postcode / area</Text>
    <TextInput value={startPostcode} onChangeText={setStartPostcode}
     style={s.input} placeholder="Example: LE1" autoCapitalize="characters"
     placeholderTextColor="#98A2A0" autoCorrect={false}/>
    <Text style={s.section}>{mode==='street_run'?'Area to group visits around':'Route destination postcode / area'}</Text>
    <TextInput value={endPostcode} onChangeText={setEndPostcode}
     style={s.input} placeholder="Example: LE4" autoCapitalize="characters"
     placeholderTextColor="#98A2A0" autoCorrect={false}/>
    <Text style={s.note}>Only a broad postcode district and rounded map coordinates are published, not the precise appointment address.</Text>
    <Text style={s.section}>{mode==='street_run'?'Maximum distance from group area':'Maximum approximate deviation from route'}</Text>
    <View style={s.row}>
     {[1,2,3,5,10].map(m=><MotionPressable key={m} onPress={()=>setDistance(m)}
      style={[s.chip,distance===m&&s.chipActive]}>
      <Text style={[s.chipText,distance===m&&s.chipTextActive]}>{m} mi</Text>
     </MotionPressable>)}
    </View>
    <Text style={s.section}>Maximum extra jobs</Text>
    <View style={s.row}>
     {(mode==='on_my_way'?[1]:[1,2,3,4]).map(n=><MotionPressable key={n} onPress={()=>setCapacity(n)}
      style={[s.chip,capacity===n&&s.chipActive]}>
      <Text style={[s.chipText,capacity===n&&s.chipTextActive]}>{n}</Text>
     </MotionPressable>)}
    </View>
    <Text style={s.note}>Only matched enquiries are offered, not bookings. A visit time must fit the published window, include travel buffer and be agreed by both sides. Pricing and any savings remain unconfirmed.</Text>
    <MotionPressable disabled={saving||!anchorId||!startPostcode.trim()||!endPostcode.trim()}
      onPress={()=>{void create()}} style={[s.primary,(!anchorId||saving)&&{opacity:.5}]}>
     {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Publish real journey</Text>}
    </MotionPressable>
   </View>:null}
   <Text style={s.section}>Published journeys</Text>
   {journeys.length?journeys.map(j=><View key={j.id} style={s.card}>
     <View style={s.row}>
      <View style={{flex:1}}>
       <Text style={s.cardTitle}>{j.mode==='street_run'?'Street Run':'On My Way'}</Text>
       <Text style={s.note}>{j.start_area} → {j.end_area} · {j.trade}</Text>
      </View>
      <View style={s.pill}><Text style={s.pillText}>{j.status}</Text></View>
     </View>
     <View style={s.detailRow}><CalendarDays size={15} color={C.muted}/>
       <Text style={s.note}>{formatUKDateTime(j.starts_at)} – {new Date(j.ends_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}</Text></View>
     <View style={s.detailRow}><MapPin size={15} color={C.muted}/>
       <Text style={s.note}>{j.max_deviation_miles} mi corridor · up to {j.max_extra_visits} extra visits</Text></View>
     {(()=>{
       const assigned=stops.filter(v=>v.routePlanId===j.id)
         .sort((a,b)=>(a.requestedStart?Date.parse(a.requestedStart):Infinity)-
          (b.requestedStart?Date.parse(b.requestedStart):Infinity));
       return <View style={{marginTop:6,gap:9}}>
        <Text style={s.cardTitle}>{assigned.length}/{j.max_extra_visits} accepted extra visits</Text>
        {assigned.map((stop,index)=><View key={stop.jobId}
          style={{borderRadius:13,backgroundColor:'#F5F8F6',padding:12,gap:6}}>
          <Text style={{fontWeight:'800',color:C.ink,fontSize:12}}>
            {index+1}. {stop.issue}</Text>
          <Text style={s.note}>{stop.requestedStart
            ? formatUKDateTime(stop.requestedStart)
            : 'Time not yet confirmed — arrange in Messages'}</Text>
          <Text style={s.note}>{stop.latitude!=null&&stop.longitude!=null
            ? 'Customer location available after matching'
            : 'Customer address not yet confirmed'}</Text>
          <View style={s.row}>
            <MotionPressable style={s.secondary} onPress={openMessages}>
              <Text style={s.secondaryText}>Messages</Text>
            </MotionPressable>
            {stop.requestedStart?<MotionPressable style={s.secondary}
                onPress={()=>openStopDirections(stop)}>
                <Navigation size={15} color={C.teal}/>
                <Text style={s.secondaryText}>Directions</Text>
              </MotionPressable>:null}
          </View>
        </View>)}
        {assigned.some(v=>v.requestedStart)?<MotionPressable
          style={[s.primary,{minHeight:44,marginTop:4}]}
          onPress={()=>openJourneyDirections(j)} accessibilityRole="button">
          <Text style={s.primaryText}>Open scheduled stops in Maps</Text>
        </MotionPressable>:null}
        <Text style={s.note}>Stops follow agreed appointment times; Google Maps calculates driving directions when opened. On My Way includes the original diary destination when its address is saved. Tradarr does not optimise road travel times or guarantee detours.</Text>
       </View>;
     })()}

     {j.status!=='closed'&&Date.parse(j.starts_at)>Date.now()?<View style={s.buttons}>
      <MotionPressable style={s.secondary} onPress={()=>{void changeStatus(j,j.status==='open'?'paused':'open')}} disabled={saving}>
       {j.status==='open'?<Pause size={15} color={C.teal}/>:<Play size={15} color={C.teal}/>}
       <Text style={s.secondaryText}>{j.status==='open'?'Pause':'Resume'}</Text>
      </MotionPressable>
      <MotionPressable style={s.secondary} onPress={()=>{void changeStatus(j,'closed')}} disabled={saving}>
       <Text style={s.secondaryText}>Close journey</Text>
      </MotionPressable>
     </View>:null}
    </View>):<View style={s.hint}>
     <Users color={C.teal} size={28}/>
     <Text style={s.cardTitle}>No published journeys yet</Text>
     <Text style={s.note}>Anchor an upcoming journey to your diary to start receiving relevant flexible enquiries.</Text>
    </View>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},header:{flexDirection:'row',alignItems:'center',gap:12,
  paddingHorizontal:18,paddingVertical:16},back:{width:44,height:44,borderRadius:22,backgroundColor:'#FFFFFF',
  alignItems:'center',justifyContent:'center'},
 eyebrow:{color:C.teal,fontSize:10,fontWeight:'800',letterSpacing:1},
 title:{color:C.ink,fontSize:25,fontWeight:'900'},
 page:{padding:18,paddingBottom:50},intro:{backgroundColor:C.tealTint,borderRadius:20,padding:16,
  flexDirection:'row',gap:12,marginBottom:18},
 card:{borderRadius:21,padding:17,backgroundColor:'#FFFFFF',marginBottom:15,gap:12,...theme.shadow},
 cardTitle:{color:C.ink,fontSize:14,fontWeight:'800'},note:{color:C.muted,fontSize:12,lineHeight:19},
 section:{fontWeight:'800',color:C.ink,fontSize:13,marginTop:10,marginBottom:4},
 row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},
 chip:{paddingHorizontal:13,minHeight:39,backgroundColor:'#EDF3F0',borderRadius:12,alignItems:'center',justifyContent:'center'},
 chipActive:{backgroundColor:C.darkTeal},chipText:{fontSize:12,fontWeight:'800',color:C.ink},
 chipTextActive:{color:'#FFFFFF'},
 appt:{borderRadius:14,minHeight:65,backgroundColor:'#F4F8F6',padding:12,flexDirection:'row',alignItems:'center',gap:9},
 apptActive:{borderColor:C.teal,borderWidth:1.5},
 input:{borderRadius:12,borderWidth:1,borderColor:C.line,minHeight:48,paddingHorizontal:12,backgroundColor:'#FBFCFB',color:C.ink},
 hint:{padding:16,borderRadius:17,backgroundColor:'#F2F6F4',gap:8,alignItems:'flex-start'},
 primary:{borderRadius:15,backgroundColor:C.darkTeal,minHeight:51,paddingHorizontal:17,justifyContent:'center',alignItems:'center'},
 primarySmall:{borderRadius:15,backgroundColor:C.darkTeal,minHeight:43,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7},
 primaryText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},
 secondary:{borderRadius:12,minHeight:38,backgroundColor:C.tealTint,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12},
 secondaryText:{color:C.teal,fontSize:12,fontWeight:'800'},
 pill:{backgroundColor:C.tealTint,borderRadius:15,paddingHorizontal:12,paddingVertical:8},
 pillText:{color:C.teal,fontWeight:'800',fontSize:12},
 buttons:{flexDirection:'row',gap:9},detailRow:{flexDirection:'row',alignItems:'center',gap:8}
});
