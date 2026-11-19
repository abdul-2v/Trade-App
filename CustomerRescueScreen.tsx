import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,ArrowRight,Clock3,LifeBuoy,RefreshCcw,ShieldCheck,Zap} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Failed={id:string;source:'normal'|'urgent';trade:string;issue:string;status:string;created_at:string};
const dateText=(s:string)=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
export default function CustomerRescueScreen({goBack,onRetry,onStartNew}:{
 goBack:()=>void;onRetry:(trade:string,issue:string,urgent:boolean)=>void;
 onStartNew?:()=>void;
}){
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[rows,setRows]=useState<Failed[]>([]);
 const [selected,setSelected]=useState<string|null>(null),[error,setError]=useState('');
 const load=async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:a}=await supabase.auth.getUser();
  if(!a.user){setError('Sign in to find your cancelled requests.');setLoading(false);setRefreshing(false);return;}
  const [jobs,urgent]=await Promise.all([
   supabase.from('jobs').select('id,trade,issue,status,created_at').eq('customer_id',a.user.id)
    .in('status',['cancelled','expired']).order('created_at',{ascending:false}).limit(100),
   supabase.from('urgent_requests').select('id,trade,issue,status,created_at').eq('customer_id',a.user.id)
    .in('status',['cancelled','expired']).order('created_at',{ascending:false}).limit(100)
  ]);
  if(jobs.error||urgent.error)setError(jobs.error?.message||urgent.error?.message||'Could not load previous jobs.');
  else{
   setError('');
   setRows([...(jobs.data||[]).map(x=>({...x,source:'normal' as const})),
    ...(urgent.data||[]).map(x=>({...x,source:'urgent' as const}))].sort(
     (a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()));
  }
  setLoading(false);setRefreshing(false);
 };
 useEffect(()=>{void load();},[]);
 // Normal and urgent requests are stored in different tables and can share IDs.
 const picked=rows.find(x=>x.source+':'+x.id===selected)||null;
 const retry=(urgent:boolean)=>{
  if(!picked)return;
  Alert.alert('Start a replacement request?',
    'Tradarr will reuse your original job description and trade, then take you to the normal booking flow. You will confirm the details and location before anything is posted.',
    [{text:'Cancel',style:'cancel'},{text:'Continue',onPress:()=>onRetry(picked.trade,picked.issue,urgent)}]);
 };
 return <View style={s.root}><View style={s.header}>
   <MotionPressable style={s.back} onPress={picked?()=>setSelected(null):goBack}><ArrowLeft size={22} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>TRADARR RESCUE</Text><Text style={s.heading}>{picked?'Rescue a booking':'When plans fall through'}</Text></View>
  </View>
  {loading?<ActivityIndicator color={C.teal} size="large" style={{marginTop:60}}/>:
  <ScrollView contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   {error?<View style={s.empty}>
     <LifeBuoy size={31} color={C.coralDark}/>
     <Text style={s.cardTitle}>Could not load your request history</Text>
     <Text style={s.body}>{error}</Text>
     <MotionPressable style={s.primary} onPress={()=>void load(true)}
       accessibilityRole="button" accessibilityLabel="Retry loading request history">
       <RefreshCcw color="#FFFFFF" size={18}/>
       <Text style={s.primaryText}>Try again</Text>
     </MotionPressable>
    </View>:picked?<><View style={s.hero}><LifeBuoy color="#D0E7E2" size={28}/>
     <Text style={s.heroTitle}>{picked.issue}</Text>
     <Text style={s.heroSub}>{picked.trade} · Original request {picked.status} · {dateText(picked.created_at)}</Text></View>
     <View style={s.card}><Text style={s.cardTitle}>Recover without starting from scratch</Text>
      <Text style={s.body}>We can carry forward the job description and trade. You'll review the details and submit a new request through Tradarr.</Text>
      <MotionPressable style={s.primary} onPress={()=>retry(false)}><RefreshCcw color="#FFFFFF" size={18}/><Text style={s.primaryText}>Find a replacement</Text></MotionPressable>
      <MotionPressable style={s.outline} onPress={()=>retry(true)}><Zap color={C.teal} size={18}/><Text style={s.outlineText}>Request urgent help</Text></MotionPressable>
      <Text style={s.fine}>This doesn't guarantee someone will accept. Your original cancelled request remains in your history, and no booking or payment is made automatically.</Text>
     </View></>:<>
    <View style={s.hero}><LifeBuoy color="#D0E7E2" size={27}/>
     <Text style={s.heroTitle}>A cancelled job shouldn't mean starting over.</Text>
     <Text style={s.heroSub}>Re-use the details from a cancelled or expired Tradarr request and look for another tradesperson.</Text></View>
    <Text style={s.section}>Requests you can rescue</Text>
    {rows.length?rows.map(v=><MotionPressable key={v.source+v.id} onPress={()=>setSelected(v.source+':'+v.id)}
      style={s.row} accessibilityRole="button" accessibilityLabel={'Rescue '+v.issue}>
      <View style={s.icon}><RefreshCcw size={20} color={C.teal}/></View>
      <View style={{flex:1}}><Text style={s.rowTitle}>{v.issue}</Text>
       <Text style={s.meta}>{v.trade} · {v.status} · {dateText(v.created_at)}</Text></View><ArrowRight size={19} color={C.teal}/>
     </MotionPressable>):<View style={s.empty}><ShieldCheck size={30} color={C.teal}/>
      <Text style={s.cardTitle}>No cancelled requests to rescue</Text>
      <Text style={s.body}>Nothing to recover? You can still post a new request and look for available local tradespeople.</Text>
      {onStartNew?<MotionPressable onPress={onStartNew} style={s.primary}
        accessibilityRole="button" accessibilityLabel="Start a new customer job request">
        <ArrowRight color="#FFFFFF" size={18}/>
        <Text style={s.primaryText}>Start a new request</Text>
      </MotionPressable>:null}
     </View>}
    <View style={s.hint}><Clock3 size={20} color={C.teal}/>
     <Text style={s.fine}>Rescue currently uses recorded cancelled or expired requests. A live replacement-matching network will depend on real tradesperson capacity and consent.</Text>
    </View>
   </>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},header:{padding:18,flexDirection:'row',alignItems:'center',gap:12},
 back:{height:44,width:44,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:C.teal},heading:{fontSize:24,fontWeight:'800',color:C.ink,marginTop:4},
 page:{padding:19,paddingBottom:45},hero:{backgroundColor:C.darkTeal,padding:23,borderRadius:25,gap:11},
 heroTitle:{fontSize:22,fontWeight:'800',color:'#FFFFFF',lineHeight:29},heroSub:{fontSize:12,lineHeight:20,color:'#D5E5E2'},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:24,marginBottom:13},
 row:{backgroundColor:'#FFFFFF',padding:16,borderRadius:22,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12,...theme.shadow},
 icon:{width:43,height:43,borderRadius:14,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 rowTitle:{fontSize:14,fontWeight:'800',color:C.ink},meta:{fontSize:11,lineHeight:18,color:C.muted,marginTop:6},
 card:{backgroundColor:'#FFFFFF',borderRadius:23,padding:20,marginTop:16,...theme.shadow},
 cardTitle:{fontSize:17,fontWeight:'800',color:C.ink},body:{fontSize:13,color:C.muted,lineHeight:21,marginTop:10},
 primary:{minHeight:54,backgroundColor:C.darkTeal,borderRadius:26,alignItems:'center',justifyContent:'center',
  flexDirection:'row',gap:10,marginTop:17},
 primaryText:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},
 outline:{minHeight:52,backgroundColor:C.tealTint,borderRadius:26,alignItems:'center',justifyContent:'center',
  flexDirection:'row',gap:10,marginTop:9},outlineText:{fontSize:13,fontWeight:'800',color:C.teal},
 fine:{fontSize:11,color:C.muted,lineHeight:18,marginTop:16,flex:1},
 hint:{flexDirection:'row',gap:10,alignItems:'flex-start',backgroundColor:C.tealTint,borderRadius:18,padding:15,marginTop:16},
 empty:{backgroundColor:'#FFFFFF',alignItems:'center',padding:26,borderRadius:22,gap:7},
 error:{color:C.coralDark,fontSize:12,padding:11}
});
