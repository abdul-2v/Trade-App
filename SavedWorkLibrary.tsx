import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Bookmark,Check,ChevronRight,Clock3,Plus,Search,Trash2} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {MotionPressable} from './Motion';
import {theme} from './theme';

export type WorkLine={kind?:'labour'|'material'|'other';description:string;quantity:number;unit_price:number;unit?:string};
export type WorkHistory={items?:WorkLine[];created_at?:string};
export type Preset={id:string;scope:string;document_kind:string;name:string;payload:any;usage_count:number;updated_at:string;pinned:boolean};
export const tradeGroups=[
 {id:'all',label:'All'}, {id:'plumbing',label:'Plumbing'},{id:'electrical',label:'Electrical'},
 {id:'carpentry',label:'Carpentry'},{id:'gardening',label:'Gardening'},
 {id:'painting',label:'Decorating'},{id:'roofing',label:'Roofing'},{id:'general',label:'General'}
];
const commonJobs:Record<string,string[]>={
 plumbing:['Fit radiator','Replace radiator valve','Replace kitchen tap','Repair leaking pipe','Fit toilet'],
 electrical:['Replace double socket','Install ceiling light','Replace light switch','Install fused spur'],
 carpentry:['Hang internal door','Fit skirting board','Install shelving','Repair timber gate'],
 gardening:['Mow lawn','Trim hedge','Garden clearance','Replace fence panel'],
 painting:['Paint bedroom','Paint external door','Prepare and paint woodwork'],
 roofing:['Replace broken roof tile','Repair gutter','Investigate roof leak'],
 general:['Call-out fee','Site inspection','Disposal of waste']
};
export const tradeFor=(description:string)=>{
 const s=description.toLowerCase();
 if(/radiator|boiler|tap|toilet|plumb|leak|pipe|drain|basin|bath|shower|valve/.test(s))return 'plumbing';
 if(/socket|light|switch|fuse|electric|wiring|consumer unit|circuit/.test(s))return 'electrical';
 if(/carpentr|joiner|timber|door|skirting|shelv|cabinet|woodwork/.test(s))return 'carpentry';
 if(/garden|lawn|hedge|fence|mow|weed|tree|grass/.test(s))return 'gardening';
 if(/paint|decorat|wallpaper|plaster/.test(s))return 'painting';
 if(/roof|gutter|tile|flashing/.test(s))return 'roofing';
 return 'general';
};
const money=(n:number)=>'£'+Number(n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const validWork=(line:WorkLine)=>!!String(line.description||'').trim() && Number.isFinite(Number(line.unit_price))&&Number(line.unit_price)>=0;
const key=(line:WorkLine)=>[String(line.kind||'other'),String(line.description||'').toLocaleLowerCase('en-GB').trim().replace(/\s+/g,' '),String(line.unit||'item')].join('|');
const cleanLine=(line:WorkLine):WorkLine=>({kind:line.kind||'other',description:String(line.description||'').trim().slice(0,300),
 quantity:Math.max(0,Number(line.quantity)||1),unit_price:Math.max(0,Number(line.unit_price)||0),unit:line.unit||'item'});
export function pastWorkSuggestions(history:WorkHistory[]):Array<{line:WorkLine;count:number}>{
 const grouped=new Map<string,{line:WorkLine;count:number}>();
 for(const doc of [...history].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))){
  for(const raw of doc.items||[]){
   if(!validWork(raw))continue;
   const line=cleanLine(raw),k=key(line),previous=grouped.get(k);
   if(previous)previous.count++;else grouped.set(k,{line,count:1});
  }
 }
 return [...grouped.values()].sort((a,b)=>b.count-a.count).slice(0,70);
}
export async function saveTradarrPreset(ownerId:string,scope:'line'|'invoice'|'quote'|'document',name:string,payload:object,kind=''){
 if(!ownerId||!name.trim())throw new Error('Sign in and choose a preset name first.');
 const {data,error}=await supabase.from('trade_document_presets').insert({
  owner_id:ownerId,scope,document_kind:kind,name:name.trim().slice(0,120),payload,pinned:false
 }).select('*').single();
 if(error||!data)throw new Error(error?.message||'Could not save preset.');
 return data as Preset;
}
const C=theme.colors;
export function SavedWorkLibrary({ownerId,history,onAdd}:{ownerId:string;history:WorkHistory[];onAdd:(line:WorkLine)=>void}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[presets,setPresets]=useState<Preset[]>([]);
 const [category,setCategory]=useState('all');
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const suggested=useMemo(()=>pastWorkSuggestions(history),[history]);
 const refresh=async()=>{
  if(!ownerId)return;
  setLoading(true);setError('');
  const {data,error}=await supabase.from('trade_document_presets').select('*').eq('owner_id',ownerId).eq('scope','line')
    .order('pinned',{ascending:false}).order('updated_at',{ascending:false}).limit(100);
  if(error)setError(error.message);else setPresets(data as Preset[]||[]);
  setLoading(false);
 };
 useEffect(()=>{if(open)void refresh();},[open,ownerId]);
 const used=async(preset:Preset)=>{
  const line=preset.payload as WorkLine;if(!validWork(line)){Alert.alert('Invalid saved job','This preset does not contain a valid item.');return;}
  onAdd(cleanLine(line));
  const {error}=await supabase.from('trade_document_presets').update({usage_count:Math.min(1000000,(preset.usage_count||0)+1),updated_at:new Date().toISOString()}).eq('id',preset.id).eq('owner_id',ownerId);
  if(error)console.warn('Could not update preset usage:',error.message);
 };
 const remove=(p:Preset)=>Alert.alert('Delete saved work?',p.name,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{
   const {error}=await supabase.from('trade_document_presets').delete().eq('owner_id',ownerId).eq('id',p.id);
   if(error)Alert.alert('Could not delete',error.message);else setPresets(x=>x.filter(row=>row.id!==p.id));
  }}]);
 const query=search.toLowerCase().trim();
 const matchCategory=(description:string,stored='')=>category==='all'||(stored&&tradeGroups.some(x=>x.id===stored)&&stored===category)||tradeFor(description)===category;
 const saved=presets.filter(p=>(!query||[p.name,p.payload?.description,p.document_kind].join(' ').toLowerCase().includes(query))&&
  matchCategory(p.payload?.description||p.name,p.document_kind));
 const recent=suggested.filter(x=>(!query||[x.line.description,x.line.kind].join(' ').toLowerCase().includes(query))&&
  matchCategory(x.line.description)).slice(0,12);
 const starters=(category==='all'?commonJobs.general:commonJobs[category]||[]).filter(name=>!query||name.toLowerCase().includes(query)).slice(0,7);
 return <View style={s.shell}>
   <MotionPressable style={s.header} onPress={()=>setOpen(x=>!x)} accessibilityRole="button"
     accessibilityLabel="Saved work and learned prices" accessibilityState={{expanded:open}}>
    <View style={s.symbol}><Bookmark color={C.teal} size={19}/></View>
    <View style={{flex:1}}><Text style={s.heading}>Saved work & previous prices</Text>
     <Text style={s.subheading}>Reuse your own jobs — every detail stays editable</Text></View>
    <ChevronRight color={C.teal} size={18} style={open?{transform:[{rotate:'90deg'}]}:undefined}/>
   </MotionPressable>
   {open&&<View style={s.body}>
    <View style={s.searchRow}><Search color={C.muted} size={17}/>
     <TextInput style={s.input} placeholder="Search radiator, socket, painting…" placeholderTextColor="#82928F"
      value={search} onChangeText={setSearch} accessibilityLabel="Search previous jobs and saved prices"/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
      {tradeGroups.map(group=><MotionPressable key={group.id} style={[s.categoryChip,category===group.id&&s.categoryChipOn]}
        onPress={()=>setCategory(group.id)} accessibilityRole="button" accessibilityState={{selected:category===group.id}}>
        <Text style={[s.categoryText,category===group.id&&s.categoryTextOn]}>{group.label}</Text>
      </MotionPressable>)}
    </ScrollView>
    {!!error&&<Text style={s.error}>Couldn't load saved presets: {error}</Text>}
    {loading?<ActivityIndicator color={C.teal}/>:null}
    {saved.length?<><Text style={s.group}>SAVED WORK · {saved.length}</Text>
     {saved.map(p=><View key={p.id} style={s.row}>
      <MotionPressable onPress={()=>void used(p)} style={{flex:1}} accessibilityRole="button" accessibilityLabel={'Add '+p.name}>
       <Text style={s.name} numberOfLines={2}>{p.name}</Text>
       <Text style={s.detail}>{money(Number(p.payload?.unit_price))} / {p.payload?.unit||'item'} · Tap to add</Text>
      </MotionPressable>
      <MotionPressable style={s.delete} onPress={()=>remove(p)} accessibilityRole="button" accessibilityLabel={'Delete '+p.name}>
       <Trash2 color={C.muted} size={16}/></MotionPressable>
     </View>)}</>:null}
    {!!recent.length&&<><Text style={s.group}>FROM YOUR PREVIOUS INVOICES & QUOTES</Text>
     {recent.map(({line,count})=><MotionPressable key={key(line)} onPress={()=>onAdd(line)} style={s.row} accessibilityRole="button" accessibilityLabel={'Reuse '+line.description}>
      <Clock3 color={C.teal} size={17}/>
      <View style={{flex:1}}><Text style={s.name} numberOfLines={2}>{line.description}</Text>
       <Text style={s.detail}>Last seen {money(line.unit_price)} / {line.unit||'item'} · {count} use{count===1?'':'s'} · editable</Text></View>
      <Plus color={C.teal} size={18}/>
     </MotionPressable>)}</>}
    {!!starters.length&&<><Text style={s.group}>COMMON JOB STARTERS · SET YOUR OWN PRICE</Text>
      {starters.map(label=><MotionPressable key={label} style={s.row} onPress={()=>onAdd({kind:'labour',description:label,quantity:1,unit_price:0,unit:'job'})}
        accessibilityRole="button" accessibilityLabel={'Add '+label+' without a price'}>
       <Plus size={17} color={C.teal}/><View style={{flex:1}}><Text style={s.name}>{label}</Text>
        <Text style={s.detail}>No preset price · enter your own rate</Text></View><ChevronRight color={C.teal} size={16}/></MotionPressable>)}</>}
    {!loading&&!saved.length&&!recent.length&&category==='all'?<Text style={s.empty}>Your own past prices will show here. Pick a trade above for job starters.</Text>:null}
   </View>}
  </View>;
}
export function SaveWorkPreset({ownerId,line}:{ownerId:string;line:WorkLine}){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false);
 const [category,setCategory]=useState(tradeFor(line.description));
 const save=async()=>{
  if(!validWork(line)||!Number.isFinite(Number(line.quantity))||Number(line.quantity)<=0){
   Alert.alert('Complete the item first','Add a description, quantity and valid price.');return;
  }
  setBusy(true);
  try{await saveTradarrPreset(ownerId,'line',name||line.description,cleanLine(line),category);
   setOpen(false);setName('');Alert.alert('Saved work','This price is now available on your website and app. You can still edit it for every job.');
  }catch(e:any){Alert.alert('Unable to save work',e?.message||String(e));}
  finally{setBusy(false);}
 };
 return <View style={{marginTop:8}}>
  {!open?<MotionPressable style={s.saveButton} onPress={()=>{setName(line.description);setOpen(true)}} accessibilityRole="button">
   <Bookmark size={15} color={C.teal}/><Text style={s.saveText}>Save as reusable job</Text>
  </MotionPressable>:<View style={s.saveEditor}>
   <Text style={s.group}>PRESET NAME</Text>
   <TextInput value={name} onChangeText={setName} maxLength={120} placeholder="e.g. Fit standard radiator" style={s.saveInput}/>
   <Text style={s.group}>TRADE CATEGORY</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
    {tradeGroups.filter(g=>g.id!=='all').map(g=><MotionPressable key={g.id} style={[s.categoryChip,category===g.id&&s.categoryChipOn]}
     onPress={()=>setCategory(g.id)}><Text style={[s.categoryText,category===g.id&&s.categoryTextOn]}>{g.label}</Text></MotionPressable>)}
   </ScrollView>
   <View style={{flexDirection:'row',gap:8}}>
    <MotionPressable onPress={()=>setOpen(false)} style={s.cancel}><Text style={s.saveText}>Cancel</Text></MotionPressable>
    <MotionPressable onPress={()=>void save()} disabled={busy} style={s.confirm}>
     {busy?<ActivityIndicator color="#FFFFFF"/>:<Check color="#FFFFFF" size={16}/>}
     <Text style={{color:'#FFFFFF',fontSize:12,fontWeight:'800'}}>Save price</Text>
    </MotionPressable>
   </View>
  </View>}
 </View>;
}
export function DocumentPresetBar({ownerId,scope,documentKind='',snapshot,onApply}:{ownerId:string;scope:'invoice'|'quote'|'document';
 documentKind?:string;snapshot:object;onApply:(payload:any)=>void}){
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[name,setName]=useState(''),[rows,setRows]=useState<Preset[]>([]);
 const [busy,setBusy]=useState(false);
 const reload=async()=>{
  if(!ownerId)return;
  setBusy(true);
  let query=supabase.from('trade_document_presets').select('*').eq('owner_id',ownerId).eq('scope',scope).order('updated_at',{ascending:false}).limit(50);
  if(scope==='document')query=query.eq('document_kind',documentKind);
  const {data,error}=await query;
  setBusy(false);
  if(error)Alert.alert('Presets unavailable',error.message);else setRows((data||[]) as Preset[]);
 };
 useEffect(()=>{if(open)void reload();},[open,ownerId,scope,documentKind]);
 const save=async()=>{
  if(!name.trim()){Alert.alert('Give this preset a name','For example, Standard radiator installation.');return;}
  setBusy(true);
  try{
   await saveTradarrPreset(ownerId,scope,name,snapshot,documentKind);
   setName('');setSaving(false);await reload();
   Alert.alert('Preset saved','The same preset is now available on the app and website.');
  }catch(e:any){Alert.alert('Could not save preset',e.message||String(e));}finally{setBusy(false);}
 };
 return <View style={s.shell}>
   <MotionPressable style={s.header} onPress={()=>setOpen(x=>!x)} accessibilityRole="button"
    accessibilityLabel="Saved document setups" accessibilityState={{expanded:open}}>
    <View style={s.symbol}><Bookmark color={C.teal} size={19}/></View>
    <View style={{flex:1}}><Text style={s.heading}>My saved {scope==='document'?'document':scope} setups</Text>
     <Text style={s.subheading}>Reuse all fields, then change anything you need</Text></View>
    <ChevronRight color={C.teal} size={18} style={open?{transform:[{rotate:'90deg'}]}:undefined}/>
   </MotionPressable>
   {open&&<View style={s.body}>
    {rows.map(row=><MotionPressable key={row.id} style={s.row} onPress={()=>{onApply(row.payload);setOpen(false)}} accessibilityRole="button" accessibilityLabel={'Use '+row.name}>
     <Bookmark color={C.teal} size={17}/><Text style={[s.name,{flex:1}]}>{row.name}</Text><Plus color={C.teal} size={17}/>
    </MotionPressable>)}
    {!rows.length&&!busy?<Text style={s.empty}>No saved setups yet. Save your current fields to reuse them next time.</Text>:null}
    {saving?<><TextInput style={s.saveInput} placeholder="Preset name" value={name} onChangeText={setName} maxLength={120}/>
      <View style={{flexDirection:'row',gap:8}}>
       <MotionPressable style={s.cancel} onPress={()=>setSaving(false)}><Text style={s.saveText}>Cancel</Text></MotionPressable>
       <MotionPressable style={s.confirm} onPress={()=>void save()} disabled={busy}><Text style={{color:'white',fontWeight:'800'}}>Save setup</Text></MotionPressable>
      </View></>:
      <MotionPressable style={s.saveButton} onPress={()=>setSaving(true)} accessibilityRole="button">
       <Plus color={C.teal} size={17}/><Text style={s.saveText}>Save current fields as preset</Text></MotionPressable>}
   </View>}
  </View>;
}
const s=StyleSheet.create({
 categoryRow:{gap:7,paddingVertical:7,paddingRight:10},
 categoryChip:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:'#F0F5F1'},
 categoryChipOn:{backgroundColor:C.darkTeal},
 categoryText:{fontSize:11,fontWeight:'800',color:C.teal},
 categoryTextOn:{color:'#FFFFFF'},
 shell:{backgroundColor:'#FFFFFF',borderRadius:18,borderWidth:1,borderColor:C.line,marginVertical:10,overflow:'hidden'},
 header:{flexDirection:'row',alignItems:'center',gap:11,padding:13,minHeight:69},
 symbol:{backgroundColor:C.tealTint,width:39,height:39,borderRadius:13,alignItems:'center',justifyContent:'center'},
 heading:{fontSize:13,fontWeight:'800',color:C.ink},
 subheading:{fontSize:11,lineHeight:16,color:C.muted,marginTop:4},
 body:{padding:13,paddingTop:4,borderTopColor:C.line,borderTopWidth:1,gap:8},
 searchRow:{flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:12,borderRadius:13,backgroundColor:'#F6F9F7'},
 input:{flex:1,minHeight:44,color:C.ink,fontSize:13},
 group:{color:C.teal,fontWeight:'800',fontSize:10,letterSpacing:.7,marginTop:10,marginBottom:3},
 row:{flexDirection:'row',gap:10,alignItems:'center',padding:11,borderRadius:12,backgroundColor:'#F7FAF8'},
 name:{fontSize:13,fontWeight:'700',color:C.ink},detail:{color:C.muted,fontSize:10,marginTop:4},
 delete:{padding:8},error:{color:'#A6473D',fontSize:12},empty:{fontSize:12,color:C.muted,lineHeight:18,paddingVertical:9},
 saveButton:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10,paddingHorizontal:8},
 saveText:{fontSize:12,fontWeight:'800',color:C.teal},
 saveEditor:{gap:8,padding:10,backgroundColor:C.tealTint,borderRadius:14},
 saveInput:{borderWidth:1,borderColor:'#C7D9D2',borderRadius:11,padding:11,backgroundColor:'#FFFFFF',fontSize:13,color:C.ink},
 cancel:{padding:11,backgroundColor:'#FFFFFF',borderRadius:11},confirm:{paddingHorizontal:17,paddingVertical:10,borderRadius:11,backgroundColor:C.darkTeal,flexDirection:'row',alignItems:'center',gap:7}
});
