import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,StyleSheet,Text,View} from 'react-native';
import {Bell,MessageCircle} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import UnifiedMessagesScreen from './UnifiedMessagesScreen';
import TradarrNotificationsScreen from './TradarrNotificationsScreen';
import type {TradarrAlert} from './TradarrNotificationsScreen';

type Tab='messages'|'notifications';
type Props={
 role:'customer'|'tradesperson';
 onOpenOther:(notice:TradarrAlert)=>void;
 initialConversationId?:string|null;
 openActivity?:boolean;
 onNativeIntentConsumed?:()=>void;
};

export default function TradarrInboxScreen({role,onOpenOther,
 initialConversationId=null,openActivity=false,onNativeIntentConsumed}:Props){
 const [tab,setTab]=useState<Tab>('messages');
 const [threadOpen,setThreadOpen]=useState(false);
 const threadWasOpenedRef=useRef(false);
 const [targetConversationId,setTargetConversationId]=useState<string|null>(null);
 const [unreadMessages,setUnreadMessages]=useState(0);
 const [unreadNotifications,setUnreadNotifications]=useState(0);
 // A notification tap can arrive while the app was closed or while its Inbox
 // is already mounted. Only the App-level authenticated lookup supplies this ID.
 useEffect(()=>{
  if(initialConversationId){
   setTargetConversationId(initialConversationId);
   setThreadOpen(false);
   threadWasOpenedRef.current=false;
   setTab('messages');
   onNativeIntentConsumed?.();
  }else if(openActivity){
   setTab('notifications');
   onNativeIntentConsumed?.();
  }
 // The intent clears itself once consumed, so callback identity is not an input.
 },[initialConversationId,openActivity]);

 const refreshCounts=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return;
  const [notifications,messages]=await Promise.all([
   supabase.from('tradarr_notifications').select('id',{count:'exact',head:true})
    .eq('recipient_id',user.id).is('read_at',null),
   supabase.rpc('tradarr_unread_conversation_counts')
  ]);
  if(!notifications.error)setUnreadNotifications(notifications.count||0);
  if(!messages.error&&Array.isArray(messages.data)){
   setUnreadMessages(messages.data.reduce(
    (sum:number,entry:any)=>sum+(Number(entry.unread_count)||0),0));
  }
 },[]);

 useEffect(()=>{
  let alive=true;
  let channel:ReturnType<typeof supabase.channel>|null=null;
  void refreshCounts();
  const subscribe=async()=>{
   const {data:{user}}=await supabase.auth.getUser();
   if(!alive||!user)return;
   channel=supabase.channel('tradarr-inbox-alert-badges-'+user.id)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tradarr_notifications',
      filter:'recipient_id=eq.'+user.id,
    },()=>{if(alive)void refreshCounts()}).subscribe();
  };
  void subscribe();
  const foreground=AppState.addEventListener('change',state=>{
   if(state==='active'&&alive)void refreshCounts();
  });
  const timer=setInterval(()=>{
   if(alive&&AppState.currentState==='active')void refreshCounts();
  },45000);
  return()=>{
   alive=false;foreground.remove();clearInterval(timer);
   if(channel)void supabase.removeChannel(channel);
  };
 },[refreshCounts]);

 const handleThreadChange=useCallback((open:boolean)=>{
  if(open)threadWasOpenedRef.current=true;
  setThreadOpen(open);
  // Do not clear a notification's target when the Messages tab first mounts.
  // Clear it only when the user actually backs out of an opened conversation.
  if(!open&&threadWasOpenedRef.current){
    threadWasOpenedRef.current=false;
    setTargetConversationId(null);
  }
 },[]);

 const openAlert=useCallback((notice:TradarrAlert)=>{
  if(notice.kind==='message'){
    setTargetConversationId(notice.data?.conversationId||null);
    setTab('messages');
    return;
  }
  onOpenOther(notice);
 },[onOpenOther]);

 const select=(next:Tab)=>{
  if(next===tab)return;
  setTargetConversationId(null);
  threadWasOpenedRef.current=false;
  setThreadOpen(false);
  setTab(next);
  void refreshCounts();
 };

 return <View style={s.root}>
  {!threadOpen?<View style={s.top}>
    <Text style={s.title}>Inbox</Text>
    <Text style={s.subtitle}>Conversations and updates in one place.</Text>
    <View style={s.segment}>
      {([
       {key:'messages',label:'Messages',Icon:MessageCircle,count:unreadMessages},
       {key:'notifications',label:'Activity',Icon:Bell,count:unreadNotifications},
      ] as const).map(({key,label,Icon,count})=>{
       const selected=tab===key;
       return <MotionPressable key={key} onPress={()=>select(key)}
        accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{selected}}
        style={[s.segmentButton,selected&&s.selected]}>
        <Icon size={18} color={selected?theme.colors.white:theme.colors.teal}/>
        <Text style={[s.segmentLabel,selected&&s.selectedLabel]}>{label}</Text>
        {count>0?<View style={[s.count,selected&&s.selectedCount]}>
          <Text style={[s.countText,selected&&s.selectedCountText]}>
           {count>99?'99+':count}
          </Text>
        </View>:null}
       </MotionPressable>;
      })}
    </View>
   </View>:null}
   {tab==='messages'?
      <UnifiedMessagesScreen role={role} embedded
       onThreadChange={handleThreadChange}
       onUnreadCountChange={setUnreadMessages}
       targetConversationId={targetConversationId}
       onOpenJob={jobId=>onOpenOther({id:jobId,kind:role==='customer'?'job_status':'job_offer',
        title:'Open job',body:'',data:{jobId},created_at:new Date().toISOString(),read_at:null})}/>:
      <TradarrNotificationsScreen
        embedded onBack={()=>select('messages')}
        onOpen={openAlert} onUnreadCountChange={setUnreadNotifications}/>}
 </View>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 top:{paddingHorizontal:17,paddingTop:17,paddingBottom:11},
 title:{fontSize:27,fontWeight:'900',color:theme.colors.ink},
 subtitle:{fontSize:12,color:theme.colors.muted,marginTop:4,marginBottom:15},
 segment:{backgroundColor:'#E9F0EC',padding:5,borderRadius:17,
  flexDirection:'row',gap:5},
 segmentButton:{flex:1,minHeight:43,borderRadius:12,flexDirection:'row',
  alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:7},
 selected:{backgroundColor:theme.colors.darkTeal},
 segmentLabel:{fontSize:13,fontWeight:'800',color:theme.colors.teal},
 selectedLabel:{color:theme.colors.white},
 count:{minWidth:20,height:20,paddingHorizontal:4,borderRadius:10,
  justifyContent:'center',alignItems:'center',backgroundColor:theme.colors.darkTeal},
 countText:{fontSize:10,fontWeight:'900',color:theme.colors.white},
 selectedCount:{backgroundColor:'#FFFFFF'},
 selectedCountText:{color:theme.colors.darkTeal},
});
