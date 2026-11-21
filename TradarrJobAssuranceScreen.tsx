import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,ArrowRight,BriefcaseBusiness,CalendarCheck,CheckCircle2,Clock3,
 ClipboardCheck,FileImage,MessageSquare,RefreshCw,Send,ShieldCheck,UploadCloud,XCircle} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {supabase} from './lib/supabase';
import {decodeChatPhotoBase64,detectChatPhotoMime} from './lib/chatPhoto';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Role='customer'|'tradesperson';
type Job={id:string;customer_id:string;accepted_tradesperson_id:string;trade:string;issue:string;status:string;created_at:string};
type Scope={id:string;job_id:string;customer_id:string;tradesperson_id:string;title:string;details:string;
 amount_delta_pence:number;extra_minutes:number;status:string;customer_note:string|null;created_at:string};
type Handover={id:string;job_id:string;customer_id:string;tradesperson_id:string;work_summary:string;
 tested_where_applicable:boolean;site_left_tidy:boolean;customer_briefed:boolean;outstanding_items:string;
 aftercare_notes:string;photo_paths:string[];status:string;created_at:string};
type Aftercare={id:string;handover_id:string;author_id:string;body:string;created_at:string};
const C=theme.colors;
const money=(value:number)=>((value<0?'−':value>0?'+':'')+'£'+
 (Math.abs(Number(value)||0)/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}));
