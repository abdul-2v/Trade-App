import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,AppState,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {
 ArrowLeft,BarChart3,BellRing,BriefcaseBusiness,CalendarClock,CheckCircle2,
 ChevronRight,ClipboardList,FileText,History,LockKeyhole,MessageSquare,
 RefreshCcw,Search,ShieldAlert,ShieldCheck,Users,Wallet,XCircle
} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {MotionPressable} from './Motion';
import TradarrStaffScreen from './TradarrStaffScreen';
import TradarrAdminAnalyticsScreen from './TradarrAdminAnalyticsScreen';
import TradarrAdminModerationScreen from './TradarrAdminModerationScreen';
import {TradarrAdminMemberControls,TradarrAdminReviewControls} from './TradarrAdminAccountControls';
import {theme} from './theme';

type Section='overview'|'analytics'|'moderation'|'users'|'traders'|'jobs'|'finance'|'appointments'|'reviews'|'cases'|'audit'|'verification'|'support';
type AdminRecord=Record<string,any>;
type Summary=Record<string,number|string>;
type SectionDef={id:Section;label:string;help:string};
const sections:SectionDef[]=[
 {id:'overview',label:'Overview',help:'Platform snapshot'},
 {id:'analytics',label:'Analytics',help:'Daily charts and conversion'},
 {id:'moderation',label:'Safety & appeals',help:'Reports, appeals and deletion requests'},
 {id:'users',label:'Users',help:'Account directory'},
 {id:'traders',label:'Trades',help:'Businesses & listing controls'},
 {id:'jobs',label:'Jobs',help:'Standard and urgent requests'},
 {id:'finance',label:'Finance',help:'Trade quotes and invoices'},
 {id:'appointments',label:'Bookings',help:'Scheduled appointments'},
 {id:'reviews',label:'Reviews',help:'Completed-job feedback'},
 {id:'cases',label:'Cases',help:'Support case directory'},
 {id:'verification',label:'Verification',help:'Credential decisions'},
 {id:'support',label:'Support desk',help:'Case triage and replies'},
 {id:'audit',label:'Audit log',help:'Administrative action history'},
];
const C=theme.colors;
const money=(n:any)=>'£'+(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const dt=(s?:string|null)=>{
 if(!s)return 'Not recorded';
 const date=new Date(s);return isNaN(date.getTime())?'Not recorded':
  date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
};
const short=(s:any)=>String(s||'').slice(0,8).toUpperCase();
const line=(v:any)=>String(v==null?'—':v);
const count=(n:any)=>Number(n||0).toLocaleString('en-GB');
const human=(s:any)=>String(s||'unknown').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const iconFor=(s:Section)=>{
 switch(s){
 case 'analytics':return BarChart3;
 case 'moderation':return ShieldAlert;
 case 'users':return Users;
 case 'traders':return BriefcaseBusiness;
 case 'jobs':return ClipboardList;
 case 'finance':return Wallet;
 case 'appointments':return CalendarClock;
 case 'reviews':return ShieldCheck;
 case 'cases':case 'support':return MessageSquare;
 case 'verification':return ShieldAlert;
 case 'audit':return History;
 default:return BarChart3;
 }
};
function Stat({title,value,note}:{title:string;value:string;note?:string}){
 return <View style={s.stat}>
  <Text style={s.statLabel}>{title}</Text>
  <Text style={s.statValue} numberOfLines={1}>{value}</Text>
  {note?<Text style={s.statNote}>{note}</Text>:null}
 </View>;
}
function SectionTile({item,onClick,sub}:{item:SectionDef;onClick:()=>void;sub?:string}){
 const Icon=iconFor(item.id);
 return <MotionPressable style={s.tile} onPress={onClick} accessibilityRole="button"
  accessibilityLabel={'Open '+item.label}>
  <View style={s.tileIcon}><Icon size={20} color={C.teal}/></View>
  <View style={{flex:1,gap:4}}>
   <Text style={s.tileTitle}>{item.label}</Text>
   <Text style={s.tileNote}>{sub||item.help}</Text>
  </View>
  <ChevronRight size={17} color={C.teal}/>
 </MotionPressable>;
}
function ItemDetails({label,value}:{label:string;value:any}){
 return <View style={s.detailRow}>
  <Text style={s.detailName}>{label}</Text>
  <Text style={s.detailValue} selectable>{line(value)}</Text>
 </View>;
}
function description(tab:Section,item:AdminRecord):{eyebrow:string;title:string;sub:string;badge?:string}{
 switch(tab){
 case 'users':return {eyebrow:human(item.account_type)+' · '+(item.email_verified?'Verified email':'Email unverified'),
   title:item.display_name||item.email||'Account',
   sub:item.email||short(item.id),badge:item.has_trade_profile?'Has trade profile':'Customer profile'};
 case 'traders':return {eyebrow:item.primary_trade||'Trade not set',
   title:item.display_name||item.email||'Tradesperson',
   sub:[item.email,item.service_area].filter(Boolean).join(' · '),
   badge:item.is_verified?'Evidence verified':'Not verified'};
 case 'jobs':return {eyebrow:human(item.job_kind)+' · '+(item.trade||'Trade'),
   title:item.title||'Untitled job',sub:'Customer '+short(item.customer_id),
   badge:human(item.status)};
 case 'finance':return {eyebrow:human(item.document_type),
   title:item.business_name||human(item.document_type),
   sub:money(item.total)+' · '+dt(item.created_at),badge:human(item.status)};
 case 'appointments':return {eyebrow:'Appointment · '+dt(item.starts_at),
   title:item.title||'Booked visit',sub:'Tradesperson '+short(item.tradesperson_id),
   badge:human(item.status)};
 case 'reviews':return {eyebrow:human(item.review_type)+' · '+item.rating+'/5 stars',
   title:item.comment||'Rating without a comment',
   sub:'Trader '+short(item.tradesperson_id),badge:'Verified completed job'};
 case 'cases':return {eyebrow:human(item.category)+' · '+human(item.priority),
   title:item.subject||'Support case',sub:'Raised '+dt(item.created_at),badge:human(item.status)};
 case 'audit':return {eyebrow:human(item.action)+' · '+dt(item.created_at),
   title:item.reason||'Administrative action',sub:'Actor '+short(item.actor_id),
   badge:human(item.target_type)};
 default:return {eyebrow:'Record',title:short(item.id),sub:''};
 }
}
const sectionToTarget=(section:Section,row:AdminRecord)=>{
 if(section==='users')return 'user';
 if(section==='traders')return 'trader';
 if(section==='jobs')return 'job';
 if(section==='finance')return row.document_type==='invoice'?'invoice':'quote';
 if(section==='reviews')return 'review';
 if(section==='cases')return 'case';
 return null;
};
export default function TradarrAdminHub({goBack,goToCustomer,goToTradesperson}:{
 goBack:()=>void;goToCustomer?:()=>void;goToTradesperson?:()=>void;
}){
 const [section,setSection]=useState<Section>('overview');
 const [overview,setOverview]=useState<Summary|null>(null);
 const [rows,setRows]=useState<AdminRecord[]>([]);
 const [paused,setPaused]=useState<Record<string,boolean>>({});
 const [suspended,setSuspended]=useState<Record<string,boolean>>({});
 const [hiddenReviews,setHiddenReviews]=useState<Record<string,boolean>>({});
 const [activity,setActivity]=useState<Record<string,any>|null>(null);
 const [activityBusy,setActivityBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [debounced,setDebounced]=useState('');
 const [selected,setSelected]=useState<AdminRecord|null>(null);
 const [reason,setReason]=useState('');
 const [noticeTitle,setNoticeTitle]=useState('');
 const [noticeBody,setNoticeBody]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [lastLoaded,setLastLoaded]=useState('');
 const [gatewayCheckBusy,setGatewayCheckBusy]=useState(false);
 const runGatewayCheck=async()=>{
  if(gatewayCheckBusy)return;
  setGatewayCheckBusy(true);
  try{
   const [identity,assurance,dashboard,directory]=await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.rpc('tradarr_admin_dashboard'),
    supabase.rpc('tradarr_admin_browse',{p_section:'users',p_search:'',p_limit:1})
   ]);
   const checks=[
    ['Current staff role',!identity.error&&identity.data.user?.app_metadata?.tradarr_staff===true],
    ['Authenticator verified',!assurance.error&&assurance.data?.currentLevel==='aal2'],
    ['Admin metrics read',!dashboard.error&&!!dashboard.data],
    ['Protected user directory read',!directory.error&&Array.isArray(directory.data)]
   ] as Array<[string,boolean]>;
   Alert.alert(checks.every(x=>x[1])?'Gateway checks passed':'Gateway needs attention',
    checks.map(([name,passed])=>(passed?'✓ ':'✕ ')+name).join('\n')+
    '\n\nRead-only check. Suspension, appeals and reports still need controlled device testing.');
  }catch(e:any){Alert.alert('Gateway check failed',e?.message||'Try again online.');}
  finally{setGatewayCheckBusy(false);}
 };

 const browseSection=section!=='overview'&&section!=='verification'&&section!=='support';
 useEffect(()=>{
  const id=setTimeout(()=>setDebounced(search.trim()),350);
  return()=>clearTimeout(id);
 },[search]);
 const load=useCallback(async(refresh=false)=>{
  if(section==='verification'||section==='support'||section==='analytics'||section==='moderation')return;
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   if(section==='overview'){
    const {data,error:e}=await supabase.rpc('tradarr_admin_dashboard');
    if(e||!data)throw e||new Error('Dashboard data was unavailable.');
    setOverview(data as Summary);
   }else{
    const {data,error:e}=await supabase.rpc('tradarr_admin_browse',{
     p_section:section,p_search:debounced,p_limit:50
    });
    if(e)throw e;
    const items=Array.isArray(data)?data as AdminRecord[]:[];
    setRows(items);
    if(section==='traders'&&items.length){
     const ids=items.map(x=>String(x.id)).filter(Boolean);
     const {data:moderation,error:moderationError}=await supabase.from('tradarr_trade_moderation')
      .select('tradesperson_id,is_paused').in('tradesperson_id',ids);
     if(moderationError)throw moderationError;
     const status:Record<string,boolean>={};
     for(const item of moderation||[])status[item.tradesperson_id]=item.is_paused;
     setPaused(status);
    }
   }
   setError('');setLastLoaded(new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}));
  }catch(e:any){setError(e?.message||'Unable to load platform data. Try again.');}
  finally{setLoading(false);setRefreshing(false);}
 },[section,debounced]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const subscription=AppState.addEventListener('change',next=>{
   if(next==='active')void load(true);
  });
  return()=>subscription.remove();
 },[load]);
 const changeSection=(target:Section)=>{
  setSection(target);setSelected(null);setSearch('');setDebounced('');setReason('');setNoticeTitle('');setNoticeBody('');setError('');
 };
 const openRecord=(record:AdminRecord)=>{setSelected(record);setReason('');setNoticeTitle('');setNoticeBody('');};
 const note=async()=>{
  if(!selected||saving)return;
  const type=sectionToTarget(section,selected);
  if(!type)return;
  const content=reason.trim();
  if(content.length<10){
   Alert.alert('Reason needed','Write at least 10 characters so the audit record is useful.');return;
  }
  setSaving(true);
  try{
   const {error:e}=await supabase.rpc('tradarr_admin_record_note',{
    p_target_type:type,p_target_id:selected.id,p_reason:content
   });
   if(e)throw e;
   setReason('');Alert.alert('Note recorded','Your action is saved in the Admin Gateway audit history.');
  }catch(e:any){Alert.alert('Could not save note',e?.message||'Please try again.');}
  finally{setSaving(false);}
 };
 const notify=async()=>{
  if(section!=='users'||!selected||saving)return;
  const title=noticeTitle.trim(),body=noticeBody.trim();
  if(title.length<5||title.length>90||body.length<10||body.length>350){
   Alert.alert('Check notice','Use a title between 5 and 90 characters and a message between 10 and 350 characters.');return;
  }
  const send=async()=>{
   setSaving(true);
   try{
    const {error:e}=await supabase.rpc('tradarr_admin_notify_user',{
     p_user_id:selected.id,p_title:title,p_message:body
    });
    if(e)throw e;
    setNoticeTitle('');setNoticeBody('');
    Alert.alert('Notice sent','The user has an in-app Tradarr notification. This is not an email or Apple push notification.');
   }catch(e:any){Alert.alert('Could not send notice',e?.message||'Please try again.');}
   finally{setSaving(false);}
  };
  Alert.alert('Send a Tradarr notice?', 'Send this message to '+(selected.email||'the selected account')+
   '. The action will be audited.',
   [{text:'Cancel',style:'cancel'},{text:'Send notice',onPress:()=>{void send()}}]);
 };
 const moderate=async(action:'pause'|'restore')=>{
  if(!selected||section!=='traders'||saving)return;
  const explanation=reason.trim();
  if(explanation.length<12){
   Alert.alert('Reason required','Provide at least 12 characters explaining the moderation decision.');return;
  }
  const perform=async()=>{
   setSaving(true);
   try{
    const {error:e}=await supabase.rpc('tradarr_admin_moderate_trade',{
     p_trade_id:selected.id,p_action:action,p_reason:explanation
    });
    if(e)throw e;
    setPaused(prev=>({...prev,[selected.id]:action==='pause'}));
    setReason('');setSelected(null);
    Alert.alert('Listing updated',action==='pause'?
     'This trade is hidden from public discovery. Existing jobs and invoices remain intact.':
     'The trade listing is restored. The tradesperson will need to enable availability again.');
    await load(true);
   }catch(e:any){Alert.alert('Action failed',e?.message||'Please try again.');}
   finally{setSaving(false);}
  };
  Alert.alert(action==='pause'?'Pause public trade listing?':'Restore public trade listing?',
   action==='pause'?'The business will disappear from public search and will be notified. Existing customer jobs are not cancelled.':'This will allow the business to appear publicly again.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',style:action==='pause'?'destructive':'default',
     onPress:()=>{void perform()}}]);
 };
 const headerTitle=sections.find(x=>x.id===section)?.label||'Overview';
 const goPrevious=()=>selected?setSelected(null):section==='overview'?goBack():changeSection('overview');
 const totals=overview||{};
 const summary=useMemo(()=>[
  ['Total accounts',count(totals.users),'+'+count(totals.new_users_7d)+' in 7 days'],
  ['Trade profiles',count(totals.traders),count(totals.verified_traders)+' verified'],
  ['Jobs created',count(totals.jobs),count(totals.active_jobs)+' active'],
  ['Urgent requests',count(totals.urgent_jobs),count(totals.open_urgent)+' open'],
  ['Invoices',count(totals.invoices),'Trade-issued documents'],
  ['Open support',count(totals.open_support),count(totals.urgent_support)+' urgent'],
 ],[overview]);
 if(section==='verification'||section==='support')
  return <TradarrStaffScreen key={section} initialTab={section==='support'?'cases':'credentials'}
   goBack={()=>changeSection('overview')}/>;
 if(section==='analytics')return <TradarrAdminAnalyticsScreen goBack={()=>changeSection('overview')}/>;
 if(section==='moderation')return <TradarrAdminModerationScreen goBack={()=>changeSection('overview')}/>;
 return <View style={s.root}>
  <View style={s.head}>
   <MotionPressable onPress={goPrevious} style={s.back}
    accessibilityRole="button" accessibilityLabel="Back">
    <ArrowLeft size={21} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1,gap:3}}>
    <Text style={s.overline}>TRADARR / SECURE CONTROL CENTRE</Text>
    <Text style={s.heading}>{selected?'Record details':section==='overview'?'Admin Gateway':headerTitle}</Text>
   </View>
   <MotionPressable style={s.refresh} onPress={()=>{void load(true)}}
     accessibilityRole="button" accessibilityLabel="Refresh admin information">
    {refreshing?<ActivityIndicator color={C.teal} size="small"/>:<RefreshCcw size={20} color={C.teal}/>}
   </MotionPressable>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled"
   contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   {error?<View style={s.warning}>
    <ShieldAlert size={17} color="#8F5523"/>
    <Text style={[s.muted,{color:'#8F5523',flex:1}]}>{error}</Text>
   </View>:null}
   {!selected&&section==='overview'?<>
    <View style={s.hero}>
     <View style={s.heroTop}><ShieldCheck color="#D7EDE5" size={26}/>
       <Text style={s.heroTopText}>MFA-PROTECTED ADMINISTRATION</Text></View>
     <Text style={s.heroTitle}>Your entire platform, in view.</Text>
     <Text style={s.heroBody}>Monitor the marketplace, review users and jobs, manage trust, and track every admin action without altering private customer records.</Text>
     <Text style={s.heroFoot}>Last synced {lastLoaded||'not yet'} · Figures from Supabase</Text>
    </View>
    {(goToCustomer||goToTradesperson)?<View style={{flexDirection:'row',gap:10}}>
      {goToCustomer?<MotionPressable onPress={goToCustomer} accessibilityRole="button"
       accessibilityLabel="Exit admin and open customer view"
       style={{flex:1,minHeight:48,borderRadius:15,backgroundColor:'#E5EFEB',
        justifyContent:'center',alignItems:'center',padding:10}}>
       <Text style={{fontSize:12,fontWeight:'900',color:C.teal}}>Customer view</Text>
      </MotionPressable>:null}
      {goToTradesperson?<MotionPressable onPress={goToTradesperson} accessibilityRole="button"
       accessibilityLabel="Exit admin and open tradesperson view"
       style={{flex:1,minHeight:48,borderRadius:15,backgroundColor:'#E5EFEB',
        justifyContent:'center',alignItems:'center',padding:10}}>
       <Text style={{fontSize:12,fontWeight:'900',color:C.teal}}>Tradesperson view</Text>
      </MotionPressable>:null}
     </View>:null}
    <MotionPressable
      onPress={()=>{void runGatewayCheck()}} disabled={gatewayCheckBusy}
      accessibilityRole="button" accessibilityLabel="Run read only administrator security and data checks"
      style={{minHeight:46,borderRadius:14,backgroundColor:'#E6F0EB',
       flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9}}>
      {gatewayCheckBusy?<ActivityIndicator size="small" color={C.teal}/>:<ShieldCheck size={18} color={C.teal}/>}
      <Text style={{fontWeight:'900',fontSize:12,color:C.teal}}>Run admin health check</Text>
     </MotionPressable>
    {loading?<ActivityIndicator color={C.teal} size="large" style={{marginVertical:35}}/>:<>
     <Text style={s.sectionTitle}>Platform overview</Text>
     <View style={s.metrics}>{summary.map(([title,value,note])=>
      <Stat key={title} title={title} value={value} note={note}/>)}</View>
     <View style={s.financial}>
      <View style={s.financeIcon}><Wallet size={21} color={C.teal}/></View>
      <View style={{flex:1}}>
       <Text style={s.financeEyebrow}>TRADE INVOICES · NOT PLATFORM REVENUE</Text>
       <Text style={s.financeTotal}>{money(totals.issued_invoice_total_gbp)}</Text>
       <Text style={s.muted}>Issued/paid invoices · {money(totals.unpaid_invoice_total_gbp)} marked unpaid</Text>
      </View>
     </View>
     <Text style={s.sectionTitle}>Needs your attention</Text>
     <View style={s.quickRow}>
      <MotionPressable style={s.quick} onPress={()=>changeSection('verification')}>
       <ShieldCheck size={20} color={C.teal}/>
       <Text style={s.quickNumber}>{count(totals.credential_queue)}</Text>
       <Text style={s.quickText}>Credential reviews</Text>
      </MotionPressable>
      <MotionPressable style={s.quick} onPress={()=>changeSection('support')}>
       <MessageSquare size={20} color={C.teal}/>
       <Text style={s.quickNumber}>{count(totals.open_support)}</Text>
       <Text style={s.quickText}>Support cases</Text>
      </MotionPressable>
      <MotionPressable style={s.quick} onPress={()=>changeSection('finance')}>
       <FileText size={20} color={C.teal}/>
       <Text style={s.quickNumber}>{count(totals.pending_approvals)}</Text>
       <Text style={s.quickText}>Quotes awaiting replies</Text>
      </MotionPressable>
     </View>
     <Text style={s.sectionTitle}>Platform management</Text>
     {sections.filter(x=>x.id!=='overview').map(item=><SectionTile key={item.id}
      item={item} onClick={()=>changeSection(item.id)}/>)}
     <View style={s.securityNote}>
      <LockKeyhole size={20} color={C.teal}/>
      <Text style={[s.muted,{flex:1}]}>Account passwords, full billing addresses and private customer location coordinates are intentionally excluded. Admin changes require a reason and are recorded.</Text>
     </View>
    </>}
   </>:selected?<>
    <View style={s.record}>
     <Text style={s.overline}>{description(section,selected).eyebrow}</Text>
     <Text style={s.recordTitle}>{description(section,selected).title}</Text>
     <Text style={s.muted}>{description(section,selected).sub}</Text>
     <View style={s.separator}/>
     <ItemDetails label="Record ID" value={selected.id}/>
     {section==='users'?<>
      <ItemDetails label="Email" value={selected.email}/>
      <ItemDetails label="Account type" value={human(selected.account_type)}/>
      <ItemDetails label="Email confirmed" value={selected.email_verified?'Yes':'No'}/>
      <ItemDetails label="Trade profile" value={selected.has_trade_profile?'Yes':'No'}/>
     </>:null}
     {section==='traders'?<>
      <ItemDetails label="Email" value={selected.email}/>
      <ItemDetails label="Trade" value={selected.primary_trade}/>
      <ItemDetails label="Service area" value={selected.service_area}/>
      <ItemDetails label="Verification" value={selected.is_verified?'Reviewed':'Not verified'}/>
      <ItemDetails label="Insurance" value={selected.is_insured?'Evidence reviewed':'Not verified'}/>
      <ItemDetails label="Customer rating" value={selected.rating+' / 5 from '+selected.review_count+' reviews'}/>
      <ItemDetails label="Public listing" value={paused[selected.id]?'PAUSED':'Not paused'}/>
     </>:null}
     {section==='jobs'?<>
      <ItemDetails label="Status" value={human(selected.status)}/>
      <ItemDetails label="Customer ID" value={selected.customer_id}/>
      <ItemDetails label="Accepted trade" value={selected.accepted_tradesperson_id}/>
      <ItemDetails label="Mode" value={human(selected.job_mode)}/>
     </>:null}
     {section==='finance'?<>
      <ItemDetails label="Document" value={human(selected.document_type)}/>
      <ItemDetails label="Amount" value={money(selected.total)}/>
      <ItemDetails label="Status" value={human(selected.status)}/>
      <ItemDetails label="Business" value={selected.business_name}/>
      <ItemDetails label="Linked job" value={selected.job_id}/>
     </>:null}
     {section==='appointments'?<>
      <ItemDetails label="Status" value={human(selected.status)}/>
      <ItemDetails label="Start" value={selected.starts_at}/>
      <ItemDetails label="End" value={selected.ends_at}/>
      <ItemDetails label="Job ID" value={selected.job_id}/>
     </>:null}
     {section==='reviews'?<>
      <ItemDetails label="Rating" value={selected.rating+' / 5'}/>
      <ItemDetails label="Job" value={selected.job_id}/>
      <ItemDetails label="Tradesperson" value={selected.tradesperson_id}/>
      <ItemDetails label="Customer" value={selected.customer_id}/>
     </>:null}
     {section==='cases'?<>
      <ItemDetails label="Status" value={human(selected.status)}/>
      <ItemDetails label="Priority" value={human(selected.priority)}/>
      <ItemDetails label="Customer ID" value={selected.submitted_by}/>
      <MotionPressable style={s.secondary} onPress={()=>changeSection('support')}>
       <MessageSquare size={17} color={C.teal}/><Text style={s.secondaryText}>Open support management</Text>
      </MotionPressable>
     </>:null}
     {section==='audit'?<>
      <ItemDetails label="Administrator" value={selected.actor_id}/>
      <ItemDetails label="Action" value={human(selected.action)}/>
      <ItemDetails label="Target" value={selected.target_type+' · '+line(selected.target_id)}/>
      <ItemDetails label="Reason" value={selected.reason}/>
     </>:null}
    </View>
    {section==='users'?<TradarrAdminMemberControls key={selected.id} userId={selected.id}/>:null}
    {section==='reviews'?<TradarrAdminReviewControls key={selected.id}
      reviewId={selected.id} reviewType={selected.review_type}/>:null}
    {section==='users'?<View style={s.record}>
     <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
      <BellRing size={20} color={C.teal}/>
      <Text style={s.sectionTitle}>Send direct in-app notice</Text>
     </View>
     <Text style={s.muted}>This delivers an Inbox Activity notification only. It does not send an email or remote push. Messages are audited and limited to 30 per administrator per day.</Text>
     <TextInput value={noticeTitle} onChangeText={setNoticeTitle}
      maxLength={90} placeholder="Notice title" placeholderTextColor={C.muted}
      style={[s.notes,{minHeight:47}]}/>
     <TextInput value={noticeBody} onChangeText={setNoticeBody}
      maxLength={350} multiline placeholder="Write a short, helpful notice"
      placeholderTextColor={C.muted} style={s.notes}/>
     <MotionPressable disabled={saving||noticeTitle.trim().length<5||noticeBody.trim().length<10}
      onPress={()=>{void notify()}} accessibilityRole="button"
      style={[s.primary,(saving||noticeTitle.trim().length<5||noticeBody.trim().length<10)&&s.disabled]}>
      <BellRing size={17} color="#FFFFFF"/>
      <Text style={s.primaryText}>Send in-app notice</Text>
     </MotionPressable>
    </View>:null}
    {section!=='audit'&&sectionToTarget(section,selected)?<View style={s.record}>
     <Text style={s.sectionTitle}>Administrator action</Text>
     <Text style={s.muted}>Record a reason for investigating or changing this record. Only staff with verified MFA can write to the audit log.</Text>
     <TextInput value={reason} onChangeText={setReason} maxLength={2000}
      style={s.notes} multiline placeholder="Why is this action needed? (minimum 12 characters)"
      placeholderTextColor={C.muted}/>
     <MotionPressable style={[s.primary,(reason.trim().length<10||saving)&&s.disabled]}
      disabled={reason.trim().length<10||saving} onPress={()=>{void note()}}>
      <History size={17} color="#FFFFFF"/>
      <Text style={s.primaryText}>Save internal audit note</Text>
     </MotionPressable>
     {section==='traders'?<View style={{gap:10}}>
      <View style={s.separator}/>
      <Text style={s.sectionTitle}>Public listing controls</Text>
      <Text style={s.muted}>Pause removes this trader from public discovery. It does not delete their account, completed jobs, quotes or invoices.</Text>
      <MotionPressable disabled={saving||reason.trim().length<12}
        onPress={()=>{void moderate(paused[selected.id]?'restore':'pause')}}
        style={[paused[selected.id]?s.secondary:s.danger,(saving||reason.trim().length<12)&&s.disabled]}>
       {paused[selected.id]?<CheckCircle2 size={17} color={C.teal}/>:<XCircle size={17} color="#A84132"/>}
       <Text style={paused[selected.id]?s.secondaryText:s.dangerText}>
        {paused[selected.id]?'Restore public listing':'Pause public listing'}
       </Text>
      </MotionPressable>
     </View>:null}
    </View>:null}
   </>:<>
    <View style={s.listHead}>
     <Text style={s.muted}>Search the {headerTitle.toLowerCase()} directory. Results are limited to 50 most recent matches.</Text>
     <View style={s.searchWrap}>
      <Search size={17} color={C.teal}/>
      <TextInput value={search} onChangeText={setSearch}
       placeholder={'Search '+headerTitle.toLowerCase()}
       placeholderTextColor={C.muted} autoCapitalize="none"
       autoCorrect={false} style={s.searchInput}/>
     </View>
    </View>
    {loading?<ActivityIndicator color={C.teal} size="large" style={{marginVertical:30}}/>:
     rows.length===0?<View style={s.empty}>
      <Search color={C.teal} size={26}/>
      <Text style={s.recordTitle}>No matching records</Text>
      <Text style={s.muted}>Try another search or refresh this section.</Text>
     </View>:
     rows.map(item=>{
      const info=description(section,item);
      return <MotionPressable style={s.item} key={line(item.id)} onPress={()=>openRecord(item)}
       accessibilityRole="button" accessibilityLabel={'Open '+info.title}>
       <View style={{flex:1,gap:6}}>
        <Text style={s.overline}>{info.eyebrow}</Text>
        <Text style={s.itemTitle} numberOfLines={2}>{info.title}</Text>
        <Text style={s.muted} numberOfLines={2}>{info.sub}</Text>
        <View style={s.itemStatus}><Text style={s.itemStatusText}>
         {section==='traders'&&paused[item.id]?'LISTING PAUSED':info.badge||dt(item.created_at)}
        </Text></View>
       </View>
       <ChevronRight size={19} color={C.teal}/>
      </MotionPressable>;
     })}
   </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 head:{padding:16,flexDirection:'row',gap:12,alignItems:'center'},
 back:{width:44,height:44,backgroundColor:'#FFFFFF',borderRadius:15,alignItems:'center',justifyContent:'center'},
 refresh:{width:44,height:44,backgroundColor:'#FFFFFF',borderRadius:15,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'900',letterSpacing:1,color:C.teal},
 heading: {fontFamily:theme.font.editorial,fontSize:24,fontWeight:'900',color:C.ink},
 page:{paddingHorizontal:17,paddingBottom:110,gap:12},
 hero:{backgroundColor:C.darkTeal,borderRadius:24,padding:22,gap:10},
 heroTop:{flexDirection:'row',alignItems:'center',gap:9},
 heroTopText:{fontSize:10,letterSpacing:1,fontWeight:'900',color:'#D6ECE5'},
 heroTitle:{fontSize:25,fontWeight:'900',color:'#FFFFFF',marginTop:4},
 heroBody:{fontSize:12,lineHeight:20,color:'#D9EDE6'},
 heroFoot:{fontSize:10,color:'#CCE5DA',marginTop:8},
 sectionTitle:{fontSize:16,fontWeight:'900',color:C.ink,marginTop:9},
 metrics:{flexDirection:'row',flexWrap:'wrap',gap:10},
 stat:{width:'48%',minHeight:112,backgroundColor:'#FFFFFF',borderRadius:18,padding:16,gap:7},
 statLabel:{fontSize:11,color:C.muted,fontWeight:'700'},
 statValue:{fontSize:25,fontWeight:'900',color:C.ink},
 statNote:{fontSize:10,color:C.teal},
 financial:{padding:18,borderRadius:20,backgroundColor:'#FFFFFF',flexDirection:'row',gap:13,alignItems:'center'},
 financeIcon:{width:43,height:43,borderRadius:15,backgroundColor:'#EAF4EF',alignItems:'center',justifyContent:'center'},
 financeEyebrow:{fontSize:10,fontWeight:'900',color:C.teal,letterSpacing:.5},
 financeTotal:{fontSize:23,fontWeight:'900',color:C.ink,marginTop:5,marginBottom:4},
 muted:{fontSize:12,lineHeight:19,color:C.muted},
 quickRow:{flexDirection:'row',gap:9},
 quick:{flex:1,padding:12,backgroundColor:'#FFFFFF',borderRadius:17,gap:7,alignItems:'flex-start'},
 quickNumber:{fontSize:23,fontWeight:'900',color:C.ink},
 quickText:{fontSize:10,lineHeight:14,color:C.muted,fontWeight:'800'},
 tile:{backgroundColor:'#FFFFFF',borderRadius:17,padding:15,flexDirection:'row',gap:12,alignItems:'center'},
 tileIcon:{height:39,width:39,borderRadius:13,backgroundColor:'#EAF4EF',justifyContent:'center',alignItems:'center'},
 tileTitle:{fontSize:14,fontWeight:'900',color:C.ink},
 tileNote:{fontSize:11,lineHeight:16,color:C.muted},
 securityNote:{padding:14,flexDirection:'row',gap:10,alignItems:'flex-start'},
 listHead:{backgroundColor:'#FFFFFF',padding:15,borderRadius:19,gap:12},
 searchWrap:{borderRadius:13,borderWidth:1,borderColor:'#DCE8E2',minHeight:46,paddingHorizontal:12,flexDirection:'row',gap:8,alignItems:'center'},
 searchInput:{flex:1,fontSize:13,color:C.ink,paddingVertical:8},
 item:{padding:17,borderRadius:18,backgroundColor:'#FFFFFF',flexDirection:'row',gap:12,alignItems:'center'},
 itemTitle:{fontSize:15,fontWeight:'900',color:C.ink},
 itemStatus:{backgroundColor:'#EAF3EE',borderRadius:10,paddingVertical:6,paddingHorizontal:9,alignSelf:'flex-start'},
 itemStatusText:{fontSize:10,fontWeight:'800',color:C.teal},
 empty:{backgroundColor:'#FFFFFF',padding:28,borderRadius:20,alignItems:'center',gap:10},
 record:{backgroundColor:'#FFFFFF',padding:18,borderRadius:20,gap:12},
 recordTitle:{fontSize:19,fontWeight:'900',color:C.ink},
 detailRow:{gap:5,paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#E9EFEC'},
 detailName:{fontSize:11,fontWeight:'800',color:C.muted},
 detailValue:{fontSize:13,color:C.ink,lineHeight:19},
 separator:{height:1,backgroundColor:'#DEE9E3',marginVertical:6},
 notes:{padding:13,borderRadius:15,borderWidth:1,borderColor:'#DCE8E2',color:C.ink,minHeight:100,textAlignVertical:'top'},
 primary:{backgroundColor:C.darkTeal,minHeight:48,borderRadius:15,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',padding:12},
 primaryText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},
 secondary:{backgroundColor:'#ECF4F0',minHeight:46,borderRadius:15,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',padding:12},
 secondaryText:{fontSize:12,fontWeight:'900',color:C.teal},
 danger:{backgroundColor:'#FFF0ED',borderRadius:15,minHeight:48,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',padding:12},
 dangerText:{fontSize:12,fontWeight:'900',color:'#A84132'},
 disabled:{opacity:.5},
 warning:{padding:13,backgroundColor:'#FFF2E2',borderRadius:13,flexDirection:'row',gap:10,alignItems:'flex-start'}
});
