import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,KeyboardAvoidingView,Platform,ScrollView,
 StyleSheet,Text,TextInput,View,Image,Linking} from 'react-native';
import {ArrowLeft,ArrowUp,Check,CheckCheck,FileText,ImagePlus,MessageCircle,Paperclip,RotateCw,Search,X} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {chatDocumentMime,chatDocumentPath,readChatDocument,safeChatDocumentName} from './lib/chatDocument';
import type {ChatDocumentMime} from './lib/chatDocument';
import ConversationJobCards from './ConversationJobCards';
import {chatPhotoPath,decodeChatPhotoBase64,detectChatPhotoMime} from './lib/chatPhoto';
import type {ChatPhotoMime} from './lib/chatPhoto';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import {MotionPressable} from './Motion';

type Role='customer'|'tradesperson';
type Inbox={id:string;otherName:string;otherTrade:string;avatar:string|null;
 lastMessage:string;updatedAt:string;unread:number};
type Message={id:number;conversation_id:string;sender_id:string;body:string;
 read_at:string|null;created_at:string;client_token?:string|null;
 attachment_path?:string|null;attachment_mime?:string|null};
type Props={role:Role;onClose?:()=>void;embedded?:boolean;
 onThreadChange?:(open:boolean)=>void;onUnreadCountChange?:(count:number)=>void;
 targetConversationId?:string|null;onOpenJob?:(jobId:string)=>void;};

