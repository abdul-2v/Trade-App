import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,ChevronRight,ClipboardCheck,Flag,History,ShieldAlert,Trash2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type Kind='report'|'appeal'|'deletion';
type Row={id:string;created_at:string;status:string;[key:string]:any};
const C=theme.colors;
const layout:{kind:Kind;name:string}[]=[
 {kind:'report',name:'User reports'},{kind:'appeal',name:'Appeals'},
 {kind:'deletion',name:'Deletion requests'}
];
const tableFor=(v:Kind)=>v==='report'?'tradarr_safety_reports':
 v==='appeal'?'tradarr_moderation_appeals':'tradarr_account_deletion_requests';
const choices=(v:Kind)=>v==='report'?['reviewing','resolved','dismissed']:
 v==='appeal'?['reviewing','upheld','declined']:['reviewing','ready_for_deletion','declined'];
const readable=(v:string)=>v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const date=(value:string)=>new Date(value).toLocaleString('en-GB',{
 day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'
});
export default function TradarrAdminModerationScreen({goBack}:{goBack:()=>void}){
 const [kind,setKind]=useState<Kind>('report');
 const [data,setData]=useState<Record<Kind,Row[]>>({report:[],appeal:[],deletion:[]});
 const [selected,setSelected]=useState<Row|null>(null);
 const [reason,setReason]=useState('');
 const [deletionCheck,setDeletionCheck]=useState<{eligible:boolean;blockers:string[];user_id_prefix:string}|null>(null);
 const [deletionPhrase,setDeletionPhrase]=useState('');
 const [preflightBusy,setPreflightBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   const results=await Promise.all((['report','appeal','deletion'] as Kind[])
    .map(async k=>{
     const {data:rows,error:e}=await supabase.from(tableFor(k)).select('*')
      .order('created_at',{ascending:false}).limit(100);
     if(e)throw e;
     return [k,(rows||[]) as Row[]] as const;
    }));
   const next={report:[],appeal:[],deletion:[]} as Record<Kind,Row[]>;
   for(const [key,rows] of results)next[key]=rows;
   setData(next);setError('');
  }catch(e:any){setError(e?.message||'Unable to load moderation queue.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const decide=async(status:string)=>{
  if(!selected||saving)return;
  if(reason.trim().length<12){
   Alert.alert('Review reason required','Write at least 12 characters explaining the decision.');return;
  }
  if(kind==='deletion'&&status==='ready_for_deletion'){
   Alert.alert('Deletion review only',
    'This marks the request as ready for manual processing. It does not delete the Auth account, files or statutory records.');
  }
  const go=async()=>{
   setSaving(true);
   try{
    const {error:e}=await supabase.rpc('tradarr_admin_case_decision',{
     p_kind:kind,p_id:selected.id,p_status:status,p_reason:reason.trim()
    });
    if(e)throw e;
    setSelected(null);setReason('');await load(true);
    Alert.alert('Decision recorded','The moderation decision was logged for audit.');
   }catch(e:any){Alert.alert('Unable to save decision',e?.message||'Try again.');}
   finally{setSaving(false);}
  };
  Alert.alert('Confirm '+readable(status)+'?',
   'Your reason will be preserved in the administrative audit history.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{void go()}}]);
 };
 const reviewDeletion=async()=>{
  if(!selected||kind!=='deletion'||selected.status!=='ready_for_deletion'||preflightBusy)return;
  setPreflightBusy(true);setDeletionCheck(null);setDeletionPhrase('');
  try{
   const {data,error:e}=await supabase.functions.invoke('tradarr-account-delete',{
    body:{request_id:selected.id,check_only:true}
   });
   if(e||!data)throw e||new Error('Preflight returned no result.');
   setDeletionCheck(data as {eligible:boolean;blockers:string[];user_id_prefix:string});
  }catch(e:any){
   Alert.alert('Deletion eligibility unavailable',e?.message||'Try checking again.');
  }finally{setPreflightBusy(false);}
 };
 const executeDeletion=()=>{
  if(!selected||kind!=='deletion'||!deletionCheck?.eligible)return;
  const required='DELETE '+deletionCheck.user_id_prefix;
  if(deletionPhrase.trim()!==required){
   Alert.alert('Confirmation does not match','Type '+required+' exactly.');return;
  }
  const requestId=selected.id;
  Alert.alert('Permanently delete this account?',
   'This is irreversible. The approved account will lose its login and associated non-retained data. A final server-side data check will be repeated.',
   [{text:'Cancel',style:'cancel'},{text:'Permanently delete',style:'destructive',onPress:()=>{
    void (async()=>{
     setPreflightBusy(true);
     try{
      const {data,error:e}=await supabase.functions.invoke('tradarr-account-delete',{
       body:{request_id:requestId,check_only:false,confirmation:required}
      });
      if(e||!data?.deleted)throw e||new Error('Deletion was not confirmed.');
      setSelected(null);setDeletionCheck(null);setDeletionPhrase('');
      await load(true);
      Alert.alert('Account deletion confirmed',data.audit_recorded===false?
       'The Auth account was deleted, but the final audit receipt needs an administrator review.':
       'The Auth account was deleted and the administrator audit receipt was recorded.');
     }catch(e:any){
      Alert.alert('Deletion not completed',e?.message||'A safety check prevented deletion. Review the request and retry only after investigating.');
      setDeletionCheck(null);setDeletionPhrase('');
     }finally{setPreflightBusy(false);}
    })();
   }}]);
 };
 const back=()=>{if(selected){setSelected(null);setReason('');setDeletionCheck(null);setDeletionPhrase('');}else goBack();};
 const shown=data[kind];
 const countOpen=(key:Kind)=>data[key].filter(row=>(
  key==='deletion'?['requested','reviewing','ready_for_deletion']:
  ['open','reviewing']).includes(row.status)).length;
 const owner=(row:Row)=>row.reporter_id||row.appellant_id||row.user_id;
 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={back} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
    <ArrowLeft size={21} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.overline}>TRADARR · STAFF MODERATION</Text>
    <Text style={s.heading}>{selected?'Case decision':'Safety & appeals'}</Text>
   </View>
  </View>
  <ScrollView contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   <View style={s.hero}>
    <ShieldAlert color="#E0F2EA" size={27}/>
    <Text style={s.heroTitle}>Review fairly. Record every decision.</Text>
    <Text style={s.heroText}>Reports, appeals and deletion requests are separate queues. Decisions require a written reason, server-side MFA and an audit entry.</Text>
   </View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {loading?<ActivityIndicator size="large" color={C.teal} style={{marginVertical:40}}/>:selected?
    <View style={s.card}>
     <Text style={s.overline}>{kind.toUpperCase()} · {readable(selected.status)}</Text>
     <Text style={s.title}>{selected.subject||selected.category||selected.topic||
       (kind==='deletion'?'Account deletion request':'Review')}</Text>
     <Text style={s.muted}>Reference {selected.id}</Text>
     <Text style={s.muted}>Account {owner(selected)}</Text>
     <Text style={s.muted}>Submitted {date(selected.created_at)}</Text>
     {kind==='report'?<>
      <Text style={s.subtitle}>Reported item</Text>
      <Text style={s.text}>{selected.target_type} · {selected.target_ref}</Text>
      <Text style={s.subtitle}>Customer statement</Text>
      <Text style={s.text}>{selected.details}</Text>
     </>:kind==='appeal'?<>
      {selected.linked_id?<Text style={s.muted}>Linked record: {selected.linked_id}</Text>:null}
      <Text style={s.subtitle}>Appeal statement</Text>
      <Text style={s.text}>{selected.explanation}</Text>
     </>:<>
      <Text style={s.subtitle}>Deletion request</Text>
      <Text style={s.text}>{selected.reason||'No reason provided.'}</Text>
      <Text style={s.warning}>Preserve legally required records and investigate active bookings before any irreversible Auth deletion. Marking “ready” is a workflow step, not account deletion.</Text>
     </>}
     {(selected.staff_note||selected.decision_note||selected.resolution_note)?
      <View style={s.note}><Text style={s.subtitle}>Previous staff reasoning</Text>
       <Text style={s.text}>{selected.staff_note||selected.decision_note||selected.resolution_note}</Text>
      </View>:null}
     <Text style={s.subtitle}>Your decision rationale</Text>
     <TextInput value={reason} onChangeText={setReason} multiline maxLength={2000}
      placeholder="Evidence checked, findings and reason (minimum 12 characters)"
      placeholderTextColor={C.muted} style={s.input}/>
     {kind==='deletion'&&selected.status==='ready_for_deletion'?<View style={s.deletionBox}>
       <Text style={s.subtitle}>Final deletion security review</Text>
       <Text style={s.muted}>Only use this for an approved request. The protected server checks for invoices, trading history, conversations, storage, disputes and administrator accounts. Most established accounts require manual privacy processing.</Text>
       <MotionPressable disabled={preflightBusy} onPress={()=>{void reviewDeletion()}}
        style={s.preflightAction} accessibilityRole="button">
        <Text style={s.preflightText}>{preflightBusy?'Checking…':'Check final deletion eligibility'}</Text>
       </MotionPressable>
       {deletionCheck?<View style={{gap:9}}>
        <Text style={s.muted}>{deletionCheck.eligible?'Eligible for final deletion':'Final deletion blocked — requires manual review'}</Text>
        {(deletionCheck.blockers||[]).map((blocker,i)=>
         <Text style={s.warning} key={i}>{blocker}</Text>)}
        {deletionCheck.eligible?<View style={{gap:8}}>
         <Text style={s.subtitle}>Type DELETE {deletionCheck.user_id_prefix} to confirm</Text>
         <TextInput value={deletionPhrase} onChangeText={setDeletionPhrase}
          autoCapitalize="characters" autoCorrect={false} style={[s.input,{minHeight:48}]}
          placeholder={'DELETE '+deletionCheck.user_id_prefix} placeholderTextColor={C.muted}/>
         <MotionPressable disabled={preflightBusy||deletionPhrase.trim()!=='DELETE '+deletionCheck.user_id_prefix}
          style={[s.action,s.destructive,{alignItems:'center',opacity:preflightBusy||deletionPhrase.trim()!=='DELETE '+deletionCheck.user_id_prefix?.5:1}]}
          onPress={executeDeletion} accessibilityRole="button">
          <Text style={[s.actionText,{color:'#994331'}]}>Permanently delete approved account</Text>
         </MotionPressable>
        </View>:null}
       </View>:null}
      </View>:null}
     <View style={s.actions}>
      {choices(kind).filter(value=>value!==selected.status&&
       !(['resolved','dismissed','upheld','declined','completed'].includes(selected.status))).map(status=>
        <MotionPressable key={status} onPress={()=>{void decide(status)}} disabled={saving}
         style={[s.action,(status==='dismissed'||status==='declined')&&s.destructive]}>
         <Text style={[s.actionText,(status==='dismissed'||status==='declined')&&{color:'#994331'}]}>
          {saving?'Saving…':readable(status)}
         </Text>
        </MotionPressable>)}
     </View>
     {['upheld','declined'].includes(selected.status)&&kind==='appeal'?
      <Text style={s.muted}>An appeal decision does not automatically restore an account or listing. The corresponding admin moderation action must be taken separately.</Text>:null}
    </View>:
    <>
     <View style={s.tabs}>
      {layout.map(item=><MotionPressable key={item.kind} onPress={()=>setKind(item.kind)}
       style={[s.tab,kind===item.kind&&s.tabActive]}>
       <Text style={[s.tabText,kind===item.kind&&s.tabTextActive]}>{item.name}</Text>
       <Text style={[s.tabCount,kind===item.kind&&s.tabTextActive]}>{countOpen(item.kind)} open</Text>
      </MotionPressable>)}
     </View>
     <Text style={s.section}>{layout.find(x=>x.kind===kind)?.name||'Cases'}</Text>
     {!shown.length?<View style={s.empty}><ClipboardCheck size={29} color={C.teal}/>
       <Text style={s.muted}>No submissions in this queue.</Text>
      </View>:shown.map(row=><MotionPressable key={row.id} onPress={()=>{setSelected(row);setReason('');setDeletionCheck(null);setDeletionPhrase('')}}
       style={s.case} accessibilityRole="button">
       <View style={{flex:1,gap:6}}>
        <Text style={s.overline}>{readable(row.status)} · {date(row.created_at)}</Text>
        <Text style={s.title}>{row.subject||row.category||row.topic||(kind==='deletion'?'Account deletion':'Case')}</Text>
        <Text numberOfLines={2} style={s.muted}>
         {row.details||row.explanation||row.reason||row.target_ref||'Tap to review'}
        </Text>
       </View><ChevronRight size={20} color={C.teal}/>
      </MotionPressable>)}
    </>
   }
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 header:{padding:17,flexDirection:'row',alignItems:'center',gap:13},
 back:{width:44,height:44,borderRadius:15,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'900',color:theme.colors.teal,letterSpacing:.6},
 heading:{fontSize:23,fontWeight:'900',color:theme.colors.ink},
 page:{paddingHorizontal:17,gap:13,paddingBottom:110},
 hero:{backgroundColor:theme.colors.darkTeal,borderRadius:22,padding:20,gap:10},
 heroTitle:{fontSize:20,fontWeight:'900',color:'#FFFFFF'},
 heroText:{fontSize:12,lineHeight:20,color:'#DBEDE6'},
 tabs:{flexDirection:'row',gap:8},
 tab:{flex:1,minHeight:70,backgroundColor:'#FFFFFF',padding:10,borderRadius:15,gap:6,alignItems:'center',justifyContent:'center'},
 tabActive:{backgroundColor:theme.colors.darkTeal},
 tabText:{fontSize:11,fontWeight:'900',color:theme.colors.ink,textAlign:'center'},
 tabTextActive:{color:'#FFFFFF'},
 tabCount:{fontSize:10,color:theme.colors.muted},
 section:{fontSize:16,fontWeight:'900',color:theme.colors.ink,marginTop:7},
 case:{backgroundColor:'#FFFFFF',borderRadius:17,padding:16,flexDirection:'row',alignItems:'center',gap:9},
 title:{fontSize:14,fontWeight:'900',color:theme.colors.ink},
 muted:{fontSize:12,lineHeight:19,color:theme.colors.muted},
 text:{fontSize:13,lineHeight:21,color:theme.colors.ink},
 card:{backgroundColor:'#FFFFFF',padding:18,borderRadius:20,gap:12},
 subtitle:{fontSize:12,fontWeight:'900',color:theme.colors.ink,marginTop:7},
 input:{borderWidth:1,borderColor:'#DEE9E3',borderRadius:14,padding:13,
  minHeight:104,textAlignVertical:'top',color:theme.colors.ink},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
 action:{backgroundColor:theme.colors.darkTeal,paddingVertical:13,paddingHorizontal:15,borderRadius:13},
 actionText:{fontSize:12,fontWeight:'900',color:'#FFFFFF'},
 destructive:{backgroundColor:'#FFF0E8'},
 note:{backgroundColor:'#F0F5F2',borderRadius:12,padding:13,gap:7},
 warning:{color:'#8F542D',fontSize:12,lineHeight:20,backgroundColor:'#FFF4E9',borderRadius:12,padding:12},
 empty:{backgroundColor:'#FFFFFF',padding:35,borderRadius:18,alignItems:'center',gap:11},
 error:{padding:13,backgroundColor:'#FFF0E5',color:'#993C2C',borderRadius:12,fontSize:12},
 deletionBox:{padding:15,borderRadius:15,backgroundColor:'#FFF9F5',gap:12,borderWidth:1,borderColor:'#E5C8BD'},
 preflightAction:{backgroundColor:theme.colors.darkTeal,borderRadius:12,paddingVertical:12,paddingHorizontal:14,alignItems:'center'},
 preflightText:{color:'#FFFFFF',fontWeight:'900',fontSize:12}
});
