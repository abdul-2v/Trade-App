import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,Bell,BellRing,BriefcaseBusiness,CalendarClock,
 CheckCheck,ChevronRight,MessageCircle,RefreshCw,FileText,Users} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import TradarrPushControl from './TradarrPushControl';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type AlertKind='message'|'job_offer'|'job_accepted'|'job_status'|'appointment'|
 'appointment_change'|'route_match'|'quote_update'|'appointment_reminder'|'invoice_update'|'verification_update'|'support_update'|'admin_notice'|'crew_update';
export type TradarrAlert={
 id:string;kind:AlertKind;title:string;body:string;
 data:{screen?:string;jobId?:string;conversationId?:string;invoiceId?:string;caseId?:string;credentialId?:string};
 created_at:string;read_at:string|null;
};
type Props={onBack:()=>void;onOpen:(notification:TradarrAlert)=>void;
 embedded?:boolean;onUnreadCountChange?:(count:number)=>void};
export default function TradarrNotificationsScreen({onBack,onOpen,embedded=false,onUnreadCountChange}:Props){
 const [uid,setUid]=useState('');
 const [items,setItems]=useState<TradarrAlert[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [unreadOnly,setUnreadOnly]=useState(false);
 const [totalUnread,setTotalUnread]=useState(0);
 const [hasOlder,setHasOlder]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [olderError,setOlderError]=useState('');
 const PAGE_SIZE=50;
 const refreshVersion=useRef(0);
 const activeUserRef=useRef('');

 const refresh=useCallback(async()=>{
  const version=++refreshVersion.current;
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(version!==refreshVersion.current)return;
  if(authError||!user){
    activeUserRef.current='';
    setUid('');setItems([]);setHasOlder(false);setTotalUnread(0);
    setError('Sign in to see your notifications.');
    setLoading(false);return;
  }
  if(activeUserRef.current!==user.id){
    // Never show a previous account's notifications after account switching.
    activeUserRef.current=user.id;
    setItems([]);setHasOlder(false);setTotalUnread(0);
  }
  setUid(user.id);
  const [alerts,unreadCount]=await Promise.all([
   supabase.from('tradarr_notifications')
    .select('id,kind,title,body,data,created_at,read_at')
    .eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(PAGE_SIZE),
   supabase.from('tradarr_notifications').select('id',{count:'exact',head:true})
    .eq('recipient_id',user.id).is('read_at',null)
  ]);
  if(version!==refreshVersion.current)return;
  if(alerts.error||unreadCount.error){
   setError('Your updates could not be loaded. '+(alerts.error?.message||unreadCount.error?.message));
   setLoading(false);return;
  }
  setItems((alerts.data||[]) as TradarrAlert[]);
  setLoadingOlder(false);
  setHasOlder((alerts.data||[]).length===PAGE_SIZE);
  setTotalUnread(unreadCount.count||0);
  setOlderError('');
  setError('');setLoading(false);
 },[]);

 useEffect(()=>{
  let active=true;
  void refresh();
  const loadChannel=async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user||!active)return;
    const channel=supabase.channel('tradarr-notifications-'+user.id)
      .on('postgres_changes',{event:'*',schema:'public',
       table:'tradarr_notifications',filter:'recipient_id=eq.'+user.id},
       ()=>{if(active)void refresh()})
      .subscribe();
    subscription=channel;
  };
  let subscription:ReturnType<typeof supabase.channel>|null=null;
  void loadChannel();
  const foreground=AppState.addEventListener('change',state=>{
    if(state==='active'&&active)void refresh();
  });
  return()=>{
    active=false;refreshVersion.current++;foreground.remove();
    if(subscription)void supabase.removeChannel(subscription);
  };
 },[refresh]);

 const unread=totalUnread;
 useEffect(()=>{onUnreadCountChange?.(unread);},[unread,onUnreadCountChange]);
 const loadOlder=async()=>{
  if(loadingOlder||!hasOlder||!uid||!items.length)return;
  const oldest=items[items.length-1],version=refreshVersion.current,userId=uid;
  if(!Number.isFinite(Date.parse(oldest.created_at)))return;
  setLoadingOlder(true);setOlderError('');
  try{
   // A new alert arriving while scrolling shifts OFFSET pages and skips
   // records. Page by the previously loaded oldest timestamp instead.
   const {data,error:pageError}=await supabase.from('tradarr_notifications')
    .select('id,kind,title,body,data,created_at,read_at')
    .eq('recipient_id',userId).lt('created_at',oldest.created_at)
    .order('created_at',{ascending:false}).limit(PAGE_SIZE);
   if(version!==refreshVersion.current||activeUserRef.current!==userId)return;
   if(pageError)throw pageError;
   const next=(data||[]) as TradarrAlert[];
   setItems(previous=>{
    const known=new Set(previous.map(x=>x.id));
    return [...previous,...next.filter(x=>!known.has(x.id))];
   });
   setHasOlder(next.length===PAGE_SIZE);
  }catch(e:any){
   if(version===refreshVersion.current&&activeUserRef.current===userId)
    setOlderError(e?.message||'Older notifications could not be loaded.');
  }finally{
   if(version===refreshVersion.current&&activeUserRef.current===userId)setLoadingOlder(false);
  }
 };
 const shown=useMemo(()=>unreadOnly?items.filter(x=>!x.read_at):items,
  [unreadOnly,items]);

 const markRead=async(id:string)=>{
  if(!uid)return;
  const stamp=new Date().toISOString();
  const {data:saved,error:markError}=await supabase.from('tradarr_notifications')
    .update({read_at:stamp}).eq('id',id).eq('recipient_id',uid)
    .is('read_at',null).select('id');
  if(markError){setError(markError.message);return;}
  if(!saved?.length){await refresh();return;}
  setItems(previous=>previous.map(item=>item.id===id?{...item,read_at:stamp}:item));
  setTotalUnread(value=>Math.max(0,value-1));
 };
 const open=async(item:TradarrAlert)=>{
  if(!item.read_at)await markRead(item.id);
  onOpen(item);
 };
 const markAll=async()=>{
  if(!uid||busy||!unread)return;
  setBusy(true);
  const stamp=new Date().toISOString();
  const {data:saved,error:saveError}=await supabase.from('tradarr_notifications')
   .update({read_at:stamp}).eq('recipient_id',uid).is('read_at',null).select('id');
  setBusy(false);
  if(saveError){Alert.alert('Could not update notifications',saveError.message);return;}
  if(!saved?.length){await refresh();return;}
  const confirmed=new Set(saved.map(row=>row.id));
  setItems(old=>old.map(item=>confirmed.has(item.id)
    ?{...item,read_at:item.read_at||stamp}:item));
  setTotalUnread(0);
 };
 const iconFor=(kind:AlertKind)=>{
   if(kind==='message')return MessageCircle;
   if(kind==='appointment'||kind==='appointment_change'||kind==='appointment_reminder')return CalendarClock;
   if(kind==='quote_update'||kind==='invoice_update'||kind==='verification_update')return FileText;
    if(kind==='support_update')return MessageCircle;
   if(kind==='crew_update')return Users;
   if(kind==='admin_notice')return BellRing;
   if(kind==='job_offer'||kind==='route_match'||kind==='job_accepted'||kind==='job_status')
    return BriefcaseBusiness;
   return Bell;
 };
 return <View style={s.root}>
  {!embedded?<View style={s.heading}>
   <MotionPressable onPress={onBack} style={s.back} accessibilityRole="button"
     accessibilityLabel="Back to account">
      <ArrowLeft color={theme.colors.ink} size={21}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.title}>Notifications</Text>
    <Text style={s.sub}>{unread>0?unread+' unread alert'+(unread===1?'':'s'):
      'Your latest Tradarr updates'}</Text>
   </View>
   <MotionPressable onPress={()=>{void refresh()}} style={s.back}
     accessibilityRole="button" accessibilityLabel="Refresh notifications">
    <RefreshCw size={19} color={theme.colors.teal}/>
   </MotionPressable>
  </View>:null}
  <TradarrPushControl/>
  <View style={[s.tools,embedded&&{paddingTop:9}]}>
   <View style={s.tabs}>
    {([{key:'all',label:'All'},{key:'unread',label:'Unread'}] as const).map(tab=>{
     const selected=unreadOnly===(tab.key==='unread');
     return <MotionPressable key={tab.key} onPress={()=>setUnreadOnly(tab.key==='unread')}
       style={[s.tab,selected&&s.selected]} accessibilityRole="button"
       accessibilityLabel={'Show '+tab.label.toLowerCase()+' notifications'}>
      <Text style={[s.tabText,selected&&s.selectedText]}>{tab.label}</Text>
     </MotionPressable>
    })}
   </View>
   <MotionPressable onPress={()=>{void markAll()}} disabled={busy||!unread}
      style={{flexDirection:'row',alignItems:'center',gap:6,opacity:unread?1:.5}}
      accessibilityRole="button" accessibilityLabel="Mark all notifications as read">
    <CheckCheck size={16} color={theme.colors.teal}/>
    <Text style={{fontSize:11,fontWeight:'800',color:theme.colors.teal}}>
      Mark all read</Text>
   </MotionPressable>
  </View>
  {error&&!items.length?<View style={s.errorPanel}>
    <BellRing size={26} color={theme.colors.coralDark}/>
    <Text style={s.error}>{error}</Text>
    <MotionPressable onPress={()=>void refresh()} style={s.retry}
      accessibilityRole="button" accessibilityLabel="Retry loading notifications">
      <RefreshCw size={17} color="#FFFFFF"/>
      <Text style={{color:'#FFFFFF',fontWeight:'800'}}>Try again</Text>
    </MotionPressable>
   </View>:null}
  {loading?<ActivityIndicator style={{marginTop:45}} color={theme.colors.teal}/>:
   error&&!items.length?null:<ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:55}}>
    {error?<MotionPressable style={s.inlineWarning} onPress={()=>void refresh()} accessibilityRole="button">
       <Text style={s.error}>Connection issue. Showing your last loaded updates. Tap to retry.</Text>
      </MotionPressable>:null}
    {shown.map(item=>{
      const Icon=iconFor(item.kind);
      return <MotionPressable key={item.id} onPress={()=>{void open(item)}}
        style={[s.row,!item.read_at&&s.unreadRow]} accessibilityRole="button"
        accessibilityLabel={item.title}>
       <View style={s.roundIcon}><Icon size={22} color={theme.colors.teal}/></View>
       <View style={{flex:1,gap:6}}>
        <View style={{flexDirection:'row',gap:5,alignItems:'center'}}>
         <Text style={s.notificationTitle} numberOfLines={2}>{item.title}</Text>
         {!item.read_at?<View style={s.unreadDot}/>:null}
        </View>
        <Text style={s.notificationBody}>{item.body}</Text>
        <Text style={s.time}>
         {new Date(item.created_at).toLocaleString('en-GB',{
          day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </Text>
       </View>
       <ChevronRight size={18} color={theme.colors.muted}/>
      </MotionPressable>
    })}
    {olderError?<MotionPressable style={s.inlineWarning} onPress={()=>{void loadOlder()}} accessibilityRole="button">
      <Text style={s.error}>{olderError} · Tap to retry older alerts</Text>
     </MotionPressable>:null}
    {hasOlder?<MotionPressable style={s.loadMore} onPress={()=>{void loadOlder()}}
      disabled={loadingOlder} accessibilityRole="button" accessibilityLabel="Load older activity alerts">
      {loadingOlder?<ActivityIndicator color={theme.colors.teal} size="small"/>:
       <Text style={s.loadMoreText}>Load older activity</Text>}
     </MotionPressable>:null}
    {!shown.length&&!hasOlder?<View style={s.empty}>
      <BellRing size={38} color={theme.colors.teal}/>
      <Text style={s.emptyTitle}>{unreadOnly?'All caught up':'No notifications yet'}</Text>
      <Text style={s.sub}>{unreadOnly?'New unread alerts will appear here.':
       'Messages, booking changes and job updates will show here as they happen.'}</Text>
    </View>:null}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 heading:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingTop:18,paddingBottom:17},
 back:{height:42,width:42,borderRadius:21,backgroundColor:'#FFFFFF',
  alignItems:'center',justifyContent:'center'},
 title:{fontSize:25,color:theme.colors.ink,fontWeight:'900'},
 sub:{fontSize:12,color:theme.colors.muted,marginTop:5,lineHeight:18},
 tools:{paddingHorizontal:16,paddingBottom:16,flexDirection:'row',alignItems:'center',
  justifyContent:'space-between',gap:10},
 tabs:{flexDirection:'row',padding:4,backgroundColor:'#E8EFEB',borderRadius:16},
 tab:{paddingVertical:9,paddingHorizontal:15,borderRadius:12},
 selected:{backgroundColor:'#FFFFFF'},
 tabText:{color:theme.colors.muted,fontSize:12,fontWeight:'800'},
 selectedText:{color:theme.colors.teal},
 row:{flexDirection:'row',padding:14,borderRadius:18,backgroundColor:'#FFFFFF',
  borderWidth:1,borderColor:'#E9EBE7',marginBottom:9,gap:12,alignItems:'center'},
 unreadRow:{borderColor:'#B7DCD1',backgroundColor:'#F5FAF7'},
 roundIcon:{height:42,width:42,borderRadius:22,backgroundColor:theme.colors.tealTint,
  alignItems:'center',justifyContent:'center'},
 unreadDot:{height:7,width:7,borderRadius:5,backgroundColor:theme.colors.teal},
 notificationTitle:{flex:1,color:theme.colors.ink,fontWeight:'900',fontSize:14},
 notificationBody:{fontSize:12,color:theme.colors.muted,lineHeight:19},
 time:{color:theme.colors.muted,fontSize:10},
 error:{color:theme.colors.coralDark,fontSize:12,lineHeight:19,textAlign:'center'},
 inlineWarning:{marginBottom:10,padding:13,borderRadius:13,backgroundColor:'#FFF2E9'},
 loadMore:{minHeight:46,paddingHorizontal:20,backgroundColor:'#EAF2EF',borderRadius:15,
   marginTop:8,marginBottom:14,justifyContent:'center',alignItems:'center'},
 loadMoreText:{color:theme.colors.teal,fontSize:12,fontWeight:'900'},
 errorPanel:{marginHorizontal:16,marginTop:14,padding:23,borderRadius:20,
   backgroundColor:'#FFFFFF',alignItems:'center',gap:13},
 retry:{minHeight:47,borderRadius:25,paddingHorizontal:23,backgroundColor:theme.colors.darkTeal,
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 empty:{paddingHorizontal:25,paddingVertical:75,gap:11,alignItems:'center'},
 emptyTitle:{fontSize:18,fontWeight:'900',color:theme.colors.ink}
});
