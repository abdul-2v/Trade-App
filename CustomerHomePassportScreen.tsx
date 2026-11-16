import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarClock,Check,ChevronRight,Home,Plus,ShieldCheck,Trash2,Wrench} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Property={id:string;customer_id:string;label:string;address:string;created_at:string};
type Category='repair'|'service'|'inspection'|'warranty'|'other';
type RecordRow={id:string;customer_id:string;property_id:string;title:string;category:Category;completed_on:string|null;next_due:string|null;notes:string|null;created_at:string};
type CompletedJob={id:string;trade:string;issue:string;completed_at:string|null;status:string};
const categories:Category[]=['repair','service','inspection','warranty','other'];
const format=(s:string|null)=>s?new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
const today=()=>new Date().toISOString().slice(0,10);
const checkDate=(s:string)=>!s.trim()||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime())&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
function Field({label,value,set,placeholder,multi}:{label:string;value:string;set:(v:string)=>void;placeholder?:string;multi?:boolean}){
 return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>
 <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor="#93A0A2"
  style={[s.input,multi&&{minHeight:90}]} multiline={multi} textAlignVertical={multi?'top':'center'}/></View>;
}
export default function CustomerHomePassportScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState(''),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);
 const [properties,setProperties]=useState<Property[]>([]),[records,setRecords]=useState<RecordRow[]>([]),[jobs,setJobs]=useState<CompletedJob[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null),[screen,setScreen]=useState<'list'|'newProperty'|'newRecord'>('list');
 const [propertyName,setPropertyName]=useState(''),[address,setAddress]=useState('');
 const [title,setTitle]=useState(''),[kind,setKind]=useState<Category>('repair'),[completed,setCompleted]=useState(today()),[due,setDue]=useState(''),[notes,setNotes]=useState('');
 const [error,setError]=useState('');
 const selected=properties.find(p=>p.id===selectedId)||properties[0]||null;
 const currentRecords=records.filter(r=>r.property_id===selected?.id);
 const upcoming=useMemo(()=>currentRecords.filter(r=>r.next_due&&r.next_due<=new Date(Date.now()+30*86400000).toISOString().slice(0,10))
  .sort((a,b)=>String(a.next_due).localeCompare(String(b.next_due))),[records,selected?.id]);
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setBusy(true);
  const {data:auth}=await supabase.auth.getUser();if(!auth.user){setError('Please sign in to manage your home.');setBusy(false);setRefreshing(false);return;}
  setUid(auth.user.id);
  const [p,r,j,u]=await Promise.all([
   supabase.from('customer_properties').select('*').eq('customer_id',auth.user.id).order('created_at'),
   supabase.from('customer_home_records').select('*').eq('customer_id',auth.user.id).order('created_at',{ascending:false}).limit(300),
   supabase.from('jobs').select('id,trade,issue,completed_at,status').eq('customer_id',auth.user.id).eq('status','completed').order('completed_at',{ascending:false}).limit(30),
   supabase.from('urgent_requests').select('id,trade,issue,status').eq('customer_id',auth.user.id).eq('status','completed').limit(30)
  ]);
  if(p.error||r.error)setError(p.error?.message||r.error?.message||'Could not load your home records.');else setError('');
  setProperties((p.data||[]) as Property[]);setRecords((r.data||[]) as RecordRow[]);
  setJobs([...(j.data||[]),...(u.data||[]).map(x=>({...x,completed_at:null}))] as CompletedJob[]);
  setBusy(false);setRefreshing(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const createProperty=async()=>{
  if(saving||!uid)return;
  if(!propertyName.trim()||!address.trim()){Alert.alert('Property details needed','Enter a name and address.');return;}
  setSaving(true);
  const {data,error:e}=await supabase.from('customer_properties').insert({
   customer_id:uid,label:propertyName.trim(),address:address.trim()
  }).select('*').single();
  setSaving(false);
  if(e||!data){Alert.alert('Could not save property',e?.message||'Please try again.');return;}
  setProperties(old=>[...old,data as Property]);setSelectedId(data.id);setPropertyName('');setAddress('');setScreen('list');
 };
 const createRecord=async()=>{
  if(saving||!uid||!selected)return;
  if(!title.trim()){Alert.alert('Enter a record title','Describe the repair, service, warranty or inspection.');return;}
  if(!checkDate(completed)||!checkDate(due)){Alert.alert('Check the dates','Use YYYY-MM-DD, or leave a date blank.');return;}
  setSaving(true);
  const {data,error:e}=await supabase.from('customer_home_records').insert({
   customer_id:uid,property_id:selected.id,title:title.trim(),category:kind,
   completed_on:completed.trim()||null,next_due:due.trim()||null,notes:notes.trim()||null
  }).select('*').single();
  setSaving(false);
  if(e||!data){Alert.alert('Could not save record',e?.message||'Please try again.');return;}
  setRecords(old=>[data as RecordRow,...old]);setTitle('');setNotes('');setDue('');setCompleted(today());setKind('repair');setScreen('list');
 };
 const removeRecord=(v:RecordRow)=>Alert.alert('Delete this record?',v.title,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{
   const {error:e}=await supabase.from('customer_home_records').delete().eq('id',v.id).eq('customer_id',uid);
   if(e)Alert.alert('Could not delete',e.message);else setRecords(old=>old.filter(r=>r.id!==v.id));
  }}]);
 const back=()=>screen!=='list'?setScreen('list'):goBack();
 return <View style={s.root}>
  <View style={s.header}><MotionPressable style={s.back} onPress={back} accessibilityRole="button" accessibilityLabel="Back"><ArrowLeft size={22} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.overline}>YOUR PROPERTY</Text><Text style={s.heading}>{screen==='newProperty'?'Add property':screen==='newRecord'?'Add home record':'My Home'}</Text></View>
  </View>
  {busy?<ActivityIndicator size="large" color={C.teal} style={{marginTop:60}}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   {error?<View style={s.card}><Text style={s.meta}>{error}</Text></View>:null}
   {screen==='newProperty'?<>
    <Text style={s.intro}>Create a private home profile. This information is only visible to you.</Text>
    <View style={s.card}>
     <Field label="Property name *" value={propertyName} set={setPropertyName} placeholder="e.g. Main home, Mum's house"/>
     <Field label="Property address *" value={address} set={setAddress} multi placeholder="Street, town and postcode"/>
     <MotionPressable onPress={()=>{void createProperty()}} disabled={saving} style={s.primary}>
      {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Save property</Text>}</MotionPressable>
    </View>
   </>:screen==='newRecord'?<>
    <Text style={s.intro}>Add a repair, service, inspection or warranty. A future due date will appear in your on-screen reminders.</Text>
    <View style={s.card}>
     <Field label="Record title *" value={title} set={setTitle} placeholder="e.g. Boiler annual service"/>
     <Text style={s.fieldLabel}>Category</Text><View style={s.choices}>
      {categories.map(c=><MotionPressable key={c} onPress={()=>setKind(c)} style={[s.chip,kind===c&&s.chipOn]}>
       <Text style={[s.chipText,kind===c&&s.chipTextOn]}>{c[0].toUpperCase()+c.slice(1)}</Text></MotionPressable>)}
     </View>
     <Field label="Work date (YYYY-MM-DD, optional)" value={completed} set={setCompleted} placeholder="2026-11-16"/>
     <Field label="Next due (YYYY-MM-DD, optional)" value={due} set={setDue} placeholder="2027-11-16"/>
     <Field label="Details or warranty notes (optional)" value={notes} set={setNotes} multi placeholder="Who did the work, what was replaced, document reference..."/>
     <Text style={s.tiny}>Reminders currently appear inside My Home only. They are not push notifications.</Text>
     <MotionPressable onPress={()=>{void createRecord()}} disabled={saving} style={s.primary}>
      {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Save home record</Text>}</MotionPressable>
    </View>
   </>:<>
    <View style={s.hero}><Home size={25} color="#CFE6E0"/><Text style={s.heroTitle}>One place for everything about your home.</Text>
     <Text style={s.heroText}>Keep maintenance dates, repairs and warranty notes ready when you need them.</Text></View>
    {properties.length?<>
      <Text style={s.section}>Your properties</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
       {properties.map(p=><MotionPressable key={p.id} onPress={()=>setSelectedId(p.id)}
        style={[s.tab,selected?.id===p.id&&s.tabOn]}><Text style={[s.tabText,selected?.id===p.id&&s.tabTextOn]}>{p.label}</Text></MotionPressable>)}
       <MotionPressable onPress={()=>setScreen('newProperty')} style={s.tab}><Plus size={17} color={C.teal}/><Text style={s.tabText}>Add</Text></MotionPressable>
      </ScrollView>
      {selected?<View style={s.propertyCard}><View style={{flex:1}}><Text style={s.propertyTitle}>{selected.label}</Text><Text style={s.meta}>{selected.address}</Text></View>
       <Home size={23} color={C.teal}/></View>:null}
      <View style={s.sectionRow}><Text style={s.section}>Upcoming care</Text><CalendarClock size={21} color={C.teal}/></View>
      {upcoming.length?upcoming.map(r=><View key={r.id} style={s.due}>
       <View style={{flex:1}}><Text style={s.recordTitle}>{r.title}</Text><Text style={s.meta}>{r.next_due&&r.next_due<today()?'Overdue: ':'Due: '}{format(r.next_due)}</Text></View>
       <CalendarClock size={20} color={C.teal}/></View>):<View style={s.smallEmpty}>
        <Text style={s.meta}>No maintenance reminders due in the next 30 days.</Text>
      </View>}
      <View style={s.sectionRow}><Text style={s.section}>Your home records</Text>
        <MotionPressable style={s.actionTextButton} onPress={()=>setScreen('newRecord')}>
         <Plus color={C.teal} size={17}/><Text style={s.actionText}>Add record</Text></MotionPressable></View>
      {currentRecords.length?currentRecords.map(r=><View key={r.id} style={s.record}>
       <View style={s.recordIcon}><Wrench size={20} color={C.teal}/></View>
       <View style={{flex:1}}><Text style={s.recordTitle}>{r.title}</Text>
        <Text style={s.meta}>{r.category} {r.completed_on?'· '+format(r.completed_on):''}</Text>
        {r.notes?<Text style={s.recordNote}>{r.notes}</Text>:null}
        {r.next_due?<Text style={s.next}>Next due: {format(r.next_due)}</Text>:null}</View>
       <MotionPressable onPress={()=>removeRecord(r)} style={{padding:8}} accessibilityRole="button" accessibilityLabel={'Delete '+r.title}>
        <Trash2 color={C.coralDark} size={17}/></MotionPressable>
      </View>):<View style={s.smallEmpty}><Text style={s.meta}>Your records will appear here. Save your first repair or service to get started.</Text>
        <MotionPressable style={s.primary} onPress={()=>setScreen('newRecord')}><Plus color="#FFFFFF" size={18}/><Text style={s.primaryText}>Add first record</Text></MotionPressable></View>}
    </>:<View style={s.smallEmpty}><Text style={s.emptyTitle}>Set up your first home</Text>
       <Text style={s.meta}>Add an address to start keeping a secure history of work and reminders.</Text>
       <MotionPressable style={s.primary} onPress={()=>setScreen('newProperty')}><Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Add a property</Text></MotionPressable>
    </View>}
    {jobs.length?<><Text style={s.section}>Completed Tradarr jobs</Text><Text style={s.intro}>Recent completed requests from this account. They are not automatically assigned to a property.</Text>
     {jobs.slice(0,8).map(j=><View key={j.id} style={s.record}><View style={s.recordIcon}><Check size={19} color={C.teal}/></View>
       <View style={{flex:1}}><Text style={s.recordTitle}>{j.issue}</Text><Text style={s.meta}>{j.trade}{j.completed_at?' · '+new Date(j.completed_at).toLocaleDateString('en-GB'):''}</Text></View>
     </View>)}
    </>:null}
    <View style={s.note}><ShieldCheck color={C.teal} size={21}/><Text style={s.tiny}>Your home records are private. This first version stores notes and maintenance dates, not uploaded certificates or automatic push alerts.</Text></View>
   </>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 header:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:20,paddingTop:17,paddingBottom:14},
 back:{width:44,height:44,backgroundColor:'#FFFFFF',borderRadius:23,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'800',color:C.teal,letterSpacing:1.3},
 heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:3},
 page:{padding:19,paddingBottom:44},
 hero:{backgroundColor:C.darkTeal,padding:23,borderRadius:25,gap:10},
 heroTitle:{fontSize:22,fontWeight:'800',color:'#FFFFFF'},
 heroText:{fontSize:12,lineHeight:20,color:'#D0E2DF'},
 intro:{fontSize:12,lineHeight:19,color:C.muted,marginBottom:16},
 section:{fontSize:18,fontWeight:'800',color:C.ink,marginTop:21,marginBottom:12},
 sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 tabs:{gap:9,paddingRight:14,marginBottom:14},
 tab:{flexDirection:'row',gap:5,alignItems:'center',paddingHorizontal:15,minHeight:41,borderRadius:21,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line},
 tabOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 tabText:{fontSize:12,color:C.muted,fontWeight:'800'},tabTextOn:{color:C.teal},
 propertyCard:{backgroundColor:'#FFFFFF',borderRadius:23,padding:18,flexDirection:'row',alignItems:'center',gap:12,...theme.shadow},
 propertyTitle:{color:C.ink,fontWeight:'800',fontSize:17},
 meta:{color:C.muted,fontSize:12,lineHeight:18,marginTop:5},
 due:{backgroundColor:C.tealTint,borderRadius:19,padding:15,marginBottom:8,flexDirection:'row',alignItems:'center',gap:10},
 record:{backgroundColor:'#FFFFFF',padding:15,borderRadius:20,marginBottom:9,flexDirection:'row',alignItems:'flex-start',gap:11,...theme.shadow},
 recordIcon:{width:40,height:40,borderRadius:14,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 recordTitle:{fontWeight:'800',fontSize:14,color:C.ink},
 recordNote:{color:C.ink,fontSize:12,lineHeight:18,marginTop:8},
 next:{color:C.teal,fontSize:12,fontWeight:'800',marginTop:8},
 smallEmpty:{padding:22,borderRadius:22,backgroundColor:'#FFFFFF',gap:13},
 emptyTitle:{color:C.ink,fontWeight:'800',fontSize:17},
 card:{backgroundColor:'#FFFFFF',borderRadius:24,padding:18,...theme.shadow},
 field:{marginBottom:16},fieldLabel:{color:C.ink,fontWeight:'800',fontSize:12,marginBottom:8},
 input:{backgroundColor:'#F9FBFA',borderColor:C.line,borderWidth:1,borderRadius:14,paddingHorizontal:12,paddingVertical:11,minHeight:48,color:C.ink,fontSize:14},
 choices:{flexDirection:'row',gap:7,flexWrap:'wrap',marginBottom:17},
 chip:{borderRadius:16,borderColor:C.line,borderWidth:1,paddingVertical:9,paddingHorizontal:12},
 chipOn:{borderColor:C.teal,backgroundColor:C.tealTint},
 chipText:{color:C.muted,fontWeight:'800',fontSize:12},chipTextOn:{color:C.teal},
 primary:{minHeight:53,paddingHorizontal:17,backgroundColor:C.darkTeal,borderRadius:25,alignItems:'center',justifyContent:'center',
   flexDirection:'row',gap:9,marginTop:10},
 primaryText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
 actionTextButton:{flexDirection:'row',alignItems:'center',gap:5},
 actionText:{color:C.teal,fontWeight:'800',fontSize:13},
 tiny:{fontSize:11,color:C.muted,lineHeight:18},
 note:{padding:14,backgroundColor:C.tealTint,borderRadius:17,flexDirection:'row',gap:10,alignItems:'center',marginTop:18}
});
