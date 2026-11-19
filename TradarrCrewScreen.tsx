import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,AppState,KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,BriefcaseBusiness,CalendarDays,Check,ChevronRight,Clock3,GraduationCap,Heart,MapPin,MessageCircle,Plus,RefreshCw,Send,ShieldCheck,Users,UserRound,Wallet} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type Kind='helper'|'skilled'|'apprentice';
type Tab='hire'|'work'|'people'|'saved'|'profile'|'activity';
type CrewProfile={user_id:string;display_name:string;headline:string;trade:string;level:Kind;area_label:string;experience_years:number;about:string;availability_note:string;is_visible:boolean;adult_confirmed:boolean};
type CrewRequest={id:string;owner_id:string;kind:Kind;title:string;trade:string;area_label:string;description:string;starts_at:string|null;ends_at:string|null;pay_amount:number;pay_unit:'hour'|'day'|'year';positions:number;employment_basis:string;status:'open'|'closed';expires_at:string;created_at:string};
type CrewApplication={id:string;request_id:string;worker_id:string;note:string;status:'applied'|'shortlisted'|'accepted'|'declined'|'withdrawn';created_at:string};
type CrewMessage={id:string;application_id:string;sender_id:string;body:string;created_at:string};
type CrewNotice={id:string;title:string;body:string;data:{applicationId?:string};read_at:string|null;created_at:string};

const C=theme.colors;
const kinds:{key:Kind;label:string}[]=[{key:'helper',label:'Extra pair of hands'},{key:'skilled',label:'Skilled trade mate'},{key:'apprentice',label:'Apprenticeship'}];
const showKind=(v:Kind)=>kinds.find(k=>k.key===v)?.label||v;
const niceDate=(v:string)=>new Date(v).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const money=(v:number)=>'£'+Number(v).toLocaleString('en-GB',{maximumFractionDigits:2});
const errorText=(e:any)=>e?.message||'Something went wrong. Please try again.';
const parseLocal=(value:string)=>{const d=new Date(value.trim().replace(' ','T'));return value.trim()&&Number.isFinite(d.getTime())?d.toISOString():null;};

