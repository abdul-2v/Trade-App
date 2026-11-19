import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,Share,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {ArrowLeft,Check,ChevronRight,Copy,MapPin,MessageCircle,Plus,ShieldCheck,Users,UserPlus,XCircle} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Group={id:string;organiser_id:string;trade:string;service:string;area_label:string;desired_window:string|null;target_homes:number;member_count:number;status:'open'|'closed';created_at:string;closes_at:string};
type Member={collective_id:string;customer_id:string};
type Offer={id:string;collective_id:string;tradesperson_id:string;price_per_home:number;includes_vat:boolean;terms:string;earliest_date:string|null;status:string;created_at:string};
const trades=['Plumber','Electrician','Builder','Heating','Roofer','Carpenter','Other'];
const money=(v:number)=>'£'+Number(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(s:string)=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
function Field({label,value,onChange,placeholder,multi}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multi?:boolean}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange}
  multiline={multi} textAlignVertical={multi?'top':'center'} placeholder={placeholder} placeholderTextColor="#95A1A1"
  style={[s.input,multi&&{height:80}]}/></View>;
}
export default function CustomerCollectiveScreen({goBack,openMessages}:{goBack:()=>void;openMessages:()=>void}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [groups,setGroups]=useState<Group[]>([]),[members,setMembers]=useState<Member[]>([]),[offers,setOffers]=useState<Offer[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [screen,setScreen]=useState<'list'|'create'|'detail'>('list'),[selectedId,setSelectedId]=useState<string|null>(null);
 const [filter,setFilter]=useState(''),[trade,setTrade]=useState('Plumber'),[service,setService]=useState('');
 const [area,setArea]=useState(''),[window,setWindow]=useState(''),[target,setTarget]=useState('5'),[saving,setSaving]=useState(false);
 const selected=groups.find(v=>v.id===selectedId)||null;
 const joined=selected?members.some(m=>m.collective_id===selected.id):false;
 const offersFor=selected?offers.filter(o=>o.collective_id===selected.id&&o.status==='active'):[];
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:auth}=await supabase.auth.getUser();const id=auth.user?.id;
  if(!id){setLoading(false);setRefreshing(false);return;}setUid(id);
  const [g,m]=await Promise.all([
   supabase.from('trade_collectives').select('*').order('created_at',{ascending:false}).limit(200),
   supabase.from('trade_collective_members').select('collective_id,customer_id').eq('customer_id',id).limit(200)
  ]);
  if(g.error||m.error){Alert.alert('Collective unavailable',g.error?.message||m.error?.message||'Please retry.');setLoading(false);setRefreshing(false);return;}
  const items=(g.data||[]) as Group[],mine=(m.data||[]) as Member[];
  setGroups(items);setMembers(mine);
  const joinedIds=mine.map(x=>x.collective_id);
  if(joinedIds.length){
   const result=await supabase.from('trade_collective_offers').select('*').in('collective_id',joinedIds).order('created_at',{ascending:false});
   setOffers((result.data||[]) as Offer[]);
   const ids=[...new Set((result.data||[]).map(x=>x.tradesperson_id as string))];
   if(ids.length){
    const pros=await supabase.from('tradesperson_profiles').select('user_id,display_name').in('user_id',ids);
    setNames(Object.fromEntries((pros.data||[]).map(v=>[v.user_id,v.display_name])));
   }
  }else setOffers([]);
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const filtered=useMemo(()=>groups.filter(g=>(g.status==='open'&&new Date(g.closes_at)>new Date()||g.organiser_id===uid||members.some(m=>m.collective_id===g.id)) &&
   (!filter.trim()||(g.area_label+' '+g.trade+' '+g.service).toLowerCase().includes(filter.trim().toLowerCase()))),[groups,filter,uid,members]);
 const create=async()=>{
  if(saving||!uid)return;
  const n=Number(target);
  if(service.trim().length<8||area.trim().length<2||!Number.isInteger(n)||n<2||n>25){
   Alert.alert('Complete the group','Describe the service, add a broad local area and choose a goal of 2–25 homes.');return;
  }
  setSaving(true);
  const {data,error}=await supabase.from('trade_collectives').insert({
   organiser_id:uid,trade,service:service.trim(),area_label:area.trim(),desired_window:window.trim()||null,target_homes:n
  }).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Could not start Collective',error?.message||'Please retry.');return;}
  setSelectedId(data.id);setScreen('detail');setTrade('Plumber');setService('');setArea('');setWindow('');setTarget('5');
  await load(true);Alert.alert('Group created','You are the first participant. Share the group to find other households interested in the same service.');
 };
 const join=async()=>{
  if(!selected||saving)return;
  if(joined){Alert.alert('Already joined','You are part of this group.');return;}
  setSaving(true);
  const {error}=await supabase.from('trade_collective_members').insert({collective_id:selected.id,customer_id:uid});
  setSaving(false);
  if(error){Alert.alert('Could not join',error.message);return;}
  await load(true);
 };
 const leave=async()=>{
  if(!selected||saving)return;
  Alert.alert('Leave this Collective?','You will stop receiving the group offers in this screen.',
   [{text:'Cancel',style:'cancel'},{text:'Leave group',style:'destructive',onPress:async()=>{
    setSaving(true);
    const {error}=await supabase.from('trade_collective_members').delete().eq('collective_id',selected.id).eq('customer_id',uid);
    setSaving(false);if(error)Alert.alert('Could not leave',error.message);else await load(true);
   }}]);
 };
 const close=async()=>{
  if(!selected||uid!==selected.organiser_id)return;
  Alert.alert('Close this Collective?','It will stop accepting new members and new tradesperson offers.',
   [{text:'Cancel',style:'cancel'},{text:'Close',onPress:async()=>{
    const {error}=await supabase.from('trade_collectives').update({status:'closed'}).eq('id',selected.id).eq('organiser_id',uid);
    if(error)Alert.alert('Could not close',error.message);else await load(true);
   }}]);
 };
 const invite=async()=>{
  if(!selected)return;
  const text='Join our local Tradarr Collective for '+selected.service+' in '+selected.area_label+'. '+
   'Search for "'+selected.service+'" in Discover > Collective. '+selected.member_count+
   ' household'+(selected.member_count===1?'':'s')+' interested so far. No addresses are shared.';
  try{await Share.share({message:text})}catch(e){Alert.alert('Could not share',String(e))}
 };
 const contact=async(offer:Offer)=>{
  if(!selected||!joined||saving)return;
  setSaving(true);
  try{
   const [who,pro]=await Promise.all([
    supabase.from('profiles').select('first_name,last_name').eq('id',uid).maybeSingle(),
    supabase.from('tradesperson_profiles').select('display_name,primary_trade').eq('user_id',offer.tradesperson_id).maybeSingle()
   ]);
   const customerName=[who.data?.first_name,who.data?.last_name].filter(Boolean).join(' ')||'Customer';
   const traderName=pro.data?.display_name||'Tradesperson';
   const {error:upsertError}=await supabase.from('conversations').upsert({
    customer_id:uid,tradesperson_id:offer.tradesperson_id,customer_display_name:customerName,
    tradesperson_display_name:traderName,tradesperson_trade:pro.data?.primary_trade||selected.trade
   },{onConflict:'customer_id,tradesperson_id',ignoreDuplicates:true});
   if(upsertError)throw upsertError;
   const {data:conversation,error:readError}=await supabase.from('conversations').select('id')
    .eq('customer_id',uid).eq('tradesperson_id',offer.tradesperson_id).single();
   if(readError||!conversation)throw readError||new Error('Conversation unavailable');
   const {error:messageError}=await supabase.from('messages').insert({
    conversation_id:conversation.id,sender_id:uid,body:
    'Hi, I am interested in your Tradarr Collective offer of '+money(offer.price_per_home)+
    ' per home for '+selected.service+' in '+selected.area_label+
    '. Please confirm what the work includes and how to arrange an individual quotation.'
   });
   if(messageError)throw messageError;
   openMessages();
  }catch(e){Alert.alert('Could not send enquiry',String(e))}
  finally{setSaving(false)}
 };
 const back=()=>screen==='detail'?(setSelectedId(null),setScreen('list')):screen==='create'?setScreen('list'):goBack();
 return <View style={s.root}><View style={s.head}>
  <MotionPressable style={s.back} onPress={back}><ArrowLeft size={22} color={C.ink}/></MotionPressable>
  <View style={{flex:1}}><Text style={s.eyebrow}>NEIGHBOURHOOD BOOKING</Text>
   <Text style={s.heading}>{screen==='create'?'Start a group':screen==='detail'?'Collective details':'Tradarr Collective'}</Text></View>
  {screen==='list'?<MotionPressable style={s.new} onPress={()=>setScreen('create')}><Plus size={18} color="#FFFFFF"/><Text style={s.newText}>New</Text></MotionPressable>:null}</View>
  {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:60}}/>:
  <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   {screen==='list'?<>
    <View style={s.hero}><Users size={25} color="#D1E9E2"/>
     <Text style={s.heroTitle}>Get the whole street interested in one job.</Text>
     <Text style={s.heroSub}>Organise nearby households who need similar work, then let local tradespeople offer a real group price.</Text></View>
    <MotionPressable onPress={()=>setScreen('create')} style={s.primary}><Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Start a neighbourhood group</Text></MotionPressable>
    <Text style={s.section}>Find existing Collectives</Text>
    <TextInput value={filter} onChangeText={setFilter} style={s.input} placeholder="Find by area or service, e.g. LE4 gutters"
      placeholderTextColor="#97A1A1"/>
    <Text style={s.note}>Only broad local areas and total household counts appear. No other household's name, address or membership list is shown.</Text>
    {filtered.length?filtered.map(x=><MotionPressable key={x.id} onPress={()=>{setSelectedId(x.id);setScreen('detail')}} style={s.group}>
      <View style={s.groupIcon}><Users color={C.teal} size={23}/></View><View style={{flex:1}}>
       <Text style={s.groupTitle}>{x.service}</Text>
       <Text style={s.groupMeta}>{x.area_label} · {x.trade}</Text>
       <Text style={s.count}>{x.member_count} / {x.target_homes} household target · {x.status}</Text>
      </View><ChevronRight size={20} color={C.teal}/></MotionPressable>):
     <View style={s.empty}><Users size={31} color={C.teal}/>
       <Text style={s.groupTitle}>No nearby groups found</Text>
       <Text style={s.note}>Start one for a service such as gutter cleaning or garden maintenance, then invite neighbours.</Text></View>}
   </>:screen==='create'?<>
     <Text style={s.intro}>Start with a common service and a broad neighbourhood or outward postcode. Do not enter individual property addresses.</Text>
     <View style={s.card}><Text style={s.label}>Trade</Text>
      <View style={s.chips}>{trades.map(t=><MotionPressable key={t} onPress={()=>setTrade(t)} style={[s.chip,trade===t&&s.chipActive]}>
       <Text style={[s.chipText,trade===t&&s.chipTextActive]}>{t}</Text></MotionPressable>)}</View>
      <Field label="Service everyone needs *" value={service} onChange={setService} placeholder="e.g. Annual gutter clearing"/>
      <Field label="Broad area *" value={area} onChange={setArea} placeholder="e.g. Leicester LE4 or Queniborough"/>
      <Field label="Preferred time window (optional)" value={window} onChange={setWindow} placeholder="e.g. Within the next month"/>
      <Field label="Target households (2–25)" value={target} onChange={setTarget} placeholder="5"/>
      <Text style={s.note}>You join as the first member. The group stays open for up to 30 days unless closed earlier.</Text>
      <MotionPressable disabled={saving} onPress={()=>{void create()}} style={s.primary}>
       {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Create Collective</Text>}</MotionPressable></View>
    </>:selected?<><View style={s.hero}><Text style={s.heroMini}>LOCAL GROUP WORK</Text><Text style={s.heroTitle}>{selected.service}</Text>
      <Text style={s.heroSub}>{selected.trade} · {selected.area_label}</Text>
      {selected.desired_window?<Text style={s.heroSub}>Preferred timing: {selected.desired_window}</Text>:null}</View>
     <View style={s.card}><Text style={s.cardTitle}>Building local interest</Text>
      <View style={s.row}><Text style={s.memberNumber}>{selected.member_count}</Text>
       <Text style={s.memberTarget}>of {selected.target_homes} households targeted</Text></View>
      <View style={s.progress}><View style={[s.progressFill,{width:Math.min(100,selected.member_count/selected.target_homes*100)+'%'}]}/></View>
      <Text style={s.note}>The target is a planning goal, not a guaranteed discount. Each property will need its own agreed scope and quote.</Text>
      <Text style={s.meta}>Group {selected.status} · Closes {date(selected.closes_at)}</Text>
      {joined?<View style={s.joined}><Check size={17} color={C.teal}/><Text style={s.joinedText}>You're part of this Collective</Text></View>:
       selected.status==='open'&&new Date(selected.closes_at)>new Date()?
       <MotionPressable disabled={saving} onPress={()=>{void join()}} style={s.primary}>
        {saving?<ActivityIndicator color="#FFFFFF"/>:<><UserPlus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Join this group</Text></>}</MotionPressable>:
       <Text style={s.meta}>This group is closed to new members.</Text>}
      <MotionPressable onPress={()=>{void invite()}} style={s.secondary}><Copy size={17} color={C.teal}/>
       <Text style={s.secondaryText}>Share with neighbours</Text></MotionPressable>
     </View>
     <Text style={s.section}>Offers from tradespeople</Text>
     {joined?<>{offersFor.length?offersFor.map(o=><View key={o.id} style={s.card}>
      <View style={s.row}><View style={{flex:1}}>
       <Text style={s.cardTitle}>{names[o.tradesperson_id]||'Tradarr professional'}</Text>
       <Text style={s.meta}>Indicative per-home offer · {o.includes_vat?'Includes VAT':'VAT extra or not applicable'}</Text></View>
       <Text style={s.money}>{money(o.price_per_home)}</Text></View>
      <Text style={s.terms}>{o.terms}</Text>
      {o.earliest_date?<Text style={s.meta}>Earliest proposed date: {date(o.earliest_date)}</Text>:null}
      <MotionPressable disabled={saving} onPress={()=>{void contact(o)}} style={s.primary}>
       {saving?<ActivityIndicator color="#FFFFFF"/>:<><MessageCircle size={18} color="#FFFFFF"/>
        <Text style={s.primaryText}>Enquire about this offer</Text></>}</MotionPressable>
     </View>):<View style={s.empty}><Users color={C.teal} size={29}/>
       <Text style={s.groupTitle}>No trader offers yet</Text><Text style={s.note}>Interested tradespeople can submit real prices once they see the local group. Share the group to help it grow.</Text></View>}</>:
     <View style={s.empty}><ShieldCheck size={28} color={C.teal}/><Text style={s.note}>Join the group to see its tradesperson offers.</Text></View>}
     <View style={s.tip}><ShieldCheck color={C.teal} size={20}/><Text style={s.tipText}>No discount is promised. Offers are indicative until a tradesperson confirms each home's scope, price, qualifications and booking.</Text></View>
     {joined&&selected.organiser_id!==uid?<MotionPressable onPress={()=>{void leave()}} style={s.leave}>
      <XCircle color={C.coralDark} size={17}/><Text style={s.leaveText}>Leave this group</Text></MotionPressable>:null}
     {selected.organiser_id===uid&&selected.status==='open'?<MotionPressable onPress={()=>{void close()}} style={s.leave}>
      <XCircle size={17} color={C.coralDark}/><Text style={s.leaveText}>Close this group</Text></MotionPressable>:null}
    </>:null}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},head:{padding:17,flexDirection:'row',alignItems:'center',gap:11},
 back:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:'800',color:C.teal},heading:{fontSize:23,fontWeight:'800',color:C.ink,marginTop:4},
 new:{borderRadius:22,backgroundColor:C.darkTeal,minHeight:42,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:5},
 newText:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},page:{padding:19,paddingBottom:45},
 hero:{backgroundColor:C.darkTeal,borderRadius:25,padding:23,gap:9},
 heroTitle:{fontSize:22,fontWeight:'800',color:'#FFFFFF',lineHeight:29},heroSub:{fontSize:12,lineHeight:20,color:'#D5E9E4'},
 heroMini:{fontSize:10,letterSpacing:1.4,fontWeight:'800',color:'#C8E6E0'},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:24,marginBottom:13},
 primary:{minHeight:53,borderRadius:26,backgroundColor:C.darkTeal,marginTop:13,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:12},
 primaryText:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},
 input:{backgroundColor:'#FFFFFF',borderRadius:15,minHeight:48,borderWidth:1,borderColor:C.line,
  paddingHorizontal:12,fontSize:14,color:C.ink},
 field:{marginBottom:14},label:{fontSize:12,fontWeight:'800',color:C.ink,marginBottom:8},
 card:{padding:19,backgroundColor:'#FFFFFF',borderRadius:22,marginTop:12,...theme.shadow},
 cardTitle:{fontSize:17,fontWeight:'800',color:C.ink},
 chips:{flexDirection:'row',gap:6,flexWrap:'wrap',marginBottom:15},
 chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:17,borderWidth:1,borderColor:C.line},
 chipActive:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextActive:{color:C.teal},
 intro:{color:C.muted,fontSize:12,lineHeight:20,marginBottom:13},
 note:{fontSize:11,color:C.muted,lineHeight:18,marginTop:10},
 empty:{borderRadius:22,padding:22,backgroundColor:'#FFFFFF',alignItems:'center',gap:9,marginTop:10},
 group:{flexDirection:'row',alignItems:'center',gap:12,borderRadius:20,backgroundColor:'#FFFFFF',
  padding:15,marginTop:11,...theme.shadow},
 groupIcon:{height:43,width:43,borderRadius:15,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 groupTitle:{fontSize:15,fontWeight:'800',color:C.ink},groupMeta:{fontSize:11,color:C.muted,marginTop:6},
 count:{fontSize:11,color:C.teal,fontWeight:'800',marginTop:7},
 row:{flexDirection:'row',gap:10,alignItems:'center'},memberNumber:{fontSize:31,fontWeight:'800',color:C.teal},
 memberTarget:{fontSize:12,color:C.muted},
 progress:{height:8,borderRadius:10,backgroundColor:'#E4ECE9',marginTop:15,overflow:'hidden'},
 progressFill:{height:8,backgroundColor:C.teal,borderRadius:10},
 meta:{fontSize:11,color:C.muted,lineHeight:18,marginTop:8},
 joined:{padding:12,borderRadius:16,backgroundColor:C.tealTint,flexDirection:'row',gap:9,alignItems:'center',marginTop:15},
 joinedText:{fontSize:12,fontWeight:'800',color:C.teal},
 secondary:{borderRadius:25,minHeight:49,alignItems:'center',justifyContent:'center',flexDirection:'row',
  gap:8,backgroundColor:C.tealTint,marginTop:9},
 secondaryText:{fontSize:12,color:C.teal,fontWeight:'800'},
 money:{fontSize:20,fontWeight:'800',color:C.ink},
 terms:{fontSize:12,lineHeight:20,color:C.ink,marginTop:12},
 tip:{padding:15,borderRadius:18,backgroundColor:C.tealTint,marginTop:17,flexDirection:'row',gap:9},
 tipText:{flex:1,fontSize:11,lineHeight:18,color:C.teal},
 leave:{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'center',padding:15,marginTop:12},
 leaveText:{fontSize:12,fontWeight:'800',color:C.coralDark}
});
