import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,ArrowUpRight,ChevronDown,ChevronRight,Plus,Receipt,Trash2,Wallet,TrendingUp,AlertCircle} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type CostKind='materials'|'labour'|'travel'|'subcontractor'|'other';
type Cost={id:string;tradesperson_id:string;invoice_id:string|null;quote_id:string|null;project_label:string|null;category:CostKind;description:string;amount:number;spent_on:string};
type Invoice={id:string;invoice_no:number;customer_name:string;subtotal:number;total:number;status:string;quote_id:string|null};
type Quote={id:string;quote_no:number;title:string;customer_name:string;subtotal:number;total:number;status:string};
type Link={key:string;label:string;subtitle:string;revenue:number;invoiceId:string|null;quoteId:string|null;status:string};
const pounds=(n:number)=>'£'+Number(n||0).toFixed(2);
const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const kindNames:Record<CostKind,string>={materials:'Materials',labour:'Labour / hired help',travel:'Travel / fuel',subcontractor:'Subcontractor',other:'Other'};
const num=(v:string)=>Number(v.replace(',','.'));
function Entry({name,value,onChange,placeholder}:{name:string;value:string;onChange:(v:string)=>void;placeholder?:string}){
 return <View style={s.field}><Text style={s.label}>{name}</Text><TextInput value={value} onChangeText={onChange}
 placeholder={placeholder} placeholderTextColor="#8C9999" style={s.input}/></View>;
}
export default function TradeProfitScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [costs,setCosts]=useState<Cost[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[quotes,setQuotes]=useState<Quote[]>([]);
 const [selected,setSelected]=useState(''),[showPicker,setShowPicker]=useState(false),[adding,setAdding]=useState(false);
 const [category,setCategory]=useState<CostKind>('materials'),[description,setDescription]=useState(''),[amount,setAmount]=useState(''),[spentOn,setSpentOn]=useState(dateToday());
 const [target,setTarget]=useState('30');
 useEffect(()=>{let alive=true;(async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;if(!id||!alive){if(alive)setLoading(false);return;}setUid(id);
  const [c,i,q]=await Promise.all([
   supabase.from('trade_job_costs').select('*').eq('tradesperson_id',id).order('spent_on',{ascending:false}).limit(500),
   supabase.from('trade_invoices').select('id,invoice_no,customer_name,subtotal,total,status,quote_id').eq('tradesperson_id',id).order('created_at',{ascending:false}).limit(100),
   supabase.from('trade_quotes').select('id,quote_no,title,customer_name,subtotal,total,status').eq('tradesperson_id',id).order('created_at',{ascending:false}).limit(100),
  ]);if(!alive)return;if(c.error)Alert.alert('Expenses unavailable',c.error.message);
  setCosts((c.data||[]) as Cost[]);setInvoices((i.data||[]) as Invoice[]);setQuotes((q.data||[]) as Quote[]);setLoading(false);
 })().catch(e=>{if(alive){setLoading(false);Alert.alert('Profit tracker',String(e));}});return()=>{alive=false;};},[]);
 const options:Link[]=useMemo(()=>{
  const existingQuoteIds=new Set(invoices.map(i=>i.quote_id).filter(Boolean));
  return [
   ...invoices.map(i=>({key:'i:'+i.id,label:'Invoice '+String(i.invoice_no).padStart(5,'0'),
    subtitle:i.customer_name+' · '+i.status,revenue:Number(i.subtotal),invoiceId:i.id,quoteId:i.quote_id,status:i.status})),
   ...quotes.filter(q=>!existingQuoteIds.has(q.id)).map(q=>({key:'q:'+q.id,label:'Quote '+String(q.quote_no).padStart(5,'0'),
    subtitle:q.customer_name+' · '+q.title,revenue:Number(q.subtotal),invoiceId:null,quoteId:q.id,status:'estimate'}))
  ];
 },[invoices,quotes]);
 const focus=options.find(o=>o.key===selected)||options[0]||null;
 const linked=costs.filter(c=>focus && (focus.invoiceId===c.invoice_id && !!c.invoice_id || !!focus.quoteId && focus.quoteId===c.quote_id));
 const spent=linked.reduce((s,c)=>s+Number(c.amount),0);
 const contribution=focus?Math.round((focus.revenue-spent)*100)/100:0;
 const margin=focus&&focus.revenue>0?100*contribution/focus.revenue:null;
 const pct=num(target);
 const needed=focus&&Number.isFinite(pct)&&pct<100&&pct>=0?spent/(1-pct/100):0;
 const totals={
  invoiced:invoices.reduce((n,i)=>n+Number(i.subtotal),0),
  collected:invoices.filter(i=>i.status==='paid').reduce((n,i)=>n+Number(i.subtotal),0),
  recorded:costs.reduce((n,i)=>n+Number(i.amount),0),
 };
 const add=async()=>{
  if(saving||!uid)return;
  if(!focus){Alert.alert('Choose a job','Create a quote or invoice first to track costs against it.');return;}
  if(!description.trim()||!Number.isFinite(num(amount))||num(amount)<0||num(amount)>1000000){
   Alert.alert('Check cost','Enter what you purchased or paid and a valid amount.');return;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)||Number.isNaN(Date.parse(spentOn+'T12:00:00'))){Alert.alert('Check date','Use YYYY-MM-DD.');return;}
  setSaving(true);
  const payload={tradesperson_id:uid,invoice_id:focus.invoiceId,quote_id:focus.invoiceId?null:focus.quoteId,
   project_label:focus.subtitle,category,description:description.trim(),amount:Math.round(num(amount)*100)/100,spent_on:spentOn};
  const {data,error}=await supabase.from('trade_job_costs').insert(payload).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Could not save cost',error?.message||'Try again.');return;}
  setCosts(old=>[data as Cost,...old]);setAdding(false);setDescription('');setAmount('');
 };
 const remove=(row:Cost)=>Alert.alert('Remove cost entry?',row.description,[{text:'Cancel',style:'cancel'},{
  text:'Remove',style:'destructive',onPress:async()=>{const {error}=await supabase.from('trade_job_costs').delete().eq('id',row.id).eq('tradesperson_id',uid);
   if(error)Alert.alert('Could not remove',error.message);else setCosts(old=>old.filter(c=>c.id!==row.id));}
 }]);
 return <View style={s.root}>
 <View style={s.header}><MotionPressable style={s.back} onPress={goBack}><ArrowLeft color={C.ink} size={23}/></MotionPressable>
 <View style={{flex:1}}><Text style={s.eyebrow}>BUSINESS TOOLS</Text><Text style={s.title}>Job profit</Text></View></View>
 {loading?<ActivityIndicator color={C.teal} size="large" style={{marginTop:65}}/>:<ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
 <Text style={s.explain}>Know what a job is really worth. Record your actual material, labour and travel costs against each quote or invoice.</Text>
 <View style={s.stats}>
  <View style={s.stat}><Text style={s.statLabel}>Invoiced ex VAT</Text><Text style={s.statAmount}>{pounds(totals.invoiced)}</Text></View>
  <View style={s.stat}><Text style={s.statLabel}>Recorded costs</Text><Text style={s.statAmount}>{pounds(totals.recorded)}</Text></View>
 </View>
 <View style={s.collectNote}><Wallet size={20} color={C.teal}/><Text style={s.collectText}>Marked paid (ex VAT): <Text style={{fontWeight:'800'}}>{pounds(totals.collected)}</Text>. This is based on manually updated invoice statuses.</Text></View>
 {options.length?<>
 <Text style={s.section}>Which job are you checking?</Text>
 <MotionPressable onPress={()=>setShowPicker(!showPicker)} style={s.picker}><View style={{flex:1}}>
 <Text style={s.pickerTitle}>{focus?.label}</Text><Text style={s.pickerSub}>{focus?.subtitle}</Text></View>
 <ChevronDown size={21} color={C.teal}/></MotionPressable>
 {showPicker?<View style={s.pickerList}>{options.map(o=><MotionPressable key={o.key}
 onPress={()=>{setSelected(o.key);setShowPicker(false);setAdding(false)}} style={s.pickerRow}>
 <Text style={s.pickerTitle}>{o.label}</Text><Text style={s.pickerSub}>{o.subtitle}</Text></MotionPressable>)}</View>:null}
 <View style={s.profitPanel}>
 <Text style={s.panelOver}>JOB CONTRIBUTION · BEFORE OVERHEADS & TAX</Text>
 <Text style={[s.heroValue,contribution<0&&linked.length>0&&{color:'#F7B49F'}]}>{linked.length?pounds(contribution):'Add costs to calculate'}</Text>
 <View style={s.profitSplit}><View><Text style={[s.miniLabel,{color:'#BBD5D1'}]}>Sales ex VAT</Text><Text style={s.miniValue}>{pounds(focus?.revenue||0)}</Text></View>
 <View><Text style={[s.miniLabel,{color:'#BBD5D1'}]}>Costs entered</Text><Text style={s.miniValue}>{pounds(spent)}</Text></View>
 <View><Text style={[s.miniLabel,{color:'#BBD5D1'}]}>Gross margin*</Text><Text style={s.miniValue}>{margin===null||!linked.length?'—':margin.toFixed(1)+'%'}</Text></View></View>
 <Text style={s.panelFoot}>*Estimated, only as complete as your entered costs. Excludes unrecorded expenses, overheads and tax. Quotes show potential revenue, not earned income.</Text>
 </View>
 <View style={s.sectionRow}><Text style={s.section}>Job expenses</Text>
 <MotionPressable onPress={()=>setAdding(!adding)} style={s.addSmall}><Plus size={16} color={C.teal}/><Text style={s.addSmallText}>Add cost</Text></MotionPressable></View>
 {adding?<View style={s.card}>
  <Text style={s.cardTitle}>Record an actual job cost</Text>
  <View style={s.kinds}>{(Object.keys(kindNames) as CostKind[]).map(k=><MotionPressable key={k}
   onPress={()=>setCategory(k)} style={[s.kind,category===k&&s.kindOn]}>
   <Text style={[s.kindText,category===k&&s.kindTextOn]}>{kindNames[k]}</Text></MotionPressable>)}</View>
  <Entry name="What was the expense?" value={description} onChange={setDescription} placeholder="e.g. 15mm copper pipe"/>
  <View style={s.two}><View style={{flex:1}}><Entry name="Cost (£)" value={amount} onChange={setAmount} placeholder="26.50"/></View>
   <View style={{flex:1}}><Entry name="Date (YYYY-MM-DD)" value={spentOn} onChange={setSpentOn}/></View></View>
  <Text style={s.helper}>Enter the cost ex VAT if you reclaim VAT; otherwise include non-recoverable VAT. Record each cost only once.</Text>
  <MotionPressable onPress={add} disabled={saving} style={s.primary}>
   {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Save expense</Text>}</MotionPressable>
 </View>:null}
 {linked.length?linked.map(row=><View style={s.expense} key={row.id}>
  <View style={s.expenseIcon}><Receipt size={20} color={C.teal}/></View><View style={{flex:1}}>
  <Text style={s.expenseTitle}>{row.description}</Text><Text style={s.expenseSub}>{kindNames[row.category]} · {row.spent_on}</Text></View>
  <Text style={s.expensePrice}>{pounds(Number(row.amount))}</Text>
  <MotionPressable onPress={()=>remove(row)} style={{padding:8}}><Trash2 size={17} color={C.coralDark}/></MotionPressable>
 </View>):<View style={s.empty}><Receipt size={30} color={C.teal}/><Text style={s.emptyTitle}>No costs entered for this job</Text>
 <Text style={s.emptyText}>Add materials, travel and labour to see a more useful job contribution figure.</Text></View>}
 <View style={s.marginCard}><View style={{flexDirection:'row',alignItems:'center',gap:9,marginBottom:9}}>
  <TrendingUp size={21} color={C.teal}/><Text style={s.cardTitle}>Margin check</Text></View>
 <Text style={s.helper}>Use actual costs to see the sales price required for your target gross margin.</Text>
 <View style={{flexDirection:'row',alignItems:'center',gap:12,marginTop:11}}>
 <View style={{width:96}}><Entry name="Target %" value={target} onChange={setTarget}/></View>
 <View style={{flex:1}}><Text style={s.miniLabel}>Required price ex VAT</Text><Text style={s.marginPrice}>{linked.length?pounds(needed):'—'}</Text></View></View>
 <Text style={s.helper}>Indicative calculation only. £0.00 until costs are recorded; not a recommended market rate.</Text></View>
 </>:<View style={s.empty}><AlertCircle size={32} color={C.teal}/><Text style={s.emptyTitle}>Start by creating a quote or invoice</Text>
 <Text style={s.emptyText}>Job profit links your income and expenses, so create an estimate or invoice first. Then come back to track the costs.</Text></View>}
 </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:15},
 back:{width:45,height:45,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.4,color:C.teal},title:{fontSize:27,fontWeight:'800',color:C.ink,marginTop:3},
 page:{paddingHorizontal:20,paddingTop:8,paddingBottom:40},explain:{color:C.muted,lineHeight:20,fontSize:13,marginBottom:18},
 stats:{flexDirection:'row',gap:11,marginBottom:12},stat:{flex:1,backgroundColor:'#FFFFFF',borderRadius:22,padding:16,...theme.shadow},
 statLabel:{fontSize:12,color:C.muted},statAmount:{fontWeight:'800',fontSize:20,color:C.ink,marginTop:8},
 collectNote:{flexDirection:'row',gap:11,alignItems:'center',backgroundColor:C.tealTint,padding:14,borderRadius:16},
 collectText:{fontSize:12,color:C.teal,lineHeight:18,flex:1},
 section:{fontWeight:'800',fontSize:19,color:C.ink,marginTop:23,marginBottom:12},
 picker:{backgroundColor:'#FFFFFF',borderRadius:19,padding:16,flexDirection:'row',alignItems:'center',gap:10,...theme.shadow},
 pickerTitle:{color:C.ink,fontWeight:'800',fontSize:14},pickerSub:{color:C.muted,fontSize:12,marginTop:5},
 pickerList:{backgroundColor:'#FFFFFF',borderRadius:18,marginTop:5,maxHeight:290},
 pickerRow:{padding:13,borderBottomWidth:1,borderColor:C.line},
 profitPanel:{backgroundColor:C.darkTeal,borderRadius:27,marginTop:16,padding:21},
 panelOver:{color:'#B7DAD6',fontSize:10,fontWeight:'800',letterSpacing:1.2},
 heroValue:{color:'#FFFFFF',fontSize:28,fontWeight:'800',marginTop:9},
 profitSplit:{flexDirection:'row',justifyContent:'space-between',gap:9,marginTop:19},
 miniLabel:{color:C.muted,fontSize:11},miniValue:{color:'#FFFFFF',fontSize:14,fontWeight:'800',marginTop:5},
 panelFoot:{fontSize:10,color:'#BAD0CF',lineHeight:16,marginTop:19},
 sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},addSmall:{flexDirection:'row',gap:4,alignItems:'center',marginTop:17},
 addSmallText:{color:C.teal,fontWeight:'800',fontSize:13},
 card:{backgroundColor:'#FFFFFF',borderRadius:23,padding:18,marginBottom:13,...theme.shadow},
 cardTitle:{fontSize:16,fontWeight:'800',color:C.ink},
 kinds:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:16,marginBottom:15},
 kind:{borderRadius:17,paddingHorizontal:11,paddingVertical:9,borderColor:C.line,borderWidth:1},
 kindOn:{borderColor:C.teal,backgroundColor:C.tealTint},kindText:{color:C.muted,fontSize:11,fontWeight:'800'},kindTextOn:{color:C.teal},
 field:{marginBottom:12},label:{fontSize:12,fontWeight:'800',color:C.ink,marginBottom:7},
 input:{borderColor:C.line,borderWidth:1,borderRadius:12,backgroundColor:'#F8FAF9',minHeight:47,paddingHorizontal:12,color:C.ink,fontSize:14},
 two:{flexDirection:'row',gap:10},helper:{fontSize:11,color:C.muted,lineHeight:18},
 primary:{backgroundColor:C.darkTeal,borderRadius:25,minHeight:53,marginTop:17,alignItems:'center',justifyContent:'center'},
 primaryText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},
 expense:{backgroundColor:'#FFFFFF',borderRadius:19,padding:14,marginBottom:9,flexDirection:'row',alignItems:'center',gap:9},
 expenseIcon:{width:38,height:38,borderRadius:13,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 expenseTitle:{fontWeight:'800',color:C.ink,fontSize:13},expenseSub:{fontSize:11,color:C.muted,marginTop:4},
 expensePrice:{fontWeight:'800',color:C.ink,fontSize:13},
 empty:{alignItems:'center',padding:26,borderRadius:24,backgroundColor:'#FFFFFF',gap:10},
 emptyTitle:{fontSize:16,fontWeight:'800',textAlign:'center',color:C.ink},
 emptyText:{fontSize:12,lineHeight:19,textAlign:'center',color:C.muted},
 marginCard:{backgroundColor:C.tealTint,borderRadius:24,padding:17,marginTop:19},
 marginPrice:{fontWeight:'800',fontSize:23,color:C.teal,marginTop:4}
});
