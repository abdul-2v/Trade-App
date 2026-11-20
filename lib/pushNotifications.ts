import Constants from 'expo-constants';
import {Platform} from 'react-native';
import {supabase} from './supabase';

const PROJECT_ID='554f9986-4268-42dd-920a-86f765cef9e4';
const EXPO_TOKEN=/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{16,}\]$/;
let cachedToken:string|null=null;

export type PhonePushState='needs_build'|'not_enabled'|'enabled'|'permission_denied';
export function isNativePushBuild(){
  return (Platform.OS==='ios'||Platform.OS==='android') && Constants.appOwnership!=='expo';
}
async function nativeModule(){
  if(!isNativePushBuild()){
    throw new Error('Phone push alerts need a Tradarr development or production build. Expo Go cannot register remote notifications.');
  }
  const Device=await import('expo-device');
  if(!Device.isDevice)throw new Error('Phone push alerts need a real iPhone or Android device.');
  return import('expo-notifications');
}
async function tokenForDevice(requestPermission:boolean):Promise<string|null>{
  const Notifications=await nativeModule();
  if(Platform.OS==='android'){
    await Notifications.setNotificationChannelAsync('default',{
      name:'Tradarr alerts',importance:Notifications.AndroidImportance.MAX,
      vibrationPattern:[0,200,150,200]
    });
  }
  let permission=await Notifications.getPermissionsAsync();
  const allowed=(p:typeof permission)=>p.granted ||
    (Platform.OS==='ios'&&p.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL);
  if(!allowed(permission) && requestPermission){
    permission=await Notifications.requestPermissionsAsync();
  }
  if(!allowed(permission)){
    if(requestPermission)throw new Error('Notifications were not allowed. You can enable Tradarr in your phone settings.');
    return null;
  }
  const projectId=Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas?.projectId as string|undefined) || PROJECT_ID;
  const expoToken=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  if(!EXPO_TOKEN.test(expoToken))throw new Error('The notification service returned an invalid device token.');
  cachedToken=expoToken;
  return expoToken;
}
export async function readPhonePushState():Promise<PhonePushState>{
  if(!isNativePushBuild())return 'needs_build';
  try{
    const Notifications=await nativeModule();
    const permission=await Notifications.getPermissionsAsync();
    const allowed=permission.granted ||
      (Platform.OS==='ios'&&permission.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL);
    if(!allowed)return permission.canAskAgain?'not_enabled':'permission_denied';
    const token=await tokenForDevice(false);
    if(!token)return 'not_enabled';
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return 'not_enabled';
    const {data,error}=await supabase.from('tradarr_push_devices')
      .select('id').eq('user_id',user.id).eq('expo_token',token)
      .eq('enabled',true).maybeSingle();
    if(error)throw error;
    return data?'enabled':'not_enabled';
  }catch{
    return 'not_enabled';
  }
}
export async function enablePhonePush(){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw new Error('Sign in before enabling phone notifications.');
  const token=await tokenForDevice(true);
  if(!token)throw new Error('Phone notification permission was not granted.');
  const {error:prefError}=await supabase.from('profiles')
    .update({notifications_enabled:true}).eq('id',user.id);
  if(prefError)throw new Error('Could not enable account notifications: '+prefError.message);
  const {error}=await supabase.from('tradarr_push_devices').upsert({
    user_id:user.id,expo_token:token,platform:Platform.OS,
    enabled:true,last_seen_at:new Date().toISOString()
  },{onConflict:'expo_token'});
  if(error)throw new Error(error.code==='23505'?
    'This device is registered to another Tradarr account. Sign out of that account and try again.':
    'Could not register this phone: '+error.message);
}
export async function disablePhonePush(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return;
  const token=cachedToken||(isNativePushBuild()?await tokenForDevice(false):null);
  if(!token)return;
  const {error}=await supabase.from('tradarr_push_devices')
    .delete().eq('user_id',user.id).eq('expo_token',token);
  if(error)throw new Error('Unable to disable this device: '+error.message);
  cachedToken=null;
}
// Called BEFORE Supabase logout. Never log or expose the token.
export async function unregisterPhoneBeforeSignOut(){
  if(!isNativePushBuild())return;
  await disablePhonePush();
}
export function notificationIdFromResponse(data:unknown):string|null{
  if(!data||typeof data!=='object'||Array.isArray(data))return null;
  const id=(data as Record<string,unknown>).notificationId;
  return typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)?id:null;
}
