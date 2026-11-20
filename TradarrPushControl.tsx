import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,StyleSheet,Text,View} from 'react-native';
import {BellRing,CheckCircle2,Smartphone,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {
 readPhonePushState,enablePhonePush,disablePhonePush,
 type PhonePushState
} from './lib/pushNotifications';
import {theme} from './theme';

/** Shared inbox control: explicit opt-in, never ask for permission on mount. */
export default function TradarrPushControl(){
 const [status,setStatus]=useState<PhonePushState|'checking'>('checking');
 const [busy,setBusy]=useState(false);
 const reload=useCallback(async()=>setStatus(await readPhonePushState()),[]);
 useEffect(()=>{
  void reload();
  const listener=AppState.addEventListener('change',state=>{
   if(state==='active')void reload();
  });
  return()=>listener.remove();
 },[reload]);
 const action=async()=>{
  if(busy)return;
  setBusy(true);
  try{
   if(status==='enabled')await disablePhonePush();
   else await enablePhonePush();
   await reload();
  }catch(e:any){
   Alert.alert('Phone notifications',e?.message||'Could not update phone notifications.');
  }finally{setBusy(false);}
 };
 if(status==='checking')return <View style={S.box}><ActivityIndicator color={theme.colors.teal} size="small"/></View>;
 const supported=status!=='needs_build';
 return <View style={S.box}>
   <View style={S.row}>
    <View style={S.icon}><BellRing size={18} color={theme.colors.teal}/></View>
    <View style={{flex:1,gap:4}}>
      <Text style={S.title}>Phone alerts</Text>
      <Text style={S.note}>{status==='enabled'?
       'Registered on this phone. Delivery requires configured Apple/Google push credentials.':
       !supported?'Available in a Tradarr development or App Store build. Expo Go still supports Activity updates.':
       status==='permission_denied'?'Notifications are blocked in your phone settings.':
       'Choose to enable alerts for new messages, requests and appointments.'}</Text>
    </View>
    {status==='enabled'?<CheckCircle2 size={20} color={theme.colors.teal}/>:<Smartphone size={19} color={theme.colors.muted}/>}
   </View>
   {supported?<MotionPressable
     onPress={()=>{if(status==='permission_denied')void Linking.openSettings();
       else void action();}}
     disabled={busy}
     style={S.action}
     accessibilityRole="button"
     accessibilityLabel={status==='enabled'?'Disable phone push alerts for this device':
       status==='permission_denied'?'Open phone notification settings':'Enable phone notifications'}>
     {busy?<ActivityIndicator color="#FFFFFF" size="small"/>:
       <Text style={S.actionText}>{status==='enabled'?'Disable on this phone':
        status==='permission_denied'?'Open phone settings':'Enable phone alerts'}</Text>}
   </MotionPressable>:null}
   <View style={S.privacy}>
     <ShieldCheck size={14} color={theme.colors.teal}/>
     <Text style={S.privacyText}>Optional. Activity and messages remain available in the app. No exact addresses are included in push previews.</Text>
   </View>
 </View>;
}
const S=StyleSheet.create({
 box:{marginHorizontal:16,marginBottom:13,padding:15,borderRadius:18,
  backgroundColor:'#FFFFFF',borderColor:'#E1E9E5',borderWidth:1,gap:12},
 row:{flexDirection:'row',gap:10,alignItems:'center'},
 icon:{height:36,width:36,borderRadius:12,justifyContent:'center',
  alignItems:'center',backgroundColor:theme.colors.tealTint},
 title:{fontSize:14,fontWeight:'900',color:theme.colors.ink},
 note:{fontSize:11,lineHeight:17,color:theme.colors.muted},
 action:{backgroundColor:theme.colors.darkTeal,minHeight:43,borderRadius:13,
  alignItems:'center',justifyContent:'center'},
 actionText:{color:'#FFFFFF',fontWeight:'900',fontSize:12},
 privacy:{flexDirection:'row',alignItems:'flex-start',gap:8},
 privacyText:{fontSize:10,lineHeight:16,flex:1,color:theme.colors.muted}
});
