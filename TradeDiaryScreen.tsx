import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import type {ScrollViewInstance} from 'react-native';
import {ArrowLeft,CalendarDays,ChevronRight,Check,Clock3,MapPin,Plus,Pencil,Users,Trash2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import BookingReschedulePanel from './BookingReschedulePanel';
import {FormFlowSteps,FormFlowFooter} from './PremiumFormFlow';
import {DocumentPresetBar} from './SavedWorkLibrary';
import {formatUKDateTime,ukSlotToISO,advanceISOByMinutes,ukDayOf} from './lib/scheduling';

const C=theme.colors;
type Customer={id:string;name:string;address:string|null};
type Appointment={id:string;tradesperson_id:string;customer_id:string|null;customer_name:string|null;title:string;address:string|null;notes:string|null;starts_at:string;ends_at:string;job_id:string|null;grid_request_id:string|null;status:'scheduled'|'completed'|'cancelled'};
const day=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const clock=(d:Date)=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
function Field({label,value,change,multi,placeholder}:{label:string;value:string;change:(v:string)=>void;multi?:boolean;placeholder?:string}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
 <TextInput value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor="#94A2A2"
 style={[s.input,multi&&{minHeight:81}]} multiline={multi} textAlignVertical={multi?'top':'center'}/></View>;
}
export default function TradeDiaryScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [items,setItems]=useState<Appointment[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [view,setView]=useState<'upcoming'|'past'>('upcoming');
 const [editing,setEditing]=useState(false);
 const [bookingStep,setBookingStep]=useState(0);
 const bookingScrollRef=useRef<ScrollViewInstance>(null);
 useEffect(()=>{if(editing)bookingScrollRef.current?.scrollTo({y:0,animated:false});},[bookingStep,editing]);
 const [editId,setEditId]=useState<string|null>(null);
 const [customerId,setCustomerId]=useState<string|null>(null);
 const [pickCustomer,setPickCustomer]=useState(false);
 const [title,setTitle]=useState('');
 const [name,setName]=useState('');
 const [address,setAddress]=useState('');
 const [notes,setNotes]=useState('');
 const [date,setDate]=useState(day(new Date()));
 const [time,setTime]=useState('09:00');
 const [duration,setDuration]=useState(60);
 useEffect(()=>{let alive=true;(async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;
  if(!id||!alive){if(alive)setLoading(false);return;}
  setUid(id);
  const [appointments,people]=await Promise.all([
   supabase.from('trade_appointments').select('*').eq('tradesperson_id',id).order('starts_at',{ascending:true}).limit(400),
   supabase.from('trade_customers').select('id,name,address').eq('tradesperson_id',id).order('name'),
  ]);
  if(!alive)return;
  if(appointments.error)Alert.alert('Could not load diary',appointments.error.message);
  setItems((appointments.data||[]) as Appointment[]);
  setCustomers((people.data||[]) as Customer[]);
  setLoading(false);
 })().catch(e=>{if(alive){setLoading(false);Alert.alert('Diary error',String(e))}});
 return()=>{alive=false};},[]);
 const refreshAppointments=async()=>{
  if(!uid)return;
  const {data,error}=await supabase.from('trade_appointments').select('*')
   .eq('tradesperson_id',uid).order('starts_at',{ascending:true}).limit(400);
  if(!error)setItems((data||[]) as Appointment[]);
 };
 const startNew=()=>{setEditId(null);setCustomerId(null);setTitle('');setName('');setAddress('');setNotes('');setDate(ukDayOf(new Date()));setTime('09:00');setDuration(60);setBookingStep(0);setEditing(true)};
 const startEdit=(v:Appointment)=>{const a=new Date(v.starts_at),b=new Date(v.ends_at);
  if(v.job_id){Alert.alert('Confirmed booking','To change the time of an accepted Tradarr job, use Request a different time below. Both parties must agree.');return;}
  if(v.grid_request_id){Alert.alert('Grid booking','This slot is tied to an accepted Grid request. Its time cannot be edited here.');return;}
  setEditId(v.id);setCustomerId(v.customer_id);setTitle(v.title);setName(v.customer_name||'');setAddress(v.address||'');setNotes(v.notes||'');
  setDate(ukDayOf(a));setTime(a.toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  setDuration(Math.max(15,Math.round((b.getTime()-a.getTime())/60000)));setBookingStep(0);setEditing(true);
 };
 const setCustomer=(v:Customer|null)=>{setCustomerId(v?.id||null);if(v){setName(v.name);setAddress(v.address||'')}setPickCustomer(false)};
 const persist=async(a:Date,b:Date)=>{setSaving(true);
  const payload={tradesperson_id:uid,customer_id:customerId,customer_name:name.trim()||null,title:title.trim(),address:address.trim()||null,notes:notes.trim()||null,
  starts_at:a.toISOString(),ends_at:b.toISOString(),updated_at:new Date().toISOString()};
  const result=editId?
  await supabase.from('trade_appointments').update(payload).eq('id',editId).eq('tradesperson_id',uid).select('*').single():
  await supabase.from('trade_appointments').insert({...payload,status:'scheduled'}).select('*').single();
  setSaving(false);
  if(result.error||!result.data){Alert.alert('Could not save',result.error?.message||'Please try again');return;}
  setItems(old=>[...old.filter(i=>i.id!==result.data.id),result.data as Appointment]);
  setEditing(false);setView('upcoming');
 };
 const save=async()=>{
  if(!uid||saving)return;
  if(!title.trim()){Alert.alert('Enter a job title');return;}
  const iso=ukSlotToISO(date,time);
  const endIso=iso?advanceISOByMinutes(iso,duration):null;
  if(!iso||!endIso||Date.parse(iso)<Date.now()-120000){
   Alert.alert('Check the appointment','Enter a valid UK date and time. A new appointment must be in the future.');return;
  }
  const a=new Date(iso),b=new Date(endIso);
  const overlap=items.find(v=>v.id!==editId&&v.status==='scheduled'&&a.getTime()<Date.parse(v.ends_at)&&b.getTime()>Date.parse(v.starts_at));
  if(overlap){Alert.alert('Time already booked','This overlaps '+overlap.title+'. Choose another appointment time.');return;}
  await persist(a,b);
 };
 const updateStatus=async(v:Appointment,status:Appointment['status'])=>{
  const {data,error}=await supabase.from('trade_appointments').update({status,updated_at:new Date().toISOString()}).eq('id',v.id).eq('tradesperson_id',uid).select('*').single();
  if(error||!data){Alert.alert('Unable to update',error?.message||'Try again');return;}
  setItems(old=>old.map(x=>x.id===v.id?data as Appointment:x));
 };
 const remove=(v:Appointment)=>Alert.alert('Delete booking?',v.title,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{const {error}=await supabase.from('trade_appointments').delete().eq('id',v.id).eq('tradesperson_id',uid);
   if(error)Alert.alert('Could not delete',error.message);else setItems(old=>old.filter(x=>x.id!==v.id));}}]);
 const now=Date.now();
 const visible=items.filter(v=>view==='upcoming'?
  v.status==='scheduled'&&new Date(v.ends_at).getTime()>=now:
  v.status!=='scheduled'||new Date(v.ends_at).getTime()<now
 ).sort((a,b)=>(view==='upcoming'?1:-1)*(new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()));
 return <View style={s.root}>
 <View style={s.header}>
 <MotionPressable style={s.back} onPress={editing?()=>setEditing(false):goBack}><ArrowLeft size={23} color={C.ink}/></MotionPressable>
 <View style={{flex:1}}><Text style={s.eyebrow}>BUSINESS TOOLS</Text><Text style={s.title}>{editing?(editId?'Edit booking':'New booking'):'Job diary'}</Text></View>
 {!editing?<MotionPressable onPress={startNew} style={s.new}><Plus size={20} color="#FFFFFF"/><Text style={s.newText}>Add</Text></MotionPressable>:null}
 </View>
 {loading?<ActivityIndicator style={{marginTop:50}} size="large" color={C.teal}/>:
 editing?<View style={{flex:1}}><ScrollView ref={bookingScrollRef} automaticallyAdjustKeyboardInsets contentContainerStyle={[s.page,{paddingBottom:110}]} keyboardShouldPersistTaps="handled">
 <DocumentPresetBar ownerId={uid} scope="document" documentKind="appointment"
  snapshot={{title,notes,duration,address}}
  onApply={payload=>{
   if(!payload||typeof payload!=='object')return;
   setTitle(String(payload.title||''));setNotes(String(payload.notes||''));
   setAddress(String(payload.address||''));
   setDuration(Math.max(15,Math.min(1440,Number(payload.duration)||60)));
   setBookingStep(0);
   // Customer and appointment time deliberately remain unchanged: never silently rebook a previous customer.
  }}/>
 <FormFlowSteps labels={['Job details','Time','Review']} active={bookingStep} onSelect={setBookingStep}
 subtitle={['Who and where is the appointment for?','Choose when the work takes place.','Check everything before adding it to the diary.'][bookingStep]}/>
 {bookingStep===0&&<View style={s.card}>
 <Field label="Work / appointment title *" value={title} change={setTitle} placeholder="e.g. Replace radiator valves"/>
 <Text style={s.explain}>
  For a Tradarr customer job, open the accepted job in Jobs to propose an appointment.
  The customer must agree before the booking enters your diary.
 </Text>
 <Text style={s.label}>Customer (optional)</Text>
 <MotionPressable style={s.customerPick} onPress={()=>setPickCustomer(x=>!x)}>
 <Users size={18} color={C.teal}/><Text style={{flex:1,color:C.teal,fontSize:13,fontWeight:'800'}}>{customerId?customers.find(x=>x.id===customerId)?.name:'Choose saved customer'}</Text><ChevronRight size={18} color={C.teal}/>
 </MotionPressable>
 {pickCustomer?<View style={s.pickList}>
 <MotionPressable style={s.pickOption} onPress={()=>setCustomer(null)}><Text style={s.pickText}>No saved customer</Text></MotionPressable>
 {customers.map(x=><MotionPressable key={x.id} onPress={()=>setCustomer(x)} style={s.pickOption}><Text style={s.pickText}>{x.name}</Text></MotionPressable>)}
 </View>:null}
 <Field label="Customer name" value={name} change={setName}/>
 <Field label="Job address" value={address} change={setAddress} multi/>
 </View>}
 {bookingStep===1&&<View style={s.card}>
 <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Field label="Date (YYYY-MM-DD)" value={date} change={setDate}/></View>
 <View style={{flex:1}}><Field label="Start time (HH:MM)" value={time} change={setTime}/></View></View>
 <Text style={s.label}>Time reserved</Text>
 <View style={s.chips}>{[30,60,90,120,180].map(d=><MotionPressable key={d} onPress={()=>setDuration(d)} style={[s.chip,d===duration&&s.chipOn]}>
 <Text style={[s.chipText,d===duration&&s.chipTextOn]}>{d<60?d+'m':d/60+'h'}</Text></MotionPressable>)}</View>
 <Field label="Job notes" value={notes} change={setNotes} multi placeholder="Parts needed, access instructions..."/>
 </View>}
 {bookingStep===2&&<View style={s.card}>
  <Text style={s.reviewEyebrow}>APPOINTMENT SUMMARY</Text>
  <Text style={s.reviewTitle}>{title||'Appointment title missing'}</Text>
  <Text style={s.reviewLine}>Customer: {name||'Not specified'}</Text>
  <Text style={s.reviewLine}>Address: {address||'Not specified'}</Text>
  <Text style={s.reviewLine}>Date: {date} at {time}</Text>
  <Text style={s.reviewLine}>Reserved for {duration} minutes</Text>
  {notes?<Text style={[s.reviewLine,{marginTop:10}]}>Notes: {notes}</Text>:null}
  <Text style={[s.explain,{marginTop:16,marginBottom:0}]}>Tradarr checks your diary for overlapping appointments when you save.</Text>
 </View>}
 </ScrollView>
 <FormFlowFooter active={bookingStep} total={3}
 onPrevious={()=>setBookingStep(v=>Math.max(0,v-1))}
 onNext={()=>{
   if(bookingStep===0&&!title.trim()){Alert.alert('Add an appointment title','Describe the work before continuing.');return;}
   if(bookingStep<2)setBookingStep(v=>v+1);else void save();
 }}
 nextDisabled={saving} primaryLabel={bookingStep===2?(saving?'Saving…':'Save appointment'):'Continue'}/>
 </View>:
 <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page}>
 <Text style={s.explain}>Appointments from accepted Tradarr jobs and Grid slots appear alongside your private diary. Confirmed times cannot overlap.</Text>
 <View style={s.summary}><CalendarDays size={26} color={C.teal}/>
 <View style={{flex:1}}><Text style={s.summaryBig}>{items.filter(x=>x.status==='scheduled'&&new Date(x.ends_at).getTime()>=now).length} upcoming</Text>
 <Text style={s.summarySub}>Scheduled appointments</Text></View></View>
 <View style={s.tabs}>{(['upcoming','past'] as const).map(x=><MotionPressable key={x} onPress={()=>setView(x)} style={[s.tab,view===x&&s.tabOn]}>
 <Text style={[s.tabText,view===x&&s.tabTextOn]}>{x==='upcoming'?'Upcoming':'Past & completed'}</Text></MotionPressable>)}</View>
 {visible.length?visible.map(x=><View key={x.id} style={s.card}>
 <View style={s.entryHead}><View style={{flex:1}}><Text style={s.date}>{new Date(x.starts_at).toLocaleDateString('en-GB',{timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short'})}</Text>
 <Text style={s.entryTitle}>{x.title}</Text></View>
 <Text style={s.time}>{new Date(x.starts_at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})}</Text></View>
 <View style={s.info}><Clock3 size={15} color={C.muted}/><Text style={s.sub}>{Math.round((new Date(x.ends_at).getTime()-new Date(x.starts_at).getTime())/60000)} mins · {x.status}</Text></View>
 {x.customer_name?<View style={s.info}><Users size={15} color={C.muted}/><Text style={s.sub}>{x.customer_name}</Text></View>:null}
 {x.address?<View style={s.info}><MapPin size={15} color={C.muted}/><Text style={s.sub}>{x.address}</Text></View>:null}
 {x.notes?<Text style={s.note}>{x.notes}</Text>:null}
 {x.job_id&&x.status==='scheduled'?<BookingReschedulePanel jobId={x.job_id}
   currentStart={x.starts_at} currentEnd={x.ends_at} onUpdated={()=>{void refreshAppointments()}}/>:null}
 {x.grid_request_id?<Text style={s.note}>Grid booking · exact time reserved</Text>:null}
 <View style={s.actions}>
 {!x.job_id&&!x.grid_request_id?<MotionPressable onPress={()=>startEdit(x)} style={s.smallBtn}>
  <Pencil size={16} color={C.teal}/><Text style={s.smallText}>Edit</Text></MotionPressable>:null}
 {!x.job_id&&!x.grid_request_id&&x.status==='scheduled'?<><MotionPressable onPress={()=>updateStatus(x,'completed')} style={s.smallBtn}><Check size={16} color={C.teal}/><Text style={s.smallText}>Complete</Text></MotionPressable>
 <MotionPressable onPress={()=>updateStatus(x,'cancelled')} style={s.smallBtn}><Text style={s.smallText}>Cancel</Text></MotionPressable></>:null}
 {!x.job_id&&!x.grid_request_id?<MotionPressable style={{marginLeft:'auto',padding:9}}
 onPress={()=>remove(x)}><Trash2 size={17} color={C.coralDark}/></MotionPressable>:null}</View>
 </View>):<View style={s.empty}><CalendarDays size={35} color={C.teal}/><Text style={s.emptyTitle}>{view==='upcoming'?'No upcoming bookings':'No past appointments'}</Text>
 <Text style={s.explain}>{view==='upcoming'?'Add a private job or appointment to organise your day.':'Completed or past bookings appear here.'}</Text>
 {view==='upcoming'?<MotionPressable onPress={startNew} style={s.primary}><Plus size={19} color="#FFFFFF"/><Text style={s.primaryText}>Add booking</Text></MotionPressable>:null}</View>}
 </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},header:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:20,paddingVertical:15},
 back:{width:44,height:44,borderRadius:24,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:C.teal},title:{fontSize:27,fontWeight:'800',color:C.ink,marginTop:3},
 new:{backgroundColor:C.darkTeal,paddingHorizontal:15,minHeight:44,borderRadius:23,flexDirection:'row',alignItems:'center',gap:5},newText:{color:'#FFFFFF',fontWeight:'800'},
 page:{paddingHorizontal:20,paddingBottom:40,paddingTop:9},
 reviewEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:C.teal},
 reviewTitle:{fontSize:22,fontWeight:'800',color:C.ink,marginTop:9,marginBottom:16},
 reviewLine:{fontSize:13,color:C.muted,lineHeight:22,marginBottom:5},explain:{color:C.muted,fontSize:13,lineHeight:21,marginBottom:18},
 card:{backgroundColor:'#FFFFFF',padding:18,borderRadius:23,marginBottom:14,...theme.shadow},
 field:{marginBottom:13},label:{fontSize:12,fontWeight:'800',color:C.ink,marginBottom:7},
 input:{minHeight:48,borderRadius:13,borderWidth:1,borderColor:C.line,paddingHorizontal:12,paddingVertical:10,color:C.ink,fontSize:14,backgroundColor:'#F9FBFA'},
 customerPick:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,minHeight:49,backgroundColor:C.tealTint,borderRadius:13,marginBottom:13},
 pickList:{maxHeight:205,borderRadius:13,paddingHorizontal:10,backgroundColor:'#F7FAF8',marginBottom:12},
 pickOption:{paddingVertical:12,borderBottomWidth:1,borderColor:C.line},pickText:{color:C.ink,fontWeight:'700',fontSize:13},
 chips:{flexDirection:'row',gap:5,marginBottom:15},chip:{flex:1,minHeight:40,borderRadius:14,backgroundColor:'#F2F6F5',alignItems:'center',justifyContent:'center'},
 chipOn:{backgroundColor:C.darkTeal},chipText:{color:C.muted,fontSize:12,fontWeight:'800'},chipTextOn:{color:'#FFFFFF'},
 primary:{minHeight:55,paddingHorizontal:17,backgroundColor:C.darkTeal,flexDirection:'row',alignItems:'center',justifyContent:'center',borderRadius:28,gap:9,marginTop:10},
 primaryText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},
 summary:{borderRadius:24,backgroundColor:'#FFFFFF',padding:19,flexDirection:'row',alignItems:'center',gap:15,...theme.shadow},
 summaryBig:{fontSize:19,fontWeight:'800',color:C.ink},summarySub:{fontSize:12,color:C.muted,marginTop:5},
 tabs:{flexDirection:'row',gap:5,padding:4,backgroundColor:'#E7EFED',borderRadius:18,marginVertical:18},
 tab:{flex:1,minHeight:46,borderRadius:15,alignItems:'center',justifyContent:'center'},tabOn:{backgroundColor:'#FFFFFF'},
 tabText:{color:C.muted,fontWeight:'700',fontSize:13},tabTextOn:{color:C.ink,fontWeight:'800'},
 entryHead:{flexDirection:'row',alignItems:'center'},date:{fontSize:12,fontWeight:'800',color:C.teal},
 entryTitle:{fontSize:17,fontWeight:'800',color:C.ink,marginTop:6},time:{fontSize:13,fontWeight:'800',color:C.teal,backgroundColor:C.tealTint,padding:9,borderRadius:12,overflow:'hidden'},
 info:{flexDirection:'row',gap:8,alignItems:'center',marginTop:10},sub:{flex:1,fontSize:12,color:C.muted},
 note:{marginTop:12,padding:10,borderRadius:10,backgroundColor:'#F6FAF8',fontSize:12,color:C.ink},
 actions:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7,borderTopWidth:1,borderTopColor:C.line,paddingTop:12,marginTop:15},
 smallBtn:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:C.tealTint,borderRadius:19,paddingHorizontal:12,minHeight:35},
 smallText:{fontSize:12,fontWeight:'800',color:C.teal},
 empty:{backgroundColor:'#FFFFFF',borderRadius:24,alignItems:'center',gap:9,padding:26,...theme.shadow},emptyTitle:{fontSize:18,fontWeight:'800',color:C.ink}
});
