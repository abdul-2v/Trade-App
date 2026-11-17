import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarDays,Clock3,MapPin,Navigation,Send,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Slot={id:string;tradesperson_id:string;trade:string;area_label:string;starts_at:string;ends_at:string;price_note:string|null;status:string};
type Request={id:string;slot_id:string;customer_id:string;summary:string;status:string;created_at:string};
const dateTime=(v:string)=>new Date(v).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const tr=['All','Plumber','Electrician','Heating','Builder','Locksmith','Carpenter','Roofer'];
export default function CustomerGridScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState(''),[slots,setSlots]=useState<Slot[]>([]),[requests,setRequests]=useState<Request[]>([]);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[saving,setSaving]=useState(false);
 const [trade,setTrade]=useState('All'),[area,setArea]=useState(''),[selected,setSelected]=useState<string|null>(null),[details,setDetails]=useState('');
 const [error,setError]=useState('');
 const load=async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;
  if(!id){setError('Sign in to explore available work slots.');setLoading(false);setRefreshing(false);return;}
  setUid(id);
  const [s,r]=await Promise.all([
   supabase.from('trade_grid_slots').select('id,tradesperson_id,trade,area_label,starts_at,ends_at,price_note,status').eq('status','open').gt('starts_at',new Date().toISOString()).order('starts_at').limit(100),
   supabase.from('trade_grid_requests').select('id,slot_id,customer_id,summary,status,created_at').eq('customer_id',id).order('created_at',{ascending:false}).limit(100)
  ]);
  if(s.error||r.error)setError(s.error?.message||r.error?.message||'Could not load available slots.');
  else{setError('');setSlots((s.data||[]) as Slot[]);setRequests((r.data||[]) as Request[]);}
  setLoading(false);setRefreshing(false);
 };
 useEffect(()=>{void load();},[]);
 const filtered=useMemo(()=>slots.filter(s=>(trade==='All'||s.trade.toLowerCase()===trade.toLowerCase())
  &&(!area.trim()||s.area_label.toLowerCase().includes(area.toLowerCase().trim()))),[slots,trade,area]);
 const slot=slots.find(s=>s.id===selected)||null;
 const selectedRequest=slot?requests.find(r=>r.slot_id===slot.id):null;
 const send=async()=>{
  if(!slot||saving)return;
  if(details.trim().length<8){Alert.alert('Describe your job','Tell the tradesperson what you need help with.');return;}
  const already=requests.find(r=>r.slot_id===slot.id);
  if(already){Alert.alert('Already requested','You have already responded to this availability window.');return;}
  setSaving(true);
  const {data,error:e}=await supabase.from('trade_grid_requests').insert({slot_id:slot.id,customer_id:uid,summary:details.trim()})
   .select('id,slot_id,customer_id,summary,status,created_at').single();
  setSaving(false);
  if(e||!data){Alert.alert('Unable to request this slot',e?.message||'Please try another window.');return;}
  setRequests(old=>[data as Request,...old]);setDetails('');
  Alert.alert('Request sent','The tradesperson can review your details and accept or decline. The appointment is not confirmed until they accept.');
 };
 const withdraw=async()=>{
  if(!selectedRequest||selectedRequest.status!=='pending'||saving)return;
  setSaving(true);
  const {data,error:e}=await supabase.from('trade_grid_requests').update({status:'withdrawn'})
    .eq('id',selectedRequest.id).eq('customer_id',uid).eq('status','pending')
    .select('id,slot_id,customer_id,summary,status,created_at').single();
  setSaving(false);
  if(e||!data){Alert.alert('Could not withdraw',e?.message||'Please refresh.');return;}
  setRequests(old=>old.map(r=>r.id===selectedRequest.id?data as Request:r));
 };
 return <View style={s.root}>
  <View style={s.head}><MotionPressable style={s.back} onPress={slot?()=>setSelected(null):goBack}><ArrowLeft size={22} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>TRADARR GRID</Text><Text style={s.heading}>{slot?'Request this slot':'Local work slots'}</Text></View></View>
  {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:60}}/>:
   <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
    {error?<Text style={s.error}>{error}</Text>:null}
    {slot?<><View style={s.hero}><Navigation size={24} color="#D0E6E2"/><Text style={s.heroTitle}>{slot.trade} · {slot.area_label}</Text>
      <Text style={s.heroSub}>{dateTime(slot.starts_at)} – {new Date(slot.ends_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</Text>
      <Text style={s.heroSub}>{slot.price_note||'Price to be agreed directly with the tradesperson'}</Text></View>
      <View style={s.card}><Text style={s.cardTitle}>Explain what you need</Text>
      {selectedRequest?<><Text style={s.info}>Your request: {selectedRequest.summary}</Text>
       <Text style={s.status}>Status: {selectedRequest.status==='pending'?'Waiting for the tradesperson':selectedRequest.status}</Text>
       {selectedRequest.status==='pending'?<MotionPressable disabled={saving} style={s.secondary} onPress={()=>{void withdraw()}}><Text style={s.secondaryText}>Withdraw request</Text></MotionPressable>:null}</>:
       <><Text style={s.info}>This sends an enquiry for the published time window. It does not automatically book the appointment or take payment.</Text>
        <TextInput multiline style={s.textarea} value={details} onChangeText={setDetails} maxLength={700}
         placeholder="e.g. Replace a leaking kitchen tap. Access via side entrance."
         placeholderTextColor="#96A2A4"/>
        <MotionPressable disabled={saving} style={s.primary} onPress={()=>{void send()}}>
         {saving?<ActivityIndicator color="#FFFFFF"/>:<><Send color="#FFFFFF" size={18}/><Text style={s.primaryText}>Request this slot</Text></>}</MotionPressable></>}
      </View></>:<>
      <View style={s.hero}><Navigation size={25} color="#D0E6E2"/><Text style={s.heroTitle}>Work when someone is already nearby.</Text>
       <Text style={s.heroSub}>Tradespeople can publish spare appointment windows in their local work area. Enquire about a suitable time—availability is genuine, not invented.</Text></View>
      <Text style={s.section}>Find a slot</Text>
      <TextInput style={s.input} value={area} onChangeText={setArea} placeholder="Filter by area, e.g. Leicester"
        placeholderTextColor="#9AA6A6"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
       {tr.map(k=><MotionPressable key={k} onPress={()=>setTrade(k)} style={[s.chip,trade===k&&s.chipOn]}>
        <Text style={[s.chipText,trade===k&&s.chipTextOn]}>{k}</Text></MotionPressable>)}</ScrollView>
      {filtered.length?filtered.map(v=><MotionPressable key={v.id} style={s.slot} onPress={()=>setSelected(v.id)}>
       <View style={s.slotIcon}><CalendarDays size={22} color={C.teal}/></View>
       <View style={{flex:1}}><Text style={s.slotTitle}>{v.trade} · {v.area_label}</Text>
        <Text style={s.slotMeta}>{dateTime(v.starts_at)}</Text>
        <Text style={s.slotMeta}>{v.price_note||'Price to be agreed'}</Text>
        {requests.some(q=>q.slot_id===v.id)?<Text style={s.status}>Your request: {requests.find(q=>q.slot_id===v.id)?.status}</Text>:null}
       </View><ArrowLeft size={18} color={C.teal} style={{transform:[{rotate:'180deg'}]}}/></MotionPressable>):
       <View style={s.empty}><Clock3 size={29} color={C.teal}/>
        <Text style={s.cardTitle}>No slots match yet</Text>
        <Text style={s.info}>Published appointments will appear when tradespeople make gaps available. This doesn't mean nobody works in your area—use Find a Trade for normal bookings.</Text>
       </View>}
      <View style={s.note}><ShieldCheck size={20} color={C.teal}/><Text style={s.noteText}>Only approximate work areas are shown. Tradarr doesn't share a tradesperson's live position or guarantee a discounted price.</Text></View>
     </>}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},head:{padding:17,flexDirection:'row',alignItems:'center',gap:12},
 back:{width:44,height:44,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:C.teal},
 heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:4},page:{padding:19,paddingBottom:42},
 hero:{backgroundColor:C.darkTeal,borderRadius:25,padding:22,gap:9},
 heroTitle:{fontSize:22,fontWeight:'800',color:'#FFFFFF',lineHeight:28},
 heroSub:{fontSize:12,color:'#DBEBE8',lineHeight:19},
 section:{fontSize:18,fontWeight:'800',color:C.ink,marginTop:23,marginBottom:12},
 input:{backgroundColor:'#FFFFFF',borderColor:C.line,borderWidth:1,borderRadius:15,minHeight:49,
  paddingHorizontal:13,color:C.ink,fontSize:14},
 chips:{gap:7,paddingVertical:12,paddingRight:25},
 chip:{borderRadius:20,borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF',paddingVertical:9,paddingHorizontal:14},
 chipOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextOn:{color:C.teal},
 slot:{backgroundColor:'#FFFFFF',borderRadius:21,padding:15,marginBottom:11,flexDirection:'row',alignItems:'center',gap:12,...theme.shadow},
 slotIcon:{width:45,height:45,backgroundColor:C.tealTint,borderRadius:15,alignItems:'center',justifyContent:'center'},
 slotTitle:{fontSize:15,fontWeight:'800',color:C.ink},slotMeta:{fontSize:12,color:C.muted,lineHeight:17,marginTop:6},
 status:{fontSize:12,fontWeight:'800',color:C.teal,marginTop:11},
 card:{backgroundColor:'#FFFFFF',borderRadius:24,padding:19,marginTop:17,...theme.shadow},
 cardTitle:{fontSize:18,fontWeight:'800',color:C.ink},
 info:{fontSize:12,color:C.muted,lineHeight:20,marginTop:10},
 textarea:{marginTop:16,minHeight:125,borderRadius:14,backgroundColor:'#F7FAF9',borderWidth:1,borderColor:C.line,
  padding:13,color:C.ink,fontSize:14,textAlignVertical:'top'},
 primary:{minHeight:55,borderRadius:27,backgroundColor:C.darkTeal,alignItems:'center',justifyContent:'center',
  gap:9,flexDirection:'row',marginTop:16},primaryText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},
 secondary:{padding:14,alignItems:'center',backgroundColor:C.tealTint,borderRadius:22,marginTop:17},
 secondaryText:{color:C.teal,fontWeight:'800',fontSize:12},
 empty:{padding:25,borderRadius:22,alignItems:'center',gap:8,backgroundColor:'#FFFFFF',marginTop:12},
 note:{flexDirection:'row',gap:10,alignItems:'center',padding:15,backgroundColor:C.tealTint,borderRadius:18,marginTop:16},
 noteText:{flex:1,fontSize:11,color:C.teal,lineHeight:17},
 error:{padding:12,fontSize:12,color:C.coralDark}
});
