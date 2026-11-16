import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,Check,CheckCheck,ChevronRight,MapPin,Package,Plus,Share2,ShoppingCart,Trash2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Item={id:string;name:string;qty:number;unit:string;unit_cost:number;merchant:string;done:boolean};
type Kit={id:string;tradesperson_id:string;name:string;job_address:string|null;items:Item[];created_at:string;updated_at:string};
const pounds=(n:number)=>'£'+Number(n||0).toFixed(2);
const number=(s:string)=>Number(s.replace(',','.'));
function Field({label,value,set,placeholder}:{label:string;value:string;set:(v:string)=>void;placeholder?:string}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={set}
 placeholder={placeholder} placeholderTextColor="#8D9C9C" style={s.input}/></View>;
}
export default function TradeMaterialsScreen({goBack,openMerchants,openProfit,initialKitId}:{
 goBack:()=>void;openMerchants:()=>void;openProfit:()=>void;initialKitId?:string|null;
}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [kits,setKits]=useState<Kit[]>([]),[selectedId,setSelectedId]=useState<string|null>(initialKitId||null);
 const [creating,setCreating]=useState(false),[adding,setAdding]=useState(false);
 const [project,setProject]=useState(''),[address,setAddress]=useState('');
 const [part,setPart]=useState(''),[qty,setQty]=useState('1'),[unit,setUnit]=useState('each'),[cost,setCost]=useState(''),[merchant,setMerchant]=useState('');
 const [busyId,setBusyId]=useState<string|null>(null);
 const selected=kits.find(k=>k.id===selectedId)||null;
 const total=(items:Item[])=>items.reduce((v,i)=>v+i.qty*i.unit_cost,0);
 const remaining=(items:Item[])=>items.filter(i=>!i.done).reduce((v,i)=>v+i.qty*i.unit_cost,0);
 useEffect(()=>{let alive=true;(async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;if(!id||!alive){if(alive)setLoading(false);return;}
  setUid(id);const {data,error}=await supabase.from('trade_material_kits').select('*').eq('tradesperson_id',id).order('created_at',{ascending:false}).limit(100);
  if(!alive)return;if(error)Alert.alert('Could not load materials',error.message);
  setKits((data||[]) as Kit[]);setLoading(false);
 })().catch(e=>{if(alive){Alert.alert('Materials error',String(e));setLoading(false)}});return()=>{alive=false};},[]);
 const create=async()=>{
  if(!uid||saving)return;
  if(!project.trim()){Alert.alert('Name your job','Enter a job or project name first.');return;}
  setSaving(true);
  const {data,error}=await supabase.from('trade_material_kits').insert({tradesperson_id:uid,name:project.trim(),job_address:address.trim()||null,items:[]}).select('*').single();
  setSaving(false);if(error||!data){Alert.alert('Could not create list',error?.message||'Try again.');return;}
  const row=data as Kit;setKits(old=>[row,...old]);setSelectedId(row.id);setCreating(false);setProject('');setAddress('');
 };
 const updateItems=async(kit:Kit,items:Item[])=>{
  if(busyId)return false;setBusyId(kit.id);
  const {data,error}=await supabase.from('trade_material_kits').update({items,updated_at:new Date().toISOString()})
   .eq('id',kit.id).eq('tradesperson_id',uid).select('*').single();
  setBusyId(null);
  if(error||!data){Alert.alert('Could not save materials',error?.message||'Try again.');return false;}
  setKits(old=>old.map(k=>k.id===kit.id?data as Kit:k));return true;
 };
 const addPart=async()=>{
  if(!selected||busyId)return;
  if(!part.trim()||!Number.isFinite(number(qty))||number(qty)<=0||number(qty)>10000
    ||(cost.trim()!==''&&(!Number.isFinite(number(cost))||number(cost)<0||number(cost)>1000000))){
   Alert.alert('Check item','Enter a part name, a positive quantity and a valid estimated unit price.');return;
  }
  const item:Item={id:Date.now()+'-'+Math.round(Math.random()*100000),name:part.trim(),qty:number(qty),
   unit,unit_cost:cost.trim()?Math.round(number(cost)*100)/100:0,merchant:merchant.trim(),done:false};
  if(await updateItems(selected,[...selected.items,item])){
   setPart('');setQty('1');setCost('');setMerchant('');setUnit('each');setAdding(false);
  }
 };
 const remove=(kit:Kit)=>Alert.alert('Delete materials list?',kit.name,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{
   const {error}=await supabase.from('trade_material_kits').delete().eq('id',kit.id).eq('tradesperson_id',uid);
   if(error){Alert.alert('Could not delete',error.message);return;}
   setKits(old=>old.filter(k=>k.id!==kit.id));setSelectedId(null);
  }}]);
 const share=async(kit:Kit)=>{
  const text=[kit.name,kit.job_address||'', 'MATERIALS CHECKLIST',...kit.items.map(i=>
   (i.done?'✓ ':'□ ')+i.qty+' '+i.unit+' '+i.name+(i.merchant?' · '+i.merchant:'')
  )].filter(Boolean).join('\n');
  try{await Share.share({message:text})}catch(e){Alert.alert('Could not share list',String(e))}
 };
 const topSummary=useMemo(()=>({lists:kits.length,items:kits.reduce((n,k)=>n+k.items.filter(i=>!i.done).length,0)}),[kits]);
 return <View style={s.root}>
  <View style={s.header}><MotionPressable style={s.back} onPress={selected?()=>{setSelectedId(null);setAdding(false)}:goBack}>
  <ArrowLeft size={23} color={C.ink}/></MotionPressable><View style={{flex:1}}>
  <Text style={s.eyebrow}>BUSINESS TOOLS</Text><Text style={s.title}>{selected?'Job materials':'Materials planner'}</Text></View>
  {!selected?<MotionPressable onPress={()=>setCreating(x=>!x)} style={s.new}><Plus size={20} color="#FFFFFF"/><Text style={s.newText}>New</Text></MotionPressable>:null}</View>
  {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:65}}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
  {!selected?<>
   <Text style={s.explain}>Never arrive without the right parts. Build a materials list for each job, tick off what you've bought and find merchants nearby.</Text>
   <View style={s.statRow}><View style={s.stat}><Text style={s.statNumber}>{topSummary.lists}</Text><Text style={s.statLabel}>Job lists</Text></View>
    <View style={s.stat}><Text style={s.statNumber}>{topSummary.items}</Text><Text style={s.statLabel}>Items still to buy</Text></View></View>
   {creating?<View style={s.card}><Text style={s.cardTitle}>New job materials list</Text>
   <Field label="Job / project name *" value={project} set={setProject} placeholder="e.g. Kitchen radiator installation"/>
   <Field label="Job address (optional)" value={address} set={setAddress} placeholder="Street or postcode"/>
   <MotionPressable onPress={create} disabled={saving} style={s.primary}>
    {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Create materials list</Text>}</MotionPressable></View>:null}
   <Text style={s.section}>Your job lists</Text>
   {kits.length?kits.map(kit=><MotionPressable key={kit.id} style={s.listCard}
    onPress={()=>{setSelectedId(kit.id);setAdding(false);setCreating(false)}}>
    <View style={s.listIcon}><Package size={23} color={C.teal}/></View><View style={{flex:1}}>
    <Text style={s.listTitle}>{kit.name}</Text><Text style={s.listSubtitle}>{kit.items.filter(i=>i.done).length}/{kit.items.length} bought · {pounds(remaining(kit.items))} remaining est.</Text>
    {kit.job_address?<Text style={s.small}>{kit.job_address}</Text>:null}</View><ChevronRight size={21} color={C.teal}/></MotionPressable>):
    <View style={s.empty}><ShoppingCart size={33} color={C.teal}/><Text style={s.emptyTitle}>No shopping lists yet</Text>
    <Text style={s.emptySub}>Start one for your next job. Keep parts, quantities and preferred suppliers together.</Text>
    <MotionPressable style={s.primary} onPress={()=>setCreating(true)}><Plus size={19} color="#FFFFFF"/><Text style={s.primaryText}>Create first list</Text></MotionPressable></View>}
   <MotionPressable style={s.mapAction} onPress={openMerchants}><MapPin size={19} color={C.teal}/><Text style={s.mapText}>Open nearby merchants map</Text><ChevronRight size={19} color={C.teal}/></MotionPressable>
  </>:<>
   <View style={s.hero}><Text style={s.heroSmall}>JOB MATERIALS</Text><Text style={s.heroTitle}>{selected.name}</Text>
    {selected.job_address?<Text style={s.heroAddress}>{selected.job_address}</Text>:null}
    <View style={s.heroRow}><View><Text style={s.heroMetric}>{selected.items.filter(i=>i.done).length}/{selected.items.length}</Text><Text style={s.heroLabel}>Bought</Text></View>
     <View><Text style={s.heroMetric}>{pounds(remaining(selected.items))}</Text><Text style={s.heroLabel}>Still to buy (est.)</Text></View></View></View>
   <View style={s.actions}><MotionPressable onPress={()=>setAdding(x=>!x)} style={s.mainAction}>
     <Plus size={18} color="#FFFFFF"/><Text style={s.mainActionText}>Add a part</Text></MotionPressable>
    <MotionPressable onPress={()=>share(selected)} style={s.altAction}><Share2 size={18} color={C.teal}/><Text style={s.altActionText}>Share</Text></MotionPressable></View>
   {adding?<View style={s.card}><Text style={s.cardTitle}>What do you need?</Text>
    <Field label="Part or material *" value={part} set={setPart} placeholder="e.g. 15mm copper pipe"/>
    <View style={s.two}><View style={{flex:1}}><Field label="Quantity" value={qty} set={setQty}/></View>
    <View style={{flex:1}}><Field label="Est. unit price (£)" value={cost} set={setCost} placeholder="Optional"/></View></View>
    <Text style={s.label}>Unit</Text><View style={s.units}>{['each','metre','box','pack','roll'].map(x=>
     <MotionPressable key={x} onPress={()=>setUnit(x)} style={[s.unit,unit===x&&s.unitOn]}>
      <Text style={[s.unitText,unit===x&&s.unitTextOn]}>{x}</Text></MotionPressable>)}</View>
    <Field label="Preferred supplier (optional)" value={merchant} set={setMerchant} placeholder="e.g. Screwfix"/>
    <MotionPressable onPress={addPart} disabled={busyId!==null} style={s.primary}>
      {busyId?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Add to checklist</Text>}</MotionPressable></View>:null}
   <Text style={s.section}>Your checklist</Text>
   {selected.items.length?selected.items.map(item=><View style={s.itemRow} key={item.id}>
    <MotionPressable onPress={()=>updateItems(selected,selected.items.map(i=>i.id===item.id?{...i,done:!i.done}:i))}
      style={[s.check,item.done&&s.checkOn]} disabled={busyId!==null} accessibilityRole="checkbox"
      accessibilityState={{checked:item.done}} accessibilityLabel={'Mark '+item.name+' as '+(item.done?'needed':'bought')}>
      {item.done?<Check size={19} color="#FFFFFF"/>:null}</MotionPressable>
    <View style={{flex:1}}><Text style={[s.itemName,item.done&&{textDecorationLine:'line-through',color:C.muted}]}>{item.name}</Text>
      <Text style={s.itemDetail}>{item.qty} {item.unit}{item.merchant?' · '+item.merchant:''}</Text></View>
    <Text style={s.itemMoney}>{item.unit_cost?pounds(item.qty*item.unit_cost):'—'}</Text>
    <MotionPressable onPress={()=>updateItems(selected,selected.items.filter(i=>i.id!==item.id))}
      style={{padding:8}} disabled={busyId!==null}><Trash2 size={17} color={C.coralDark}/></MotionPressable>
   </View>):<View style={s.empty}><CheckCheck size={32} color={C.teal}/><Text style={s.emptyTitle}>Add the parts for this job</Text>
    <Text style={s.emptySub}>Tick parts off as you buy them so nothing gets missed.</Text></View>}
   <View style={s.totalCard}><View style={s.totalRow}><Text style={s.totalLabel}>Full list estimate</Text><Text style={s.totalValue}>{pounds(total(selected.items))}</Text></View>
    <View style={s.totalRow}><Text style={s.totalLabel}>Remaining estimate</Text><Text style={s.totalValue}>{pounds(remaining(selected.items))}</Text></View>
    <Text style={s.fine}>Prices are your estimates, not live merchant quotes. Purchasing an item doesn't automatically record a business expense.</Text></View>
   <MotionPressable onPress={openMerchants} style={s.mapAction}><MapPin size={19} color={C.teal}/><Text style={s.mapText}>Find nearby merchants</Text><ChevronRight size={18} color={C.teal}/></MotionPressable>
   <MotionPressable onPress={openProfit} style={s.mapAction}><ShoppingCart size={19} color={C.teal}/><Text style={s.mapText}>Record actual costs in Job Profit</Text><ChevronRight size={18} color={C.teal}/></MotionPressable>
   <MotionPressable onPress={()=>remove(selected)} style={s.delete}><Trash2 size={17} color={C.coralDark}/><Text style={s.deleteText}>Delete this list</Text></MotionPressable>
  </>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},header:{flexDirection:'row',gap:12,alignItems:'center',paddingHorizontal:20,paddingVertical:15},
 back:{width:44,height:44,borderRadius:24,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:C.teal},title:{fontSize:27,fontWeight:'800',color:C.ink,marginTop:3},
 new:{backgroundColor:C.darkTeal,borderRadius:24,flexDirection:'row',alignItems:'center',gap:6,minHeight:44,paddingHorizontal:15},
 newText:{color:'#FFFFFF',fontWeight:'800'},page:{paddingHorizontal:20,paddingTop:8,paddingBottom:40},
 explain:{color:C.muted,lineHeight:20,fontSize:13,marginBottom:18},
 statRow:{flexDirection:'row',gap:11,marginBottom:15},stat:{flex:1,padding:18,backgroundColor:'#FFFFFF',borderRadius:22,...theme.shadow},
 statNumber:{fontSize:23,fontWeight:'800',color:C.ink},statLabel:{color:C.muted,fontSize:12,marginTop:7},
 section:{color:C.ink,fontSize:19,fontWeight:'800',marginTop:19,marginBottom:13},
 card:{backgroundColor:'#FFFFFF',padding:17,borderRadius:23,marginBottom:15,...theme.shadow},
 cardTitle:{color:C.ink,fontSize:16,fontWeight:'800',marginBottom:14},
 field:{marginBottom:13},label:{color:C.ink,fontSize:12,fontWeight:'800',marginBottom:8},
 input:{minHeight:48,borderRadius:13,backgroundColor:'#F9FBFA',borderWidth:1,borderColor:C.line,paddingHorizontal:13,color:C.ink,fontSize:14},
 primary:{borderRadius:25,backgroundColor:C.darkTeal,minHeight:52,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:12,paddingHorizontal:12},
 primaryText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},
 listCard:{backgroundColor:'#FFFFFF',padding:17,flexDirection:'row',alignItems:'center',gap:13,borderRadius:23,marginBottom:11,...theme.shadow},
 listIcon:{width:46,height:46,borderRadius:16,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 listTitle:{fontSize:16,fontWeight:'800',color:C.ink},listSubtitle:{fontSize:12,color:C.muted,marginTop:5,lineHeight:17},
 small:{fontSize:11,color:C.muted,marginTop:4},empty:{backgroundColor:'#FFFFFF',borderRadius:24,padding:25,alignItems:'center',gap:10},
 emptyTitle:{fontSize:17,fontWeight:'800',color:C.ink},emptySub:{textAlign:'center',color:C.muted,fontSize:12,lineHeight:19},
 mapAction:{minHeight:54,borderRadius:20,paddingHorizontal:15,marginTop:16,backgroundColor:C.tealTint,flexDirection:'row',alignItems:'center',gap:10},
 mapText:{flex:1,color:C.teal,fontWeight:'800',fontSize:13},
 hero:{backgroundColor:C.darkTeal,borderRadius:25,padding:22,marginBottom:15},
 heroSmall:{fontSize:10,color:'#B7D8D5',fontWeight:'800',letterSpacing:1.2},
 heroTitle:{color:'#FFFFFF',fontSize:23,fontWeight:'800',marginTop:6},
 heroAddress:{fontSize:12,color:'#D3E1DF',marginTop:6},
 heroRow:{flexDirection:'row',justifyContent:'space-between',gap:20,marginTop:24},
 heroMetric:{fontSize:22,color:'#FFFFFF',fontWeight:'800'},heroLabel:{fontSize:11,color:'#B7D8D5',marginTop:4},
 actions:{flexDirection:'row',gap:10,marginBottom:8},
 mainAction:{flex:1,backgroundColor:C.darkTeal,borderRadius:18,minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 mainActionText:{color:'#FFFFFF',fontWeight:'800',fontSize:13},
 altAction:{width:105,backgroundColor:C.tealTint,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 altActionText:{color:C.teal,fontWeight:'800',fontSize:12},
 two:{flexDirection:'row',gap:9},units:{flexDirection:'row',gap:7,flexWrap:'wrap',marginBottom:14},
 unit:{paddingHorizontal:11,paddingVertical:9,borderRadius:15,borderColor:C.line,borderWidth:1},
 unitOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 unitText:{fontSize:11,color:C.muted,fontWeight:'800'},unitTextOn:{color:C.teal},
 itemRow:{backgroundColor:'#FFFFFF',borderRadius:18,flexDirection:'row',alignItems:'center',gap:11,padding:13,marginBottom:9},
 check:{width:31,height:31,borderWidth:2,borderColor:'#A1BAB6',borderRadius:11,alignItems:'center',justifyContent:'center'},
 checkOn:{backgroundColor:C.teal,borderColor:C.teal},
 itemName:{fontSize:14,fontWeight:'800',color:C.ink},itemDetail:{fontSize:11,color:C.muted,marginTop:5},
 itemMoney:{fontWeight:'800',fontSize:12,color:C.ink},
 totalCard:{borderRadius:22,padding:18,backgroundColor:'#FFFFFF',marginTop:15},
 totalRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8},
 totalLabel:{fontSize:12,color:C.muted},totalValue:{fontSize:16,fontWeight:'800',color:C.ink},
 fine:{fontSize:10,color:C.muted,lineHeight:16,marginTop:8},
 delete:{alignSelf:'center',flexDirection:'row',alignItems:'center',gap:7,padding:15,marginTop:10},
 deleteText:{color:C.coralDark,fontSize:12,fontWeight:'800'}
});
