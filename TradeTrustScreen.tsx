import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {ArrowLeft,CheckCircle2,FileCheck2,FileUp,LockKeyhole,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type Kind='identity'|'business'|'insurance'|'qualification';
type Submission={id:string;kind:Kind;status:string;applicant_note:string|null;
 evidence_path:string;review_note:string|null;valid_until:string|null;created_at:string;reviewed_at:string|null};
type Chosen={name:string;uri:string;size:number};
const C=theme.colors;
const kinds:{kind:Kind;title:string;help:string}[]=[
 {kind:'identity',title:'Identity evidence',help:'Confirm the person behind your trading profile.'},
 {kind:'business',title:'Business evidence',help:'For example, a relevant company or business registration document.'},
 {kind:'insurance',title:'Public liability insurance',help:'Provide your policy certificate. Staff must verify the expiry before adding the badge.'},
 {kind:'qualification',title:'Trade qualifications',help:'Submit a trade-specific certificate or qualification for review.'},
];
const label=(status:string)=>({
 submitted:'Submitted for review',reviewing:'Being reviewed',approved:'Approved by staff',
 rejected:'Not approved',revoked:'Approval withdrawn'
} as Record<string,string>)[status]||status;
const fromBytes=(bytes:Uint8Array)=>{
 if(bytes.length>=5&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45)
  return {ext:'pdf',mime:'application/pdf'};
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
  return {ext:'jpg',mime:'image/jpeg'};
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)
  return {ext:'png',mime:'image/png'};
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
  String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {ext:'webp',mime:'image/webp'};
 throw new Error('Choose a genuine PDF, JPEG, PNG or WebP document.');
};
export default function TradeTrustScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState('');
 const [items,setItems]=useState<Submission[]>([]);
 const [busy,setBusy]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [saving,setSaving]=useState(false);
 const [kind,setKind]=useState<Kind>('insurance');
 const [note,setNote]=useState('');
 const [chosen,setChosen]=useState<Chosen|null>(null);
 const [error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setBusy(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw new Error('Sign in as a tradesperson to submit credentials.');
   setUid(user.id);
   const {data,error:readError}=await supabase.from('trade_credential_submissions')
    .select('id,kind,status,applicant_note,evidence_path,review_note,valid_until,created_at,reviewed_at')
    .eq('tradesperson_id',user.id).order('created_at',{ascending:false}).limit(60);
   if(readError)throw readError;
   setItems((data||[]) as Submission[]);setError('');
  }catch(e:any){setError(e?.message||'Unable to load your verification requests.');}
  finally{setBusy(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const pick=async()=>{
  try{
   const res=await DocumentPicker.getDocumentAsync({
    type:['application/pdf','image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false
   });
   if(res.canceled||!res.assets?.[0])return;
   const asset=res.assets[0];
   if(asset.size&&asset.size>8*1024*1024)throw new Error('Files must be under 8 MB.');
   setChosen({name:asset.name,uri:asset.uri,size:asset.size||0});
  }catch(e:any){Alert.alert('File unavailable',e?.message||'Please select another document.');}
 };
 const submit=async()=>{
  if(saving||!uid||!chosen)return;
  if(items.some(x=>x.kind===kind&&['submitted','reviewing'].includes(x.status))){
    Alert.alert('Already in review','That category has an open submission. Wait for the review outcome.');return;
  }
  setSaving(true);
  let path='';
  try{
   const file=new File(chosen.uri);
   if(file.size<8||file.size>8*1024*1024)throw new Error('Select a file between 8 bytes and 8 MB.');
   const bytes=await file.bytes();
   if(bytes.length>8*1024*1024)throw new Error('The selected file is too large.');
   const {ext,mime}=fromBytes(bytes);
   const token=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);
   path=uid+'/'+token+'.'+ext;
   const {error:uploadError}=await supabase.storage.from('tradarr-credentials')
    .upload(path,bytes,{contentType:mime,upsert:false});
   if(uploadError)throw uploadError;
   const {error:submitError}=await supabase.from('trade_credential_submissions')
    .insert({tradesperson_id:uid,kind,evidence_path:path,applicant_note:note.trim()||null});
   if(submitError){
    await supabase.storage.from('tradarr-credentials').remove([path]);
    throw submitError;
   }
   setChosen(null);setNote('');
   await load(true);
   Alert.alert('Evidence submitted','Your document is private and awaiting a staff review. Uploading does not award a verified or insured badge.');
  }catch(e:any){
   Alert.alert('Could not submit evidence',e?.message||'Check your connection and try again.');
  }finally{setSaving(false);}
 };
 const openEvidence=async(row:Submission)=>{
  const {data,error:linkError}=await supabase.storage.from('tradarr-credentials')
   .createSignedUrl(row.evidence_path,180);
  if(linkError||!data?.signedUrl){
   Alert.alert('Could not open document',linkError?.message||'Try again.');return;
  }
  await Linking.openURL(data.signedUrl).catch(()=>{
   Alert.alert('Cannot open document','Your device could not open the file.');
  });
 };
 const active=items.some(x=>x.kind===kind&&['submitted','reviewing'].includes(x.status));
 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={goBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back to business">
    <ArrowLeft size={21} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.overline}>TRUST AND CREDENTIALS</Text>
    <Text style={s.title}>Get verified</Text>
   </View>
  </View>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   <View style={s.hero}>
    <ShieldCheck color="#DAF3EA" size={30}/>
    <Text style={s.heroTitle}>Earn confidence through evidence.</Text>
    <Text style={s.heroSub}>Tradarr reviews credentials before showing verified or insured badges. Documents remain private to you and authorised review staff.</Text>
   </View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {busy?<ActivityIndicator color={C.teal} style={{marginVertical:35}}/>:<>
    <Text style={s.section}>Your submitted evidence</Text>
    {items.length?items.map(item=><View style={s.card} key={item.id}>
      <View style={s.row}>
       <FileCheck2 color={C.teal} size={20}/>
       <View style={{flex:1}}>
        <Text style={s.cardTitle}>{kinds.find(x=>x.kind===item.kind)?.title||item.kind}</Text>
        <Text style={s.muted}>Submitted {new Date(item.created_at).toLocaleDateString('en-GB')}</Text>
       </View>
       <Text style={[s.status,item.status==='approved'&&s.approved]}>{label(item.status)}</Text>
      </View>
      {item.kind==='insurance'&&item.status==='approved'&&item.valid_until?
       <Text style={s.muted}>Approved cover expiry: {new Date(item.valid_until+'T12:00:00').toLocaleDateString('en-GB')}</Text>:null}
      {item.review_note?<Text style={s.note}>Reviewer: {item.review_note}</Text>:null}
      <MotionPressable accessibilityRole="button" onPress={()=>{void openEvidence(item)}}>
       <Text style={s.link}>View your private evidence</Text>
      </MotionPressable>
     </View>):<View style={s.empty}>
      <Text style={s.muted}>No credentials submitted yet. Choose a category below to begin.</Text>
     </View>}
    <Text style={s.section}>Submit a credential</Text>
    <View style={s.card}>
     {kinds.map(option=><MotionPressable key={option.kind} onPress={()=>{setKind(option.kind);setChosen(null)}}
      style={[s.option,kind===option.kind&&s.selected]} accessibilityRole="radio"
      accessibilityState={{checked:kind===option.kind}}>
      <View style={{flex:1}}>
       <Text style={s.cardTitle}>{option.title}</Text>
       <Text style={s.muted}>{option.help}</Text>
      </View>
      {kind===option.kind?<CheckCircle2 color={C.teal} size={20}/>:null}
     </MotionPressable>)}
     {active?<Text style={s.warn}>You already have a {kind} submission awaiting review. Another can be sent once the review is decided.</Text>:null}
     <MotionPressable onPress={()=>{void pick()}} disabled={active||saving} style={s.fileButton}
      accessibilityRole="button"><FileUp size={19} color={C.teal}/>
      <Text style={s.link}>{chosen?chosen.name:'Choose a PDF or image (max 8 MB)'}</Text>
     </MotionPressable>
     <TextInput value={note} onChangeText={setNote} style={s.input} multiline maxLength={1000}
      placeholder="Optional details: provider, qualification title or policy reference"
      placeholderTextColor={C.muted}/>
     <MotionPressable disabled={active||saving||!chosen} onPress={()=>{void submit()}}
      style={[s.primary,(active||saving||!chosen)&&{opacity:.5}]} accessibilityRole="button">
      {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Submit for staff review</Text>}
     </MotionPressable>
    </View>
    <View style={s.footer}><LockKeyhole size={18} color={C.teal}/>
     <Text style={[s.muted,{flex:1}]}>Evidence is not shown on public profiles. Tradarr verification is not a guarantee of workmanship, insurance coverage or regulatory eligibility.</Text>
    </View>
   </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 header:{flexDirection:'row',alignItems:'center',gap:12,padding:17},
 back:{width:43,height:43,backgroundColor:'#FFFFFF',borderRadius:16,justifyContent:'center',alignItems:'center'},
 overline:{fontSize:10,fontWeight:'900',letterSpacing:1,color:theme.colors.teal},
 title:{fontSize:23,fontWeight:'900',color:theme.colors.ink,marginTop:2},
 page:{paddingHorizontal:17,paddingBottom:110,gap:13},
 hero:{backgroundColor:theme.colors.darkTeal,padding:22,borderRadius:22,gap:12},
 heroTitle:{fontSize:21,fontWeight:'900',color:'#FFFFFF'},
 heroSub:{fontSize:12,lineHeight:20,color:'#DCEFE8'},
 card:{backgroundColor:'#FFFFFF',borderRadius:19,padding:16,gap:12},
 empty:{padding:24,borderRadius:18,backgroundColor:'#FFFFFF'},
 section:{fontSize:16,fontWeight:'900',color:theme.colors.ink,marginTop:7},
 cardTitle:{fontSize:13,fontWeight:'800',color:theme.colors.ink},
 muted:{fontSize:11,lineHeight:17,color:theme.colors.muted},
 row:{flexDirection:'row',gap:8,alignItems:'center'},
 status:{fontSize:10,fontWeight:'800',color:'#765820',backgroundColor:'#FFF2DF',padding:8,borderRadius:11,overflow:'hidden',maxWidth:122},
 approved:{color:'#13774B',backgroundColor:'#E0F3E8'},
 note:{fontSize:12,color:theme.colors.ink,backgroundColor:'#EFF6F3',padding:10,borderRadius:12},
 link:{fontSize:12,fontWeight:'900',color:theme.colors.teal,flexShrink:1},
 option:{borderRadius:13,flexDirection:'row',alignItems:'center',padding:12,gap:9,borderWidth:1,borderColor:'#E4EBE8'},
 selected:{backgroundColor:'#F0F7F4',borderColor:theme.colors.teal},
 fileButton:{minHeight:50,borderRadius:14,padding:12,flexDirection:'row',gap:10,alignItems:'center',backgroundColor:'#EFF6F3'},
 input:{minHeight:89,textAlignVertical:'top',borderRadius:14,borderWidth:1,borderColor:'#E1E9E6',padding:13,color:theme.colors.ink},
 primary:{backgroundColor:theme.colors.darkTeal,alignItems:'center',justifyContent:'center',minHeight:51,borderRadius:15},
 primaryText:{color:'#FFFFFF',fontSize:13,fontWeight:'900'},
 footer:{flexDirection:'row',gap:10,padding:12,alignItems:'flex-start'},
 error:{padding:13,borderRadius:12,backgroundColor:'#FFF0E4',color:'#9D422F'},
 warn:{fontSize:12,lineHeight:19,color:'#8B5A1A'}
});