function Field({label,value,onChange,placeholder,multiline=false,keyboardType}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean;keyboardType?:'numeric'|'default'}){
 return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput
  style={[s.input,multiline&&{minHeight:95,textAlignVertical:'top'}]}
  value={value} onChangeText={onChange} placeholder={placeholder}
  placeholderTextColor="#8C9A98" multiline={multiline} keyboardType={keyboardType||'default'}
  autoCapitalize="sentences" /></View>;
}
function Chip({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
 return <MotionPressable style={[s.chip,selected&&s.chipSelected]} onPress={onPress}
   accessibilityRole="button" accessibilityState={{selected}}>
   <Text style={[s.chipText,selected&&{color:'#FFFFFF'}]}>{label}</Text>
  </MotionPressable>;
}
function MainButton({label,onPress,disabled=false,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
 return <MotionPressable disabled={disabled} onPress={onPress}
 style={[s.action,secondary&&s.secondary,disabled&&{opacity:.5}]}
 accessibilityRole="button" accessibilityLabel={label}>
 <Text style={[s.actionText,secondary&&{color:C.teal}]}>{label}</Text>
 </MotionPressable>;
}
export default function TradarrCrewScreen({goBack,viewerRole='tradesperson'}:{goBack:()=>void;viewerRole?:'tradesperson'|'crew'}){
 const [tab,setTab]=useState<Tab>(viewerRole==='crew'?'work':'hire');
 const [uid,setUid]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [profiles,setProfiles]=useState<CrewProfile[]>([]);
 const [requests,setRequests]=useState<CrewRequest[]>([]);
 const [applications,setApplications]=useState<CrewApplication[]>([]);
 const [saved,setSaved]=useState<string[]>([]);
 const [posting,setPosting]=useState(false);
 const [postKind,setPostKind]=useState<Kind>('helper');
 const [postTitle,setPostTitle]=useState('');
 const [postTrade,setPostTrade]=useState('Plumbing');
 const [postArea,setPostArea]=useState('Leicester');
 const [postDescription,setPostDescription]=useState('');
 const [postStart,setPostStart]=useState('');
 const [postEnd,setPostEnd]=useState('');
 const [postPay,setPostPay]=useState('');
 const [postUnit,setPostUnit]=useState<'hour'|'day'|'year'>('day');
 const [postBasis,setPostBasis]=useState<'employment'|'self_employed'|'to_confirm'>('to_confirm');
 const [postPositions,setPostPositions]=useState('1');
 const [applicationFor,setApplicationFor]=useState<string|null>(null);
 const [applicationNote,setApplicationNote]=useState('');
 const [openRequest,setOpenRequest]=useState<string|null>(null);
 const [threadId,setThreadId]=useState<string|null>(null);
 const [messages,setMessages]=useState<CrewMessage[]>([]);
 const [notices,setNotices]=useState<CrewNotice[]>([]);
 const [messageDraft,setMessageDraft]=useState('');
 const [name,setName]=useState('');
 const [headline,setHeadline]=useState('');
 const [profileTrade,setProfileTrade]=useState('Plumbing');
 const [profileArea,setProfileArea]=useState('Leicester');
 const [profileLevel,setProfileLevel]=useState<Kind>('helper');
 const [years,setYears]=useState('0');
 const [about,setAbout]=useState('');
 const [availability,setAvailability]=useState('');
 const [visible,setVisible]=useState(false);
 const [adult,setAdult]=useState(false);
 const [hasProfile,setHasProfile]=useState(false);
 const [search,setSearch]=useState('');
 const myProfile=useMemo(()=>profiles.find(p=>p.user_id===uid),[profiles,uid]);
 const ownRequests=requests.filter(x=>x.owner_id===uid);
 const activeRequests=requests.filter(x=>x.owner_id!==uid&&x.status==='open'&&new Date(x.expires_at)>new Date());
 const myApplications=applications.filter(a=>a.worker_id===uid);

 const refresh=useCallback(async()=>{
  const {data:{user},error:authErr}=await supabase.auth.getUser();
  if(authErr||!user){setError('Please sign in to use Crew.');setLoading(false);return;}
  setUid(user.id);
  const [p,r,a,f,n]=await Promise.all([
   supabase.from('crew_profiles').select('*').order('updated_at',{ascending:false}).limit(150),
   supabase.from('crew_requests').select('*').order('created_at',{ascending:false}).limit(150),
   supabase.from('crew_applications').select('*').order('created_at',{ascending:false}).limit(300),
   supabase.from('crew_saved').select('worker_id').eq('owner_id',user.id),
   supabase.from('tradarr_notifications').select('id,title,body,data,read_at,created_at')
    .eq('recipient_id',user.id).eq('kind','crew_update').order('created_at',{ascending:false}).limit(80),
  ]);
  const firstError=p.error||r.error||a.error||f.error||n.error;
  if(firstError)setError('Crew is unavailable: '+firstError.message);
  else{
   setProfiles((p.data||[]) as CrewProfile[]);
   setRequests((r.data||[]) as CrewRequest[]);
   setApplications((a.data||[]) as CrewApplication[]);
   setSaved((f.data||[]).map(x=>x.worker_id));
   setNotices((n.data||[]) as CrewNotice[]);
   setError('');
  }
  setLoading(false);
 },[]);
 useEffect(()=>{
  void refresh();
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  return()=>sub.remove();
 },[refresh]);
 useEffect(()=>{
  if(!uid||viewerRole!=='crew')return;
  const ch=supabase.channel('crew-activity-'+uid)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'tradarr_notifications',filter:'recipient_id=eq.'+uid},
      ()=>{void refresh();}).subscribe();
  return()=>{void supabase.removeChannel(ch);};
 },[uid,viewerRole,refresh]);
 useEffect(()=>{
  if(!myProfile||hasProfile)return;
  setName(myProfile.display_name);setHeadline(myProfile.headline);
  setProfileTrade(myProfile.trade);setProfileArea(myProfile.area_label);
  setProfileLevel(myProfile.level);setYears(String(myProfile.experience_years));
  setAbout(myProfile.about);setAvailability(myProfile.availability_note);
  setVisible(myProfile.is_visible);setAdult(myProfile.adult_confirmed);setHasProfile(true);
 },[myProfile,hasProfile]);

 const run=async(fn:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError('');
  try{await fn();await refresh();}catch(e){Alert.alert('Crew',errorText(e));}finally{setBusy(false);}
 };
 const saveProfile=()=>void run(async()=>{
  if(!adult)throw new Error('Crew is currently for people aged 18 or over.');
  const payload={user_id:uid,display_name:name.trim(),headline:headline.trim(),
   trade:profileTrade.trim(),area_label:profileArea.trim(),level:profileLevel,
   experience_years:Number(years),about:about.trim(),availability_note:availability.trim(),
   is_visible:visible,adult_confirmed:true,updated_at:new Date().toISOString()};
  if(!Number.isInteger(payload.experience_years)||payload.experience_years<0||payload.experience_years>60)
   throw new Error('Enter a valid number of years of experience.');
  const {error:e}=await supabase.from('crew_profiles').upsert(payload,{onConflict:'user_id'});
  if(e)throw e;Alert.alert('Saved','Your Crew profile has been updated.');
 });
 const publish=()=>void run(async()=>{
  const amount=Number(postPay),positions=Number(postPositions);
  if(!Number.isFinite(amount)||amount<=0)throw new Error('Add a positive pay amount.');
  if(!Number.isInteger(positions)||positions<1||positions>20)throw new Error('Positions must be between 1 and 20.');
  const start=postStart.trim()?parseLocal(postStart):null;
  const end=postEnd.trim()?parseLocal(postEnd):null;
  if((postStart.trim()&&!start)||(postEnd.trim()&&!end)||Boolean(start)!==Boolean(end))
   throw new Error('Use dates like 2026-11-21 08:00 for both start and end, or leave both blank.');
  if(start&&end&&new Date(end)<=new Date(start))throw new Error('End time must be after start time.');
  const basis=postKind==='apprentice'?'employment':postBasis;
  const unit=postKind==='apprentice'&&postUnit==='day'?'hour':postUnit;
  const {error:e}=await supabase.from('crew_requests').insert({
   owner_id:uid,kind:postKind,title:postTitle.trim(),trade:postTrade.trim(),
   area_label:postArea.trim(),description:postDescription.trim(),starts_at:start,ends_at:end,
   pay_amount:amount,pay_unit:unit,positions,employment_basis:basis,status:'open'
  });
  if(e)throw e;
  setPosting(false);setPostTitle('');setPostDescription('');setPostStart('');setPostEnd('');setPostPay('');
  Alert.alert('Request published','Eligible Crew members can now apply.');
 });
 const apply=(requestId:string)=>void run(async()=>{
  if(!myProfile||!myProfile.is_visible){setTab('profile');throw new Error('Publish your Crew profile before applying.');}
  const {error:e}=await supabase.from('crew_applications').insert({
   request_id:requestId,worker_id:uid,note:applicationNote.trim(),status:'applied'
  });
  if(e)throw e;
  setApplicationFor(null);setApplicationNote('');
  Alert.alert('Application sent','You can follow its status in Find work.');
 });
 const changeApplication=(id:string,status:string)=>void run(async()=>{
  const {error:e}=await supabase.rpc('crew_set_application_status',{p_id:id,p_status:status});
  if(e)throw e;
 });
 const closeRequest=(id:string)=>Alert.alert('Close request','Stop new applications?',[
  {text:'Keep open',style:'cancel'},
  {text:'Close',onPress:()=>void run(async()=>{const {error:e}=await supabase.from('crew_requests')
   .update({status:'closed'}).eq('id',id).eq('owner_id',uid);if(e)throw e;})}
 ]);
 const toggleSaved=(workerId:string)=>void run(async()=>{
  if(saved.includes(workerId)){const {error:e}=await supabase.from('crew_saved')
    .delete().eq('owner_id',uid).eq('worker_id',workerId);if(e)throw e;}
  else{const {error:e}=await supabase.from('crew_saved').insert({owner_id:uid,worker_id:workerId});if(e)throw e;}
 });
 const loadMessages=useCallback(async(id:string)=>{
  const {data,error:e}=await supabase.from('crew_messages').select('*')
    .eq('application_id',id).order('created_at',{ascending:true}).limit(150);
  if(e)setError(e.message);else setMessages((data||[]) as CrewMessage[]);
 },[]);
 useEffect(()=>{
  if(!threadId)return;
  void loadMessages(threadId);
  const channel=supabase.channel('crew-thread-'+threadId)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'crew_messages',
    filter:'application_id=eq.'+threadId},()=>{void loadMessages(threadId)}).subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[threadId,loadMessages]);
 const sendMessage=()=>void run(async()=>{
  if(!threadId||!messageDraft.trim())return;
  const {error:e}=await supabase.from('crew_messages').insert({
   application_id:threadId,sender_id:uid,body:messageDraft.trim()
  });
  if(e)throw e;
  setMessageDraft('');await loadMessages(threadId);
 });
 const tabItems:{key:Tab;label:string}[]=viewerRole==='crew'?
  [{key:'work',label:'Find work'},{key:'activity',label:'Activity'+(notices.some(n=>!n.read_at)?' •':'')},
   {key:'profile',label:'My profile'}]:
  [{key:'hire',label:'Hire'},{key:'work',label:'Find work'},{key:'people',label:'People'},
   {key:'saved',label:'My Crew'},{key:'profile',label:'My profile'}];
 const thread=applications.find(x=>x.id===threadId);
 const threadRequest=requests.find(x=>x.id===thread?.request_id);

 return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}
   showsVerticalScrollIndicator={false}>
   <View style={s.header}>
    <MotionPressable accessibilityRole="button" accessibilityLabel={viewerRole==='crew'?'Sign out':'Back to Tools'} onPress={goBack} style={s.back}>
     <ArrowLeft color={C.ink} size={22}/></MotionPressable>
    <View style={{flex:1}}><Text style={s.eyebrow}>TRADARR FOR TRADES</Text><Text style={s.title}>Crew</Text>
     <Text style={s.subtitle}>{viewerRole==='crew'?'Find local work. Grow your skills.':'Find a hand. Build your team.'}</Text></View>
    <MotionPressable accessibilityRole="button" accessibilityLabel="Refresh Crew" onPress={()=>void refresh()} style={s.back}>
     <RefreshCw color={C.teal} size={20}/></MotionPressable>
   </View>
   {threadId?<>
    <MotionPressable onPress={()=>{setThreadId(null);setMessages([])}} style={s.link}>
     <ArrowLeft size={17} color={C.teal}/><Text style={s.linkText}>Back to Crew</Text></MotionPressable>
    <Text style={s.sectionTitle}>{threadRequest?.title||'Crew conversation'}</Text>
    <Text style={s.muted}>Only the applicant and person hiring can read this conversation.</Text>
    <View style={s.card}>
     {messages.map(m=><View key={m.id} style={[s.bubble,m.sender_id===uid&&s.myBubble]}>
      <Text style={{fontSize:13,color:m.sender_id===uid?'#FFFFFF':C.ink}}>{m.body}</Text>
      <Text style={[s.time,{color:m.sender_id===uid?'#CFDFD9':C.muted}]}>{niceDate(m.created_at)}</Text>
     </View>)}
     {!messages.length?<Text style={s.muted}>No messages yet. Introduce yourself and confirm the job details.</Text>:null}
     <TextInput value={messageDraft} onChangeText={setMessageDraft} multiline
      style={[s.input,{marginTop:14,minHeight:64}]} placeholder="Write a message…"
      placeholderTextColor="#879794"/>
     <MainButton label={busy?'Sending…':'Send message'} onPress={sendMessage} disabled={busy||!messageDraft.trim()}/>
    </View>
   </>:<>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}
    contentContainerStyle={{gap:7,paddingRight:16}}>
    {tabItems.map(t=><Chip key={t.key} label={t.label} selected={tab===t.key}
      onPress={()=>{setTab(t.key);setPosting(false);setApplicationFor(null);}}/>)}
   </ScrollView>
   {error?<View style={[s.card,{borderColor:'#EAB6A3'}]}><Text style={{color:'#9A3F20'}}>{error}</Text></View>:null}
   {loading?<ActivityIndicator style={{marginTop:60}} color={C.teal}/>:null}
   {!loading&&tab==='hire'&&viewerRole==='tradesperson'?<>
    <View style={s.hero}>
     <Users size={29} color="#C6DDD5"/><Text style={s.heroTitle}>Need an extra pair of hands?</Text>
     <Text style={s.heroText}>Post paid opportunities for site helpers, experienced mates or future apprentices.</Text>
     <MainButton label={posting?'Hide form':'+ Post a Crew request'} onPress={()=>setPosting(v=>!v)}/>
    </View>
    {posting?<View style={s.card}>
     <Text style={s.sectionTitle}>New Crew request</Text>
     <Text style={s.fieldLabel}>Who are you looking for?</Text>
     <View style={s.wrap}>{kinds.map(k=><Chip key={k.key} label={k.label} selected={postKind===k.key}
      onPress={()=>{setPostKind(k.key);if(k.key==='apprentice'){setPostBasis('employment');setPostUnit('hour');}}}/>)}</View>
     <Field label="Job title" value={postTitle} onChange={setPostTitle} placeholder="Plumber's mate for bathroom fit"/>
     <Field label="Trade" value={postTrade} onChange={setPostTrade} placeholder="Plumbing"/>
     <Field label="Town / general area" value={postArea} onChange={setPostArea} placeholder="Leicester"/>
     <Field label="Work and requirements" value={postDescription} onChange={setPostDescription} multiline
       placeholder="Describe tasks, skills, supervision, equipment, and site access. Do not include the full job address."/>
     {postKind!=='apprentice'?<>
      <Field label="Start (optional, YYYY-MM-DD HH:mm)" value={postStart} onChange={setPostStart} placeholder="2026-11-21 08:00"/>
      <Field label="End (optional, YYYY-MM-DD HH:mm)" value={postEnd} onChange={setPostEnd} placeholder="2026-11-21 16:00"/>
     </>:<Text style={s.notice}>Apprenticeships are paid employment and require an approved training programme, an apprenticeship agreement and a training plan. Tradarr only introduces applicants.</Text>}
     <Field label="Pay offered (£)" value={postPay} onChange={setPostPay} keyboardType="numeric" placeholder="120"/>
     <Text style={s.fieldLabel}>Pay per</Text>
     <View style={s.wrap}>{(['hour','day','year'] as const).filter(x=>postKind!=='apprentice'||x!=='day').map(x=>
      <Chip key={x} label={x==='hour'?'Hour':x==='day'?'Day':'Year'} selected={postUnit===x} onPress={()=>setPostUnit(x)}/>)}</View>
     <Field label="How many people?" value={postPositions} onChange={setPostPositions} keyboardType="numeric"/>
     {postKind!=='apprentice'?<><Text style={s.fieldLabel}>Intended arrangement</Text>
      <View style={s.wrap}>{([{v:'employment',t:'Employed'},{v:'self_employed',t:'Self-employed'},{v:'to_confirm',t:'Discuss first'}] as const).map(x=>
       <Chip key={x.v} label={x.t} selected={postBasis===x.v} onPress={()=>setPostBasis(x.v)}/>)}</View></>:null}
     <Text style={s.notice}>Advertised pay must meet applicable UK law. Agree employment status, insurance, right-to-work and site safety before work starts. Never advertise an unpaid trial.</Text>
     <MainButton label={busy?'Publishing…':'Publish request'} onPress={publish} disabled={busy}/>
    </View>:null}
    <Text style={s.sectionTitle}>My requests ({ownRequests.length})</Text>
    {!ownRequests.length?<Text style={s.muted}>No Crew requests yet. Your first listing will appear here.</Text>:null}
    {ownRequests.map(r=><View key={r.id} style={s.card}>
     <View style={s.cardTop}><Text style={[s.tag,r.status==='closed'&&{backgroundColor:'#EBECEA'}]}>{showKind(r.kind)}</Text>
      <Text style={s.muted}>{r.status==='closed'?'Closed':'Open'}</Text></View>
     <Text style={s.cardTitle}>{r.title}</Text>
     <Text style={s.muted}>{r.area_label} · {money(r.pay_amount)} / {r.pay_unit}</Text>
     <Text style={s.muted}>{applications.filter(a=>a.request_id===r.id).length} application(s)</Text>
     <View style={s.actions}><MainButton secondary label={openRequest===r.id?'Hide applicants':'Review applicants'}
       onPress={()=>setOpenRequest(openRequest===r.id?null:r.id)}/>
      {r.status==='open'?<MainButton secondary label="Close" onPress={()=>closeRequest(r.id)}/>:null}</View>
     {openRequest===r.id?<View style={{marginTop:12}}>
      {applications.filter(a=>a.request_id===r.id).map(a=>{
       const worker=profiles.find(p=>p.user_id===a.worker_id);
       return <View key={a.id} style={s.inner}>
        <Text style={s.cardTitle}>{worker?.display_name||'Applicant'}</Text>
        <Text style={s.muted}>{worker?.headline||'Crew member'} · {a.status}</Text>
        <Text style={s.detail}>{a.note}</Text>
        <View style={s.actions}>
         {a.status==='applied'?<MainButton secondary label="Shortlist" onPress={()=>changeApplication(a.id,'shortlisted')}/>:null}
         {(a.status==='applied'||a.status==='shortlisted')?<MainButton label="Accept" onPress={()=>changeApplication(a.id,'accepted')}/>:null}
         {(a.status==='applied'||a.status==='shortlisted')?<MainButton secondary label="Decline" onPress={()=>changeApplication(a.id,'declined')}/>:null}
         <MainButton secondary label="Messages" onPress={()=>setThreadId(a.id)}/>
        </View>
       </View>;
      })}
      {!applications.some(a=>a.request_id===r.id)?<Text style={s.muted}>No applications received yet.</Text>:null}
     </View>:null}
    </View>)}
   </>:null}
   {!loading&&tab==='work'?<>
    <Text style={s.sectionTitle}>Find paid work</Text>
    <Text style={[s.muted,{marginBottom:13}]}>Apply for short-term assistance, skilled work or apprenticeships. Nothing is booked until both sides agree terms.</Text>
    {!myProfile?<View style={s.card}><Text style={s.cardTitle}>Create your Crew profile</Text>
      <Text style={s.muted}>Show the skills and experience you can offer to other tradespeople.</Text>
      <MainButton label="Set up my profile" onPress={()=>setTab('profile')}/></View>:null}
    <Field label="Search by trade or town" value={search} onChange={setSearch} placeholder="Plumbing, Leicester…"/>
    {activeRequests.filter(r=>(r.title+' '+r.trade+' '+r.area_label).toLowerCase().includes(search.toLowerCase())).map(r=>{
     const applied=applications.find(a=>a.request_id===r.id&&a.worker_id===uid);
     return <View key={r.id} style={s.card}>
      <Text style={s.tag}>{showKind(r.kind)}</Text>
      <Text style={s.cardTitle}>{r.title}</Text>
      <Text style={s.muted}>{r.trade} · {r.area_label}</Text>
      <Text style={s.detail}>{r.description}</Text>
      <View style={s.wrap}><Text style={s.pay}>{money(r.pay_amount)} / {r.pay_unit}</Text>
       <Text style={s.muted}>{r.positions} place(s)</Text>
       {r.starts_at?<Text style={s.muted}>{niceDate(r.starts_at)}</Text>:null}</View>
      {r.kind==='apprentice'?<Text style={s.notice}>Training-provider registration and formal apprenticeship arrangements are required before an apprenticeship begins.</Text>:null}
      {applied?<><Text style={s.status}>Application: {applied.status}</Text>
       <View style={s.actions}><MainButton secondary label="Messages" onPress={()=>setThreadId(applied.id)}/>
       {['applied','shortlisted','accepted'].includes(applied.status)?<MainButton secondary label="Withdraw" onPress={()=>changeApplication(applied.id,'withdrawn')}/>:null}</View></>:
       applicationFor===r.id?<View style={{marginTop:13}}>
        <Field label="Why are you a good match?" value={applicationNote} onChange={setApplicationNote} multiline
         placeholder="Share your experience, availability and what you can help with."/>
        <MainButton label={busy?'Sending…':'Send application'} onPress={()=>apply(r.id)} disabled={busy}/>
        <MainButton secondary label="Cancel" onPress={()=>setApplicationFor(null)}/>
       </View>:<MainButton label="Apply" onPress={()=>{
        if(!myProfile||!myProfile.is_visible){setTab('profile');Alert.alert('Profile required','Create and publish your Crew profile first.');}
        else setApplicationFor(r.id);}}/>}
     </View>;
    })}
    {!activeRequests.length?<Text style={s.muted}>No live Crew opportunities yet. Check back as tradespeople begin posting.</Text>:null}
    <Text style={s.sectionTitle}>My applications ({myApplications.length})</Text>
    {myApplications.map(a=><View key={a.id} style={s.card}>
      <Text style={s.cardTitle}>{requests.find(r=>r.id===a.request_id)?.title||'Crew request'}</Text>
      <Text style={s.muted}>Status: {a.status} · Applied {niceDate(a.created_at)}</Text>
      <MainButton secondary label="View messages" onPress={()=>setThreadId(a.id)}/>
    </View>)}
   </>:null}
   {!loading&&tab==='people'&&viewerRole==='tradesperson'?<>
    <Text style={s.sectionTitle}>Available Crew</Text>
    <Text style={[s.muted,{marginBottom:14}]}>Only people who choose to be visible appear here. These are self-described skills, not verified qualifications.</Text>
    {!profiles.filter(p=>p.user_id!==uid).length?<Text style={s.muted}>No public Crew profiles yet.</Text>:null}
    {profiles.filter(p=>p.user_id!==uid).map(p=><View key={p.user_id} style={s.card}>
     <Text style={s.tag}>{showKind(p.level)}</Text>
     <Text style={s.cardTitle}>{p.display_name}</Text><Text style={s.detail}>{p.headline}</Text>
     <Text style={s.muted}>{p.trade} · {p.area_label} · {p.experience_years} years experience</Text>
     {p.availability_note?<Text style={s.muted}>Availability: {p.availability_note}</Text>:null}
     {p.about?<Text style={s.detail}>{p.about}</Text>:null}
     <MainButton secondary label={saved.includes(p.user_id)?'Remove from My Crew':'Save to My Crew'}
      onPress={()=>toggleSaved(p.user_id)}/>
    </View>)}
   </>:null}
   {!loading&&tab==='saved'&&viewerRole==='tradesperson'?<>
    <Text style={s.sectionTitle}>My Crew</Text>
    <Text style={[s.muted,{marginBottom:14}]}>Keep trusted helpers in one place. Saving someone does not mean they have accepted future work.</Text>
    {!saved.length?<Text style={s.muted}>Nobody saved yet. Visit People to add your first crew member.</Text>:null}
    {saved.map(id=>{const p=profiles.find(x=>x.user_id===id);return <View key={id} style={s.card}>
     <Text style={s.cardTitle}>{p?.display_name||'Crew member'}</Text>
     <Text style={s.muted}>{p?p.headline+' · '+p.area_label:'Profile is not currently publicly available'}</Text>
     <MainButton secondary label="Remove from My Crew" onPress={()=>toggleSaved(id)}/>
    </View>;})}
   </>:null}
   {!loading&&tab==='activity'&&viewerRole==='crew'?<>
    <Text style={s.sectionTitle}>Crew activity</Text>
    <Text style={[s.muted,{marginBottom:15}]}>Application updates and private messages appear here.</Text>
    {!notices.length?<Text style={s.muted}>No Crew updates yet.</Text>:null}
    {notices.map(n=><MotionPressable key={n.id} style={s.card} accessibilityRole="button"
      accessibilityLabel={n.title} onPress={()=>void run(async()=>{
        if(!n.read_at){const {error:e}=await supabase.from('tradarr_notifications')
          .update({read_at:new Date().toISOString()}).eq('id',n.id).is('read_at',null);
         if(e)throw e;}
        if(n.data?.applicationId)setThreadId(n.data.applicationId);
        else setTab('work');
      })}>
      <View style={s.cardTop}><Text style={s.cardTitle}>{n.title}</Text>
       {!n.read_at?<Text style={s.tag}>New</Text>:null}</View>
      <Text style={s.detail}>{n.body}</Text>
      <Text style={s.muted}>{niceDate(n.created_at)}</Text>
    </MotionPressable>)}
   </>:null}
   {!loading&&tab==='profile'?<>
    <Text style={s.sectionTitle}>My Crew profile</Text>
    <Text style={[s.muted,{marginBottom:15}]}>Separate from your customer-facing tradesperson listing. Set visibility yourself.</Text>
    <View style={s.card}>
     <Field label="Display name" value={name} onChange={setName} placeholder="Your name"/>
     <Field label="Headline" value={headline} onChange={setHeadline} placeholder="Reliable plumber's mate with site experience"/>
     <Text style={s.fieldLabel}>Experience level</Text>
     <View style={s.wrap}>{kinds.map(k=><Chip key={k.key} label={k.label} selected={profileLevel===k.key} onPress={()=>setProfileLevel(k.key)}/>)}</View>
     <Field label="Trade / skills" value={profileTrade} onChange={setProfileTrade} placeholder="Plumbing"/>
     <Field label="Town / working area" value={profileArea} onChange={setProfileArea} placeholder="Leicester"/>
     <Field label="Years of experience" value={years} onChange={setYears} keyboardType="numeric"/>
     <Field label="About your experience" value={about} onChange={setAbout} multiline placeholder="Experience, safe working practices, qualifications and tools"/>
     <Field label="When are you available?" value={availability} onChange={setAvailability} placeholder="Most weekdays, with one day's notice"/>
     <MotionPressable style={s.switchRow} onPress={()=>setAdult(v=>!v)}>
      <View style={[s.square,adult&&s.squareChecked]}>{adult?<Check size={14} color="#FFFFFF"/>:null}</View>
      <Text style={s.switchText}>I confirm I am at least 18 years old.</Text></MotionPressable>
     <MotionPressable style={s.switchRow} onPress={()=>setVisible(v=>!v)}>
      <View style={[s.square,visible&&s.squareChecked]}>{visible?<Check size={14} color="#FFFFFF"/>:null}</View>
      <Text style={s.switchText}>Show my profile to tradespeople looking for Crew members.</Text></MotionPressable>
     <Text style={s.notice}>Please do not share your full address, date of birth, right-to-work documents or identity numbers in this public profile. Tradarr has not verified the experience entered here.</Text>
     <MainButton label={busy?'Saving…':'Save Crew profile'} onPress={saveProfile} disabled={busy}/>
    </View>
   </>:null}
   </>}
   <View style={s.footer}><ShieldCheck size={19} color={C.teal}/>
    <Text style={[s.muted,{flex:1}]}>Crew makes introductions, not employment offers. Hirers must check suitability, contracts, lawful pay, insurance and site safety. Report suspicious requests through Tradarr Support.</Text>
   </View>
  </ScrollView>
 </KeyboardAvoidingView>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 page:{paddingHorizontal:16,paddingTop:14,paddingBottom:110},
 header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20},
 back:{height:44,width:44,borderRadius:15,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,letterSpacing:1.5,color:C.teal,fontWeight:'900'},
 title:{fontSize:33,fontWeight:'900',color:C.ink,letterSpacing:-.8},
 subtitle:{fontSize:12,color:C.muted,marginTop:3},
 hero:{backgroundColor:C.darkTeal,padding:22,borderRadius:26,marginBottom:22,gap:10},
 heroTitle:{fontSize:23,color:'#FFFFFF',fontWeight:'900',marginTop:4},
 heroText:{color:'#D7E6E1',fontSize:13,lineHeight:20,marginBottom:6},
 chip:{backgroundColor:'#E7EFEC',paddingHorizontal:14,paddingVertical:11,borderRadius:20,alignItems:'center'},
 chipSelected:{backgroundColor:C.darkTeal},
 chipText:{fontSize:12,fontWeight:'800',color:C.teal},
 wrap:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12},
 sectionTitle:{fontSize:20,fontWeight:'900',color:C.ink,marginBottom:14,marginTop:5},
 card:{backgroundColor:'#FFFFFF',borderRadius:24,padding:17,marginBottom:13,borderWidth:1,borderColor:'#EAECE8',gap:10},
 cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:5},
 tag:{alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:11,borderRadius:20,
  overflow:'hidden',backgroundColor:C.tealTint,color:C.teal,fontWeight:'800',fontSize:11},
 cardTitle:{fontSize:17,fontWeight:'900',color:C.ink},
 muted:{fontSize:12,color:C.muted,lineHeight:19},
 detail:{fontSize:13,lineHeight:20,color:C.ink,marginTop:3},
 pay:{color:C.teal,fontWeight:'900',fontSize:14},
 status:{color:C.teal,fontWeight:'800',fontSize:12,marginTop:7},
 field:{gap:7,marginBottom:9},
 fieldLabel:{fontSize:12,color:C.ink,fontWeight:'800',marginBottom:2},
 input:{borderWidth:1,borderColor:'#DCE5E0',backgroundColor:'#FDFDFB',
  paddingHorizontal:14,paddingVertical:13,minHeight:47,borderRadius:14,color:C.ink,fontSize:14},
 notice:{fontSize:12,lineHeight:19,color:C.muted,backgroundColor:'#F2F5F1',
  borderRadius:12,padding:12,marginBottom:5},
 action:{backgroundColor:C.teal,borderRadius:14,paddingHorizontal:15,paddingVertical:13,
  minHeight:45,alignItems:'center',justifyContent:'center',marginTop:6},
 secondary:{backgroundColor:C.tealTint},
 actionText:{fontWeight:'900',fontSize:12,color:'#FFFFFF',textAlign:'center'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
 inner:{borderTopWidth:1,borderTopColor:C.line,paddingTop:14,marginTop:7,gap:7},
 link:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:17},
 linkText:{fontSize:13,fontWeight:'900',color:C.teal},
 bubble:{backgroundColor:C.soft,borderRadius:15,padding:13,marginBottom:8,alignSelf:'flex-start',maxWidth:'91%'},
 myBubble:{backgroundColor:C.teal,alignSelf:'flex-end'},
 time:{fontSize:10,marginTop:6},
 square:{height:21,width:21,borderRadius:6,borderWidth:1.5,borderColor:C.teal,alignItems:'center',justifyContent:'center'},
 squareChecked:{backgroundColor:C.teal},
 switchRow:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:5,paddingVertical:4},
 switchText:{fontSize:13,lineHeight:20,color:C.ink,flex:1},
 footer:{marginTop:24,padding:16,backgroundColor:'#E8EEEA',borderRadius:19,flexDirection:'row',gap:10}
});
