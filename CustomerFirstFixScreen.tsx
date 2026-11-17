import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Image,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {ArrowLeft,Camera,ChevronRight,ClipboardCheck,FileText,Plus,Send,ShieldAlert,Trash2,Wrench} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
const BUCKET='tradarr-firstfix';
type Brief={id:string;customer_id:string;trade:string;title:string;symptoms:string;appliance_model:string|null;
 access_notes:string|null;photo_paths:string[];created_at:string};
const trades=['Plumber','Heating','Electrician','Builder','Locksmith','Carpenter','Roofer'];
const prompts:Record<string,string>={
 Plumber:'When did the leak or issue start? Is the water isolated? Where is the problem?',
 Heating:'What is the make/model? What happens when you use the heating? Are any error codes shown?',
 Electrician:'Which room or circuit is affected? What has stopped working? Do not touch exposed wiring.',
 Builder:'What work is needed? Are there access restrictions or measurements you can provide?'
};
function Field({label,value,onChange,multi,placeholder}:{label:string;value:string;onChange:(v:string)=>void;multi?:boolean;placeholder?:string}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange} multiline={multi}
  textAlignVertical={multi?'top':'center'} placeholder={placeholder} placeholderTextColor="#93A3A5"
  style={[s.input,multi&&{minHeight:104}]}/></View>;
}
function decodeBase64(input:string):ArrayBuffer{
 const raw=input.replace(/\s/g,'');
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 if(raw.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw new Error('The photo could not be read.');
 const bytes=new Uint8Array(Math.floor(raw.length*3/4)-(raw.endsWith('==')?2:raw.endsWith('=')?1:0));
 let at=0;
 for(let i=0;i<raw.length;i+=4){
  const a=chars.indexOf(raw[i]),b=chars.indexOf(raw[i+1]);
  const c=raw[i+2]==='='?0:chars.indexOf(raw[i+2]),d=raw[i+3]==='='?0:chars.indexOf(raw[i+3]);
  if(a<0||b<0||c<0||d<0)throw new Error('Invalid photo data.');
  const value=(a<<18)|(b<<12)|(c<<6)|d;
  bytes[at++]=(value>>16)&255;
  if(raw[i+2]!=='=')bytes[at++]=(value>>8)&255;
  if(raw[i+3]!=='=')bytes[at++]=value&255;
 }
 return bytes.buffer as ArrayBuffer;
}
const makeSummary=(v:Brief)=>[
 v.title,'Trade needed: '+v.trade,'Problem: '+v.symptoms,
 v.appliance_model?'Make/model: '+v.appliance_model:null,
 v.access_notes?'Access/details: '+v.access_notes:null,
 'Photos: '+v.photo_paths.length+' stored privately in Tradarr FirstFix (not automatically sent).'
].filter(Boolean).join('\n');
export default function CustomerFirstFixScreen({goBack,onUseBrief}:{goBack:()=>void;onUseBrief:(trade:string,summary:string)=>void}){
 const [uid,setUid]=useState(''),[rows,setRows]=useState<Brief[]>([]),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false);
 const [creating,setCreating]=useState(false),[selectedId,setSelectedId]=useState<string|null>(null);
 const [trade,setTrade]=useState('Plumber'),[title,setTitle]=useState(''),[symptoms,setSymptoms]=useState('');
 const [model,setModel]=useState(''),[access,setAccess]=useState(''),[photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const selected=rows.find(r=>r.id===selectedId)||null;
 useEffect(()=>{let active=true;(async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;
  if(!id){if(active)setBusy(false);return;}setUid(id);
  const {data,error}=await supabase.from('customer_firstfix_briefs').select('*').eq('customer_id',id)
    .order('created_at',{ascending:false}).limit(100);
  if(active){if(error)Alert.alert('FirstFix unavailable',error.message);else setRows((data||[]) as Brief[]);setBusy(false);}
 })().catch(e=>{if(active){setBusy(false);Alert.alert('Could not load FirstFix',String(e))}});return()=>{active=false};},[]);
 useEffect(()=>{let active=true;const paths=selected?.photo_paths||[];
  (async()=>{const entries=await Promise.all(paths.map(async path=>{
   const {data}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600);
   return [path,data?.signedUrl||''] as const;
  }));if(active)setPhotoUrls(Object.fromEntries(entries));})().catch(()=>{if(active)setPhotoUrls({})});
  return()=>{active=false};
 },[selected?.id,selected?.photo_paths.join('|')]);
 const save=async()=>{
  if(saving||!uid)return;
  if(title.trim().length<3||symptoms.trim().length<8){Alert.alert('Describe the issue','Add a clear issue title and a few details about what is happening.');return;}
  setSaving(true);
  const {data,error}=await supabase.from('customer_firstfix_briefs').insert({
   customer_id:uid,trade,title:title.trim(),symptoms:symptoms.trim(),appliance_model:model.trim()||null,access_notes:access.trim()||null
  }).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Unable to save repair brief',error?.message||'Try again.');return;}
  setRows(old=>[data as Brief,...old]);setSelectedId(data.id);setCreating(false);setTitle('');setSymptoms('');setModel('');setAccess('');
 };
 const uploadPhoto=async()=>{
  if(!selected||!uid||saving)return;
  if(selected.photo_paths.length>=3){Alert.alert('Three photos maximum','Remove a photo before adding another.');return;}
  const permissions=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permissions.granted){Alert.alert('Photo access needed','Allow photo library access to attach a repair photo.');return;}
  const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.55,base64:true});
  if(picked.canceled||!picked.assets?.[0])return;
  const asset=picked.assets[0];
  if(!asset.base64){Alert.alert('Photo unavailable','Your device did not return image data. Try another image.');return;}
  setSaving(true);
  try{
   const binary=decodeBase64(asset.base64);
   if(binary.byteLength>4*1024*1024)throw new Error('Please choose a smaller image (under 4MB).');
   const contentType=asset.mimeType==='image/png'?'image/png':'image/jpeg';
   const extension=contentType==='image/png'?'png':'jpg';
   const path=uid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+extension;
   const upload=await supabase.storage.from(BUCKET).upload(path,binary,{contentType,upsert:false});
   if(upload.error)throw upload.error;
   const {data,error}=await supabase.from('customer_firstfix_briefs').update({
    photo_paths:[...selected.photo_paths,path],updated_at:new Date().toISOString()
   }).eq('id',selected.id).eq('customer_id',uid).select('*').single();
   if(error||!data){await supabase.storage.from(BUCKET).remove([path]);throw error||new Error('Could not save photo to brief.');}
   setRows(old=>old.map(r=>r.id===selected.id?data as Brief:r));
  }catch(e){Alert.alert('Could not attach photo',String(e))}
  finally{setSaving(false);}
 };
 const removePhoto=async(path:string)=>{
  if(!selected||saving)return;
  setSaving(true);
  const {data,error}=await supabase.from('customer_firstfix_briefs')
   .update({photo_paths:selected.photo_paths.filter(p=>p!==path),updated_at:new Date().toISOString()})
   .eq('id',selected.id).eq('customer_id',uid).select('*').single();
  if(error||!data){setSaving(false);Alert.alert('Could not update brief',error?.message||'Try again.');return;}
  setRows(old=>old.map(r=>r.id===selected.id?data as Brief:r));
  const deleted=await supabase.storage.from(BUCKET).remove([path]);
  setSaving(false);
  if(deleted.error)Alert.alert('Photo cleanup pending','The photo is no longer attached to your brief, but removing its stored copy needs another attempt.');
 };
 const deleteBrief=(v:Brief)=>Alert.alert('Delete repair brief?',v.title,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{
    const {error}=await supabase.from('customer_firstfix_briefs').delete().eq('id',v.id).eq('customer_id',uid);
    if(error){Alert.alert('Unable to delete',error.message);return;}
    if(v.photo_paths.length)await supabase.storage.from(BUCKET).remove(v.photo_paths);
    setRows(old=>old.filter(x=>x.id!==v.id));setSelectedId(null);
  }}]);
 return <View style={s.root}><View style={s.head}>
  <MotionPressable style={s.back} onPress={()=>selected?setSelectedId(null):creating?setCreating(false):goBack()}>
   <ArrowLeft size={22} color={C.ink}/></MotionPressable>
  <View style={{flex:1}}><Text style={s.eyebrow}>FIRSTFIX</Text><Text style={s.heading}>{selected?'Repair brief':creating?'Prepare a repair':'Arrive ready'}</Text></View></View>
  {busy?<ActivityIndicator size="large" color={C.teal} style={{marginTop:60}}/>:
   <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
   {!selected&&!creating?<><View style={s.hero}><Camera size={27} color="#D1E6E2"/>
     <Text style={s.heroTitle}>Help your tradesperson prepare before arriving.</Text>
     <Text style={s.heroText}>Create a proper repair brief with symptoms, model details and private photos. Fewer surprises, clearer enquiries.</Text>
    </View><MotionPressable style={s.primary} onPress={()=>setCreating(true)}>
     <Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Prepare a repair brief</Text></MotionPressable>
    <Text style={s.section}>Your repair briefs</Text>
    {rows.length?rows.map(v=><MotionPressable key={v.id} style={s.listRow} onPress={()=>setSelectedId(v.id)}>
      <View style={s.iconBox}><Wrench size={21} color={C.teal}/></View><View style={{flex:1}}>
      <Text style={s.cardTitle}>{v.title}</Text><Text style={s.meta}>{v.trade} · {v.photo_paths.length} photos</Text></View>
      <ChevronRight size={19} color={C.teal}/></MotionPressable>):
     <View style={s.empty}><ClipboardCheck size={31} color={C.teal}/><Text style={s.meta}>No briefs yet. Start with the issue you need fixing.</Text></View>}
    </>:creating?<><Text style={s.intro}>We'll turn your notes into a clear job description. You can attach up to three photos after saving.</Text>
      <Text style={s.section}>Which trade?</Text><ScrollView horizontal contentContainerStyle={s.tradeChips} showsHorizontalScrollIndicator={false}>
      {trades.map(v=><MotionPressable key={v} style={[s.chip,trade===v&&s.chipOn]} onPress={()=>setTrade(v)}>
       <Text style={[s.chipText,trade===v&&s.chipTextOn]}>{v}</Text></MotionPressable>)}</ScrollView>
      <View style={s.card}><Field label="Repair title *" value={title} onChange={setTitle} placeholder="e.g. Leaking radiator valve"/>
       <Field label="What's happening? *" value={symptoms} onChange={setSymptoms} multi placeholder={prompts[trade]||'What happened, where is it, and when did it start?'}/>
       <Field label="Appliance make / model (optional)" value={model} onChange={setModel} placeholder="e.g. Ideal Logic 30, error code F1"/>
       <Field label="Access or site details (optional)" value={access} onChange={setAccess} multi placeholder="e.g. Stopcock location, parking, photos available"/>
      </View><View style={s.warning}><ShieldAlert size={21} color={C.teal}/><Text style={s.warningText}>This is not a diagnosis. Suspected gas leaks or dangerous electrical faults require urgent professional safety advice, not app troubleshooting.</Text></View>
      <MotionPressable disabled={saving} style={s.primary} onPress={()=>{void save()}}>
       {saving?<ActivityIndicator color="#FFFFFF"/>:<><FileText size={19} color="#FFFFFF"/><Text style={s.primaryText}>Save repair brief</Text></>}</MotionPressable>
    </>:selected?<><View style={s.hero}><Text style={s.overline}>REPAIR BRIEF</Text>
      <Text style={s.heroTitle}>{selected.title}</Text><Text style={s.heroText}>{selected.trade} · Prepared for your job request</Text></View>
     <View style={s.card}><Text style={s.cardTitle}>The problem</Text><Text style={s.body}>{selected.symptoms}</Text>
      {selected.appliance_model?<><Text style={s.cardTitle}>Make / model</Text><Text style={s.body}>{selected.appliance_model}</Text></>:null}
      {selected.access_notes?<><Text style={s.cardTitle}>Access notes</Text><Text style={s.body}>{selected.access_notes}</Text></>:null}</View>
     <View style={s.card}><Text style={s.cardTitle}>Your photos · {selected.photo_paths.length}/3</Text>
      <Text style={s.meta}>Photos are stored privately in your account. They are not automatically shared with tradespeople when you post a job.</Text>
      <View style={s.photoGrid}>{selected.photo_paths.map(path=><View key={path} style={s.photo}>
        {photoUrls[path]?<Image source={{uri:photoUrls[path]}} style={s.photoImage}/>:<Camera size={25} color={C.muted}/>}
        <MotionPressable onPress={()=>{void removePhoto(path)}} disabled={saving} style={s.photoDelete}>
         <Trash2 size={15} color={C.coralDark}/></MotionPressable></View>)}</View>
      {selected.photo_paths.length<3?<MotionPressable disabled={saving} style={s.outline} onPress={()=>{void uploadPhoto()}}>
       {saving?<ActivityIndicator color={C.teal}/>:<><Camera size={18} color={C.teal}/><Text style={s.outlineText}>Add a photo</Text></>}</MotionPressable>:null}
     </View>
     <MotionPressable onPress={()=>onUseBrief(selected.trade,selected.title+'\n'+selected.symptoms+
      (selected.appliance_model?'\nModel: '+selected.appliance_model:'')+(selected.access_notes?'\nAccess: '+selected.access_notes:''))}
      style={s.primary}><Send size={18} color="#FFFFFF"/><Text style={s.primaryText}>Use in a job request</Text></MotionPressable>
     <MotionPressable onPress={()=>{void Share.share({message:makeSummary(selected)}).catch(e=>Alert.alert('Unable to share',String(e)))}} style={s.outline}>
       <FileText size={18} color={C.teal}/><Text style={s.outlineText}>Share written brief</Text></MotionPressable>
     <Text style={s.intro}>You'll confirm the booking using the normal Tradarr flow. Images are private to your account unless separately shared by you.</Text>
     <MotionPressable style={s.delete} onPress={()=>deleteBrief(selected)}><Trash2 size={16} color={C.coralDark}/><Text style={s.deleteText}>Delete brief</Text></MotionPressable>
    </>:null}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},head:{flexDirection:'row',alignItems:'center',gap:12,padding:18},
 back:{height:43,width:43,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.4,color:C.teal},heading:{fontSize:25,color:C.ink,fontWeight:'800',marginTop:4},
 page:{padding:19,paddingBottom:45},hero:{backgroundColor:C.darkTeal,padding:22,borderRadius:25,gap:10},
 overline:{color:'#C4E4DD',fontSize:10,letterSpacing:1.4,fontWeight:'800'},
 heroTitle:{fontSize:22,color:'#FFFFFF',fontWeight:'800',lineHeight:29},
 heroText:{fontSize:12,color:'#D3E5E0',lineHeight:20},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:24,marginBottom:12},
 primary:{minHeight:53,paddingHorizontal:15,marginTop:17,backgroundColor:C.darkTeal,borderRadius:27,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
 primaryText:{fontSize:13,color:'#FFFFFF',fontWeight:'800'},
 tradeChips:{gap:7,marginBottom:15,paddingRight:25},
 chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF'},
 chipOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextOn:{color:C.teal},
 intro:{fontSize:12,lineHeight:19,color:C.muted,marginBottom:13},
 card:{backgroundColor:'#FFFFFF',padding:18,borderRadius:23,marginTop:13,...theme.shadow},
 field:{marginBottom:15},label:{fontSize:12,color:C.ink,fontWeight:'800',marginBottom:7},
 input:{fontSize:14,color:C.ink,borderColor:C.line,borderWidth:1,borderRadius:14,
  paddingHorizontal:12,paddingVertical:11,backgroundColor:'#F8FAF9',minHeight:48},
 cardTitle:{fontSize:16,fontWeight:'800',color:C.ink,marginBottom:9},meta:{fontSize:12,color:C.muted,lineHeight:19,marginTop:4},
 body:{fontSize:13,lineHeight:20,color:C.ink,marginBottom:15},
 listRow:{padding:15,backgroundColor:'#FFFFFF',borderRadius:21,marginBottom:10,flexDirection:'row',alignItems:'center',gap:12,...theme.shadow},
 iconBox:{width:43,height:43,backgroundColor:C.tealTint,borderRadius:14,alignItems:'center',justifyContent:'center'},
 empty:{backgroundColor:'#FFFFFF',padding:25,borderRadius:23,alignItems:'center',gap:9},
 warning:{marginTop:13,padding:15,backgroundColor:C.tealTint,borderRadius:17,flexDirection:'row',gap:10,alignItems:'flex-start'},
 warningText:{fontSize:11,color:C.teal,lineHeight:18,flex:1},
 photoGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:15},
 photo:{width:88,height:88,borderRadius:13,backgroundColor:'#EEF3F1',overflow:'hidden',alignItems:'center',justifyContent:'center'},
 photoImage:{width:88,height:88},photoDelete:{position:'absolute',right:0,top:0,backgroundColor:'#FFFFFF',padding:7,borderBottomLeftRadius:10},
 outline:{minHeight:49,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',borderRadius:23,
  backgroundColor:C.tealTint,marginTop:11},
 outlineText:{fontSize:12,fontWeight:'800',color:C.teal},
 delete:{padding:15,alignSelf:'center',flexDirection:'row',gap:8,alignItems:'center',marginTop:12},
 deleteText:{color:C.coralDark,fontWeight:'800',fontSize:12}
});
