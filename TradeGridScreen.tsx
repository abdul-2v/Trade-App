import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarDays,Check,Clock3,MapPin,Plus,Trash2,Users} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Slot={id:string;tradesperson_id:string;trade:string;area_label:string;starts_at:string;ends_at:string;price_note:string|null;status:'open'|'paused'|'booked'|'closed'};
type Request={id:string;slot_id:string;customer_id:string;summary:string;status:'pending'|'accepted'|'declined'|'withdrawn';created_at:string;trade_grid_slots:{id:string;tradesperson_id:string;starts_at:string;area_label:string;trade:string}|null};
const when=(s:string)=>new Date(s).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
function Entry({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){
 return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>
  <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#90A0A0"/></View>;
}
export default function TradeGridScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState(''),[trade,setTrade]=useState(''),[area,setArea]=useState(''),[date,setDate]=useState(localDay()),[time,setTime]=useState('11:00');
 const [duration,setDuration]=useState(90),[priceNote,setPriceNote]=useState('');
 const [slots,setSlots]=useState<Slot[]>([]),[requests,setRequests]=useState<Request[]>([]);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[creating,setCreating]=useState(false);
 const load=async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;
  if(!id){setBusy(false);return;}setUid(id);
  const [profile,avail,existing,pending]=await Promise.all([
   supabase.from('tradesperson_profiles').select('primary_trade').eq('user_id',id).maybeSingle(),
   supabase.from('trade_availability').select('work_area_label').eq('user_id',id).maybeSingle(),
   supabase.from('trade_grid_slots').select('*').eq('tradesperson_id',id).order('starts_at',{ascending:false}).limit(100),
   supabase.from('trade_grid_requests')
    .select('id,slot_id,customer_id,summary,status,created_at,trade_grid_slots!inner(id,tradesperson_id,starts_at,area_label,trade)')
    .eq('trade_grid_slots.tradesperson_id',id).order('created_at',{ascending:false}).limit(100)
  ]);
  if(existing.error||pending.error)Alert.alert('Grid unavailable',existing.error?.message||pending.error?.message||'Try again.');
  setTrade(x=>x||profile.data?.primary_trade||'Plumber');
  setArea(x=>x||avail.data?.work_area_label||'');
  setSlots((existing.data||[]) as Slot[]);
  setRequests((pending.data||[]) as unknown as Request[]);
  setBusy(false);
 };
 useEffect(()=>{void load();},[]);
 const publish=async()=>{
  if(saving||!uid)return;
  const start=new Date(date+'T'+time+':00');
  if(!trade.trim()||!area.trim()){Alert.alert('Add your work area','Enter your trade and approximate local area.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(start.getTime())||start.getTime()<Date.now()+3*60000){
   Alert.alert('Choose a future time','Enter a future local date and a start time such as 11:00.');return;}
  if(!/^\d{2}:\d{2}$/.test(time)||duration<30||duration>720){Alert.alert('Invalid slot duration');return;}
  setSaving(true);
  const payload={tradesperson_id:uid,trade:trade.trim(),area_label:area.trim(),starts_at:start.toISOString(),
   ends_at:new Date(start.getTime()+duration*60000).toISOString(),price_note:priceNote.trim()||null,status:'open'};
  const {data,error}=await supabase.from('trade_grid_slots').insert(payload).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Unable to publish slot',error?.message||'Try again.');return;}
  setSlots(old=>[data as Slot,...old]);setCreating(false);setPriceNote('');
 };
 const changeSlot=async(slot:Slot,status:'paused'|'open'|'closed')=>{
  if(status==='open'&&new Date(slot.starts_at).getTime()<=Date.now()){Alert.alert('This window has passed','Publish another future window instead.');return;}
  const {data,error}=await supabase.from('trade_grid_slots').update({status}).eq('id',slot.id).eq('tradesperson_id',uid).select('*').single();
  if(error||!data){Alert.alert('Could not update slot',error?.message||'Try again.');return;}
  setSlots(old=>old.map(s=>s.id===slot.id?data as Slot:s));
 };
 const decide=async(row:Request,status:'accepted'|'declined')=>{
  const slot=slots.find(s=>s.id===row.slot_id);
  if(!slot||slot.status!=='open'){Alert.alert('Slot no longer available','You cannot accept new requests for this window.');return;}
  const apply=async()=>{
   const {data,error}=await supabase.from('trade_grid_requests').update({status})
    .eq('id',row.id).eq('status','pending').select('id,slot_id,customer_id,summary,status,created_at,trade_grid_slots(id,tradesperson_id,starts_at,area_label,trade)').single();
   if(error||!data){Alert.alert('Could not respond',error?.message||'Try again.');return;}
   setRequests(old=>old.map(r=>r.id===row.id?data as unknown as Request:r));
   if(status==='accepted')setSlots(old=>old.map(s=>s.id===row.slot_id?{...s,status:'booked'}:s));
  };
  if(status==='accepted'){
   Alert.alert('Accept this booking request?','You are reserving '+when(slot.starts_at)+' for this customer. Confirm the address, scope and price with them before attending.',
     [{text:'Cancel',style:'cancel'},{text:'Accept request',onPress:()=>{void apply()}}]);
  }else await apply();
 };
 return <View style={s.root}>
  <View style={s.header}><MotionPressable onPress={goBack} style={s.back}><ArrowLeft size={22} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>BUSINESS TOOLS</Text><Text style={s.heading}>Grid availability</Text></View>
   <MotionPressable onPress={()=>setCreating(v=>!v)} style={s.new}><Plus size={18} color="#FFFFFF"/><Text style={s.newText}>Publish</Text></MotionPressable></View>
  {busy?<ActivityIndicator color={C.teal} size="large" style={{marginTop:55}}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   <View style={s.hero}><Clock3 size={25} color="#CBE5DF"/><Text style={s.heroTitle}>Fill useful gaps in your diary.</Text>
    <Text style={s.heroSub}>Publish genuine spare windows in an approximate work area. Customers can ask to use one, and you decide whether to accept.</Text></View>
   {creating?<View style={s.card}>
    <Text style={s.section}>Publish a work window</Text>
    <Entry label="Your trade" value={trade} onChange={setTrade} placeholder="e.g. Plumber"/>
    <Entry label="Approximate area" value={area} onChange={setArea} placeholder="e.g. Leicester LE4"/>
    <View style={s.two}><View style={{flex:1}}><Entry label="Date (YYYY-MM-DD)" value={date} onChange={setDate}/></View>
     <View style={{flex:1}}><Entry label="Start (HH:MM)" value={time} onChange={setTime}/></View></View>
    <Text style={s.fieldLabel}>Time available</Text><View style={s.durations}>
     {[60,90,120,180].map(d=><MotionPressable key={d} onPress={()=>setDuration(d)} style={[s.chip,duration===d&&s.chipOn]}>
       <Text style={[s.chipText,duration===d&&s.chipTextOn]}>{d}m</Text></MotionPressable>)}</View>
    <Entry label="Price note (optional)" value={priceNote} onChange={setPriceNote} placeholder="e.g. Minimum call-out £60"/>
    <Text style={s.note}>Only your approximate area and this time window are public to signed-in customers. Your live location is not shared.</Text>
    <MotionPressable disabled={saving} onPress={()=>{void publish()}} style={s.primary}>
     {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Publish available slot</Text>}</MotionPressable>
   </View>:null}
   <Text style={s.section}>Customer enquiries</Text>
   {requests.filter(r=>r.status==='pending').length?requests.filter(r=>r.status==='pending').map(r=>{
    const slot=slots.find(x=>x.id===r.slot_id);
    return <View key={r.id} style={s.card}><View style={s.row}><Users size={19} color={C.teal}/>
      <Text style={s.cardTitle}>{slot?.trade||'Grid request'} · {slot?.area_label||'Local area'}</Text></View>
     <Text style={s.meta}>{slot?when(slot.starts_at):'Unknown date'}</Text>
     <Text style={s.summary}>{r.summary}</Text>
     {slot?.status==='open'?<View style={s.buttons}>
      <MotionPressable onPress={()=>{void decide(r,'accepted')}} style={s.accept}><Check size={18} color="#FFFFFF"/><Text style={s.primaryText}>Accept</Text></MotionPressable>
      <MotionPressable onPress={()=>{void decide(r,'declined')}} style={s.reject}><Text style={s.rejectText}>Decline</Text></MotionPressable>
     </View>:<Text style={s.meta}>The slot is no longer open; this request cannot be accepted.</Text>}</View>;
   }):<View style={s.empty}><Text style={s.meta}>No new customer enquiries yet. Publish an available slot to get started.</Text></View>}
   <Text style={s.section}>Your published slots</Text>
   {slots.length?slots.map(slot=><View key={slot.id} style={s.card}>
    <View style={s.row}><MapPin size={19} color={C.teal}/><Text style={s.cardTitle}>{slot.trade} · {slot.area_label}</Text></View>
    <Text style={s.meta}>{when(slot.starts_at)} – {new Date(slot.ends_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</Text>
    <Text style={s.meta}>Status: {slot.status} · {requests.filter(r=>r.slot_id===slot.id).length} enquiries</Text>
    {slot.status==='open'||slot.status==='paused'?<View style={s.buttons}>
      <MotionPressable style={s.reject} onPress={()=>{void changeSlot(slot,slot.status==='open'?'paused':'open')}}>
       <Text style={s.rejectText}>{slot.status==='open'?'Pause':'Reopen'}</Text></MotionPressable>
      <MotionPressable style={s.reject} onPress={()=>{void changeSlot(slot,'closed')}}><Trash2 size={16} color={C.coralDark}/>
       <Text style={s.rejectText}>Close</Text></MotionPressable></View>:null}
   </View>):<View style={s.empty}><CalendarDays size={29} color={C.teal}/><Text style={s.meta}>No slots published. Start with a real gap in your schedule.</Text></View>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},header:{padding:18,flexDirection:'row',alignItems:'center',gap:12},
 back:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.4,color:C.teal},heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:3},
 new:{backgroundColor:C.darkTeal,paddingHorizontal:15,minHeight:42,borderRadius:22,flexDirection:'row',alignItems:'center',gap:6},
 newText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},page:{padding:19,paddingBottom:40},
 hero:{backgroundColor:C.darkTeal,padding:22,borderRadius:24,gap:10},
 heroTitle:{fontSize:21,fontWeight:'800',color:'#FFFFFF'},heroSub:{fontSize:12,lineHeight:20,color:'#D1E6E1'},
 card:{backgroundColor:'#FFFFFF',padding:18,borderRadius:22,marginTop:12,...theme.shadow},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:22,marginBottom:11},
 field:{marginBottom:12},fieldLabel:{fontSize:12,fontWeight:'800',color:C.ink,marginBottom:7},
 input:{backgroundColor:'#F8FAF9',borderColor:C.line,borderWidth:1,borderRadius:13,paddingHorizontal:12,minHeight:48,
  color:C.ink,fontSize:14},two:{flexDirection:'row',gap:9},durations:{flexDirection:'row',gap:7,marginBottom:14},
 chip:{flex:1,backgroundColor:'#FFFFFF',borderColor:C.line,borderWidth:1,borderRadius:13,minHeight:39,alignItems:'center',justifyContent:'center'},
 chipOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextOn:{color:C.teal},
 note:{fontSize:11,lineHeight:17,color:C.muted},primary:{backgroundColor:C.darkTeal,borderRadius:24,minHeight:53,
  alignItems:'center',justifyContent:'center',marginTop:15},primaryText:{fontSize:13,color:'#FFFFFF',fontWeight:'800'},
 row:{flexDirection:'row',alignItems:'center',gap:9},cardTitle:{fontSize:15,fontWeight:'800',color:C.ink,flex:1},
 meta:{fontSize:12,color:C.muted,lineHeight:18,marginTop:6},summary:{fontSize:14,color:C.ink,lineHeight:21,marginTop:10},
 buttons:{flexDirection:'row',gap:9,marginTop:13},
 accept:{flex:1,minHeight:46,backgroundColor:C.darkTeal,borderRadius:19,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},
 reject:{minHeight:46,flex:1,backgroundColor:C.tealTint,borderRadius:19,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},
 rejectText:{fontSize:13,fontWeight:'800',color:C.teal},
 empty:{backgroundColor:'#FFFFFF',padding:22,borderRadius:22,marginTop:7,alignItems:'center',gap:8}
});
