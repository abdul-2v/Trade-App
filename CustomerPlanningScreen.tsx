import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import {ArrowLeft,Check,ClipboardCheck,HandCoins,Plus,Share2,ShieldCheck,Trash2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';
import {moneyPence,budgetSummary,initialPlan,parsePlan,type Plan,type PlanMode,type PlanRow} from './lib/customerPlanning';
const C=theme.colors;
const copy={
 budget:{title:'Budget planner',sub:'Set your own budget, estimate costs and track what you have spent.',Icon:HandCoins},
 hire:{title:'Hire checklist',sub:'Check the essentials before agreeing to work. This is your own record, not a Tradarr verification.',Icon:ShieldCheck},
 snags:{title:'Snag list',sub:'Record unfinished or faulty work, track fixes and share the remaining list.',Icon:ClipboardCheck}
};
const currency=(p:number)=>'£'+(p/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function CustomerPlanningScreen({userId,mode,goBack,leaveGuard}:{userId:string;mode:PlanMode;goBack:()=>void;leaveGuard:React.RefObject<((leave:()=>void)=>void)|null>}){
 const [plan,setPlan]=useState<Plan>(()=>initialPlan(mode));
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const [newItem,setNewItem]=useState('');
 const busy=useRef(false);
 const key='tradarr:customer-planning:v1:'+userId+':'+mode;
 const config=copy[mode];
 const load=async()=>{
  setLoading(true);setError('');
  try{if(!userId)throw Error('Sign in to save a plan.');const raw=await Storage.getItem(key);setPlan(raw?parsePlan(raw,mode):initialPlan(mode));setDirty(false);}
  catch{setError('Could not read your saved plan. Retry before editing.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[key]);
 const update=(fn:(p:Plan)=>Plan)=>{if(!busy.current){setPlan(fn);setDirty(true);}};
 const editRow=(id:string,patch:Partial<PlanRow>)=>update(p=>({...p,rows:p.rows.map(r=>r.id===id?{...r,...patch}:r)}));
 const add=()=>{const label=newItem.trim();if(!label||plan.rows.length>=100)return;update(p=>({...p,rows:[...p.rows,{id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),label,estimated:'',paid:'',done:false}]}));setNewItem('');};
 const remove=(id:string)=>Alert.alert('Remove this item?','This removes it from your plan.',[{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>update(p=>({...p,rows:p.rows.filter(r=>r.id!==id)}))}]);
 const total=budgetSummary(plan);
 const invalid=mode==='budget'&&(!total||[plan.limit,...plan.rows.flatMap(r=>[r.estimated,r.paid])].some(v=>v!==''&&moneyPence(v)===null));
 const save=async()=>{
  if(busy.current||loading||error||invalid||!userId)return;
  busy.current=true;setSaving(true);
  try{await Storage.setItem(key,JSON.stringify(plan));setDirty(false);}
  catch{Alert.alert('Could not save','Your changes are still here. Try again before leaving.');}
  finally{busy.current=false;setSaving(false);}
 };
 const requestLeave=(leave:()=>void)=>{if(busy.current)return;if(dirty)Alert.alert('Unsaved changes','Save your plan before leaving or discard the changes.',[{text:'Keep editing',style:'cancel'},{text:'Discard',style:'destructive',onPress:leave}]);else leave();};
 useEffect(()=>{
  leaveGuard.current=requestLeave;
  return()=>{leaveGuard.current=null;};
 },[dirty,leaveGuard]);
 const back=()=>requestLeave(goBack);
 const reset=()=>Alert.alert('Reset this plan?','This will clear the saved plan on this device.',[{text:'Cancel',style:'cancel'},{text:'Reset',style:'destructive',onPress:async()=>{
  if(busy.current)return;busy.current=true;setSaving(true);
  try{await Storage.removeItem(key);setPlan(initialPlan(mode));setNewItem('');setDirty(false);}
  catch{Alert.alert('Could not reset','Your existing plan has been kept.');}
  finally{busy.current=false;setSaving(false);}
 }}]);
 const share=async()=>{
  if(invalid)return;
  const heading=plan.title.trim()||config.title;
  const lines=mode==='budget'&&total?[heading,'Budget: '+currency(total.limit),'Estimated incl. contingency: '+currency(total.planned),'Spent: '+currency(total.paid),...plan.rows.map(r=>r.label+': estimate '+currency(moneyPence(r.estimated)||0)+' / spent '+currency(moneyPence(r.paid)||0))]:
   [heading,...plan.rows.map(r=>(r.done?'[Done] ':'[Open] ')+r.label)];
  try{await Share.share({message:lines.join('\n')});}catch{Alert.alert('Could not share','Please try again.');}
 };
 const done=plan.rows.filter(r=>r.done).length;
 return <View style={s.root}>
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   <View style={s.header}><MotionPressable onPress={back} style={s.back} accessibilityLabel="Back to Discover"><ArrowLeft size={23} color={C.ink}/></MotionPressable><View style={{flex:1,minWidth:0}}><Text style={s.eyebrow}>YOUR CUSTOMER TOOLKIT</Text><Text style={s.title}>{config.title}</Text></View></View>
   <Text style={s.sub}>{config.sub}</Text>
   {loading?<ActivityIndicator color={C.teal} style={{margin:20}}/>:error?<View style={s.card}><Text style={s.text}>{error}</Text><MotionPressable style={s.button} onPress={load}><Text style={s.buttonText}>Retry</Text></MotionPressable></View>:<>
    <View style={s.card}><Text style={s.label}>Project or job name (optional)</Text><TextInput value={plan.title} maxLength={100} editable={!saving} onChangeText={title=>update(p=>({...p,title}))} placeholder="e.g. Bathroom renovation" style={s.input} accessibilityLabel="Project or job name"/>
     <Text style={s.note}>Saved on this device for this account. Do not enter passwords, payment details or sensitive personal information.</Text></View>
    {mode==='budget'?<>
     <View style={s.card}><Text style={s.label}>Total budget (£)</Text><TextInput value={plan.limit} keyboardType="decimal-pad" maxLength={12} editable={!saving} onChangeText={limit=>update(p=>({...p,limit}))} style={s.input} placeholder="0.00" accessibilityLabel="Total budget in pounds"/>
      <Text style={s.label}>Contingency reserve</Text><View style={s.chips}>{[0,5,10,15,20].map(n=><MotionPressable key={n} onPress={()=>update(p=>({...p,contingency:n}))} accessibilityRole="radio" accessibilityState={{checked:plan.contingency===n}} style={[s.chip,plan.contingency===n&&s.chipOn]}><Text style={[s.chipText,plan.contingency===n&&{color:C.white}]}>{n}%</Text></MotionPressable>)}</View></View>
     <View style={s.summary}><Text style={s.summaryLabel}>Estimated total including reserve</Text><Text style={s.amount}>{total?currency(total.planned):'—'}</Text><Text style={s.summaryLabel}>{total?'Spent '+currency(total.paid)+' · Reserve '+currency(total.reserve):'Enter valid amounts'}</Text>{total&&total.limit>0?<Text style={s.summaryLabel}>{total.remaining>=0?currency(total.remaining)+' left in planned budget':currency(-total.remaining)+' over planned budget'}</Text>:null}</View>
    </>:<View style={s.summary}><Text style={s.summaryLabel}>{mode==='hire'?'Checks completed':'Items resolved'}</Text><Text style={s.amount}>{done} / {plan.rows.length}</Text><View style={s.track}><View style={[s.fill,{width:(plan.rows.length?done/plan.rows.length*100:0)+'%'}]}/></View><Text style={s.summaryLabel}>{mode==='hire'?'Tick a check only when you have reviewed it yourself.':'Mark an item complete after reviewing the fix.'}</Text></View>}
    <Text style={s.section}>{mode==='budget'?'Cost breakdown':mode==='hire'?'Before you agree':'Outstanding work'}</Text>
    {plan.rows.map(row=><View key={row.id} style={s.card}>
     <View style={s.row}>
      {mode!=='budget'?<MotionPressable style={[s.check,row.done&&s.checkOn]} onPress={()=>editRow(row.id,{done:!row.done})} accessibilityRole="checkbox" accessibilityLabel={row.label} accessibilityState={{checked:row.done}}>{row.done?<Check size={20} color={C.white}/>:null}</MotionPressable>:null}
      <Text style={[s.text,{flex:1,minWidth:0}]}>{row.label}</Text>
      {mode!=='hire'?<MotionPressable onPress={()=>remove(row.id)} style={s.back} accessibilityLabel={'Remove '+row.label}><Trash2 size={18} color={C.coralDark}/></MotionPressable>:null}
     </View>
     {mode==='budget'?<View style={s.row}>{(['estimated','paid'] as const).map(field=><View key={field} style={{flex:1,minWidth:0}}><Text style={s.label}>{field==='estimated'?'Estimated (£)':'Spent (£)'}</Text><TextInput value={row[field]} maxLength={12} editable={!saving} keyboardType="decimal-pad" onChangeText={v=>editRow(row.id,{[field]:v})} placeholder="0.00" accessibilityLabel={row.label+' '+field} style={s.input}/></View>)}</View>:null}
    </View>)}
    {mode!=='hire'?<View style={s.card}><Text style={s.label}>{mode==='budget'?'Add cost item':'Add a snag'}</Text><View style={s.row}><TextInput value={newItem} editable={!saving} onChangeText={setNewItem} maxLength={180} placeholder={mode==='budget'?'e.g. Flooring':'e.g. Door does not close'} style={[s.input,{flex:1}]} accessibilityLabel="New item"/><MotionPressable onPress={add} disabled={!newItem.trim()||saving||plan.rows.length>=100} style={[s.back,{backgroundColor:C.tealTint}]} accessibilityLabel="Add item"><Plus size={24} color={C.teal}/></MotionPressable></View></View>:null}
    {invalid?<Text style={s.error}>Enter non-negative amounts in pounds with up to two decimal places.</Text>:null}
    <View style={s.row}><MotionPressable disabled={invalid||saving} onPress={save} style={[s.button,{flex:1},(invalid||saving)&&{opacity:.5}]} accessibilityLabel="Save plan">{saving?<ActivityIndicator color={C.white}/>:<Text style={s.buttonText}>{dirty?'Save plan':'Save'}</Text>}</MotionPressable><MotionPressable disabled={invalid||saving} onPress={share} style={[s.share,invalid&&{opacity:.5}]} accessibilityLabel="Share plan"><Share2 size={18} color={C.teal}/><Text style={s.text}>Share</Text></MotionPressable></View>
    <Text style={s.note}>{dirty?'Unsaved changes. Use Save to keep your edits.':'Plans are separate from official bookings, payments and approvals.'}</Text>
    <MotionPressable onPress={reset} disabled={saving} style={s.reset} accessibilityLabel="Reset this saved plan"><Trash2 size={16} color={C.coralText}/><Text style={s.error}>Reset plan</Text></MotionPressable>
   </>}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},page:{padding:18,paddingBottom:35,gap:11},header:{flexDirection:'row',alignItems:'center',gap:12},back:{width:44,height:44,borderRadius:22,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.4,color:C.teal},title:{fontFamily:theme.font.editorial,fontSize:28,fontWeight:'800',color:C.ink,letterSpacing:-.7},sub:{fontSize:14,lineHeight:21,color:C.muted,marginBottom:4},card:{borderRadius:20,backgroundColor:C.white,borderWidth:1,borderColor:C.line,padding:13,gap:8},label:{fontSize:12,fontWeight:'700',color:C.ink},input:{minHeight:45,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.soft,paddingHorizontal:12,paddingVertical:9,color:C.ink,fontSize:14},note:{fontSize:11,lineHeight:17,color:C.muted},summary:{backgroundColor:C.darkTeal,borderRadius:22,padding:17,gap:6},summaryLabel:{fontSize:12,lineHeight:18,color:'#C0D1D2'},amount:{fontFamily:theme.font.numeric,fontSize:29,fontWeight:'800',color:C.white},track:{height:6,borderRadius:3,backgroundColor:'#355258',overflow:'hidden'},fill:{height:6,backgroundColor:'#B8DBCC'},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{minHeight:36,paddingHorizontal:12,borderRadius:18,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},chipOn:{backgroundColor:C.darkTeal},chipText:{fontSize:12,fontWeight:'700',color:C.teal},section:{fontSize:18,fontWeight:'800',color:C.ink,marginTop:4},row:{flexDirection:'row',alignItems:'center',gap:10},text:{fontSize:14,fontWeight:'700',color:C.ink},check:{width:44,height:44,borderRadius:13,borderWidth:1,borderColor:C.line,backgroundColor:C.soft,alignItems:'center',justifyContent:'center'},checkOn:{backgroundColor:C.teal},button:{minHeight:49,backgroundColor:C.darkTeal,borderRadius:24,alignItems:'center',justifyContent:'center',paddingHorizontal:16},buttonText:{color:C.white,fontWeight:'800',fontSize:14},share:{minHeight:49,borderRadius:24,backgroundColor:C.white,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:16},reset:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},error:{fontSize:12,color:C.coralText}
});
