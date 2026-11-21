import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Linking,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {
 ArrowLeft,ArrowRight,BriefcaseBusiness,CalendarClock,Check,ChevronRight,
 ClipboardCheck,FileText,FolderLock,Lightbulb,MapPin,Plus,RefreshCw,
 Share2,ShieldCheck,Sparkles,Trash2,TrendingUp,Users,Wallet
} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

export type QuoteDraftFromSuite={title:string;scope:string;labour:number;materials:number;markup:number};
export type BusinessFeature='radar'|'quoteStudio'|'assistant'|'smartDiary'|
 'commandCentre'|'moneyHub'|'crewOps'|'repeatEngine'|'bookingProfile'|
 'documentVault'|'insights'|'growthKit';

type R=Record<string,any>;
const C=theme.colors;
const titles:Record<BusinessFeature,string>={
 radar:'Opportunity Radar',quoteStudio:'Smart Quote Studio',assistant:'Business Assistant',
 smartDiary:'Smart Diary & Gap Filler',commandCentre:'Job Command Centre',
 moneyHub:'Money Hub',crewOps:'Crew Operations',repeatEngine:'Repeat Customer Engine',
 bookingProfile:'Business Booking Profile',documentVault:'Document Vault',
 insights:'Business Insights',growthKit:'Growth Toolkit'
};
const subtitles:Record<BusinessFeature,string>={
 radar:'Match real work to your trade and area',quoteStudio:'Prepare better scopes and reusable quotes',
 assistant:'Understand what your business records suggest',
 smartDiary:'Spot possible booking gaps in your diary',
 commandCentre:'Keep job checklists in one place',
 moneyHub:'Track invoices, money due and job costs',
 crewOps:'Record agreed helper hours alongside Crew',
 repeatEngine:'Keep track of legitimate service follow-ups',
 bookingProfile:'Prepare a shareable business contact profile',
 documentVault:'Store and retrieve private trade documents',
 insights:'See your actual business performance',
 growthKit:'Save reusable customer communication drafts'
};
const definitions:Record<BusinessFeature,string[]>={
 radar:['job_offers','urgent_request_offers','trade_suite_radar_prefs'],
 quoteStudio:['trade_suite_templates','trade_quotes'],
 assistant:['trade_quotes','trade_invoices','trade_appointments','trade_customers','trade_job_costs'],
 smartDiary:['trade_appointments','trade_working_hours','trade_grid_slots'],
 commandCentre:['jobs','urgent_requests','trade_suite_job_tasks'],
 moneyHub:['trade_invoices','trade_job_costs','trade_quotes'],
 crewOps:['crew_requests','crew_applications','trade_suite_crew_hours'],
 repeatEngine:['trade_customers','trade_suite_reminders'],
 bookingProfile:['tradesperson_profiles','trade_suite_booking_profile'],
 documentVault:['trade_suite_documents'],
 insights:['trade_quotes','trade_invoices','trade_job_costs','jobs','urgent_requests','trade_customers'],
 growthKit:['trade_suite_templates','trade_customers']
};
const ownerField:Record<string,string>={
 job_offers:'tradesperson_id',urgent_request_offers:'tradesperson_id',
 trade_quotes:'tradesperson_id',trade_invoices:'tradesperson_id',trade_appointments:'tradesperson_id',
 trade_customers:'tradesperson_id',trade_job_costs:'tradesperson_id',trade_working_hours:'tradesperson_id',
 trade_grid_slots:'tradesperson_id',tradesperson_profiles:'user_id',
 jobs:'accepted_tradesperson_id',urgent_requests:'accepted_tradesperson_id',
 crew_requests:'owner_id',trade_suite_radar_prefs:'tradesperson_id',
 trade_suite_templates:'tradesperson_id',trade_suite_reminders:'tradesperson_id',
 trade_suite_job_tasks:'tradesperson_id',trade_suite_crew_hours:'tradesperson_id',
 trade_suite_booking_profile:'tradesperson_id',trade_suite_documents:'tradesperson_id'
};
const pound=(v:any)=>'£'+(Number(v)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const shortDate=(x:any)=>x?new Date(String(x)).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
const time=(x:any)=>x?new Date(String(x)).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
const num=(x:any)=>Number.isFinite(Number(x))?Number(x):0;
const sum=(rows:R[],key:string)=>rows.reduce((n,r)=>n+num(r[key]),0);
const err=(x:any)=>x?.message||String(x||'Please try again');
function Input({label,value,onChange,multiline=false,placeholder,number=false}:{
 label:string;value:string;onChange:(v:string)=>void;multiline?:boolean;placeholder?:string;number?:boolean
}){return <View style={sx.field}><Text style={sx.label}>{label}</Text>
 <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
  placeholderTextColor="#819391" multiline={multiline} textAlignVertical={multiline?'top':'center'}
  keyboardType={number?'decimal-pad':'default'} style={[sx.input,multiline&&{minHeight:95}]}/></View>}
function Btn({label,onPress,secondary=false,disabled=false}:{
 label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean
}){return <MotionPressable onPress={onPress} disabled={disabled}
 accessibilityRole="button" accessibilityLabel={label}
 style={[sx.button,secondary&&sx.secondary,disabled&&{opacity:.5}]}>
 <Text style={[sx.buttonText,secondary&&{color:C.teal}]}>{label}</Text>
 </MotionPressable>}
function Pill({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
 return <MotionPressable accessibilityRole="button" accessibilityState={{selected:active}}
 onPress={onPress} style={[sx.pill,active&&{backgroundColor:C.darkTeal}]}>
  <Text style={[sx.pillText,active&&{color:'#FFFFFF'}]}>{label}</Text>
 </MotionPressable>
}
function Card({children}:{children:React.ReactNode}){return <View style={sx.card}>{children}</View>}
function Empty({children}:{children:string}){return <View style={sx.empty}>
  <View style={sx.emptyIcon}><ClipboardCheck size={22} color={C.teal}/></View>
  <Text style={sx.emptyTitle}>Nothing here yet</Text>
  <Text style={[sx.muted,{textAlign:'center'}]}>{children}</Text>
 </View>}
function Metric({label,value}:{label:string;value:string|number}){return <View style={sx.metric}>
 <Text style={sx.metricValue}>{value}</Text><Text style={sx.muted}>{label}</Text></View>}

export default function TradeBusinessSuiteScreen({feature,goBack,openTool,openQuoteDraft}:{
 feature:BusinessFeature;goBack:()=>void;openTool:(screen:string)=>void;
 openQuoteDraft:(draft:QuoteDraftFromSuite)=>void;
}){
 const [uid,setUid]=useState('');
 const [rows,setRows]=useState<Record<string,R[]>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState('');
 const [refreshing,setRefreshing]=useState(false);
 const [tradeFilter,setTradeFilter]=useState('');
 const [maxMiles,setMaxMiles]=useState('15');
 const [minValue,setMinValue]=useState('0');
 const [urgentOnly,setUrgentOnly]=useState(false);
 const [scopeTitle,setScopeTitle]=useState('');
 const [scopeBody,setScopeBody]=useState('');
 const [labour,setLabour]=useState('');
 const [materials,setMaterials]=useState('');
 const [markup,setMarkup]=useState('0');
 const [question,setQuestion]=useState<'quotes'|'money'|'customers'>('quotes');
 const [selectedJob,setSelectedJob]=useState<{id:string;kind:'standard'|'urgent';title:string}|null>(null);
 const [taskTitle,setTaskTitle]=useState('');
 const [customerId,setCustomerId]=useState('');
 const [reminderTitle,setReminderTitle]=useState('');
 const [reminderDate,setReminderDate]=useState('');
 const [reminderNote,setReminderNote]=useState('');
 const [hoursApp,setHoursApp]=useState('');
 const [hoursDate,setHoursDate]=useState(new Date().toISOString().slice(0,10));
 const [hoursCount,setHoursCount]=useState('');
 const [hoursRate,setHoursRate]=useState('');
 const [hoursNote,setHoursNote]=useState('');
 const [businessHeadline,setBusinessHeadline]=useState('');
 const [businessServices,setBusinessServices]=useState('');
 const [bookingNotes,setBookingNotes]=useState('');
 const [documentLabel,setDocumentLabel]=useState('');
 const [documentKind,setDocumentKind]=useState('other');
 const [documentExpiry,setDocumentExpiry]=useState('');
 const [chosen,setChosen]=useState<{name:string;uri:string;size:number}|null>(null);
 const [templateType,setTemplateType]=useState<'follow_up'|'review'|'general'>('follow_up');
 const [templateTitle,setTemplateTitle]=useState('');
 const [templateBody,setTemplateBody]=useState('');
 const [radarItems,setRadarItems]=useState<R[]>([]);

 const list=(name:string)=>rows[name]||[];
 const refresh=useCallback(async()=>{
  setRefreshing(true);
  try {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){setProblem('Please sign in as a tradesperson.');setLoading(false);return;}
  const id=user.id;
  setUid(id);
  const names=definitions[feature];
  const result=await Promise.all(names.map(async table=>{
   let req=supabase.from(table).select('*').limit(250);
   if(ownerField[table])req=req.eq(ownerField[table],id);
   const response=await req;
   return {table,data:(response.data||[]) as R[],error:response.error};
  }));
  const failed=result.find(x=>x.error);
  if(failed){setProblem(failed.table+': '+err(failed.error));setLoading(false);return;}
  const next:Record<string,R[]>={};
  result.forEach(x=>{next[x.table]=x.data;});
  if(feature==='radar'){
   const m=(next.job_offers||[]).filter(x=>x.status==='offered').map(x=>({id:x.id,kind:'standard',source_id:x.job_id,distance:num(x.distance_miles),value:x.quoted_price??x.route_price}));
   const u=(next.urgent_request_offers||[]).filter(x=>x.status==='offered').map(x=>({id:x.id,kind:'urgent',source_id:x.request_id,distance:num(x.distance_miles),value:null}));
   const ids=m.map(x=>x.source_id);
   const uids=u.map(x=>x.source_id);
   const [mDetails,uDetails]=await Promise.all([
    ids.length?supabase.from('jobs').select('id,trade,issue,status').in('id',ids):Promise.resolve({data:[],error:null}),
    uids.length?supabase.from('urgent_requests').select('id,trade,issue,status').in('id',uids):Promise.resolve({data:[],error:null})
   ]);
   const all=[...(mDetails.data||[]),...(uDetails.data||[])];
   const mapped=[...m,...u].map(x=>({...x,job:all.find(d=>d.id===x.source_id)}));
   setRadarItems(mapped);
  }
  const prefs=(next.trade_suite_radar_prefs||[])[0];
  if(prefs){setTradeFilter(prefs.trade_filter||'');setMaxMiles(String(prefs.max_distance_miles||15));
   setMinValue(String(prefs.minimum_job_value||0));setUrgentOnly(Boolean(prefs.urgent_only));}
  const booking=(next.trade_suite_booking_profile||[])[0];
  if(booking){setBusinessHeadline(booking.headline||'');setBusinessServices(booking.services||'');
   setBookingNotes(booking.booking_instructions||'');}
  setRows(next);setProblem('');setLoading(false);
  } catch(e) {setProblem(err(e));setLoading(false);}
  finally {setRefreshing(false);}
 },[feature]);
 useEffect(()=>{void refresh();},[refresh]);
 const run=async(action:()=>Promise<void>)=>{
  if(busy)return;
  setBusy(true);setProblem('');
  try{await action();await refresh();}
  catch(e){Alert.alert('Tradarr Tools',err(e));}
  finally{setBusy(false);}
 };
 const changeExisting=async(table:string,id:string,changes:R)=>{
  const {data,error}=await supabase.from(table).update(changes)
   .eq('id',id).eq('tradesperson_id',uid).select('id').maybeSingle();
  if(error||!data)throw new Error(error?.message||'No record was updated.');
 };
 const create=async(table:string,values:R)=>{
  const {data,error}=await supabase.from(table).insert({tradesperson_id:uid,...values}).select('id').single();
  if(error||!data)throw new Error(error?.message||'Could not save.');
 };
 const confirmDelete=(title:string,action:()=>Promise<void>)=>{
  Alert.alert(title,'This cannot be undone.',[
   {text:'Cancel',style:'cancel'},
   {text:'Delete',style:'destructive',onPress:()=>void run(action)}
  ]);
 };
 const quotes=list('trade_quotes');
 const invoices=list('trade_invoices');
 const appointments=list('trade_appointments');
 const customers=list('trade_customers');
 const costs=list('trade_job_costs');
 const tasks=list('trade_suite_job_tasks');
 const filteredRadar=radarItems.filter(x=>(!urgentOnly||x.kind==='urgent')&&
  (num(x.distance)<=Number(maxMiles)||!x.distance)&&
  (Number(minValue)<=0||(x.value!=null&&num(x.value)>=Number(minValue)))&&
  (!tradeFilter.trim()||(String(x.job?.trade||'')).toLowerCase()
     .includes(tradeFilter.trim().toLowerCase())));
 const sentQuotes=quotes.filter(x=>['sent','accepted','converted'].includes(x.status));
 const wonQuotes=quotes.filter(x=>['accepted','converted'].includes(x.status));
 const issuedInvoices=invoices.filter(x=>x.status!=='draft'&&x.status!=='void');
 const paidInvoices=invoices.filter(x=>x.status==='paid');
 const dueInvoices=invoices.filter(x=>x.status==='sent');
 const totalRevenue=sum(paidInvoices,'total');
 const totalCosts=sum(costs,'amount');
 const shareText=async(title:string,body:string)=>{
  await Share.share({title,message:body});
 };
 const saveRadar=()=>void run(async()=>{
  const n=Number(maxMiles),v=Number(minValue);
  if(!Number.isInteger(n)||n<1||n>100||!Number.isFinite(v)||v<0)
   throw new Error('Choose 1–100 miles and a non-negative job value.');
  const payload={trade_filter:tradeFilter.trim(),max_distance_miles:n,
   minimum_job_value:v,urgent_only:urgentOnly,updated_at:new Date().toISOString()};
  const existing=list('trade_suite_radar_prefs')[0];
  const q=existing
   ?await supabase.from('trade_suite_radar_prefs').update(payload).eq('tradesperson_id',uid)
    .select('tradesperson_id').maybeSingle()
   :await supabase.from('trade_suite_radar_prefs').insert({tradesperson_id:uid,...payload})
    .select('tradesperson_id').maybeSingle();
  if(q.error||!q.data)throw new Error(q.error?.message||'Could not save Radar settings.');
  Alert.alert('Radar saved','These preferences are used to filter your offers.');
 });
 const quoteDraft=()=>{
  const l=Number(labour)||0,m=Number(materials)||0,p=Number(markup)||0;
  const materialsWithMarkup=m*(1+p/100);
  return 'PROJECT: '+(scopeTitle.trim()||'New quotation')+'\n\n'+
   'PROPOSED SCOPE\n'+scopeBody.trim()+'\n\n'+
   'Labour: '+pound(l)+'\nMaterials: '+pound(m)+'\nMaterials markup: '+p.toFixed(1)+'%\n'+
   'Estimated subtotal (before any VAT): '+pound(l+materialsWithMarkup)+
   '\n\nDraft only. Confirm quantities, VAT, costs and any regulated requirements before issuing.';
 };
 const saveQuoteTemplate=()=>void run(async()=>{
  if(scopeTitle.trim().length<2||scopeBody.trim().length<5)
   throw new Error('Add a template name and meaningful job scope.');
  if([labour,materials,markup].some(v=>v.trim()&&!Number.isFinite(Number(v))))
   throw new Error('Labour, materials and markup must be valid numbers.');
  if(Number(labour)<0||Number(materials)<0||Number(markup)<0||Number(markup)>1000)
   throw new Error('Costs cannot be negative; markup must be 0–1000%.');
  await create('trade_suite_templates',{category:'quote',title:scopeTitle.trim(),body:quoteDraft()});
  Alert.alert('Template saved','You can reuse or share this scope alongside the full Quotes tool.');
 });
 const latestTwo=useMemo(()=>appointments.filter(x=>x.status!=='cancelled'
  &&new Date(x.ends_at).getTime()>Date.now()).sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))),
 [appointments]);
 const gaps=useMemo(()=>{
  const result:{start:string;end:string;minutes:number}[]=[];
  for(let i=0;i<latestTwo.length-1;i++){
   const a=latestTwo[i],b=latestTwo[i+1];
   const d1=new Date(a.ends_at),d2=new Date(b.starts_at);
   if(d1.toDateString()===d2.toDateString()){
    const minutes=Math.round((d2.getTime()-d1.getTime())/60000);
    if(minutes>=60)result.push({start:a.ends_at,end:b.starts_at,minutes});
   }
  }
  return result.slice(0,12);
 },[latestTwo]);
 const jobOptions=[...list('jobs').map(x=>({id:x.id,kind:'standard' as const,title:x.issue||x.trade})),
 ...list('urgent_requests').map(x=>({id:x.id,kind:'urgent' as const,title:x.issue||x.trade}))];
 const addTask=()=>void run(async()=>{
  if(!selectedJob||taskTitle.trim().length<2)throw new Error('Choose a job and enter the task.');
  await create('trade_suite_job_tasks',{job_id:selectedJob.id,job_kind:selectedJob.kind,title:taskTitle.trim(),is_done:false});
  setTaskTitle('');
 });
 const acceptedCrew=list('crew_applications').filter(x=>x.status==='accepted'&&
  list('crew_requests').some(r=>r.id===x.request_id&&r.owner_id===uid));
 const logHours=()=>void run(async()=>{
  if(!acceptedCrew.some(x=>x.id===hoursApp))throw new Error('Select an accepted Crew application.');
  const h=Number(hoursCount),rate=hoursRate.trim()?Number(hoursRate):null;
  if(!(h>0&&h<=24)||!Number.isFinite(h))throw new Error('Hours must be above 0 and no more than 24.');
  if(rate!==null&&(!(rate>=0&&rate<=10000)||!Number.isFinite(rate)))
   throw new Error('Enter a valid hourly cost.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(hoursDate)||Number.isNaN(new Date(hoursDate).getTime()))
   throw new Error('Use a valid date (YYYY-MM-DD).');
  await create('trade_suite_crew_hours',{application_id:hoursApp,worked_on:hoursDate,
   hours:h,hourly_cost:rate,note:hoursNote.trim()});
  setHoursCount('');setHoursNote('');
 });
 const addReminder=()=>void run(async()=>{
  if(!customers.some(c=>c.id===customerId))throw new Error('Choose a customer.');
  if(reminderTitle.trim().length<3)throw new Error('Add a reminder title.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(reminderDate)||Number.isNaN(new Date(reminderDate).getTime()))
   throw new Error('Use a valid YYYY-MM-DD due date.');
  await create('trade_suite_reminders',{customer_id:customerId,
   title:reminderTitle.trim(),due_on:reminderDate,note:reminderNote.trim(),status:'due'});
  setReminderTitle('');setReminderNote('');
 });
 const bookingProfile=list('tradesperson_profiles')[0];
 const saveBooking=()=>void run(async()=>{
  const payload={headline:businessHeadline.trim(),services:businessServices.trim(),
   booking_instructions:bookingNotes.trim(),updated_at:new Date().toISOString()};
  const existing=list('trade_suite_booking_profile')[0];
  const q=existing?
   await supabase.from('trade_suite_booking_profile').update(payload).eq('tradesperson_id',uid)
    .select('tradesperson_id').maybeSingle():
   await supabase.from('trade_suite_booking_profile').insert({tradesperson_id:uid,...payload})
    .select('tradesperson_id').maybeSingle();
  if(q.error||!q.data)throw new Error(q.error?.message||'Could not save booking details.');
  Alert.alert('Booking details saved','These details can be shared as a contact card. A public web URL is not live yet.');
 });
 const pickDocument=async()=>{
  try{
   const p=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png',
    'image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    multiple:false,copyToCacheDirectory:true});
   if(p.canceled||!p.assets?.length)return;
   const v=p.assets[0];if(v.size&&v.size>10*1024*1024)throw Error('Maximum file size: 10 MB.');
   setChosen({name:v.name,uri:v.uri,size:v.size||0});if(!documentLabel)setDocumentLabel(v.name.slice(0,140));
  }catch(e){Alert.alert('Document',err(e));}
 };
 const submitDocument=()=>void run(async()=>{
  if(!chosen||!uid||documentLabel.trim().length<3)throw new Error('Choose a document and label it.');
  if(documentExpiry&&(!/^\d{4}-\d{2}-\d{2}$/.test(documentExpiry)||Number.isNaN(new Date(documentExpiry).getTime())))
   throw new Error('Use YYYY-MM-DD for expiry.');
  const lower=chosen.name.toLowerCase();
  const ext=lower.endsWith('.pdf')?'pdf':lower.endsWith('.jpg')||lower.endsWith('.jpeg')?'jpg':
    lower.endsWith('.png')?'png':lower.endsWith('.webp')?'webp':lower.endsWith('.docx')?'docx':'';
  if(!ext)throw new Error('PDF, JPG, PNG, WebP and DOCX only.');
  const mime:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',png:'image/png',
   webp:'image/webp',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  const file=new File(chosen.uri);if(file.size<8||file.size>10*1024*1024)throw new Error('File must be 8 bytes to 10 MB.');
  const bytes=await file.bytes();
  if(bytes.length<8||bytes.length>10*1024*1024)throw new Error('File size is not permitted.');
  const path=uid+'/'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,15)+'.'+ext;
  const upload=await supabase.storage.from('tradarr-trade-vault').upload(path,bytes,
    {contentType:mime[ext],upsert:false});
  if(upload.error)throw upload.error;
  try{await create('trade_suite_documents',{object_path:path,label:documentLabel.trim(),
    category:documentKind,expiry_date:documentExpiry||null});}
  catch(e){await supabase.storage.from('tradarr-trade-vault').remove([path]);throw e;}
  setChosen(null);setDocumentLabel('');setDocumentExpiry('');
  Alert.alert('Stored privately','Your document is only visible to this business account.');
 });
 const deleteDocument=(d:R)=>confirmDelete('Delete private document?',async()=>{
  const remove=await supabase.storage.from('tradarr-trade-vault').remove([d.object_path]);
  if(remove.error)throw remove.error;
  await changeDelete('trade_suite_documents',d.id);
 });
 const changeDelete=async(table:string,id:string)=>{
  const {error}=await supabase.from(table).delete().eq('id',id).eq('tradesperson_id',uid);
  if(error)throw error;
 };
 const templateSave=()=>void run(async()=>{
  if(templateTitle.trim().length<2||templateBody.trim().length<5)
   throw new Error('Enter a template title and message.');
  await create('trade_suite_templates',{category:templateType,
   title:templateTitle.trim(),body:templateBody.trim()});
  setTemplateTitle('');setTemplateBody('');
 });
 const insightsContent=()=>{
  const outstanding=sum(dueInvoices,'total');
  const unanswered=quotes.filter(q=>q.status==='sent').length;
  const upcoming=appointments.filter(a=>a.status==='scheduled'&&new Date(a.starts_at)>new Date()).length;
  const facts:string[]=[];
  facts.push(unanswered?unanswered+' sent quote(s) are still awaiting a decision. Review them in Quotes.':'No sent quotes are currently awaiting a decision.');
  facts.push(outstanding?'You have '+pound(outstanding)+' in invoices marked sent but unpaid.':'No invoices are currently marked sent but unpaid.');
  facts.push(upcoming?'Your diary contains '+upcoming+' future scheduled appointment(s).':'You have no future appointments currently scheduled.');
  if(customers.length)facts.push('Your saved customer book contains '+customers.length+' contact(s).');
  return facts;
 };
 return <View style={sx.root}>
  <View style={sx.header}>
   <MotionPressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back to Tools" style={sx.back}>
    <ArrowLeft color={C.ink} size={22}/></MotionPressable>
   <View style={{flex:1}}><Text style={sx.eyebrow}>TRADARR BUSINESS TOOLS</Text>
    <Text style={sx.title}>{titles[feature]}</Text>
    <Text style={sx.muted}>{subtitles[feature]}</Text></View>
   <MotionPressable onPress={()=>void refresh()} accessibilityRole="button" accessibilityLabel="Refresh" style={sx.back}>
    {refreshing?<ActivityIndicator color={C.teal} size="small"/>:
     <RefreshCw color={C.teal} size={21}/>}</MotionPressable>
  </View>
  <ScrollView automaticallyAdjustKeyboardInsets style={{flex:1}} contentContainerStyle={sx.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   {loading?<ActivityIndicator size="large" color={C.teal}/>:null}
   {problem?<Card><Text style={sx.warning}>{problem}</Text><Btn label="Try again" secondary onPress={()=>void refresh()}/></Card>:null}
   {!loading&&!problem&&feature==='radar'?<>
    <Card><Text style={sx.heading}>Your opportunity preferences</Text>
     <Input label="Trade (leave blank for all)" value={tradeFilter} onChange={setTradeFilter} placeholder="Plumbing"/>
     <Input label="Maximum distance (miles)" value={maxMiles} onChange={setMaxMiles} number/>
     <Input label="Minimum advertised job value (£)" value={minValue} onChange={setMinValue} number/>
     <Pill label={urgentOnly?'Urgent only: on':'Include flexible & urgent'} active={urgentOnly} onPress={()=>setUrgentOnly(x=>!x)}/>
     <Btn label="Save Radar preferences" onPress={saveRadar} disabled={busy}/>
     <Text style={sx.muted}>Filters help you review real offers. They do not create or guarantee new customer demand.</Text>
    </Card>
    <Text style={sx.heading}>Live offers matched to your account</Text>
    {filteredRadar.map(x=><Card key={x.id}><Text style={sx.cardTitle}>{x.job?.issue||'New '+x.kind+' work'}</Text>
      <Text style={sx.muted}>{x.job?.trade||'Trade offer'} · {x.kind==='urgent'?'Urgent':'Flexible'} · {num(x.distance).toFixed(1)} miles</Text>
      {x.value!=null?<Text style={sx.pillText}>Indicative offer value: {pound(x.value)}</Text>:null}
      <Btn label="Review in Jobs" secondary onPress={()=>openTool('tradeJobs')}/></Card>)}
    {!filteredRadar.length?<Card>
       <Text style={sx.cardTitle}>{radarItems.length?'No offers meet these filters':'No new offers yet'}</Text>
       <Text style={sx.muted}>{radarItems.length
         ? 'Some offers exist, but your trade, distance or minimum value filters hide them. Adjust the filters above.'
         : 'No new offer is currently addressed to your account. Stay visible on the customer map and check Jobs.'}</Text>
       {radarItems.length?<Btn label="Clear filters" secondary onPress={()=>{
         setTradeFilter('');setMaxMiles('100');setMinValue('0');setUrgentOnly(false);
       }}/>:null}
     </Card>:null}
    <Btn label="Open full job marketplace" onPress={()=>openTool('tradeJobs')}/>
   </>:null}
   {!loading&&!problem&&feature==='quoteStudio'?<>
    <Card><Text style={sx.heading}>Build a reusable quote scope</Text>
     <Input label="Template / project name" value={scopeTitle} onChange={setScopeTitle} placeholder="Bathroom installation"/>
     <Input label="Work included" value={scopeBody} onChange={setScopeBody} multiline placeholder="Preparation, labour, included materials and exclusions..."/>
     <Input label="Labour estimate (£)" value={labour} onChange={setLabour} number/>
     <Input label="Materials estimate (£)" value={materials} onChange={setMaterials} number/>
     <Input label="Materials markup (%)" value={markup} onChange={setMarkup} number/>
     <View style={sx.summary}><Text style={sx.heading}>Indicative subtotal: {pound((num(labour)+num(materials)*(1+num(markup)/100)))}</Text>
      <Text style={sx.muted}>Before any VAT. Draft only — no invoice or payment is created.</Text></View>
     <Btn label="Save as quote template" onPress={saveQuoteTemplate} disabled={busy}/>
     <Btn label="Share draft scope" secondary onPress={()=>{
       if(!scopeTitle.trim()||!scopeBody.trim()){
        Alert.alert('Add scope details','Enter a title and scope before sharing.');return;
       }
       void shareText('Draft quote',quoteDraft());
     }}/>
     <Btn label="Continue in full quote builder" secondary onPress={()=>{
       if(!scopeTitle.trim()||!scopeBody.trim()){
         Alert.alert('Add a scope first','Enter a template title and work scope first.');return;
       }
       openQuoteDraft({title:scopeTitle.trim(),scope:scopeBody.trim(),
        labour:Math.max(0,num(labour)),materials:Math.max(0,num(materials)),markup:Math.max(0,num(markup))});
     }}/>
     <Btn label="Open Quotes without draft" secondary onPress={()=>openTool('tradeQuotes')}/>
    </Card>
    <Text style={sx.heading}>Saved quote templates</Text>
    {list('trade_suite_templates').filter(x=>x.category==='quote').map(t=><Card key={t.id}>
     <Text style={sx.cardTitle}>{t.title}</Text><Text style={sx.smallBody}>{t.body}</Text>
     <Btn label="Copy or share" secondary onPress={()=>void shareText(t.title,t.body)}/>
     <Btn label="Use template in full quote" secondary onPress={()=>openQuoteDraft({
       title:t.title,scope:t.body,labour:0,materials:0,markup:0
     })}/>
     <Btn label="Delete template" secondary onPress={()=>confirmDelete('Delete template?',()=>changeDelete('trade_suite_templates',t.id))}/>
    </Card>)}
    {!list('trade_suite_templates').some(x=>x.category==='quote')?<Empty>No saved quote scopes yet.</Empty>:null}
   </>:null}
   {!loading&&!problem&&feature==='assistant'?<>
    <Card><View style={sx.iconHeading}><Lightbulb color={C.teal} size={25}/><Text style={sx.heading}>Based on your real records</Text></View>
     <Text style={sx.muted}>The assistant currently provides calculated business guidance. It does not invent an AI answer, access private customer messages or take actions on your behalf.</Text>
     <View style={sx.wrap}>{([
      ['quotes','Quotations'],['money','Money'],['customers','Customers']] as const)
      .map(([id,label])=><Pill key={id} label={label} active={question===id} onPress={()=>setQuestion(id)}/>)}</View>
     {question==='quotes'?<Text style={sx.smallBody}>{sentQuotes.length} quotations sent/accepted/converted. {quotes.filter(q=>q.status==='sent').length} currently awaiting a decision. Review outstanding estimates and confirm scope before sending.</Text>:null}
     {question==='money'?<Text style={sx.smallBody}>{pound(sum(dueInvoices,'total'))} is marked invoiced and unpaid. {pound(totalRevenue)} is recorded as paid. Costs recorded: {pound(totalCosts)}. These figures are not bank-verified.</Text>:null}
     {question==='customers'?<Text style={sx.smallBody}>{customers.length} customer contacts and {appointments.filter(x=>x.status==='scheduled'&&new Date(x.starts_at)>new Date()).length} future appointments are recorded. Check for legitimate service follow-ups.</Text>:null}
     <Btn label={question==='quotes'?'Review quotes':question==='money'?'View invoices':'Open customer book'}
       onPress={()=>openTool(question==='quotes'?'tradeQuotes':question==='money'?'tradeInvoices':'tradeCustomers')}/>
    </Card>
    <Card><Text style={sx.heading}>Suggested priorities</Text>
     {insightsContent().map((item,i)=><View key={i} style={sx.row}>
       <Check size={19} color={C.teal}/>
       <Text style={[sx.smallBody,{flex:1}]}>{item}</Text>
      </View>)}
     <Btn label="Open profit tracker" secondary onPress={()=>openTool('tradeProfit')}/>
     <Text style={sx.muted}>Suggestions use your own saved records, not generative AI. Nothing is sent or changed automatically.</Text>
    </Card>
   </>:null}
   {!loading&&!problem&&feature==='smartDiary'?<>
    <Card><Text style={sx.heading}>Your future bookings</Text>
     <Metric label="Upcoming appointments" value={latestTwo.length}/>
     <Text style={sx.muted}>Gap suggestions use confirmed diary times, not a live travel-time calculation. Check your working hours and journey before offering a slot.</Text>
     <Btn label="Open full diary" onPress={()=>openTool('tradeDiary')}/>
     <Btn label="Working hours" secondary onPress={()=>openTool('tradeHours')}/>
    </Card>
    <Text style={sx.heading}>Possible gaps between bookings</Text>
    {gaps.map((g,i)=><Card key={i}><Text style={sx.cardTitle}>{shortDate(g.start)} · {time(g.start)} to {time(g.end)}</Text>
     <Text style={sx.muted}>Approximately {g.minutes} minutes between existing appointments</Text>
     <Btn label="Review / publish a Grid opening" secondary onPress={()=>openTool('tradeGrid')}/></Card>)}
    {!gaps.length?<Empty>No gaps of at least an hour between upcoming appointments were found. Empty diary days can still be scheduled manually.</Empty>:null}
    <Btn label="Plan On My Way / Street Run" secondary onPress={()=>openTool('tradeRoutes')}/>
   </>:null}
   {!loading&&!problem&&feature==='commandCentre'?<>
    <Text style={sx.heading}>Your accepted jobs</Text>
    {!jobOptions.length?<Empty>No accepted marketplace jobs yet. New jobs will appear here when you accept customer work.</Empty>:null}
    {jobOptions.map(j=><MotionPressable accessibilityRole="button" accessibilityLabel={'Open checklist for '+j.title}
      key={j.kind+j.id} style={sx.card} onPress={()=>setSelectedJob(j)}>
      <View style={sx.row}><BriefcaseBusiness color={C.teal} size={22}/><View style={{flex:1}}>
       <Text style={sx.cardTitle}>{j.title}</Text>
       <Text style={sx.muted}>{tasks.filter(t=>t.job_id===j.id&&t.job_kind===j.kind&&t.is_done).length} / {tasks.filter(t=>t.job_id===j.id&&t.job_kind===j.kind).length} checklist items done</Text>
      </View><ChevronRight color={C.teal} size={20}/></View>
    </MotionPressable>)}
    {selectedJob?<Card><Text style={sx.heading}>Checklist · {selectedJob.title}</Text>
     {tasks.filter(t=>t.job_id===selectedJob.id&&t.job_kind===selectedJob.kind).map(t=>
      <View key={t.id} style={sx.row}><MotionPressable onPress={()=>void run(()=>changeExisting('trade_suite_job_tasks',t.id,{is_done:!t.is_done}))}
        style={[sx.check,t.is_done&&{backgroundColor:C.teal}]}>
       {t.is_done?<Check color="#FFFFFF" size={16}/>:null}</MotionPressable>
       <Text style={[sx.smallBody,{flex:1},t.is_done&&{textDecorationLine:'line-through'}]}>{t.title}</Text>
       <MotionPressable onPress={()=>confirmDelete('Delete job task?',()=>changeDelete('trade_suite_job_tasks',t.id))}>
        <Trash2 color={C.muted} size={18}/></MotionPressable></View>)}
     <Input label="New checklist task" value={taskTitle} onChange={setTaskTitle} placeholder="Photograph finished work"/>
     <Btn label="Add task" onPress={addTask} disabled={busy}/>
     <Btn label="Open Jobs" secondary onPress={()=>openTool('tradeJobs')}/>
    </Card>:null}
   </>:null}
   {!loading&&!problem&&feature==='moneyHub'?<>
    <View style={sx.metrics}><Metric label="Marked paid" value={pound(totalRevenue)}/>
     <Metric label="Sent & outstanding" value={pound(sum(dueInvoices,'total'))}/>
     <Metric label="Recorded costs" value={pound(totalCosts)}/>
     <Metric label="Paid minus costs (rough)" value={pound(totalRevenue-totalCosts)}/></View>
    <Card><Text style={sx.heading}>Outstanding invoices</Text>
     {dueInvoices.slice(0,12).map(x=><View key={x.id} style={sx.line}>
      <Text style={sx.smallBody}>{x.customer_name||'Customer'} · {pound(x.total)}</Text>
      <Text style={sx.muted}>Due {shortDate(x.due_date)}</Text></View>)}
     {!dueInvoices.length?<Text style={sx.muted}>No invoices currently marked sent and unpaid.</Text>:null}
     <Text style={sx.muted}>Figures come from invoices manually marked paid and recorded costs. This is not tax advice, bank reconciliation or Making Tax Digital filing.</Text>
     <Btn label={invoices.length?'Open invoices':'Create your first invoice'} onPress={()=>openTool('tradeInvoices')}/>
     <Btn label="Open job costs and profit" secondary onPress={()=>openTool('tradeProfit')}/>
    </Card>
   </>:null}
   {!loading&&!problem&&feature==='crewOps'?<>
    <Card><Text style={sx.heading}>Crew team records</Text>
     <Metric label="Accepted Crew applications" value={acceptedCrew.length}/>
     <Text style={sx.muted}>Log time and agreed costs for accepted Crew workers. These are internal business notes, not payroll records, a contract or proof of payment.</Text>
     <Btn label="Open Tradarr Crew" onPress={()=>openTool('tradeCrew')}/>
    </Card>
    <Card><Text style={sx.heading}>Log hours</Text>
     <Text style={sx.label}>Accepted applicant</Text>
     <View style={sx.wrap}>{acceptedCrew.map(a=><Pill key={a.id} label={'Crew '+a.id.slice(0,8)}
       active={hoursApp===a.id} onPress={()=>setHoursApp(a.id)}/>)}</View>
     {!acceptedCrew.length?<Text style={sx.muted}>Accept an applicant in Crew first.</Text>:null}
     <Input label="Date (YYYY-MM-DD)" value={hoursDate} onChange={setHoursDate}/>
     <Input label="Hours worked" value={hoursCount} onChange={setHoursCount} number/>
     <Input label="Agreed hourly cost (£, optional)" value={hoursRate} onChange={setHoursRate} number/>
     <Input label="Notes" value={hoursNote} onChange={setHoursNote} multiline/>
     <Btn label="Save work hours" onPress={logHours} disabled={busy||!acceptedCrew.length}/>
    </Card>
    {list('trade_suite_crew_hours').map(x=><Card key={x.id}>
     <Text style={sx.cardTitle}>{shortDate(x.worked_on)} · {x.hours} hours</Text>
     <Text style={sx.muted}>{x.hourly_cost==null?'No rate recorded':'Estimated labour cost: '+pound(num(x.hours)*num(x.hourly_cost))}</Text>
     {x.note?<Text style={sx.smallBody}>{x.note}</Text>:null}
     <Btn label="Remove log" secondary onPress={()=>confirmDelete('Delete hours record?',()=>changeDelete('trade_suite_crew_hours',x.id))}/>
    </Card>)}
   </>:null}
   {!loading&&!problem&&feature==='repeatEngine'?<>
    <Card><Text style={sx.heading}>Schedule a service follow-up</Text>
     <Text style={sx.muted}>Save your reminder first. Nothing is sent automatically to customers.</Text>
     <Text style={sx.label}>Select customer</Text>
     <View style={sx.wrap}>{customers.map(c=><Pill key={c.id} label={c.name} active={customerId===c.id} onPress={()=>setCustomerId(c.id)}/>)}</View>
     {!customers.length?<Btn label="Add customer first" secondary onPress={()=>openTool('tradeCustomers')}/>:null}
     <Input label="Reminder" value={reminderTitle} onChange={setReminderTitle} placeholder="Annual boiler service"/>
     <Input label="Due date (YYYY-MM-DD)" value={reminderDate} onChange={setReminderDate}/>
     <Input label="Internal notes" value={reminderNote} onChange={setReminderNote} multiline/>
     <Btn label="Save service reminder" onPress={addReminder} disabled={busy||!customers.length}/>
    </Card>
    <Text style={sx.heading}>Your reminders</Text>
    {list('trade_suite_reminders').sort((a,b)=>String(a.due_on).localeCompare(String(b.due_on))).map(x=>{
     const c=customers.find(a=>a.id===x.customer_id);
     return <Card key={x.id}><Text style={sx.cardTitle}>{x.title}</Text>
      <Text style={sx.muted}>{c?.name||'Customer'} · {shortDate(x.due_on)} · {x.status}</Text>
      {x.note?<Text style={sx.smallBody}>{x.note}</Text>:null}
      {x.status==='due'?<Btn label="Mark as completed" secondary onPress={()=>void run(()=>changeExisting('trade_suite_reminders',x.id,{status:'done'}))}/>:null}
      <Btn label="Prepare manual reminder message" secondary onPress={()=>void shareText('Service reminder',
       'Hello '+(c?.name||'')+', just a reminder about '+x.title+'. Please contact us if you would like to arrange a suitable appointment.')}/>
      <Btn label="Delete reminder" secondary onPress={()=>confirmDelete('Delete reminder?',()=>changeDelete('trade_suite_reminders',x.id))}/>
     </Card>;
    })}
    <Text style={sx.muted}>Promotional or rebooking messages may be direct marketing. Check permission or the full UK soft opt-in conditions and honour opt-outs before contacting anyone.</Text>
   </>:null}
   {!loading&&!problem&&feature==='bookingProfile'?<>
    <Card><Text style={sx.heading}>Your shareable contact card</Text>
     <Text style={sx.muted}>Prepare a professional introduction to share with customers. Saving here does not create a public website or change your public listing.</Text>
     <View style={sx.bookingPreview}>
       <Text style={sx.bookingPreviewEyebrow}>TRADARR · BUSINESS PROFILE</Text>
       <Text style={sx.bookingPreviewName}>{bookingProfile?.business_name||bookingProfile?.display_name||'Your business'}</Text>
       <Text style={sx.bookingPreviewTrade}>{bookingProfile?.primary_trade||'Trade professional'}</Text>
       <Text style={sx.bookingPreviewBody}>{businessHeadline.trim()||'Add a headline to introduce your business.'}</Text>
       <Text style={sx.bookingPreviewBody}>{businessServices.trim()||'Add your services so customers know what you offer.'}</Text>
       <Text style={sx.bookingPreviewTrade}>{bookingProfile?.public_phone||'Contact through Tradarr'}</Text>
     </View>
     <Input label="Headline" value={businessHeadline} onChange={setBusinessHeadline} placeholder="Your reliable local plumber"/>
     <Input label="Services offered" value={businessServices} onChange={setBusinessServices} multiline placeholder="Bathrooms, repairs, heating..."/>
     <Input label="How customers should contact you" value={bookingNotes} onChange={setBookingNotes} multiline placeholder="Call or message to request an appointment"/>
     <Btn label="Save booking profile" onPress={saveBooking} disabled={busy}/>
     <Btn label="Share business contact details" secondary onPress={()=>void shareText('Trade business details',
      (bookingProfile?.business_name||bookingProfile?.display_name||'My business')+'\n'+
      (businessHeadline||'')+'\n'+(businessServices||'')+'\n'+
      'Phone: '+(bookingProfile?.public_phone||'Please contact through Tradarr')+'\n'+
      (bookingNotes||''))}/>
     <Btn label="Edit public tradesperson profile" secondary onPress={()=>openTool('tradeProfile')}/>
    </Card>
   </>:null}
   {!loading&&!problem&&feature==='documentVault'?<>
    <Card><Text style={sx.heading}>Upload a private business document</Text>
     <Text style={sx.muted}>PDF, JPG, PNG, WebP or Word (.docx), up to 10 MB. Files are private to your business account and not automatically published as verified evidence.</Text>
     <Btn label={chosen?'Selected: '+chosen.name:'Choose file'} secondary onPress={()=>void pickDocument()}/>
     <Input label="Document name" value={documentLabel} onChange={setDocumentLabel}/>
     <Text style={sx.label}>Document category</Text>
     <View style={sx.wrap}>{['insurance','qualification','receipt','warranty','other'].map(x=><Pill key={x}
      label={x} active={documentKind===x} onPress={()=>setDocumentKind(x)}/>)}</View>
     <Input label="Expiry date, if any (YYYY-MM-DD)" value={documentExpiry} onChange={setDocumentExpiry}/>
     <Btn label="Store document privately" onPress={submitDocument} disabled={busy||!chosen}/>
    </Card>
    <Text style={sx.heading}>Your document vault</Text>
    {list('trade_suite_documents').map(d=><Card key={d.id}>
     <Text style={sx.cardTitle}>{d.label}</Text>
     <Text style={sx.muted}>{d.category} · Added {shortDate(d.created_at)}</Text>
     {d.expiry_date?<Text style={sx.warning}>Expires {shortDate(d.expiry_date)}</Text>:null}
     <Btn label="Open private document" secondary onPress={()=>void run(async()=>{
      const {data,error}=await supabase.storage.from('tradarr-trade-vault').createSignedUrl(d.object_path,120);
      if(error||!data?.signedUrl)throw Error(error?.message||'Could not access document.');
      await Linking.openURL(data.signedUrl);
     })}/>
     <Btn label="Delete document" secondary onPress={()=>deleteDocument(d)}/>
    </Card>)}
    {!list('trade_suite_documents').length?<Empty>No private documents saved yet.</Empty>:null}
   </>:null}
   {!loading&&!problem&&feature==='insights'?<>
    <View style={sx.metrics}><Metric label="Quotes prepared" value={quotes.length}/>
     <Metric label="Accepted or invoiced" value={wonQuotes.length}/>
     <Metric label="Quote win rate" value={sentQuotes.length?Math.round(wonQuotes.length/sentQuotes.length*100)+'%':'—'}/>
     <Metric label="Booked customers" value={customers.length}/>
     <Metric label="Paid invoices" value={paidInvoices.length}/>
     <Metric label="Payment recorded" value={pound(totalRevenue)}/>
     <Metric label="Sent & unpaid" value={pound(sum(dueInvoices,'total'))}/>
     <Metric label="Recorded costs" value={pound(totalCosts)}/></View>
    {quotes.length+invoices.length+customers.length===0?<Card>
       <Text style={sx.heading}>Build your business dashboard</Text>
       <Text style={sx.muted}>Start with a customer, quote or invoice. As work is recorded, the figures and follow-ups will appear here.</Text>
       <Btn label="Create an invoice" onPress={()=>openTool('tradeInvoices')}/>
       <Btn label="Add a customer" secondary onPress={()=>openTool('tradeCustomers')}/>
     </Card>:null}
    <Card><Text style={sx.heading}>Suggested next actions</Text>
     {insightsContent().map((x,i)=><View style={sx.line} key={i}><Text style={sx.smallBody}>{x}</Text></View>)}
     <Text style={sx.muted}>Figures are based on your saved records, which may be incomplete. They do not include bank reconciliation, tax calculations or every off-app job.</Text>
     <Btn label="Open profit tracker" secondary onPress={()=>openTool('tradeProfit')}/>
    </Card>
   </>:null}
   {!loading&&!problem&&feature==='growthKit'?<>
    <Card><Text style={sx.heading}>Communication templates</Text>
     <Text style={sx.muted}>Save messages for follow-ups, reviews and general customer care. Tradarr never sends them automatically from this tool.</Text>
     <Text style={sx.label}>Template type</Text>
     <View style={sx.wrap}>{(['follow_up','review','general'] as const).map(x=>
      <Pill key={x} label={x==='follow_up'?'Follow-up':x==='review'?'Review request':'General'}
       active={templateType===x} onPress={()=>setTemplateType(x)}/>)}</View>
     <Input label="Template name" value={templateTitle} onChange={setTemplateTitle} placeholder="Quote follow-up"/>
     <Input label="Message text" value={templateBody} onChange={setTemplateBody} multiline
      placeholder="Hello, just following up about the quotation..."/>
     <Btn label="Save message template" onPress={templateSave} disabled={busy}/>
    </Card>
    <Card>
      <Text style={sx.heading}>Start with an editable example</Text>
      <Text style={sx.muted}>Choose a draft, personalise the wording and save it. Nothing is sent automatically.</Text>
      <View style={sx.wrap}>
        {[
          {title:'Quote follow-up',type:'follow_up' as const,
           body:'Hello, just checking whether you had any questions about the quotation I sent. Please let me know if I can clarify anything.'},
          {title:'Thank you after a job',type:'general' as const,
           body:'Thank you for choosing us. If there is anything you need help with following the work, please get in touch.'},
          {title:'Review invitation',type:'review' as const,
           body:'Thank you for your custom. If you were happy with the completed work, we would appreciate an honest review of your experience.'}
        ].map(item=><Pill key={item.title} label={item.title} active={templateTitle===item.title}
          onPress={()=>{setTemplateTitle(item.title);setTemplateType(item.type);setTemplateBody(item.body);}}/>)}
      </View>
    </Card>
    <Text style={sx.heading}>Saved message templates</Text>
    {list('trade_suite_templates').filter(t=>t.category!=='quote').map(t=><Card key={t.id}>
     <Text style={sx.cardTitle}>{t.title}</Text><Text style={sx.muted}>{t.category.replace('_',' ')}</Text>
     <Text style={sx.smallBody}>{t.body}</Text>
     <Btn label="Copy / share draft" secondary onPress={()=>void shareText(t.title,t.body)}/>
     <Btn label="Delete template" secondary onPress={()=>confirmDelete('Delete template?',()=>changeDelete('trade_suite_templates',t.id))}/>
    </Card>)}
    {!list('trade_suite_templates').some(x=>x.category!=='quote')?<Empty>No saved growth templates yet.</Empty>:null}
    <Text style={sx.warning}>Review invitations and promotional follow-ups can count as marketing. Check UK GDPR and PECR before contacting people. No bulk messages are sent by Tradarr.</Text>
   </>:null}
   <View style={sx.footer}><ShieldCheck color={C.teal} size={19}/>
    <Text style={[sx.muted,{flex:1}]}>Your business records stay private to your signed-in tradesperson account. No subscription restrictions have been added.</Text>
   </View>
  </ScrollView>
 </View>;
}

const sx=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 header:{paddingTop:14,paddingBottom:17,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10},
 back:{width:42,height:42,borderRadius:15,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'900',color:C.teal,letterSpacing:1.3},
 title:{fontFamily:theme.font.editorial,fontSize:24,fontWeight:'900',color:C.ink,letterSpacing:-.6,marginTop:3,marginBottom:4},
 page:{paddingHorizontal:16,paddingBottom:120,gap:13},
 card:{backgroundColor:'#FFFFFF',borderRadius:23,padding:16,borderWidth:1,borderColor:'#E5EBE8',gap:11},
 heading:{fontSize:18,fontWeight:'900',color:C.ink},
 cardTitle:{fontSize:15,fontWeight:'800',color:C.ink},
 muted:{fontSize:12,lineHeight:19,color:C.muted},
 smallBody:{fontSize:13,lineHeight:20,color:C.ink},
 warning:{fontSize:12,color:'#9A4E34',lineHeight:19},
 field:{gap:6,marginBottom:3},
 label:{fontSize:12,fontWeight:'800',color:C.ink},
 input:{borderWidth:1,borderColor:'#DDE7E3',backgroundColor:'#FCFDFC',borderRadius:13,
 paddingHorizontal:13,paddingVertical:12,minHeight:45,fontSize:14,color:C.ink},
 button:{borderRadius:13,paddingHorizontal:14,paddingVertical:13,minHeight:44,backgroundColor:C.teal,
 justifyContent:'center',alignItems:'center',marginTop:3},
 secondary:{backgroundColor:C.tealTint},
 buttonText:{fontWeight:'900',fontSize:13,color:'#FFFFFF',textAlign:'center'},
 pill:{borderRadius:30,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#E9F0EE'},
 pillText:{fontSize:12,fontWeight:'700',color:C.teal},
 wrap:{flexDirection:'row',flexWrap:'wrap',gap:6,marginVertical:4},
 empty:{backgroundColor:'#EDF3F0',paddingHorizontal:22,paddingVertical:25,
   borderRadius:20,alignItems:'center',gap:7},
 emptyIcon:{height:45,width:45,borderRadius:15,backgroundColor:'#DCEBE6',
   alignItems:'center',justifyContent:'center',marginBottom:4},
 emptyTitle:{color:C.ink,fontSize:15,fontWeight:'900'},
 bookingPreview:{backgroundColor:C.darkTeal,borderRadius:20,padding:18,gap:7},
 bookingPreviewEyebrow:{fontSize:10,color:'#B5DBD5',fontWeight:'900',letterSpacing:1.1},
 bookingPreviewName:{fontSize:20,fontWeight:'900',color:'#FFFFFF'},
 bookingPreviewTrade:{fontSize:13,fontWeight:'800',color:'#C9E1DB'},
 bookingPreviewBody:{fontSize:13,color:'#E4F0EB',lineHeight:19},
 line:{borderBottomWidth:1,borderBottomColor:'#EDF0EE',paddingBottom:10,gap:5},
 row:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:5},
 check:{width:25,height:25,borderWidth:1.5,borderColor:C.teal,borderRadius:7,alignItems:'center',justifyContent:'center'},
 summary:{backgroundColor:'#F0F5F2',borderRadius:15,padding:14,gap:6},
 iconHeading:{flexDirection:'row',gap:10,alignItems:'center'},
 metrics:{flexDirection:'row',flexWrap:'wrap',gap:9},
 metric:{backgroundColor:'#FFFFFF',borderRadius:19,padding:15,width:'48%',gap:5,borderColor:'#E6EEEA',borderWidth:1},
 metricValue:{fontWeight:'900',fontSize:21,color:C.ink},
 footer:{marginTop:14,flexDirection:'row',gap:10,backgroundColor:'#EDF3EF',padding:16,borderRadius:17}
});
