import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,Bell,BellRing,BriefcaseBusiness,CalendarClock,
 CheckCheck,ChevronRight,MessageCircle,RefreshCw} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type AlertKind='message'|'job_offer'|'job_accepted'|'job_status'|'appointment'|
 'appointment_change'|'route_match';
export type TradarrAlert={
 id:string;kind:AlertKind;title:string;body:string;
 data:{screen?:string;jobId?:string;conversationId?:string};
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

 const refresh=useCallback(async()=>{
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){
    setError('Sign in to see your notifications.');
    setLoading(false);return;
  }
  setUid(user.id);
  const {data,error:loadError}=await supabase.from('tradarr_notifications')
   .select('id,kind,title,body,data,created_at,read_at')
   .eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(100);
  if(loadError){setError(loadError.message);setLoading(false);return;}
  setItems((data||[]) as TradarrAlert[]);
  setError('');setLoading(false);
 },[]);

 useEffect(()=>{
  let active=true;
  void refresh();
  const loadChannel=async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user||!active)return;
    const channel=supabase.channel('tradarr-notifications-'+user.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',
       table:'tradarr_notifications',filter:'recipient_id=eq.'+user.id},
       ()=>{if(active)void refresh()})
      .subscribe();
    subscription=channel;
  };
  let subscription:ReturnType<typeof supabase.channel>|null=null;
  void loadChannel();
  return()=>{
    active=false;
    if(subscription)void supabase.removeChannel(subscription);
  };
 },[refresh]);

 const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items]);
 useEffect(()=>{onUnreadCountChange?.(unread);},[unread,onUnreadCountChange]);
 const shown=useMemo(()=>unreadOnly?items.filter(x=>!x.read_at):items,
  [unreadOnly,items]);

 const markRead=async(id:string)=>{
  if(!uid)return;
  const stamp=new Date().toISOString();
  const {error:markError}=await supabase.from('tradarr_notifications')
    .update({read_at:stamp}).eq('id',id).eq('recipient_id',uid).is('read_at',null);
  if(markError){setError(markError.message);return;}
  setItems(previous=>previous.map(item=>item.id===id?{...item,read_at:stamp}:item));
 };
 const open=async(item:TradarrAlert)=>{
  if(!item.read_at)await markRead(item.id);
  onOpen(item);
 };
 const markAll=async()=>{
  if(!uid||busy||!unread)return;
  setBusy(true);
  const stamp=new Date().toISOString();
  const {error:saveError}=await supabase.from('tradarr_notifications')
   .update({read_at:stamp}).eq('recipient_id',uid).is('read_at',null);
  setBusy(false);
  if(saveError){Alert.alert('Could not update notifications',saveError.message);return;}
  setItems(old=>old.map(item=>({...item,read_at:item.read_at||stamp})));
 };
 const iconFor=(kind:AlertKind)=>{
   if(kind==='message')return MessageCircle;
   if(kind==='appointment'||kind==='appointment_change')return CalendarClock;
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
  {error?<Text style={s.error}>{error}</Text>:null}
  {loading?<ActivityIndicator style={{marginTop:45}} color={theme.colors.teal}/>:
   <ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:35}}>
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
    {!shown.length?<View style={s.empty}>
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
 error:{color:theme.colors.coralDark,fontSize:12,paddingHorizontal:20,marginBottom:12},
 empty:{paddingHorizontal:25,paddingVertical:75,gap:11,alignItems:'center'},
 emptyTitle:{fontSize:18,fontWeight:'900',color:theme.colors.ink}
});
