import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,StyleSheet,Text,TextInput,View} from 'react-native';
import {Activity,CheckCircle2,ShieldAlert,ShieldCheck,XCircle} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
const date=(v:any)=>v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not recorded';
const upper=(v:string)=>v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const count=(v:any)=>Number(v||0).toLocaleString('en-GB');

export function TradarrAdminMemberControls({userId}:{userId:string}){
 const [suspended,setSuspended]=useState(false);
 const [activity,setActivity]=useState<Record<string,any>|null>(null);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const [mod,events]=await Promise.all([
    supabase.from('tradarr_account_moderation')
     .select('suspended,reason,reviewed_at').eq('user_id',userId).maybeSingle(),
    supabase.rpc('tradarr_admin_account_activity',{p_user_id:userId})
   ]);
   if(mod.error||events.error)throw mod.error||events.error;
   setSuspended(mod.data?.suspended===true);
   setActivity((events.data||{}) as Record<string,any>);setError('');
  }catch(e:any){setError(e?.message||'Could not load member moderation information.');}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void load();},[load]);
 const act=async()=>{
  if(busy)return;
  if(reason.trim().length<12){Alert.alert('Reason required','Enter at least 12 characters.');return;}
  const action=suspended?'reinstate':'suspend';
  const commit=async()=>{
   setBusy(true);
   try{
    const {error:e}=await supabase.rpc('tradarr_admin_moderate_account',{
     p_user_id:userId,p_action:action,p_reason:reason.trim()
    });
    if(e)throw e;
    setReason('');setSuspended(action==='suspend');
    Alert.alert('Account status updated',action==='suspend'?
      'New marketplace activity is restricted. Support, appeals and existing records remain accessible.':
      'Marketplace activity is restored.');
    await load();
   }catch(e:any){Alert.alert('Moderation failed',e?.message||'Try again.');}
   finally{setBusy(false);}
  };
  Alert.alert(action==='suspend'?'Suspend account?':'Reinstate account?',
   'Sensitive decision: the account holder will be notified and the reason will enter the audit log.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm decision',
     style:action==='suspend'?'destructive':'default',onPress:()=>{void commit()}}]);
 };
 return <View style={s.box}>
  <View style={s.row}><ShieldAlert color={C.teal} size={20}/>
   <Text style={[s.title,{flex:1}]}>Account administration</Text></View>
  {loading?<ActivityIndicator color={C.teal}/>:<>
   {error?<Text style={s.error}>{error}</Text>:null}
   <Text style={s.muted}>Current status: <Text style={s.bold}>{suspended?'Suspended':'Not suspended'}</Text></Text>
   <Text style={s.muted}>A suspension stops new marketplace writes but preserves support and appeal access. Administrative accounts cannot be suspended through this action.</Text>
   <TextInput value={reason} onChangeText={setReason} maxLength={2000} multiline style={s.input}
    placeholder="Reason and evidence for the decision" placeholderTextColor={C.muted}/>
   <MotionPressable disabled={busy||reason.trim().length<12} onPress={()=>{void act()}}
    style={[s.action,suspended?s.good:s.danger,(busy||reason.trim().length<12)&&{opacity:.5}]}>
    {suspended?<CheckCircle2 size={18} color={C.teal}/>:<XCircle size={18} color="#A14938"/>}
    <Text style={[s.actionText,suspended?{color:C.teal}:{color:'#A14938'}]}>
     {suspended?'Reinstate account':'Suspend marketplace account'}
    </Text>
   </MotionPressable>
   <View style={s.divider}/>
   <View style={s.row}><Activity color={C.teal} size={18}/>
    <Text style={s.title}>Recorded account activity</Text></View>
   <Text style={s.muted}>These are in-app transactions, not logins, device tracking or GPS history.</Text>
   {activity?<View style={s.grid}>
    {([
      ['Jobs posted',activity.jobs_posted],['Urgent requests',activity.urgent_requests],
      ['Jobs accepted',activity.jobs_accepted],['Messages sent',activity.messages_sent],
      ['Appointments',activity.appointments],['Invoices issued',activity.invoices_issued],
      ['Support cases',activity.support_cases],['Safety reports',activity.reports_filed]
    ] as [string,any][]).map(([label,value])=><View key={label} style={s.stat}>
     <Text style={s.muted}>{label}</Text><Text style={s.number}>{count(value)}</Text>
    </View>)}
    <Text style={[s.muted,{width:'100%'}]}>Last message: {date(activity.last_message_at)} · Last job: {date(activity.last_job_at)}</Text>
    {Array.isArray(activity.recent_events)&&activity.recent_events.length?
     <View style={{width:'100%',gap:7}}>{activity.recent_events.slice(0,12).map((event:any,i:number)=>
      <Text key={i} style={s.muted}>{upper(event.kind||'activity')} · {date(event.at)}</Text>)}</View>:null}
   </View>:null}
  </>}
 </View>;
}
export function TradarrAdminReviewControls({reviewId,reviewType}:{reviewId:string;reviewType:string}){
 const [hidden,setHidden]=useState(false);
 const [reason,setReason]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const {data,error:e}=await supabase.from('tradarr_review_moderation')
    .select('is_hidden,reason,reviewed_at')
    .eq('review_type',reviewType).eq('review_id',reviewId).maybeSingle();
   if(e)throw e;setHidden(data?.is_hidden===true);setError('');
  }catch(e:any){setError(e?.message||'Unable to load moderation status.');}
  finally{setLoading(false);}
 },[reviewId,reviewType]);
 useEffect(()=>{void load();},[load]);
 const act=()=>{
  if(reason.trim().length<12){Alert.alert('Reason required','Explain the decision in at least 12 characters.');return;}
  const action=hidden?'restore':'hide';
  Alert.alert(action==='hide'?'Hide this review?':'Restore this review?',
   'The review remains in the evidence history. Its effect on the public profile rating changes immediately.',
   [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{
     void (async()=>{
      setBusy(true);
      try{
       const {error:e}=await supabase.rpc('tradarr_admin_moderate_review',{
        p_review_type:reviewType,p_review_id:reviewId,p_action:action,p_reason:reason.trim()
       });
       if(e)throw e;
       setHidden(action==='hide');setReason('');
       Alert.alert('Review moderation saved','The public rating has been recalculated and the decision audited.');
      }catch(e:any){Alert.alert('Moderation failed',e?.message||'Please retry.');}
      finally{setBusy(false);}
     })();
   }}]);
 };
 return <View style={s.box}>
  <View style={s.row}><ShieldCheck color={C.teal} size={20}/>
   <Text style={s.title}>Review moderation</Text></View>
  {loading?<ActivityIndicator color={C.teal}/>:<>
   {error?<Text style={s.error}>{error}</Text>:null}
   <Text style={s.muted}>Rating status: <Text style={s.bold}>{hidden?'Hidden from rating':'Included in rating'}</Text></Text>
   <Text style={s.muted}>The original review is retained for dispute handling, even when it is not included in the public rating.</Text>
   <TextInput value={reason} onChangeText={setReason} multiline maxLength={2000} style={s.input}
    placeholder="Reason for hiding/restoring this review" placeholderTextColor={C.muted}/>
   <MotionPressable disabled={busy||reason.trim().length<12} onPress={act}
    style={[s.action,hidden?s.good:s.danger,(busy||reason.trim().length<12)&&{opacity:.5}]}>
    <Text style={[s.actionText,{color:hidden?C.teal:'#A14938'}]}>{hidden?'Restore review':'Hide review from public rating'}</Text>
   </MotionPressable>
  </>}
 </View>;
}
const s=StyleSheet.create({
 box:{backgroundColor:'#FFFFFF',borderRadius:20,padding:18,gap:12},
 row:{flexDirection:'row',alignItems:'center',gap:9},
 title:{fontSize:15,fontWeight:'900',color:theme.colors.ink},
 muted:{fontSize:12,lineHeight:19,color:theme.colors.muted},
 bold:{fontWeight:'900',color:theme.colors.ink},
 error:{fontSize:12,color:'#A04436'},
 input:{borderColor:'#DDE8E2',borderWidth:1,borderRadius:14,minHeight:94,
  padding:13,color:theme.colors.ink,textAlignVertical:'top'},
 action:{padding:14,borderRadius:14,minHeight:47,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},
 good:{backgroundColor:'#E8F4ED'},
 danger:{backgroundColor:'#FFF1EA'},
 actionText:{fontSize:12,fontWeight:'900'},
 divider:{height:1,backgroundColor:'#E1E9E3',marginVertical:8},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:9},
 stat:{width:'47%',padding:12,borderRadius:13,backgroundColor:'#F0F6F2',gap:7},
 number:{fontSize:22,fontWeight:'900',color:theme.colors.ink}
});
