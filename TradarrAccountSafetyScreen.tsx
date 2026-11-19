import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,LockKeyhole,MessageSquareOff,ShieldAlert,ShieldCheck,Trash2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
type Appeal={id:string;topic:string;status:string;decision_note:string|null;created_at:string};
type Deletion={id:string;status:string;resolution_note:string|null;created_at:string};
type Conversation={id:string;customer_id:string;tradesperson_id:string;customer_display_name:string|null;tradesperson_display_name:string|null};
type UserBlock={blocked_id:string};
const C=theme.colors;
const date=(s:string)=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const topics=['account_suspension','trade_listing','review_moderation','other'] as const;
const sentence=(v:string)=>v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function TradarrAccountSafetyScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState('');
 const [suspended,setSuspended]=useState(false);
 const [suspensionReason,setSuspensionReason]=useState('');
 const [appeals,setAppeals]=useState<Appeal[]>([]);
 const [deletions,setDeletions]=useState<Deletion[]>([]);
 const [conversations,setConversations]=useState<Conversation[]>([]);
 const [blocked,setBlocked]=useState<string[]>([]);
 const [topic,setTopic]=useState<typeof topics[number]>('account_suspension');
 const [appealText,setAppealText]=useState('');
 const [deleteText,setDeleteText]=useState('');
 const [deleteConfirmation,setDeleteConfirmation]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   const {data:{user},error:e}=await supabase.auth.getUser();
   if(e||!user)throw new Error('Sign in to manage account safety.');
   setUid(user.id);
   const [moderation,appealQuery,deleteQuery,chatQuery,blockQuery]=await Promise.all([
    supabase.from('tradarr_account_moderation').select('suspended,reason').eq('user_id',user.id).maybeSingle(),
    supabase.from('tradarr_moderation_appeals').select('id,topic,status,decision_note,created_at')
     .eq('appellant_id',user.id).order('created_at',{ascending:false}).limit(30),
    supabase.from('tradarr_account_deletion_requests').select('id,status,resolution_note,created_at')
     .eq('user_id',user.id).order('created_at',{ascending:false}).limit(20),
    supabase.from('conversations').select('id,customer_id,tradesperson_id,customer_display_name,tradesperson_display_name')
     .or('customer_id.eq.'+user.id+',tradesperson_id.eq.'+user.id).limit(80),
    supabase.from('tradarr_user_blocks').select('blocked_id').eq('blocker_id',user.id)
   ]);
   for(const v of [moderation,appealQuery,deleteQuery,chatQuery,blockQuery])if(v.error)throw v.error;
   setSuspended(moderation.data?.suspended===true);
   setSuspensionReason(moderation.data?.reason||'');
   setAppeals((appealQuery.data||[]) as Appeal[]);
   setDeletions((deleteQuery.data||[]) as Deletion[]);
   setConversations((chatQuery.data||[]) as Conversation[]);
   setBlocked((blockQuery.data||[]).map(x=>x.blocked_id));setError('');
  }catch(e:any){setError(e?.message||'Unable to load account security information.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const sendAppeal=async()=>{
  if(saving||!uid)return;
  if(appealText.trim().length<20){Alert.alert('Explain your appeal','Write at least 20 characters describing why you disagree.');return;}
  setSaving(true);
  try{
   const {error:e}=await supabase.from('tradarr_moderation_appeals').insert({
    appellant_id:uid,topic,explanation:appealText.trim()
   });
   if(e)throw e;
   setAppealText('');await load(true);
   Alert.alert('Appeal submitted','Your appeal will appear in the moderation queue. No decision has been made yet.');
  }catch(e:any){Alert.alert('Unable to submit appeal',e?.message||'Please try again.');}
  finally{setSaving(false);}
 };
 const changeBlock=async(peerId:string,shouldBlock:boolean)=>{
  if(!uid||peerId===uid||saving)return;
  const perform=async()=>{
   setSaving(true);
   try{
    if(shouldBlock){
     const {error:e}=await supabase.from('tradarr_user_blocks')
      .insert({blocker_id:uid,blocked_id:peerId});
     if(e)throw e;
    }else{
     const {error:e}=await supabase.from('tradarr_user_blocks')
      .delete().eq('blocker_id',uid).eq('blocked_id',peerId);
     if(e)throw e;
    }
    setBlocked(previous=>shouldBlock?[...previous,peerId]:previous.filter(x=>x!==peerId));
   }catch(e:any){Alert.alert('Unable to update block',e?.message||'Please try again.');}
   finally{setSaving(false);}
  };
  if(shouldBlock){
   Alert.alert('Block this account?',
    'Neither account will be able to send new Tradarr chat messages to the other. Existing job and invoice records remain available.',
    [{text:'Cancel',style:'cancel'},{text:'Block',onPress:()=>{void perform()}}]);
  }else await perform();
 };
 const requestDeletion=async()=>{
  if(saving||!uid)return;
  if(deleteConfirmation.trim()!=='DELETE'){
   Alert.alert('Confirmation needed','Type DELETE exactly to request account deletion.');return;
  }
  if(deletions.some(x=>['requested','reviewing','ready_for_deletion'].includes(x.status))){
   Alert.alert('Request already submitted','An account deletion request is already being processed.');return;
  }
  Alert.alert('Request deletion of your Tradarr account?',
   'This creates a formal deletion request for review. It does not immediately erase Auth login, invoices, active bookings, messages or legally retained information.',
   [{text:'Cancel',style:'cancel'},{text:'Submit deletion request',style:'destructive',onPress:()=>{
    void (async()=>{
     setSaving(true);
     try{
      const {error:e}=await supabase.from('tradarr_account_deletion_requests')
       .insert({user_id:uid,reason:deleteText.trim()||null});
      if(e)throw e;
      setDeleteConfirmation('');setDeleteText('');await load(true);
      Alert.alert('Deletion request recorded','Your request is in the admin queue. You can continue using Tradarr unless your account is restricted.');
     }catch(e:any){Alert.alert('Unable to request deletion',e?.message||'Try again.');}
     finally{setSaving(false);}
    })();
   }}]);
 };
 const peers=conversations.map(c=>({
  id:c.customer_id===uid?c.tradesperson_id:c.customer_id,
  name:c.customer_id===uid?c.tradesperson_display_name:c.customer_display_name
 })).filter((p,i,list)=>p.id!==uid&&list.findIndex(x=>x.id===p.id)===i);
 return <View style={s.root}>
  <View style={s.head}>
   <MotionPressable onPress={goBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
    <ArrowLeft color={C.ink} size={20}/>
   </MotionPressable>
   <View style={{flex:1}}><Text style={s.overline}>YOUR ACCOUNT</Text><Text style={s.heading}>Privacy & safety</Text></View>
  </View>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   <View style={s.hero}>
    <ShieldCheck size={28} color="#DFF1E7"/>
    <Text style={s.heroTitle}>Your control over your account.</Text>
    <Text style={s.heroBody}>Manage contact restrictions, review moderation decisions and request account deletion without contacting another user.</Text>
   </View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {loading?<ActivityIndicator style={{marginTop:40}} size="large" color={C.teal}/>:<>
    {suspended?<View style={s.alert}>
      <Text style={s.title}>Your marketplace access is restricted</Text>
      <Text style={s.body}>{suspensionReason}</Text>
      <Text style={s.muted}>You can review previous records, use support and submit an appeal. New marketplace actions are unavailable until reinstatement.</Text>
     </View>:null}
    <Text style={s.section}>Contact controls</Text>
    <View style={s.card}>
     <View style={s.row}><MessageSquareOff color={C.teal} size={21}/>
      <Text style={[s.title,{flex:1}]}>Block a conversation participant</Text>
     </View>
     <Text style={s.muted}>Blocking stops new direct chat messages in both directions. It does not cancel jobs, appointments or legal payment obligations.</Text>
     {!peers.length?<Text style={s.muted}>No conversations to manage yet.</Text>:
      peers.map(peer=><View key={peer.id} style={s.peer}>
       <View style={{flex:1}}><Text style={s.title}>{peer.name||'Tradarr member'}</Text>
        <Text style={s.muted}>Account {peer.id.slice(0,8).toUpperCase()}</Text></View>
       <MotionPressable disabled={saving} onPress={()=>{void changeBlock(peer.id,!blocked.includes(peer.id))}}
        style={[s.chip,blocked.includes(peer.id)&&s.chipBlocked]}>
        <Text style={[s.chipText,blocked.includes(peer.id)&&{color:'#A13D31'}]}>
         {blocked.includes(peer.id)?'Unblock':'Block'}
        </Text>
       </MotionPressable>
      </View>)}
    </View>
    <Text style={s.section}>Moderation appeals</Text>
    {appeals.map(item=><View key={item.id} style={s.card}>
      <Text style={s.overline}>{sentence(item.topic)} · {sentence(item.status)}</Text>
      <Text style={s.muted}>Submitted {date(item.created_at)}</Text>
      {item.decision_note?<Text style={s.body}>Decision: {item.decision_note}</Text>:null}
     </View>)}
    <View style={s.card}>
     <Text style={s.title}>Request a moderation review</Text>
     <Text style={s.muted}>Disagree with an account suspension, trade-listing decision or review moderation? Explain the circumstances here.</Text>
     <View style={s.options}>
      {topics.map(t=><MotionPressable key={t} onPress={()=>setTopic(t)}
       style={[s.chip,topic===t&&s.chipSelected]}>
       <Text style={[s.chipText,topic===t&&{color:'#FFFFFF'}]}>{sentence(t)}</Text>
      </MotionPressable>)}
     </View>
     <TextInput value={appealText} onChangeText={setAppealText} multiline maxLength={3000}
      style={s.input} placeholder="Explain your appeal in at least 20 characters"
      placeholderTextColor={C.muted}/>
     <MotionPressable style={[s.primary,(saving||appealText.trim().length<20)&&s.disabled]}
      disabled={saving||appealText.trim().length<20} onPress={()=>{void sendAppeal()}}>
      <Text style={s.primaryText}>Submit appeal</Text>
     </MotionPressable>
    </View>
    <Text style={s.section}>Account deletion</Text>
    {deletions.map(item=><View key={item.id} style={s.card}>
      <Text style={s.overline}>DELETION REQUEST · {sentence(item.status)}</Text>
      <Text style={s.muted}>Submitted {date(item.created_at)}</Text>
      {item.resolution_note?<Text style={s.body}>{item.resolution_note}</Text>:null}
     </View>)}
    <View style={s.card}>
     <View style={s.row}><Trash2 color="#9A4534" size={21}/>
      <Text style={[s.title,{flex:1}]}>Request deletion of my account</Text></View>
     <Text style={s.muted}>The request enters a protected queue for review of active jobs, payment records and retention obligations. This stage does not automatically delete your Auth account or storage files.</Text>
     <TextInput multiline style={[s.input,{minHeight:58}]} maxLength={1500}
      value={deleteText} onChangeText={setDeleteText}
      placeholder="Optional reason for leaving" placeholderTextColor={C.muted}/>
     <TextInput style={[s.input,{minHeight:45}]} autoCapitalize="characters"
      value={deleteConfirmation} onChangeText={setDeleteConfirmation}
      placeholder="Type DELETE to confirm" placeholderTextColor={C.muted}/>
     <MotionPressable style={[s.danger,(saving||deleteConfirmation!=='DELETE')&&s.disabled]}
      disabled={saving||deleteConfirmation!=='DELETE'} onPress={()=>{void requestDeletion()}}>
      <Text style={s.dangerText}>Request account deletion</Text>
     </MotionPressable>
    </View>
    <Text style={s.footer}>For urgent threats, contact emergency services. This interface is not an emergency reporting channel.</Text>
   </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 head:{padding:16,flexDirection:'row',alignItems:'center',gap:13},
 back:{backgroundColor:'#FFFFFF',width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'900',color:theme.colors.teal,letterSpacing:1},
 heading:{fontSize:23,fontWeight:'900',color:theme.colors.ink},
 page:{paddingHorizontal:17,paddingBottom:120,gap:13},
 hero:{backgroundColor:theme.colors.darkTeal,padding:21,borderRadius:22,gap:11},
 heroTitle:{fontSize:20,fontWeight:'900',color:'#FFFFFF'},
 heroBody:{fontSize:12,color:'#DFEEE7',lineHeight:20},
 section:{fontSize:16,fontWeight:'900',color:theme.colors.ink,marginTop:8},
 card:{backgroundColor:'#FFFFFF',padding:17,borderRadius:19,gap:13},
 title:{fontSize:14,fontWeight:'900',color:theme.colors.ink},
 muted:{fontSize:12,lineHeight:19,color:theme.colors.muted},
 body:{fontSize:12,lineHeight:19,color:theme.colors.ink},
 row:{flexDirection:'row',gap:11,alignItems:'center'},
 peer:{flexDirection:'row',gap:11,alignItems:'center',borderTopWidth:1,borderTopColor:'#EDF2EF',paddingTop:10},
 options:{flexDirection:'row',flexWrap:'wrap',gap:7},
 chip:{backgroundColor:'#EDF4F0',paddingVertical:10,paddingHorizontal:13,borderRadius:12},
 chipSelected:{backgroundColor:theme.colors.darkTeal},
 chipBlocked:{backgroundColor:'#FFF1E8'},
 chipText:{fontSize:12,fontWeight:'800',color:theme.colors.ink},
 input:{borderRadius:14,borderWidth:1,borderColor:'#DDE8E1',minHeight:99,padding:12,textAlignVertical:'top',color:theme.colors.ink},
 primary:{borderRadius:15,minHeight:48,backgroundColor:theme.colors.darkTeal,padding:12,alignItems:'center',justifyContent:'center'},
 primaryText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},
 danger:{borderRadius:15,minHeight:48,backgroundColor:'#FFF0E9',padding:12,alignItems:'center',justifyContent:'center'},
 dangerText:{fontSize:12,fontWeight:'900',color:'#9A4534'},
 disabled:{opacity:.5},
 alert:{backgroundColor:'#FFF4EA',borderRadius:17,padding:16,gap:8},
 error:{padding:13,color:'#A34732',backgroundColor:'#FFF1E8',borderRadius:12,fontSize:12},
 footer:{color:theme.colors.muted,fontSize:10,lineHeight:18,padding:10}
});