const fmt=(iso:string)=>new Date(iso).toLocaleString('en-GB',
 {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const quickCustomer=['Could you confirm your availability?','Can you provide an estimate?','Can we arrange a visit?'];
const quickTrade=['Thanks for reaching out. Can you send more details?',
 'What day works best for you?','I can discuss pricing after reviewing the job.'];
const makeToken=()=>{
 // Uniqueness token for safe retry, not a secret or a proof of identity.
 const hex='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
 return hex.replace(/[xy]/g,ch=>{
  const n=Math.floor(Math.random()*16);
  return (ch==='x'?n:(n&3)|8).toString(16);
 });
};

export default function UnifiedMessagesScreen({role,onClose,embedded=false,
 onThreadChange,onUnreadCountChange,targetConversationId,onOpenJob}:Props){
 const [uid,setUid]=useState('');
 const [inbox,setInbox]=useState<Inbox[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [thread,setThread]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 const [query,setQuery]=useState('');
 const [loadingInbox,setLoadingInbox]=useState(true);
 const [loadingThread,setLoadingThread]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [hasOlder,setHasOlder]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [chatError,setChatError]=useState('');
 const [photo,setPhoto]=useState<{uri:string;base64:string;mime:ChatPhotoMime}|null>(null);
 const [document,setDocument]=useState<{uri:string;name:string;mime:ChatDocumentMime;size:number}|null>(null);
 const [otherTyping,setOtherTyping]=useState(false);
 const lastTypingSentRef=useRef(0);
 const [mediaUrls,setMediaUrls]=useState<Record<string,string>>({});
 const expiresRef=useRef<Record<string,number>>({});
 const uploadedAttachmentRef=useRef<{token:string;path:string}|null>(null);
 const scrollRef=useRef<any>(null);
 const stickToBottomRef=useRef(true);
 const selectedRef=useRef<string|null>(null);
 const tokenRef=useRef<string|null>(null);
 selectedRef.current=selectedId;

 const signPhotos=useCallback(async(items:Message[])=>{
  const now=Date.now();
  const paths=[...new Set(items.map(m=>m.attachment_path).filter((v):v is string=>Boolean(v)))]
    .filter(path=>!expiresRef.current[path]||expiresRef.current[path]<now+60000);
  if(!paths.length)return;
  const {data,error:signError}=await supabase.storage.from('tradarr-chat')
    .createSignedUrls(paths,1800);
  if(signError||!data)return;
  const next:Record<string,string>={};
  data.forEach(row=>{
    if(row.path&&row.signedUrl&&!row.error){
      next[row.path]=row.signedUrl;
      expiresRef.current[row.path]=Date.now()+25*60000;
    }
  });
  if(Object.keys(next).length)setMediaUrls(old=>({...old,...next}));
 },[]);

 const pickPhoto=async()=>{
  if(busy)return;
  try{
   const result=await ImagePicker.launchImageLibraryAsync({
     mediaTypes:['images'],quality:0.65,base64:true,exif:false,allowsEditing:false
   });
   if(result.canceled||!result.assets?.length)return;
   const asset=result.assets[0];
   const base64=asset.base64;
   if(!base64)throw new Error('This photo could not be prepared. Choose a different image.');
   if(asset.fileSize&&asset.fileSize>8*1024*1024)
      throw new Error('Choose a photo smaller than 8MB.');
   if(base64.length*0.75>8*1024*1024)
      throw new Error('Choose a smaller photo to send.');
   setPhoto({uri:asset.uri,base64,mime:detectChatPhotoMime(base64)});
   setDocument(null);
   tokenRef.current=null;uploadedAttachmentRef.current=null;
  }catch(error:any){
   Alert.alert('Photo unavailable',error?.message||'Could not choose the photo.');
  }
 };

 const pickDocument=async()=>{
  if(busy)return;
  try{
   const result=await DocumentPicker.getDocumentAsync({
    type:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory:true,multiple:false
   });
   if(result.canceled||!result.assets.length)return;
   const file=result.assets[0];
   if((file.size||0)>8*1024*1024)throw new Error('Choose a document smaller than 8 MB.');
   const mime=chatDocumentMime(file.name);
   setDocument({uri:file.uri,name:safeChatDocumentName(file.name),mime,size:file.size||0});
   setPhoto(null);tokenRef.current=null;uploadedAttachmentRef.current=null;
  }catch(e:any){Alert.alert('Document unavailable',e?.message||'Unable to select document.');}
 };
 const publishDraft=(value:string)=>{
  setDraft(value);tokenRef.current=null;setChatError('');
  if(!selectedId||!uid||!value.trim())return;
  const now=Date.now();
  if(now-lastTypingSentRef.current<2800)return;
  lastTypingSentRef.current=now;
  void supabase.from('conversation_typing').upsert({
    conversation_id:selectedId,user_id:uid,
    expires_at:new Date(now+7000).toISOString(),
    updated_at:new Date(now).toISOString()
  },{onConflict:'conversation_id,user_id'});
 };
 const loadInbox=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setLoadingInbox(false);setError('Please sign in to view messages.');return;}
  setUid(user.id);
  const {data:rows,error:readError}=await supabase.from('conversations')
   .select('id,customer_id,tradesperson_id,customer_display_name,tradesperson_display_name,tradesperson_trade,tradesperson_avatar_url,updated_at')
   .eq(role==='customer'?'customer_id':'tradesperson_id',user.id)
   .order('updated_at',{ascending:false}).limit(100);
  if(readError){setError(readError.message);setLoadingInbox(false);return;}
  const ids=(rows||[]).map(x=>x.id);
  if(!ids.length){setInbox([]);setError('');setLoadingInbox(false);return;}
  const [{data:latest,error:lastErr},{data:counts,error:countErr}]=await Promise.all([
   supabase.from('messages').select('conversation_id,body,created_at')
     .in('conversation_id',ids).order('created_at',{ascending:false}).limit(500),
   supabase.rpc('tradarr_unread_conversation_counts')
  ]);
  if(lastErr){setError(lastErr.message);}
  const last=new Map<string,{body:string;created_at:string}>();
  (latest||[]).forEach(m=>{if(!last.has(m.conversation_id))last.set(m.conversation_id,m);});
  const unread=new Map<string,number>();
  if(!countErr)(counts||[]).forEach((v:any)=>unread.set(v.conversation_id,Number(v.unread_count)||0));
  const next:Inbox[]=(rows||[]).map(row=>{
   const mostRecent=last.get(row.id);
   return {
    id:row.id,
    otherName:role==='customer'
       ? row.tradesperson_display_name||'Tradesperson'
       : row.customer_display_name||'Customer',
    otherTrade:role==='customer'?row.tradesperson_trade||'Trade professional':'Customer conversation',
    avatar:role==='customer'?row.tradesperson_avatar_url||null:null,
    lastMessage:mostRecent?.body||'Conversation started · say hello',
    updatedAt:mostRecent?.created_at||row.updated_at,
    unread:unread.get(row.id)||0
   };
  }).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
  setInbox(next);setLoadingInbox(false);setError(lastErr?.message||countErr?.message||'');
 },[role]);

 const markRead=useCallback(async(conversationId:string,userId:string)=>{
  if(!userId)return;
  const {error:readError}=await supabase.from('messages')
    .update({read_at:new Date().toISOString()})
    .eq('conversation_id',conversationId)
    .neq('sender_id',userId)
    .is('read_at',null);
  if(!readError){
   setInbox(previous=>previous.map(i=>i.id===conversationId?{...i,unread:0}:i));
  }
 },[]);

 const loadThread=useCallback(async(id:string,showSpinner=false)=>{
  if(showSpinner)setLoadingThread(true);
  const {data, error:readError}=await supabase.from('messages')
   .select('id,conversation_id,sender_id,body,read_at,created_at,client_token,attachment_path,attachment_mime')
   .eq('conversation_id',id).order('created_at',{ascending:false}).limit(50);
  if(selectedRef.current!==id)return;
  if(readError){setChatError(readError.message);setLoadingThread(false);return;}
  const next=((data||[]) as Message[]).reverse();
  setThread(next);setHasOlder((data||[]).length===50);setLoadingThread(false);setChatError('');
  void signPhotos(next);
  const {data:{user}}=await supabase.auth.getUser();
  if(user)void markRead(id,user.id);
 },[markRead,signPhotos]);

 const loadOlder=async()=>{
  if(!selectedId||!hasOlder||loadingOlder||!thread.length)return;
  stickToBottomRef.current=false;
  setLoadingOlder(true);
  const first=thread[0];
  const {data,error:loadError}=await supabase.from('messages')
   .select('id,conversation_id,sender_id,body,read_at,created_at,client_token,attachment_path,attachment_mime')
   .eq('conversation_id',selectedId).lt('created_at',first.created_at)
   .order('created_at',{ascending:false}).limit(50);
  setLoadingOlder(false);
  if(loadError){setChatError(loadError.message);return;}
  const older=((data||[]) as Message[]).reverse();
  setThread(old=>[...older.filter(a=>!old.some(b=>a.id===b.id)),...old]);
  setHasOlder(older.length===50);void signPhotos(older);
 };

 useEffect(()=>{
  let active=true;
  const start=async()=>{
   await loadInbox();
   const {data:{user}}=await supabase.auth.getUser();
   if(!active||!user)return;
   const channel=supabase.channel('inbox-watch-'+role+'-'+user.id)
     .on('postgres_changes',{event:'*',schema:'public',table:'conversations',
       filter:(role==='customer'?'customer_id':'tradesperson_id')+'=eq.'+user.id},
      ()=>{if(active)void loadInbox()}).subscribe();
   inboxChannel.current=channel;
  };
  const inboxChannel:{current:any}={current:null};
  void start();
  const onState=AppState.addEventListener('change',state=>{
   if(state==='active'){void loadInbox();if(selectedRef.current)void loadThread(selectedRef.current);}
  });
  const interval=setInterval(()=>{
   if(AppState.currentState==='active'){
    void loadInbox();
    if(selectedRef.current)void loadThread(selectedRef.current);
   }
  },45000);
  return()=>{
   active=false;clearInterval(interval);onState.remove();
   if(inboxChannel.current)void supabase.removeChannel(inboxChannel.current);
  };
 },[role,loadInbox,loadThread]);

 useEffect(()=>{
  if(!selectedId){setThread([]);setChatError('');return;}
  let active=true;
  setLoadingThread(true);
  void loadThread(selectedId,true);
  const channel=supabase.channel('messages-watch-'+selectedId)
   .on('postgres_changes',{event:'*',schema:'public',table:'messages',
    filter:'conversation_id=eq.'+selectedId},payload=>{
     if(!active)return;
     const incoming=payload.new as Message;
     if(payload.eventType==='INSERT'){
      setThread(old=>old.some(m=>m.id===incoming.id)?old:[...old,incoming]);
      void signPhotos([incoming]);
      if(incoming.sender_id!==uid&&uid)void markRead(selectedId,uid);
     }else if(payload.eventType==='UPDATE'){
      setThread(old=>old.map(m=>m.id===incoming.id?{...m,...incoming}:m));
     }
     void loadInbox();
   }).subscribe();
  return()=>{active=false;void supabase.removeChannel(channel);};
 },[selectedId,uid,loadInbox,loadThread,markRead,signPhotos]);

 useEffect(()=>{
  if(!selectedId||!uid){setOtherTyping(false);return;}
  let alive=true;
  const check=async()=>{
   const {data}=await supabase.from('conversation_typing').select('user_id,expires_at')
    .eq('conversation_id',selectedId).neq('user_id',uid)
    .gt('expires_at',new Date().toISOString()).limit(1);
   if(alive)setOtherTyping(Boolean(data?.length));
  };
  void check();
  const channel=supabase.channel('typing-watch-'+selectedId+'-'+uid)
   .on('postgres_changes',{event:'*',schema:'public',table:'conversation_typing',
    filter:'conversation_id=eq.'+selectedId},()=>{void check()}).subscribe();
  const timer=setInterval(()=>{void check()},5000);
  return()=>{alive=false;clearInterval(timer);void supabase.removeChannel(channel)};
 },[selectedId,uid]);

 const send=async()=>{
  const body=draft.trim()||(photo?'📷 Photo':document?'📄 '+safeChatDocumentName(document.name):'');
  if(!selectedId||!uid||!body||busy)return;
  const targetConversationId=selectedId;
  if(body.length>4000){
   Alert.alert('Message too long','Keep messages under 4000 characters.');return;
  }
  const token=tokenRef.current||makeToken();
  tokenRef.current=token;
  setBusy(true);setChatError('');
  try{
   let attachmentPath:string|null=null;
   if(photo||document){
    const mime=photo?.mime||document!.mime;
    attachmentPath=photo?chatPhotoPath(targetConversationId,uid,token,photo.mime):
      chatDocumentPath(targetConversationId,uid,token,document!.mime);
    if(uploadedAttachmentRef.current?.token!==token ||
       uploadedAttachmentRef.current?.path!==attachmentPath){
      const bytes=photo?decodeChatPhotoBase64(photo.base64):await readChatDocument(document!.uri,document!.mime);
      const {error:uploadError}=await supabase.storage.from('tradarr-chat')
        .upload(attachmentPath,bytes,{contentType:mime,cacheControl:'3600',upsert:false});
      if(uploadError){
        // If the network failed after an upload actually succeeded, verify
        // the private object rather than uploading a duplicate.
        const {data:verified}=await supabase.storage.from('tradarr-chat')
          .createSignedUrl(attachmentPath,60);
        if(!verified?.signedUrl)throw uploadError;
      }
      uploadedAttachmentRef.current={token,path:attachmentPath};
    }
   }
   const payload:any={conversation_id:targetConversationId,sender_id:uid,body,client_token:token};
   if(attachmentPath){
     payload.attachment_path=attachmentPath;
     payload.attachment_mime=photo?.mime||document?.mime||'image/jpeg';
   }
   let {data,error:sendError}=await supabase.from('messages').insert(payload)
     .select('id,conversation_id,sender_id,body,read_at,created_at,client_token,attachment_path,attachment_mime')
     .single();
   if(sendError?.code==='23505'){
     const prior=await supabase.from('messages')
       .select('id,conversation_id,sender_id,body,read_at,created_at,client_token,attachment_path,attachment_mime')
       .eq('sender_id',uid).eq('client_token',token).maybeSingle();
     data=prior.data;sendError=prior.error;
   }
   if(sendError||!data)throw sendError||new Error('Could not confirm delivery. Tap Send to retry.');
   if(selectedRef.current===targetConversationId){
     setThread(old=>old.some(m=>m.id===data.id)?old:[...old,data as Message]);
     stickToBottomRef.current=true;
     void signPhotos([data as Message]);
     setDraft('');setPhoto(null);setDocument(null);
     uploadedAttachmentRef.current=null;tokenRef.current=null;
   }
   void loadInbox();
  }catch(error:any){
   setChatError(error?.message||'Could not send. Tap Send again to retry.');
   // Keep message, photo and unique retry token until successfully delivered.
  }finally{setBusy(false);}
 };

 const selected=inbox.find(x=>x.id===selectedId)||null;
 const visible=useMemo(()=>inbox.filter(i=>(i.otherName+' '+i.otherTrade+' '+i.lastMessage)
   .toLowerCase().includes(query.trim().toLowerCase())),[inbox,query]);
 const quick=role==='customer'?quickCustomer:quickTrade;
 const totalUnread=inbox.reduce((sum,item)=>sum+item.unread,0);
 useEffect(()=>{onThreadChange?.(Boolean(selected));},[Boolean(selected),onThreadChange]);
 useEffect(()=>{onUnreadCountChange?.(totalUnread);},[totalUnread,onUnreadCountChange]);
 useEffect(()=>{
  if(targetConversationId&&inbox.some(item=>item.id===targetConversationId)){
    setSelectedId(targetConversationId);
  }
 },[targetConversationId,inbox]);
 return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}
   keyboardVerticalOffset={Platform.OS==='ios'?20:0}>
  {selected ? <>
    <View style={s.chatHeader}>
      <MotionPressable onPress={()=>{setSelectedId(null);setDraft('');setPhoto(null);setDocument(null);
        uploadedAttachmentRef.current=null;tokenRef.current=null;stickToBottomRef.current=true;}}
        style={s.back} accessibilityRole="button" accessibilityLabel="Back to inbox">
       <ArrowLeft size={21} color={theme.colors.ink}/>
      </MotionPressable>
      <View style={s.avatar}>
       <Text style={s.avatarText}>{selected.otherName.trim().split(' ')
         .slice(0,2).map(v=>v[0]).join('').toUpperCase()}</Text>
      </View>
      <View style={{flex:1}}>
       <Text style={s.chatTitle}>{selected.otherName}</Text>
       <Text style={s.sub}>{selected.otherTrade}</Text>
      </View>
    </View>
    {onOpenJob?<ConversationJobCards conversationId={selected.id} role={role} onOpenJob={onOpenJob}/>:null}
    {chatError ? <MotionPressable onPress={()=>{void loadThread(selected.id)}} style={s.errorBar}>
     <Text style={s.errorText}>{chatError} · Tap to refresh</Text></MotionPressable> : null}
    <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent}
      keyboardShouldPersistTaps="handled" scrollEventThrottle={100}
      onScroll={(event:any)=>{
        const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;
        stickToBottomRef.current=contentOffset.y+layoutMeasurement.height>=contentSize.height-95;
      }}
      onContentSizeChange={()=>{
        if(stickToBottomRef.current)scrollRef.current?.scrollToEnd({animated:true});
      }}>
      {hasOlder?<MotionPressable disabled={loadingOlder} style={s.more} onPress={()=>{void loadOlder()}}>
       <Text style={s.moreText}>{loadingOlder?'Loading…':'Load earlier messages'}</Text>
      </MotionPressable>:null}
      {loadingThread?<ActivityIndicator color={theme.colors.teal}/>:
       thread.length?thread.map(m=>{
        const mine=m.sender_id===uid;
        return <View key={m.id} style={[s.bubble,mine?s.mine:s.theirs]}>
         {m.attachment_path&&mediaUrls[m.attachment_path]?(
           m.attachment_mime?.startsWith('image/')?
           <Image source={{uri:mediaUrls[m.attachment_path]}}
             style={{width:220,height:190,borderRadius:13,backgroundColor:'#D7E4DF'}}
             resizeMode="contain" accessibilityLabel="Photo attachment" />:
           <MotionPressable onPress={()=>{void Linking.openURL(mediaUrls[m.attachment_path!])
            .catch(()=>Alert.alert('Unable to open document','The attachment link expired. Refresh the conversation to retry.'))}}
             style={{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:8}}
             accessibilityRole="button" accessibilityLabel="Open shared document">
             <FileText size={20} color={mine?'#FFFFFF':theme.colors.teal}/>
             <Text style={[s.body,mine&&s.mineText]}>Open shared document</Text>
           </MotionPressable>
          ):null}
         <Text style={[s.body,mine&&s.mineText]}>{m.body}</Text>
         <View style={s.messageMeta}>
          <Text style={[s.time,mine&&s.mineText]}>{fmt(m.created_at)}</Text>
          {mine?(m.read_at?<CheckCheck color="#C5F6DF" size={13}/>:<Check color="#D5ECE5" size={13}/>):null}
         </View>
        </View>;
       }):<View style={s.emptyChat}><MessageCircle size={30} color={theme.colors.teal}/>
        <Text style={s.emptyTitle}>Start the conversation</Text>
        <Text style={s.sub}>Messages are visible only to you and this person.</Text></View>}
    </ScrollView>
    {otherTyping?<Text style={s.typing}>Typing…</Text>:null}
    <ScrollView horizontal style={s.quickScroller} contentContainerStyle={s.quickRow}
      showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
     {quick.map(t=><MotionPressable key={t} onPress={()=>{setDraft(t);tokenRef.current=null;setChatError('')}}
      style={s.quickChip}><Text style={s.quickText} numberOfLines={1}>{t}</Text></MotionPressable>)}
    </ScrollView>
    {photo?<View style={{paddingHorizontal:12,paddingVertical:9,
      backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',gap:12}}>
      <Image source={{uri:photo.uri}} style={{height:62,width:72,borderRadius:11}} resizeMode="cover"/>
      <View style={{flex:1}}>
        <Text style={{fontSize:13,fontWeight:'800',color:theme.colors.ink}}>Photo ready to send</Text>
        <Text style={{fontSize:11,color:theme.colors.muted}}>Private to this conversation · up to 8 MB</Text>
      </View>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Remove attached photo"
        onPress={()=>{setPhoto(null);tokenRef.current=null;uploadedAttachmentRef.current=null}}>
        <X size={20} color={theme.colors.muted}/>
      </MotionPressable>
    </View>:null}
    {document?<View style={s.documentPreview}>
      <FileText size={23} color={theme.colors.teal}/>
      <View style={{flex:1}}>
       <Text style={{fontSize:13,fontWeight:'800',color:theme.colors.ink}} numberOfLines={1}>{document.name}</Text>
       <Text style={{fontSize:11,color:theme.colors.muted}}>Private attachment · maximum 8 MB</Text>
      </View>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Remove document"
        onPress={()=>{setDocument(null);tokenRef.current=null;uploadedAttachmentRef.current=null}}>
        <X size={20} color={theme.colors.muted}/>
      </MotionPressable>
    </View>:null}
    <View style={s.composer}>
     <MotionPressable onPress={()=>{void pickPhoto()}} disabled={busy}
      accessibilityRole="button" accessibilityLabel="Attach a photo"
      style={{height:44,width:39,alignItems:'center',justifyContent:'center'}}>
       <ImagePlus size={22} color={theme.colors.teal}/>
     </MotionPressable>
     <MotionPressable onPress={()=>{void pickDocument()}} disabled={busy}
      accessibilityRole="button" accessibilityLabel="Attach a PDF or Word document"
      style={{height:44,width:34,alignItems:'center',justifyContent:'center'}}>
      <Paperclip size={20} color={theme.colors.teal}/>
     </MotionPressable>
     <TextInput value={draft} multiline maxLength={4000}
      onChangeText={publishDraft}
      style={s.input} placeholder="Write your message…" placeholderTextColor={theme.colors.muted}
      accessibilityLabel="Message text" textAlignVertical="top"/>
     <MotionPressable style={[s.send,((!draft.trim()&&!photo&&!document)||busy)&&{opacity:.45}]}
       disabled={(!draft.trim()&&!photo&&!document)||busy}
       onPress={()=>{void send()}} accessibilityRole="button" accessibilityLabel="Send message">
      {busy?<ActivityIndicator size="small" color="#FFFFFF"/>:<ArrowUp color="#FFFFFF" size={20}/>}
     </MotionPressable>
    </View>
    <Text style={s.privacy}>Sent messages cannot be edited. Double tick means read.</Text>
  </>:<>
    {!embedded?<View style={s.head}>
     <View style={{flex:1}}><Text style={s.title}>Messages</Text>
      <Text style={s.sub}>{totalUnread?totalUnread+' unread messages':'Your conversations in one place'}</Text></View>
     <MotionPressable style={s.refresh} onPress={()=>{void loadInbox()}}
       accessibilityRole="button" accessibilityLabel="Refresh conversations">
      <RotateCw size={20} color={theme.colors.teal}/>
     </MotionPressable>
    </View>:null}
    <View style={[s.search,embedded&&{marginTop:6}]}>
     <Search size={19} color={theme.colors.muted}/>
     <TextInput value={query} onChangeText={setQuery} placeholder="Search conversations"
      style={{flex:1,fontSize:14,color:theme.colors.ink}} placeholderTextColor={theme.colors.muted}/>
     {embedded?<MotionPressable onPress={()=>{void loadInbox()}}
       accessibilityRole="button" accessibilityLabel="Refresh conversations"
       style={{width:30,height:36,alignItems:'center',justifyContent:'center'}}>
      <RotateCw size={18} color={theme.colors.teal}/>
     </MotionPressable>:null}
    </View>
    {error ? <Text style={s.errorText}>{error}</Text> : null}
    {loadingInbox?<ActivityIndicator style={{marginTop:40}} color={theme.colors.teal}/>:
     <ScrollView contentContainerStyle={{paddingBottom:32,paddingHorizontal:17}}>
      {visible.map(v=><MotionPressable key={v.id} onPress={()=>setSelectedId(v.id)}
        style={s.inboxRow} accessibilityRole="button"
        accessibilityLabel={'Open conversation with '+v.otherName+(v.unread?', '+v.unread+' unread':'')}>
       <View style={s.avatar}><Text style={s.avatarText}>
        {v.otherName.trim().split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}</Text></View>
       <View style={{flex:1,gap:5}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:6}}>
         <Text style={[s.person,v.unread>0&&{fontWeight:'900'}]} numberOfLines={1}>{v.otherName}</Text>
         <Text style={s.date}>{fmt(v.updatedAt)}</Text>
        </View>
        <Text style={s.preview} numberOfLines={2}>{v.lastMessage}</Text>
       </View>
       {v.unread>0?<View style={s.unread}><Text style={s.unreadText}>{v.unread>99?'99+':v.unread}</Text></View>:null}
      </MotionPressable>)}
      {!visible.length?<View style={s.noMessages}>
       <MessageCircle size={35} color={theme.colors.teal}/>
       <Text style={s.emptyTitle}>{query?'No matching conversations':'No messages yet'}</Text>
       <Text style={s.sub}>New conversations appear here when you connect with someone.</Text>
      </View>:null}
     </ScrollView>}
  </>}
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 head:{paddingHorizontal:21,paddingTop:23,paddingBottom:18,flexDirection:'row',alignItems:'center'},
 title:{color:theme.colors.ink,fontSize:28,fontWeight:'900'},sub:{color:theme.colors.muted,fontSize:12,marginTop:4,lineHeight:18},
 refresh:{height:42,width:42,borderRadius:22,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 search:{marginHorizontal:17,marginBottom:14,backgroundColor:'#FFFFFF',borderRadius:17,minHeight:50,paddingHorizontal:15,
  flexDirection:'row',alignItems:'center',gap:9},
 inboxRow:{minHeight:85,borderRadius:19,backgroundColor:'#FFFFFF',padding:12,marginBottom:9,
  flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#ECEBE7'},
 avatar:{height:46,width:46,borderRadius:24,backgroundColor:theme.colors.tealTint,alignItems:'center',justifyContent:'center'},
 avatarText:{fontWeight:'900',color:theme.colors.teal,fontSize:15},
 person:{flex:1,color:theme.colors.ink,fontSize:15,fontWeight:'800'},
 date:{fontSize:10,color:theme.colors.muted},preview:{fontSize:12,color:theme.colors.muted,lineHeight:17},
 unread:{borderRadius:15,minWidth:23,minHeight:23,backgroundColor:theme.colors.teal,alignItems:'center',
  justifyContent:'center',paddingHorizontal:5},
 unreadText:{color:'#FFFFFF',fontWeight:'900',fontSize:10},
 chatHeader:{flexDirection:'row',alignItems:'center',gap:10,minHeight:69,paddingHorizontal:13,
  backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E9EDE8'},
 back:{width:39,height:39,borderRadius:20,alignItems:'center',justifyContent:'center',
  backgroundColor:'#F2F4F0'},
 chatTitle:{fontSize:16,fontWeight:'900',color:theme.colors.ink},
 messages:{flex:1},messagesContent:{paddingHorizontal:14,paddingTop:15,paddingBottom:20,gap:9},
 bubble:{maxWidth:'87%',paddingHorizontal:14,paddingVertical:12,borderRadius:19,gap:6},
 mine:{backgroundColor:theme.colors.darkTeal,alignSelf:'flex-end',borderBottomRightRadius:5},
 theirs:{backgroundColor:'#FFFFFF',alignSelf:'flex-start',borderBottomLeftRadius:5,
  borderWidth:1,borderColor:'#E7EAE5'},
 body:{fontSize:14,lineHeight:21,color:theme.colors.ink},mineText:{color:'#FFFFFF'},
 messageMeta:{flexDirection:'row',justifyContent:'flex-end',gap:5,alignItems:'center'},
 time:{fontSize:10,color:theme.colors.muted},
 composer:{flexDirection:'row',padding:12,paddingBottom:7,alignItems:'flex-end',gap:8,
  backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:'#E6EBE7'},
 input:{flex:1,maxHeight:115,minHeight:44,borderRadius:20,backgroundColor:'#F4F7F5',
  paddingHorizontal:15,paddingTop:11,paddingBottom:10,color:theme.colors.ink,fontSize:14},
 send:{width:44,height:44,borderRadius:22,backgroundColor:theme.colors.darkTeal,justifyContent:'center',alignItems:'center'},
 typing:{color:theme.colors.teal,fontSize:11,paddingHorizontal:18,paddingVertical:5},
 documentPreview:{paddingHorizontal:12,paddingVertical:9,backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',gap:12},
 privacy:{fontSize:10,color:theme.colors.muted,textAlign:'center',backgroundColor:'#FFFFFF',paddingBottom:6},
 quickScroller:{maxHeight:45,flexGrow:0,backgroundColor:'#F3F6F3'},
 quickRow:{alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:7},
 quickChip:{paddingHorizontal:12,paddingVertical:7,borderRadius:18,backgroundColor:'#FFFFFF',
  borderWidth:1,borderColor:'#DAE7E0',maxWidth:265},
 quickText:{fontSize:11,fontWeight:'700',color:theme.colors.teal},
 noMessages:{padding:38,marginTop:22,alignItems:'center',gap:10},
 emptyChat:{alignItems:'center',gap:10,marginTop:70},
 emptyTitle:{fontSize:18,fontWeight:'900',color:theme.colors.ink},
 errorBar:{backgroundColor:'#FFF0EC',padding:10},
 errorText:{color:theme.colors.coralDark,fontWeight:'700',fontSize:12,paddingHorizontal:15,paddingVertical:7},
 more:{alignSelf:'center',padding:10,backgroundColor:'#FFFFFF',borderRadius:12},
 moreText:{fontSize:12,fontWeight:'800',color:theme.colors.teal}
});
