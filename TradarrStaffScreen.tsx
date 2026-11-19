import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,RefreshControl,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CheckCircle2,FileCheck2,MessageSquare,ShieldCheck} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {MotionPressable} from './Motion';
import {theme} from './theme';
type Evidence={id:string;tradesperson_id:string;kind:string;evidence_path:string;applicant_note:string|null;
 status:string;valid_until:string|null;review_note:string|null;created_at:string};
type Case={id:string;submitted_by:string;category:string;subject:string;message:string;status:string;
 priority:string;resolution_note:string|null;assigned_to:string|null;created_at:string};
type Update={id:string;author_id:string;message:string;internal_only:boolean;created_at:string};
const C=theme.colors;
const date=(x:string)=>new Date(x).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export default function TradarrStaffScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState('');
 const [authorised,setAuthorised]=useState(false);
 const [tab,setTab]=useState<'credentials'|'cases'>('credentials');
 const [credentialRows,setCredentialRows]=useState<Evidence[]>([]);
 const [caseRows,setCaseRows]=useState<Case[]>([]);
 const [selectedCredential,setSelectedCredential]=useState<string|null>(null);
 const [selectedCase,setSelectedCase]=useState<string|null>(null);
 const [updates,setUpdates]=useState<Update[]>([]);
 const [note,setNote]=useState('');
 const [expiry,setExpiry]=useState('');
 const [caseStatus,setCaseStatus]=useState('open');
 const [priority,setPriority]=useState('normal');
 const [resolution,setResolution]=useState('');
 const [reply,setReply]=useState('');
 const [internal,setInternal]=useState(false);
 const [busy,setBusy]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const current=credentialRows.find(x=>x.id===selectedCredential)||null;
 const support=caseRows.find(x=>x.id===selectedCase)||null;

 const load=useCallback(async()=>{
  setBusy(true);
  try{
   const {data:{user},error:e}=await supabase.auth.getUser();
   if(e||!user)throw new Error('Please sign in.');
   if(user.app_metadata?.tradarr_staff!==true){
    setAuthorised(false);
    throw new Error('No staff authorisation is attached to this account.');
   }
   setUid(user.id);setAuthorised(true);
   const [creds,cases]=await Promise.all([
    supabase.from('trade_credential_submissions').select('*')
     .order('created_at',{ascending:false}).limit(120),
    supabase.from('support_requests').select('*')
     .order('created_at',{ascending:false}).limit(120)
   ]);
   if(creds.error||cases.error)throw creds.error||cases.error;
   setCredentialRows((creds.data||[]) as Evidence[]);
   setCaseRows((cases.data||[]) as Case[]);
   setError('');
  }catch(e:any){setError(e?.message||'Unable to load the review queue.');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!selectedCase||!authorised)return;
  let active=true;
  const get=async()=>{
   const {data,error:e}=await supabase.from('support_case_updates')
     .select('id,author_id,message,internal_only,created_at')
     .eq('case_id',selectedCase).order('created_at',{ascending:true}).limit(120);
   if(active){if(e)setError(e.message);else setUpdates((data||[]) as Update[]);}
  };
  void get();
  return()=>{active=false};
 },[selectedCase,authorised]);
 const openCredential=(item:Evidence)=>{
  setSelectedCredential(item.id);setNote(item.review_note||'');
  setExpiry(item.valid_until||'');
 };
 const document=async(path:string)=>{
  const {data,error:e}=await supabase.storage.from('tradarr-credentials')
    .createSignedUrl(path,180);
  if(e||!data?.signedUrl){Alert.alert('Cannot open evidence',e?.message||'Access denied.');return;}
  await Linking.openURL(data.signedUrl).catch(()=>Alert.alert('Open failed','Could not open evidence on this device.'));
 };
 const review=async(status:'reviewing'|'approved'|'rejected'|'revoked')=>{
  if(!current||!authorised||saving)return;
  if(status==='approved'&&current.kind==='insurance'&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||
     expiry<new Date().toISOString().slice(0,10))){
   Alert.alert('Insurance expiry needed','Check the policy and enter its current expiration date (YYYY-MM-DD).');return;
  }
  if((status==='rejected'||status==='revoked')&&note.trim().length<5){
   Alert.alert('Reason required','Provide a clear reason for the applicant.');return;
  }
  const act=async()=>{
   setSaving(true);
   const {error:e}=await supabase.from('trade_credential_submissions').update({
     status,review_note:note.trim()||null,
     valid_until:current.kind==='insurance'&&status==='approved'?expiry:current.valid_until
   }).eq('id',current.id);
   setSaving(false);
   if(e){Alert.alert('Review not saved',e.message);return;}
   setSelectedCredential(null);await load();
  };
  if(status==='approved'||status==='revoked')
   Alert.alert(status==='approved'?'Approve evidence?':'Withdraw approval?',
     'This decision updates a public trust badge when applicable. Confirm you have verified the genuine evidence.',
     [{text:'Cancel',style:'cancel'},{text:'Confirm decision',onPress:()=>{void act()}}]);
  else await act();
 };
 const openCase=(item:Case)=>{
  setSelectedCase(item.id);setCaseStatus(item.status);setPriority(item.priority);
  setResolution(item.resolution_note||'');setReply('');setInternal(false);
 };
 const saveCase=async()=>{
  if(!support||saving||!authorised)return;
  if(['resolved','closed'].includes(caseStatus)&&resolution.trim().length<5){
   Alert.alert('Outcome needed','Record a meaningful case resolution before closing it.');return;
  }
  setSaving(true);
  const {error:e}=await supabase.from('support_requests')
   .update({status:caseStatus,priority,assigned_to:uid,resolution_note:resolution.trim()||null})
   .eq('id',support.id);
  setSaving(false);
  if(e){Alert.alert('Could not update case',e.message);return;}
  setSelectedCase(null);await load();
 };
 const sendReply=async()=>{
  if(!support||!uid||!reply.trim()||saving)return;
  setSaving(true);
  const {data,error:e}=await supabase.from('support_case_updates')
    .insert({case_id:support.id,author_id:uid,message:reply.trim(),internal_only:internal})
    .select('id,author_id,message,internal_only,created_at').single();
  setSaving(false);
  if(e||!data){Alert.alert('Reply failed',e?.message||'Try again.');return;}
  setUpdates(old=>[...old,data as Update[] extends (infer U)[]?U:never]);
  setReply('');setInternal(false);
 };
 const back=()=>selectedCredential?setSelectedCredential(null):selectedCase?setSelectedCase(null):goBack();
 return <View style={s.root}>
  <View style={s.header}><MotionPressable onPress={back} style={s.back}>
    <ArrowLeft size={21} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.overline}>RESTRICTED STAFF ACCESS</Text>
     <Text style={s.heading}>{current?'Credential decision':support?'Support case':'Review & support'}</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={busy&&authorised} onRefresh={()=>{void load()}} tintColor={C.teal}/>}>
   {error?<Text style={s.error}>{error}</Text>:null}
   {busy?<ActivityIndicator size="large" color={C.teal}/>:!authorised?
    <Text style={s.muted}>Access is limited to accounts granted the server-managed Tradarr staff role.</Text>:
   current?<View style={s.card}>
    <Text style={s.overline}>{current.kind.toUpperCase()} · {current.status.toUpperCase()}</Text>
    <Text style={s.title}>Trade account {current.tradesperson_id.slice(0,8).toUpperCase()}</Text>
    <Text style={s.muted}>Submitted {date(current.created_at)}</Text>
    {current.applicant_note?<Text style={s.body}>{current.applicant_note}</Text>:null}
    <MotionPressable style={s.secondary} onPress={()=>{void document(current.evidence_path)}}>
      <FileCheck2 size={17} color={C.teal}/><Text style={s.link}>Open private evidence</Text>
    </MotionPressable>
    <Text style={s.muted}>Confirm authenticity and relevant coverage before approving. Never rely on the filename or applicant statement alone.</Text>
    {current.kind==='insurance'?<>
      <Text style={s.label}>Verified insurance expiry (YYYY-MM-DD)</Text>
      <TextInput value={expiry} onChangeText={setExpiry} style={s.input}
       autoCapitalize="none" placeholder="2027-11-19" placeholderTextColor={C.muted}/>
    </>:null}
    <Text style={s.label}>Review note / rejection reason</Text>
    <TextInput value={note} onChangeText={setNote} multiline maxLength={2000}
      placeholder="Record evidence checked, or a reason for rejection" style={[s.input,{minHeight:80}]}
      placeholderTextColor={C.muted}/>
    {current.status==='submitted'?<MotionPressable style={s.secondary} disabled={saving} onPress={()=>{void review('reviewing')}}>
       <Text style={s.link}>Mark as being reviewed</Text></MotionPressable>:null}
    {['submitted','reviewing'].includes(current.status)?<>
      <MotionPressable style={s.primary} disabled={saving} onPress={()=>{void review('approved')}}>
       <Text style={s.primaryText}>Approve verified evidence</Text></MotionPressable>
      <MotionPressable style={s.secondary} disabled={saving} onPress={()=>{void review('rejected')}}>
       <Text style={[s.link,{color:'#A04938'}]}>Reject with reason</Text></MotionPressable>
     </>:null}
    {current.status==='approved'?<MotionPressable style={s.secondary} disabled={saving} onPress={()=>{void review('revoked')}}>
       <Text style={[s.link,{color:'#A04938'}]}>Withdraw approval</Text></MotionPressable>:null}
   </View>:
   support?<View style={s.card}>
     <Text style={s.overline}>{support.category.toUpperCase()} · {support.id.slice(0,8).toUpperCase()}</Text>
     <Text style={s.title}>{support.subject}</Text>
     <Text style={s.muted}>Submitted {date(support.created_at)}</Text>
     <Text style={s.body}>{support.message}</Text>
     <Text style={s.label}>Priority</Text><View style={s.options}>
       {['normal','high','urgent'].map(x=><MotionPressable key={x} style={[s.chip,priority===x&&s.selected]}
         onPress={()=>setPriority(x)}><Text style={[s.chipText,priority===x&&s.selectedText]}>{x}</Text></MotionPressable>)}
     </View>
     <Text style={s.label}>Status</Text><View style={s.options}>
       {['open','in_progress','resolved','closed'].map(x=><MotionPressable key={x}
        style={[s.chip,caseStatus===x&&s.selected]} onPress={()=>setCaseStatus(x)}>
        <Text style={[s.chipText,caseStatus===x&&s.selectedText]}>{x.replace('_',' ')}</Text></MotionPressable>)}
     </View>
     <Text style={s.label}>Case outcome (required to resolve)</Text>
     <TextInput value={resolution} onChangeText={setResolution} style={[s.input,{minHeight:73}]}
       multiline placeholder="Actions taken and resolution" placeholderTextColor={C.muted}/>
     <MotionPressable style={s.primary} disabled={saving} onPress={()=>{void saveCase()}}>
       <Text style={s.primaryText}>Save triage decision</Text></MotionPressable>
     <Text style={s.label}>Case updates</Text>
     {updates.map(item=><View key={item.id} style={s.replyCard}>
       <Text style={s.overline}>{item.internal_only?'STAFF-ONLY NOTE':item.author_id===uid?'STAFF REPLY':'CUSTOMER'}</Text>
       <Text style={s.body}>{item.message}</Text>
       <Text style={s.muted}>{date(item.created_at)}</Text>
     </View>)}
     <TextInput value={reply} onChangeText={setReply} style={[s.input,{minHeight:75}]}
       maxLength={3000} multiline placeholder="Write a reply or private note"
       placeholderTextColor={C.muted}/>
     <View style={s.row}>
      <Switch value={internal} onValueChange={setInternal}/>
      <Text style={s.muted}>Internal staff note — not visible to the customer</Text>
     </View>
     <MotionPressable style={s.secondary} disabled={saving||reply.trim().length<2}
       onPress={()=>{void sendReply()}}>
       <MessageSquare size={17} color={C.teal}/>
       <Text style={s.link}>Send {internal?'internal note':'customer reply'}</Text>
     </MotionPressable>
   </View>:
   <>
    <View style={s.hero}><ShieldCheck size={28} color="#D8EEE7"/>
      <Text style={s.heroTitle}>Trusted review queue</Text>
      <Text style={s.heroSub}>Only server-authorised staff can approve evidence or manage cases. Decisions are recorded against your account.</Text>
    </View>
    <View style={s.options}>
      <MotionPressable style={[s.tab,tab==='credentials'&&s.selected]} onPress={()=>setTab('credentials')}>
       <Text style={[s.chipText,tab==='credentials'&&s.selectedText]}>Credentials ({credentialRows.filter(x=>['submitted','reviewing'].includes(x.status)).length} open)</Text>
      </MotionPressable>
      <MotionPressable style={[s.tab,tab==='cases'&&s.selected]} onPress={()=>setTab('cases')}>
       <Text style={[s.chipText,tab==='cases'&&s.selectedText]}>Support ({caseRows.filter(x=>['open','in_progress'].includes(x.status)).length} open)</Text>
      </MotionPressable>
    </View>
    {(tab==='credentials'?credentialRows:caseRows).length===0?
     <View style={s.card}><Text style={s.muted}>Nothing in this queue yet.</Text></View>:null}
    {tab==='credentials'?credentialRows.map(item=><MotionPressable key={item.id} style={s.card}
      onPress={()=>openCredential(item)} accessibilityRole="button">
      <Text style={s.overline}>{item.kind.toUpperCase()} · {item.status.toUpperCase()}</Text>
      <Text style={s.title}>{item.tradesperson_id.slice(0,8).toUpperCase()}</Text>
      <Text style={s.muted}>{date(item.created_at)}</Text>
    </MotionPressable>):
    caseRows.map(item=><MotionPressable key={item.id} style={s.card} onPress={()=>openCase(item)}
     accessibilityRole="button">
     <Text style={s.overline}>{item.priority.toUpperCase()} · {item.status.toUpperCase()} · {item.category}</Text>
     <Text style={s.title}>{item.subject}</Text>
     <Text style={s.muted}>{date(item.created_at)}</Text>
    </MotionPressable>)}
   </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 header:{flexDirection:'row',alignItems:'center',gap:12,padding:17},
 back:{backgroundColor:'#FFFFFF',width:43,height:43,borderRadius:15,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'900',letterSpacing:1,color:theme.colors.teal},
 heading:{fontSize:22,fontWeight:'900',color:theme.colors.ink},
 page:{paddingHorizontal:17,paddingBottom:110,gap:13},
 hero:{borderRadius:21,padding:22,gap:10,backgroundColor:theme.colors.darkTeal},
 heroTitle:{fontSize:19,color:'#FFFFFF',fontWeight:'900'},
 heroSub:{fontSize:12,color:'#D8EAE5',lineHeight:19},
 card:{backgroundColor:'#FFFFFF',borderRadius:19,padding:16,gap:12},
 replyCard:{backgroundColor:'#F2F7F4',borderRadius:13,padding:11,gap:7},
 title:{fontSize:14,fontWeight:'900',color:theme.colors.ink},
 body:{fontSize:13,lineHeight:20,color:theme.colors.ink},
 muted:{fontSize:11,lineHeight:18,color:theme.colors.muted},
 label:{fontSize:12,fontWeight:'900',color:theme.colors.ink},
 input:{borderRadius:14,padding:12,borderWidth:1,borderColor:'#DBE5E0',color:theme.colors.ink,minHeight:45,textAlignVertical:'top'},
 options:{flexDirection:'row',flexWrap:'wrap',gap:7},
 tab:{flex:1,padding:12,borderRadius:13,backgroundColor:'#FFFFFF',alignItems:'center'},
 chip:{padding:11,borderRadius:12,backgroundColor:'#EFF2F0'},
 selected:{backgroundColor:theme.colors.darkTeal},
 chipText:{fontSize:12,fontWeight:'800',color:theme.colors.ink},
 selectedText:{color:'#FFFFFF'},
 row:{flexDirection:'row',gap:9,alignItems:'center'},
 primary:{backgroundColor:theme.colors.darkTeal,borderRadius:14,minHeight:48,
  alignItems:'center',justifyContent:'center',paddingHorizontal:13},
 primaryText:{fontWeight:'900',fontSize:12,color:'#FFFFFF'},
 secondary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,minHeight:46,
  borderRadius:14,backgroundColor:'#ECF4F0',paddingHorizontal:12},
 link:{fontSize:12,fontWeight:'900',color:theme.colors.teal},
 error:{padding:13,borderRadius:12,color:'#A74737',backgroundColor:'#FFF0E4',fontSize:12}
});