const nice=(value:string)=>String(value||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=(value:string)=>value?new Date(value).toLocaleString('en-GB',{
 day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
function pence(value:string):number{
 const x=value.trim();
 if(!/^-?\d{1,7}(\.\d{1,2})?$/.test(x))throw new Error('Enter a valid price change in pounds with up to two decimal places.');
 const neg=x.startsWith('-'),parts=(neg?x.slice(1):x).split('.');
 const amount=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(amount)||amount>100000000)throw new Error('The amount is too large.');
 return neg?-amount:amount;
}
const B='tradarr-finishproof';
export default function TradarrJobAssuranceScreen({role,onBack}:{role:Role;onBack:()=>void}){
 const isTrade=role==='tradesperson';
 const [uid,setUid]=useState('');
 const [jobs,setJobs]=useState<Job[]>([]);
 const [scopes,setScopes]=useState<Scope[]>([]);
 const [handovers,setHandovers]=useState<Handover[]>([]);
 const [updates,setUpdates]=useState<Aftercare[]>([]);
 const [selected,setSelected]=useState('');
 const [tab,setTab]=useState<'scope'|'handover'>('scope');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [scopeTitle,setScopeTitle]=useState('');
 const [scopeDetails,setScopeDetails]=useState('');
 const [amount,setAmount]=useState('0.00');
 const [extraMinutes,setExtraMinutes]=useState('0');
 const [decisionNote,setDecisionNote]=useState('');
 const [summary,setSummary]=useState('');
 const [tested,setTested]=useState(false);
 const [tidy,setTidy]=useState(false);
 const [briefed,setBriefed]=useState(false);
 const [outstanding,setOutstanding]=useState('');
 const [aftercare,setAftercare]=useState('');
 const [photos,setPhotos]=useState<ImagePicker.ImagePickerAsset[]>([]);
 const [reply,setReply]=useState('');
 const [handoverNote,setHandoverNote]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw authError||new Error('Sign in to see your job assurance records.');
   const yours=await supabase.from('jobs')
    .select('id,customer_id,accepted_tradesperson_id,trade,issue,status,created_at')
    .eq(isTrade?'accepted_tradesperson_id':'customer_id',user.id)
    .not('accepted_tradesperson_id','is',null)
    .order('created_at',{ascending:false}).limit(100);
   if(yours.error)throw yours.error;
   const all=(yours.data||[]) as Job[];
   if(all.length){
    const ids=all.map(x=>x.id);
    const [s,h]=await Promise.all([
     supabase.from('tradarr_scope_changes').select('*').in('job_id',ids)
      .order('created_at',{ascending:false}).limit(300),
     supabase.from('tradarr_job_handovers').select('*').in('job_id',ids)
      .order('created_at',{ascending:false}).limit(100)
    ]);
    if(s.error||h.error)throw s.error||h.error;
    const handoverRows=(h.data||[]) as Handover[];
    const thread=handoverRows.length?await supabase.from('tradarr_handover_updates').select('*')
     .in('handover_id',handoverRows.map(x=>x.id)).order('created_at',{ascending:true}).limit(300):null;
    if(thread?.error)throw thread.error;
    setScopes((s.data||[]) as Scope[]);setHandovers(handoverRows);
    setUpdates((thread?.data||[]) as Aftercare[]);
   }else{setScopes([]);setHandovers([]);setUpdates([]);}
   setUid(user.id);setJobs(all);
   setSelected(previous=>all.some(x=>x.id===previous)?previous:(all[0]?.id||''));
  }catch(e:any){setError(e?.message||'Could not load your job records.');}
  finally{setLoading(false);}
 },[isTrade]);
 useEffect(()=>{void load();const listener=AppState.addEventListener('change',state=>{
   if(state==='active')void load();
  });return()=>listener.remove();},[load]);
 const current=jobs.find(j=>j.id===selected)||null;
 const jobScopes=useMemo(()=>scopes.filter(s=>s.job_id===selected),[scopes,selected]);
 const handover=handovers.find(h=>h.job_id===selected)||null;
 const aftercareUpdates=updates.filter(u=>u.handover_id===handover?.id);
 const pending=jobScopes.find(x=>x.status==='pending');
 const execute=async(fn:()=>Promise<void>,success:string)=>{
  if(busy)return;setBusy(true);setError('');
  try{await fn();await load();Alert.alert('Saved',success);}
  catch(e:any){setError(e?.message||'Could not save. Please try again.');}
  finally{setBusy(false);}
 };
 const submitScope=()=>{
  if(!current||!isTrade||busy)return;
  if(scopeTitle.trim().length<5||scopeDetails.trim().length<12){
   setError('Add a title and an accurate description of the extra work.');return;
  }
  let amountPence=0;
  try{amountPence=pence(amount);}catch(e:any){setError(e.message);return;}
  const minutes=Number(extraMinutes);
  if(!Number.isInteger(minutes)||minutes<0||minutes>10080){
   setError('Additional minutes must be between 0 and 10,080.');return;
  }
  Alert.alert('Send for customer approval?',
   'The customer will see the proposed changes to the work, price and time. No invoice or quote is changed automatically.',
   [{text:'Cancel',style:'cancel'},{text:'Send proposal',onPress:()=>{
    void execute(async()=>{
     const {error:e}=await supabase.rpc('tradarr_scope_propose',{
      p_job_id:current.id,p_title:scopeTitle.trim(),p_details:scopeDetails.trim(),
      p_amount_delta_pence:amountPence,p_extra_minutes:minutes
     });if(e)throw e;
     setScopeTitle('');setScopeDetails('');setAmount('0.00');setExtraMinutes('0');
    },'The change is waiting for your customer to approve or decline.');
   }}]);
 };
 const decideScope=(proposal:Scope,status:'approved'|'declined'|'withdrawn')=>{
  Alert.alert(status==='approved'?'Approve this change?':status==='declined'?'Decline this change?':'Withdraw this proposal?',
   'Your decision will be recorded with the price and time difference.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{void execute(async()=>{
    const {error:e}=await supabase.rpc('tradarr_scope_decide',{
     p_id:proposal.id,p_decision:status,p_customer_note:status==='withdrawn'?'':decisionNote.trim()
    });if(e)throw e;setDecisionNote('');
   },'Your scope change decision has been recorded.')}}]);
 };
 const pickPhotos=async()=>{
  try{
   const result=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:3,base64:true,quality:0.72
   });
   if(!result.canceled&&result.assets?.length){
    if(result.assets.length>3)throw new Error('Choose up to three photos.');
    setPhotos(result.assets);
   }
  }catch(e:any){setError(e.message||'Could not choose photos.');}
 };
 const sendHandover=()=>{
  if(!current||busy)return;
  if(summary.trim().length<12){setError('Describe the actual completed work in at least 12 characters.');return;}
  if(outstanding.length>1200||aftercare.length>1600){setError('Shorten the handover notes.');return;}
  Alert.alert('Send completion handover?',
   'This factual record and any photos will be shared privately with your customer. It cannot be edited after sending.',
   [{text:'Cancel',style:'cancel'},{text:'Send handover',onPress:()=>{void execute(async()=>{
    const uploaded:string[]=[];
    let committed=false;
    try{
     for(const asset of photos){
      if(!asset.base64)throw new Error('One photo could not be read. Select it again.');
      const mime=detectChatPhotoMime(asset.base64);
      const bytes=decodeChatPhotoBase64(asset.base64);
      if(bytes.length>4*1024*1024)throw new Error('Each handover photo must be smaller than 4 MB.');
      const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
      const name=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);
      const path=uid+'/'+current.id+'/'+name+'.'+ext;
      const {error:uploadError}=await supabase.storage.from(B).upload(path,bytes,{
       contentType:mime,cacheControl:'3600',upsert:false
      });
      if(uploadError)throw uploadError;
      uploaded.push(path);
     }
     const {error:e}=await supabase.rpc('tradarr_finishproof_submit',{
      p_job_id:current.id,p_summary:summary.trim(),
      p_tested:tested,p_tidy:tidy,p_briefed:briefed,
      p_outstanding:outstanding.trim(),p_aftercare:aftercare.trim(),
      p_photo_paths:uploaded
     });if(e)throw e;
     committed=true;setPhotos([]);
    }catch(e){
     if(!committed&&uploaded.length){
      const removed=await supabase.storage.from(B).remove(uploaded);
      if(removed.error)console.warn('Tradarr handover cleanup:',removed.error.message);
     }
     throw e;
    }
   },'The completed-work record is available to your customer.') }}]);
 };
 const respondHandover=(status:'acknowledged'|'followup_requested')=>{
  if(!handover||busy)return;
  if(status==='followup_requested'&&handoverNote.trim().length<10){
   setError('Explain the follow-up request in at least ten characters.');return;
  }
  Alert.alert(status==='acknowledged'?'Acknowledge receipt?':'Request follow-up?',
   status==='acknowledged'?'This only confirms receiving the record; your statutory rights are unaffected.':
    'Your written concern will be sent to the tradesperson and saved with this job.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{void execute(async()=>{
    const {error:e}=await supabase.rpc('tradarr_finishproof_respond',{
     p_id:handover.id,p_decision:status,p_note:handoverNote.trim()
    });if(e)throw e;setHandoverNote('');
   },'Your handover response has been saved.')}}]);
 };
 const sendReply=()=>{
  if(!handover||busy||reply.trim().length<2)return;
  void execute(async()=>{
   const {error:e}=await supabase.rpc('tradarr_finishproof_message',{
    p_id:handover.id,p_body:reply.trim()
   });if(e)throw e;setReply('');
  },'Your message is now in the aftercare conversation.');
 };
 const openPhoto=async(path:string)=>{
  try{
   const {data,error:e}=await supabase.storage.from(B).createSignedUrl(path,90);
   if(e||!data?.signedUrl)throw e||new Error('Private photo unavailable.');
   await Linking.openURL(data.signedUrl);
  }catch(e:any){Alert.alert('Photo unavailable',e?.message||'Check your connection and try again.');}
 };
 const Input=({value,onChange,placeholder,multiline=false,height=52,maxLength=1600}:{
  value:string;onChange:(v:string)=>void;placeholder:string;multiline?:boolean;height?:number;maxLength?:number;
 })=><TextInput value={value} onChangeText={onChange} placeholder={placeholder}
   multiline={multiline} maxLength={maxLength} textAlignVertical={multiline?'top':'center'}
   placeholderTextColor={C.muted} style={[s.input,{minHeight:height}]}/>;
 const Action=({label,onPress,disabled=false,secondary=false}:{
  label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;
 })=><MotionPressable onPress={onPress} disabled={disabled||busy}
  style={[s.action,secondary&&s.secondary,(disabled||busy)&&{opacity:.5}]}
  accessibilityRole="button" accessibilityLabel={label}>
  <Text style={[s.actionText,secondary&&s.secondaryText]}>{label}</Text><ArrowRight size={16} color={secondary?C.teal:'#FFFFFF'}/>
 </MotionPressable>;
 return <View style={s.root}>
  <View style={s.top}>
   <MotionPressable onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back to jobs">
    <ArrowLeft size={21} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}><Text style={s.overline}>TRADARR / JOB ASSURANCE</Text>
    <Text style={s.heading}>ScopeGuard & FinishProof</Text></View>
   <MotionPressable onPress={()=>{void load()}} style={s.back} accessibilityRole="button" accessibilityLabel="Refresh assurance records">
    <RefreshCw size={19} color={C.teal}/>
   </MotionPressable>
  </View>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   <Text style={s.intro}>{isTrade?'Propose extras clearly, then hand over your completed work professionally.':
    'Approve job changes and keep your completed work and aftercare in one place.'}</Text>
   <View style={s.tabs}>
    {([{id:'scope',label:'ScopeGuard',Icon:ShieldCheck},{id:'handover',label:'FinishProof',Icon:ClipboardCheck}] as const)
     .map(x=><MotionPressable key={x.id} onPress={()=>setTab(x.id)}
      style={[s.tab,tab===x.id&&s.tabOn]} accessibilityRole="tab"
      accessibilityState={{selected:tab===x.id}}>
      <x.Icon size={21} color={tab===x.id?C.teal:C.muted}/>
      <Text style={[s.tabText,tab===x.id&&s.tabTextOn]}>{x.label}</Text>
     </MotionPressable>)}
   </View>
   {error?<View style={s.error}><Text style={s.errorText}>{error}</Text>
    <Action label="Try refreshing" secondary onPress={()=>{void load()}}/></View>:null}
   {loading?<ActivityIndicator style={{marginTop:36}} size="large" color={C.teal}/>:
    jobs.length===0?<View style={s.empty}><BriefcaseBusiness size={33} color={C.teal}/>
      <Text style={s.cardTitle}>No assigned jobs yet</Text>
      <Text style={s.muted}>{isTrade?'Once a customer assigns you a job, you can protect extra work and send a handover here.':
       'Once a tradesperson accepts your job, you can approve changes and review the final handover.'}</Text>
     </View>:<>
    <Text style={s.label}>SELECT AN ASSIGNED JOB</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.jobRow}>
      {jobs.map(job=><MotionPressable key={job.id} onPress={()=>{setSelected(job.id);setError('')}}
       style={[s.jobChip,selected===job.id&&s.jobChipOn]} accessibilityRole="button"
       accessibilityLabel={'Select '+job.trade+' job'}>
        <Text style={[s.jobName,selected===job.id&&s.jobNameOn]} numberOfLines={1}>{job.trade} · {job.issue.slice(0,26)}</Text>
        <Text style={[s.jobStatus,selected===job.id&&s.jobStatusOn]}>{nice(job.status)}</Text>
       </MotionPressable>)}
    </ScrollView>
    {current?<View style={s.jobHead}>
     <Text style={s.overline}>REAL JOB · {nice(current.status)}</Text>
     <Text style={s.cardTitle}>{current.issue.split(' — ')[0]}</Text>
     <Text style={s.muted}>Started {date(current.created_at)} · {current.id.slice(0,8)}</Text>
    </View>:null}
    {tab==='scope'?<>
     <View style={s.sectionHeader}><ShieldCheck size={22} color={C.teal}/>
      <Text style={s.sectionTitle}>Written changes and costs</Text></View>
     <Text style={s.muted}>A proposal captures the extra work, price difference and time. The original quote and invoice are not changed automatically.</Text>
     {isTrade&&current&&['accepted','en_route','arrived','in_progress'].includes(current.status)&&!pending?
      <View style={s.card}>
       <Text style={s.cardTitle}>Propose a change</Text>
       <Text style={s.label}>WHAT NEEDS CHANGING?</Text>
       <Input value={scopeTitle} onChange={setScopeTitle} placeholder="e.g. Replace additional damaged pipe" maxLength={140}/>
       <Text style={s.label}>WHAT WORK IS INVOLVED?</Text>
       <Input value={scopeDetails} onChange={setScopeDetails} multiline height={92}
        placeholder="Explain the extra work and why it is needed…" />
       <Text style={s.label}>PRICE DIFFERENCE IN £ (NEGATIVE FOR SAVINGS)</Text>
       <Input value={amount} onChange={setAmount} placeholder="0.00" maxLength={16}/>
       <Text style={s.label}>ADDITIONAL MINUTES</Text>
       <Input value={extraMinutes} onChange={setExtraMinutes} placeholder="0" maxLength={5}/>
       <Action label="Send for customer approval" onPress={submitScope}/>
      </View>:null}
     {isTrade&&!!pending?<View style={s.notice}><Clock3 color={C.teal} size={19}/>
      <Text style={s.muted}>One change is awaiting customer approval. Wait for a decision or withdraw that proposal before creating another.</Text></View>:null}
     {jobScopes.length?jobScopes.map(item=><View key={item.id} style={s.card}>
      <View style={s.cardTop}><Text style={s.overline}>{date(item.created_at)}</Text>
       <Text style={s.statusBadge}>{nice(item.status)}</Text></View>
      <Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.details}</Text>
      <View style={s.metrics}><Text style={s.money}>{money(item.amount_delta_pence)}</Text>
       <Text style={s.minutes}>+{item.extra_minutes} minutes</Text></View>
      {item.customer_note?<Text style={s.muted}>Customer note: {item.customer_note}</Text>:null}
      {item.status==='pending'&&!isTrade&&item.customer_id===uid?<>
       <Text style={s.label}>OPTIONAL MESSAGE TO THE TRADER</Text>
       <Input value={decisionNote} onChange={setDecisionNote} placeholder="Your response (optional)" maxLength={800}/>
       <View style={s.twoActions}><Action label="Decline" secondary onPress={()=>decideScope(item,'declined')}/>
        <Action label="Approve" onPress={()=>decideScope(item,'approved')}/></View>
      </>:null}
      {item.status==='pending'&&isTrade&&item.tradesperson_id===uid?
       <Action label="Withdraw proposal" secondary onPress={()=>decideScope(item,'withdrawn')}/>:null}
     </View>):<View style={s.empty}><ShieldCheck size={29} color={C.teal}/>
      <Text style={s.cardTitle}>No scope changes yet</Text><Text style={s.muted}>If the work needs to change, a written proposal will be saved here.</Text></View>}
    </>:<>
     <View style={s.sectionHeader}><ClipboardCheck color={C.teal} size={22}/>
      <Text style={s.sectionTitle}>Completed-work handover</Text></View>
     <Text style={s.muted}>A factual job record, private photos and a place to ask questions. Acknowledging receipt does not waive consumer rights.</Text>
     {!handover&&current?.status!=='completed'?<View style={s.empty}>
      <Clock3 size={29} color={C.teal}/><Text style={s.cardTitle}>Not yet available</Text>
      <Text style={s.muted}>The assigned trader can create the handover after marking the job completed.</Text></View>:null}
     {!handover&&current?.status==='completed'&&isTrade?<View style={s.card}>
      <Text style={s.cardTitle}>Prepare your handover</Text>
      <Text style={s.label}>WORK ACTUALLY COMPLETED</Text>
      <Input value={summary} onChange={setSummary} multiline height={108}
       placeholder="Describe materials, repairs and checks performed…" maxLength={2400}/>
      <Text style={s.label}>FACTUAL HANDOVER CHECKLIST</Text>
      {([{label:'Tested where applicable',v:tested,onChange:setTested},
         {label:'Left the work area tidy',v:tidy,onChange:setTidy},
         {label:'Explained maintenance or operation',v:briefed,onChange:setBriefed}])
       .map(x=><MotionPressable key={x.label} style={s.check} onPress={()=>x.onChange(!x.v)}
        accessibilityRole="checkbox" accessibilityState={{checked:x.v}}>
        {x.v?<CheckCircle2 size={20} color={C.teal}/>:<View style={s.unchecked}/>}
        <Text style={s.body}>{x.label}</Text></MotionPressable>)}
      <Text style={s.label}>OUTSTANDING ITEMS OR LIMITATIONS</Text>
      <Input value={outstanding} onChange={setOutstanding} multiline height={80} maxLength={1200}
       placeholder="Anything unfinished, awaiting parts or excluded…"/>
      <Text style={s.label}>AFTERCARE / MAINTENANCE ADVICE</Text>
      <Input value={aftercare} onChange={setAftercare} multiline height={80} maxLength={1600}
       placeholder="Care instructions and factual warranty terms if agreed…"/>
      <MotionPressable onPress={()=>{void pickPhotos()}} style={s.photoButton}
       accessibilityRole="button" accessibilityLabel="Choose up to three handover photos">
       <UploadCloud size={22} color={C.teal}/><Text style={s.photoText}>{photos.length?
       photos.length+' private photo(s) selected':'Attach up to 3 private photos (4 MB each)'}</Text>
      </MotionPressable>
      <Text style={s.muted}>Photos are private to the job participants, not published on your profile.</Text>
      <Action label="Send handover to customer" onPress={sendHandover}/>
     </View>:null}
     {!handover&&current?.status==='completed'&&!isTrade?<View style={s.empty}>
      <ClipboardCheck size={29} color={C.teal}/><Text style={s.cardTitle}>Waiting for a handover</Text>
      <Text style={s.muted}>The tradesperson has marked this job completed but has not sent a handover yet.</Text>
     </View>:null}
     {handover?<View style={s.card}>
      <View style={s.cardTop}><Text style={s.overline}>SENT {date(handover.created_at)}</Text>
       <Text style={s.statusBadge}>{nice(handover.status)}</Text></View>
      <Text style={s.cardTitle}>Work completed</Text><Text style={s.body}>{handover.work_summary}</Text>
      <View style={s.checks}>
       {([['Testing recorded',handover.tested_where_applicable],['Left tidy',handover.site_left_tidy],
         ['Customer briefed',handover.customer_briefed]] as const).map(([name,done])=>
        <Text style={s.checkSummary} key={name}>{done?'✓':'○'} {name}: {done?'Reported yes':'Not confirmed'}</Text>)}
      </View>
      <Text style={s.label}>OUTSTANDING ITEMS</Text><Text style={s.body}>{handover.outstanding_items||'None specified by the tradesperson.'}</Text>
      <Text style={s.label}>AFTERCARE</Text><Text style={s.body}>{handover.aftercare_notes||'No additional guidance recorded.'}</Text>
      {(handover.photo_paths||[]).map((path,i)=><Action key={path} label={'Open private photo '+(i+1)}
       secondary onPress={()=>{void openPhoto(path)}}/>)}
      {!isTrade&&handover.customer_id===uid&&handover.status!=='acknowledged'?<>
       <Text style={s.label}>NOTE FOR THE TRADESPERSON (REQUIRED FOR FOLLOW-UP)</Text>
       <Input value={handoverNote} onChange={setHandoverNote} multiline height={84}
        placeholder="Describe an issue or anything you want to clarify…"/>
       {handover.status==='awaiting_customer'?
        <Action label="Request follow-up" secondary onPress={()=>respondHandover('followup_requested')}/>:null}
       <Action label="Acknowledge receipt (rights unaffected)" onPress={()=>respondHandover('acknowledged')}/>
      </>:null}
      <View style={s.divider}/>
      <Text style={s.cardTitle}>Aftercare conversation</Text>
      {aftercareUpdates.length?aftercareUpdates.map(u=><View key={u.id} style={[s.message,u.author_id===uid&&s.ownMessage]}>
       <Text style={s.messageMeta}>{u.author_id===uid?'You':'Other participant'} · {date(u.created_at)}</Text>
       <Text style={s.body}>{u.body}</Text></View>):<Text style={s.muted}>No messages yet. Keep follow-up questions with this completed job.</Text>}
      <Text style={s.label}>WRITE AN AFTERCARE MESSAGE</Text>
      <Input value={reply} onChange={setReply} multiline height={85}
       placeholder="Ask or answer a question about the completed work…"/>
      <Action label="Send aftercare message" onPress={sendReply} disabled={reply.trim().length<2}/>
      <Text style={s.disclaimer}>This record is supplied by the tradesperson, not an independent inspection or statutory certificate. It does not replace consumer rights.</Text>
     </View>:null}
    </>}
    </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 top:{paddingHorizontal:16,paddingTop:16,paddingBottom:14,flexDirection:'row',gap:12,alignItems:'center',backgroundColor:C.customerBackground},
 back:{width:42,height:42,borderRadius:21,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,letterSpacing:1.2,fontWeight:'900',color:C.teal},
 heading:{fontSize:22,fontWeight:'900',letterSpacing:-0.5,color:C.ink},
 page:{padding:16,paddingTop:2,paddingBottom:82,gap:14},
 intro:{fontSize:13,lineHeight:20,color:C.muted},
 tabs:{flexDirection:'row',gap:10,marginTop:5},
 tab:{flex:1,borderWidth:1,borderColor:'#DFEAE1',backgroundColor:'#FFFFFF',borderRadius:17,padding:14,alignItems:'center',gap:7},
 tabOn:{backgroundColor:'#EBF6EE',borderColor:'#8BBE9E'},
 tabText:{fontSize:13,fontWeight:'800',color:C.muted},tabTextOn:{color:C.teal},
 sectionHeader:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12},
 sectionTitle:{fontSize:20,fontWeight:'900',letterSpacing:-0.4,color:C.ink},
 label:{fontSize:10,fontWeight:'900',letterSpacing:0.7,color:C.teal,marginTop:7},
 jobRow:{gap:8,paddingVertical:4},
 jobChip:{paddingHorizontal:13,paddingVertical:11,minWidth:170,maxWidth:235,borderWidth:1,borderColor:'#E1E9E2',borderRadius:14,backgroundColor:'#FFFFFF',gap:5},
 jobChipOn:{borderColor:'#79B397',backgroundColor:'#EAF4EC'},
 jobName:{fontSize:12,fontWeight:'800',color:C.ink},jobNameOn:{color:C.teal},
 jobStatus:{fontSize:10,color:C.muted},jobStatusOn:{color:C.teal},
 jobHead:{padding:16,backgroundColor:'#EBF4ED',borderRadius:17,gap:5},
 card:{padding:17,borderRadius:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E0EBE1',gap:13},
 cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 cardTitle:{fontSize:17,fontWeight:'900',color:C.ink,lineHeight:24},
 body:{fontSize:12,lineHeight:19,color:C.ink},
 muted:{fontSize:11,lineHeight:17,color:C.muted},
 statusBadge:{fontSize:10,fontWeight:'900',color:C.teal,backgroundColor:'#E7F4E9',borderRadius:12,overflow:'hidden',paddingHorizontal:10,paddingVertical:6},
 input:{borderColor:'#D4E3D9',borderWidth:1.1,borderRadius:13,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:C.ink,backgroundColor:'#FCFEFC'},
 action:{borderRadius:13,paddingHorizontal:15,paddingVertical:14,minHeight:47,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10,backgroundColor:C.teal,flex:1},
 secondary:{backgroundColor:'#EEF5EF',borderWidth:1,borderColor:'#C6E0D1'},
 actionText:{color:'#FFFFFF',fontSize:12,fontWeight:'900',flexShrink:1,textAlign:'center'},
 secondaryText:{color:C.teal},
 metrics:{flexDirection:'row',gap:11,alignItems:'center',flexWrap:'wrap'},
 money:{fontSize:21,fontWeight:'900',color:C.teal},
 minutes:{fontSize:12,color:C.muted,fontWeight:'800'},
 twoActions:{flexDirection:'row',gap:10},
 error:{padding:13,borderRadius:13,backgroundColor:'#FFF0E5',gap:9},
 errorText:{color:'#9F5540',fontSize:12,lineHeight:18,fontWeight:'700'},
 empty:{padding:24,borderRadius:18,backgroundColor:'#FFFFFF',alignItems:'center',gap:11,borderWidth:1,borderColor:'#E4EBE3'},
 notice:{flexDirection:'row',gap:11,alignItems:'center',padding:15,backgroundColor:'#FFF8E8',borderRadius:13},
 check:{flexDirection:'row',gap:11,alignItems:'center',backgroundColor:'#F7FAF7',padding:12,borderRadius:11},
 unchecked:{height:20,width:20,borderWidth:1.5,borderColor:'#9AB5A4',borderRadius:10},
 checks:{gap:6,backgroundColor:'#F2F8F3',padding:12,borderRadius:12},
 checkSummary:{fontSize:11,color:C.teal,fontWeight:'800'},
 photoButton:{backgroundColor:'#EFF7F0',padding:15,borderRadius:13,borderWidth:1,borderColor:'#C6E2CF',flexDirection:'row',alignItems:'center',gap:11},
 photoText:{flex:1,fontWeight:'800',fontSize:12,color:C.teal},
 divider:{borderTopWidth:1,borderColor:'#E6EDE7',marginTop:5},
 message:{borderRadius:13,padding:13,backgroundColor:'#F4F6F4',gap:5},
 ownMessage:{backgroundColor:'#E8F4EC'},
 messageMeta:{fontSize:10,color:C.teal,fontWeight:'800'},
 disclaimer:{fontSize:10,lineHeight:16,color:C.muted}
});
