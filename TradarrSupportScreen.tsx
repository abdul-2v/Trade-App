import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,AppState,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,ChevronRight,Headphones,MessageSquare,Send,ShieldAlert} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {openSupportEvidence,uploadSupportEvidence} from './lib/supportEvidence';
import type {SupportEvidence} from './lib/supportEvidence';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Category='account'|'booking'|'safety'|'technical'|'other';
type Case={id:string;category:Category;subject:string;message:string;status:string;priority:string;resolution_note:string|null;
 created_at:string;updated_at:string};
type Reply={id:string;case_id:string;author_id:string;message:string;internal_only:boolean;created_at:string};
const C=theme.colors;
const categories:Category[]=['booking','safety','account','technical','other'];
const categoryTitle=(v:string)=>v.charAt(0).toUpperCase()+v.slice(1);
const prettyDate=(v:string)=>new Date(v).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export default function TradarrSupportScreen({goBack,role}:{goBack:()=>void;role:'customer'|'tradesperson'}){
 const [uid,setUid]=useState('');
 const [cases,setCases]=useState<Case[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [responses,setResponses]=useState<Reply[]>([]);
 const [evidence,setEvidence]=useState<SupportEvidence[]>([]);
 const [uploading,setUploading]=useState(false);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [sending,setSending]=useState(false);
 const [view,setView]=useState<'list'|'new'>('list');
 const [category,setCategory]=useState<Category>('booking');
 const [subject,setSubject]=useState('');
 const [description,setDescription]=useState('');
 const [reply,setReply]=useState('');
 const [error,setError]=useState('');
 const selected=cases.find(c=>c.id===selectedId)||null;

 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   const {data:{user},error:e}=await supabase.auth.getUser();
   if(e||!user)throw new Error('Sign in to view your support cases.');
   setUid(user.id);
   const {data,error:readError}=await supabase.from('support_requests')
    .select('id,category,subject,message,status,priority,resolution_note,created_at,updated_at')
    .eq('submitted_by',user.id).order('created_at',{ascending:false}).limit(100);
   if(readError)throw readError;
   setCases((data||[]) as Case[]);setError('');
  }catch(e:any){setError(e?.message||'Could not load support cases.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{
  void load();
  const foreground=AppState.addEventListener('change',state=>{
   if(state==='active')void load(true);
  });
  return()=>foreground.remove();
 },[load]);
 useEffect(()=>{
  if(!selectedId)return;
  let active=true;
  const read=async()=>{
   const {data,error:e}=await supabase.from('support_case_updates')
    .select('id,case_id,author_id,message,internal_only,created_at')
    .eq('case_id',selectedId).order('created_at',{ascending:true}).limit(120);
   if(active){if(!e)setResponses((data||[]) as Reply[]);else setError(e.message);}
  };
  const readEvidence=async()=>{
   const {data,error:e}=await supabase.from('support_case_evidence')
    .select('id,case_id,uploader_id,file_path,file_name,mime_type,created_at')
    .eq('case_id',selectedId).order('created_at',{ascending:false}).limit(60);
   if(active){if(!e)setEvidence((data||[]) as SupportEvidence[]);else setError(e.message);}
  };
  void read();void readEvidence();
  const channel=supabase.channel('tradarr-case-'+selectedId+'-'+Date.now())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_case_updates',
     filter:'case_id=eq.'+selectedId},()=>{if(active)void read()})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_case_evidence',
     filter:'case_id=eq.'+selectedId},()=>{if(active)void readEvidence()})
   .subscribe();
  return()=>{active=false;void supabase.removeChannel(channel)};
 },[selectedId]);
 const attach=async()=>{
  if(!selectedId||!uid||uploading)return;
  setUploading(true);
  try{
   const uploaded=await uploadSupportEvidence(selectedId,uid);
   if(uploaded)setEvidence(old=>[uploaded,...old.filter(x=>x.id!==uploaded.id)]);
  }catch(e:any){Alert.alert('Evidence was not attached',e?.message||'Please try again.');}
  finally{setUploading(false);}
 };
 const viewEvidence=async(item:SupportEvidence)=>{
  try{await openSupportEvidence(item.file_path);}
  catch(e:any){Alert.alert('Unable to open evidence',e?.message||'Please retry.');}
 };
 const send=async()=>{
  if(sending||!uid)return;
  const cleanSubject=subject.trim(),cleanDetails=description.trim();
  if(cleanSubject.length<4||cleanDetails.length<10){
   Alert.alert('More information needed','Enter a subject and at least 10 characters explaining the issue.');return;
  }
  setSending(true);
  try{
   const {data,error:e}=await supabase.from('support_requests').insert({
    submitted_by:uid,category,subject:cleanSubject,message:cleanDetails
   }).select('id').single();
   if(e||!data)throw e||new Error('Support case not saved.');
   setSubject('');setDescription('');setView('list');
   await load(true);setSelectedId(data.id);
   Alert.alert('Case recorded','Your reference is '+data.id.slice(0,8).toUpperCase()+
    '. This early-access queue is not yet monitored continuously.');
  }catch(e:any){Alert.alert('Could not submit',e?.message||'Check your connection and retry.');}
  finally{setSending(false);}
 };
 const post=async()=>{
  const body=reply.trim();
  if(sending||!uid||!selected||body.length<2)return;
  if(!['open','in_progress'].includes(selected.status)){
   Alert.alert('Case closed','Create a new support case if you still need help.');return;
  }
  setSending(true);
  try{
   const {data,error:e}=await supabase.from('support_case_updates').insert({
    case_id:selected.id,author_id:uid,message:body,internal_only:false
   }).select('id,case_id,author_id,message,internal_only,created_at').single();
   if(e||!data)throw e||new Error('Reply not saved');
   setResponses(old=>old.some(v=>v.id===data.id)?old:[...old,data as Reply]);
   setReply('');
  }catch(e:any){Alert.alert('Could not send update',e?.message||'Retry when connected.');}
  finally{setSending(false);}
 };
 const back=()=>selectedId?setSelectedId(null):view==='new'?setView('list'):goBack();
 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={back} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
    <ArrowLeft size={21} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.overline}>TRADARR SUPPORT</Text>
    <Text style={s.heading}>{selected?'Case details':view==='new'?'New support case':'Help & cases'}</Text>
   </View>
  </View>
  {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:70}}/>:
   <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
    {error?<Text style={s.error}>{error}</Text>:null}
    {selected?<><View style={s.card}>
      <Text style={s.overline}>CASE {selected.id.slice(0,8).toUpperCase()} · {categoryTitle(selected.category)}</Text>
      <Text style={s.title}>{selected.subject}</Text>
      <Text style={s.status}>{selected.status.replace('_',' ').toUpperCase()}</Text>
      <Text style={s.muted}>Opened {prettyDate(selected.created_at)}</Text>
      <Text style={s.text}>{selected.message}</Text>
      {selected.resolution_note?<View style={s.resolution}><Text style={s.title}>Case outcome</Text>
        <Text style={s.text}>{selected.resolution_note}</Text></View>:null}
     </View>
     <Text style={s.section}>Private evidence</Text>
     <View style={s.card}>
      <Text style={s.muted}>Photos and PDFs are private to you and authorised Tradarr support staff.</Text>
      {evidence.map(item=><MotionPressable key={item.id}
        onPress={()=>{void viewEvidence(item)}} accessibilityRole="button"
        style={[s.primary,{backgroundColor:'#E9F4EF',justifyContent:'flex-start',minHeight:42}]}>
        <Text style={[s.primaryText,{color:C.teal,flex:1}]} numberOfLines={2}>
          {item.file_name}</Text>
        <ChevronRight size={17} color={C.teal}/>
       </MotionPressable>)}
      {['open','in_progress'].includes(selected.status)?
       <MotionPressable style={s.primary} disabled={uploading}
         accessibilityRole="button" onPress={()=>{void attach()}}>
         <Text style={s.primaryText}>{uploading?'Uploading securely…':'Attach photo or PDF · max 8 MB'}</Text>
       </MotionPressable>:null}
      {!evidence.length?<Text style={s.muted}>No evidence attached.</Text>:null}
     </View>
     <Text style={s.section}>Case conversation</Text>
     {responses.map(item=><View key={item.id} style={[s.card,{gap:6}]}>
       <Text style={s.overline}>{item.author_id===uid?'YOUR UPDATE':'TRADARR STAFF'}</Text>
       <Text style={s.text}>{item.message}</Text>
       <Text style={s.muted}>{prettyDate(item.created_at)}</Text>
     </View>)}
     {['open','in_progress'].includes(selected.status)?<View style={s.card}>
      <Text style={s.title}>Add an update</Text>
      <TextInput value={reply} onChangeText={setReply} maxLength={3000} multiline
       style={s.input} placeholder="Add any information that could help with this case"
       placeholderTextColor={C.muted}/>
      <MotionPressable disabled={sending||reply.trim().length<2} onPress={()=>{void post()}}
       style={[s.primary,(sending||reply.trim().length<2)&&{opacity:.5}]} accessibilityRole="button">
       <Send color="#FFFFFF" size={17}/>
       <Text style={s.primaryText}>{sending?'Sending…':'Send case update'}</Text>
      </MotionPressable>
     </View>:<Text style={s.muted}>This case is closed. Open a new case if the issue continues.</Text>}
    </>:view==='new'?<View style={s.card}>
     <Text style={s.title}>Tell us what happened</Text>
     <Text style={s.muted}>Please avoid sharing passwords or bank details. We will use your account to link this case to you.</Text>
     <Text style={s.label}>Category</Text>
     <View style={s.options}>{categories.map(k=><MotionPressable key={k} onPress={()=>setCategory(k)}
       style={[s.chip,k===category&&s.chipActive]}>
       <Text style={[s.chipText,k===category&&s.chipActiveText]}>{categoryTitle(k)}</Text>
      </MotionPressable>)}</View>
     <Text style={s.label}>Subject</Text>
     <TextInput style={[s.input,{minHeight:48}]} value={subject} onChangeText={setSubject}
      maxLength={140} placeholder="Brief description" placeholderTextColor={C.muted}/>
     <Text style={s.label}>What happened?</Text>
     <TextInput style={s.input} value={description} onChangeText={setDescription}
      multiline maxLength={4000} placeholder="Explain the issue, including relevant job details"
      placeholderTextColor={C.muted}/>
     <MotionPressable style={[s.primary,sending&&{opacity:.6}]} disabled={sending}
      onPress={()=>{void send()}} accessibilityRole="button">
      <Send size={17} color="#FFFFFF"/><Text style={s.primaryText}>{sending?'Saving case…':'Submit support case'}</Text>
     </MotionPressable>
    </View>:<>
     <View style={s.hero}><Headphones size={28} color="#D6EBE7"/>
      <Text style={s.heroTitle}>Help with Tradarr</Text>
      <Text style={s.heroSub}>Keep your requests in one place and see their progress. The early-access support queue is not monitored continuously.</Text>
     </View>
     <MotionPressable onPress={()=>setView('new')} style={s.primary}
      accessibilityRole="button"><ShieldAlert size={18} color="#FFFFFF"/>
      <Text style={s.primaryText}>Report a problem or ask for help</Text></MotionPressable>
     <Text style={s.section}>Your cases</Text>
     {cases.length?cases.map(item=><MotionPressable key={item.id} onPress={()=>setSelectedId(item.id)}
       style={[s.card,{flexDirection:'row',alignItems:'center',gap:12}]} accessibilityRole="button">
       <MessageSquare size={21} color={C.teal}/>
       <View style={{flex:1,gap:5}}><Text style={s.title}>{item.subject}</Text>
        <Text style={s.muted}>{categoryTitle(item.category)} · {prettyDate(item.created_at)}</Text>
        <Text style={s.status}>{item.status.replace('_',' ').toUpperCase()}</Text>
       </View><ChevronRight color={C.teal} size={18}/>
      </MotionPressable>):<View style={s.card}>
       <Text style={s.muted}>You have no support cases. Reports and replies appear here after submission.</Text>
      </View>}
    </>}
    <Text style={s.footer}>This isn't an emergency service. In immediate danger, call 999. In the UK, report fraud to the appropriate authorities.</Text>
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 header:{flexDirection:'row',alignItems:'center',gap:12,padding:17},
 back:{width:43,height:43,backgroundColor:'#FFFFFF',borderRadius:15,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,letterSpacing:1,fontWeight:'900',color:theme.colors.teal},
 heading:{fontSize:23,fontWeight:'900',color:theme.colors.ink},
 page:{paddingHorizontal:17,paddingBottom:110,gap:13},
 hero:{backgroundColor:theme.colors.darkTeal,borderRadius:22,padding:22,gap:10},
 heroTitle:{fontSize:20,color:'#FFFFFF',fontWeight:'900'},
 heroSub:{fontSize:12,lineHeight:20,color:'#E1F0EB'},
 card:{backgroundColor:'#FFFFFF',borderRadius:19,padding:17,gap:12},
 title:{fontFamily:theme.font.heading,color:theme.colors.ink,fontSize:15,fontWeight:'900'},
 text:{color:theme.colors.ink,fontSize:13,lineHeight:21},
 muted:{color:theme.colors.muted,fontSize:12,lineHeight:18},
 label:{fontSize:12,color:theme.colors.ink,fontWeight:'900'},
 status:{fontSize:10,fontWeight:'900',color:theme.colors.teal,backgroundColor:'#E8F3EE',
  padding:7,borderRadius:9,overflow:'hidden',alignSelf:'flex-start'},
 section:{fontSize:16,fontWeight:'900',color:theme.colors.ink,marginTop:8},
 input:{borderRadius:13,borderWidth:1,borderColor:'#DEE9E3',padding:12,
  textAlignVertical:'top',color:theme.colors.ink,minHeight:95},
 options:{flexDirection:'row',flexWrap:'wrap',gap:7},
 chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:12,backgroundColor:'#F0F2EF'},
 chipActive:{backgroundColor:theme.colors.darkTeal},
 chipText:{color:theme.colors.ink,fontSize:12,fontWeight:'800'},
 chipActiveText:{color:'#FFFFFF'},
 primary:{minHeight:50,backgroundColor:theme.colors.darkTeal,borderRadius:16,
  alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10,paddingHorizontal:13},
 primaryText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},
 resolution:{padding:13,borderRadius:14,backgroundColor:'#EDF7F2',gap:7},
 footer:{fontSize:11,lineHeight:18,color:theme.colors.muted,paddingHorizontal:10,marginTop:4},
 error:{fontSize:12,color:'#9A4633',backgroundColor:'#FFF1E6',padding:12,borderRadius:10},
});
