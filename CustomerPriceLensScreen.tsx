import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {ArrowLeft,BarChart3,CheckCircle,ChevronRight,FileText,Plus,Scale,ShieldCheck,Trash2,TrendingUp} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Trade='Plumber'|'Electrician'|'Builder'|'Heating'|'Locksmith'|'Carpenter'|'Roofer';
const tradeOptions:Trade[]=['Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer'];
type Quote={id:string;name:string;amount:number;vat_included:boolean;included:string;excluded:string;deposit_percent:number};
type Check={id:string;customer_id:string;title:string;trade:string;quotes:Quote[];created_at:string;updated_at:string};
type Received={id:string;job_id:string|null;urgent_request_id:string|null;document:{business_name:string;title:string;total:number;scope_included?:string|null;scope_excluded?:string|null;deposit_percent?:number;vat_rate?:number;quote_no:number};decision:string;delivered_at:string};
type Band={sample_size:number;lower_quartile:number;median:number;upper_quartile:number};
const pounds=(v:number)=>'£'+Number(v||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
function Field({label,value,change,placeholder,multi}:{label:string;value:string;change:(v:string)=>void;placeholder?:string;multi?:boolean}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={change}
  placeholder={placeholder} placeholderTextColor="#94A1A1"
  multiline={multi} textAlignVertical={multi?'top':'center'} style={[s.input,multi&&{height:76}]}/></View>;
}
function Stats({values}:{values:number[]}){
 const sorted=[...values].filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
 if(sorted.length<2)return <Text style={s.noteText}>Add at least two complete quotes to see a price comparison.</Text>;
 const lowest=sorted[0],highest=sorted[sorted.length-1];
 return <View style={s.stats}><View style={s.stat}><Text style={s.statLabel}>Lowest quoted</Text><Text style={s.statNumber}>{pounds(lowest)}</Text></View>
  <View style={s.stat}><Text style={s.statLabel}>Highest quoted</Text><Text style={s.statNumber}>{pounds(highest)}</Text></View>
  <Text style={s.statsNote}>Difference: {pounds(highest-lowest)}. A cheaper quote isn't necessarily better value if scope, VAT or materials differ.</Text></View>;
}
export default function CustomerPriceLensScreen({goBack,openQuoteCentre}:{goBack:()=>void;openQuoteCentre:()=>void}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [checks,setChecks]=useState<Check[]>([]),[received,setReceived]=useState<Received[]>([]);
 const [screen,setScreen]=useState<'list'|'new'|'edit'>('list'),[selectedId,setSelectedId]=useState<string|null>(null);
 const [title,setTitle]=useState(''),[trade,setTrade]=useState<Trade>('Plumber');
 const [name,setName]=useState(''),[amount,setAmount]=useState(''),[included,setIncluded]=useState(''),[excluded,setExcluded]=useState('');
 const [vatIncluded,setVatIncluded]=useState(true),[deposit,setDeposit]=useState('0'),[saving,setSaving]=useState(false);
 const [band,setBand]=useState<Band|null>(null),[bandLoading,setBandLoading]=useState(false);
 const selected=checks.find(x=>x.id===selectedId)||null;
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:user}=await supabase.auth.getUser();if(!user.user){setLoading(false);setRefreshing(false);return;}
  setUid(user.user.id);
  const [c,r]=await Promise.all([
   supabase.from('customer_price_checks').select('*').eq('customer_id',user.user.id).order('updated_at',{ascending:false}).limit(100),
   supabase.from('trade_customer_proposals').select('id,job_id,urgent_request_id,document,decision,delivered_at')
    .eq('customer_id',user.user.id).order('delivered_at',{ascending:false}).limit(100)
  ]);
  if(c.error||r.error)Alert.alert('Could not load prices',c.error?.message||r.error?.message||'Please try again.');
  setChecks((c.data||[]) as Check[]);setReceived((r.data||[]) as Received[]);
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const loadBand=async(t:string)=>{
  setBandLoading(true);setBand(null);
  const {data,error}=await supabase.rpc('tradarr_observed_job_prices',{p_trade:t});
  if(!error&&data?.[0]&&Number(data[0].sample_size)>=8)setBand(data[0] as Band);
  setBandLoading(false);
 };
 useEffect(()=>{void loadBand(selected?.trade||trade);},[selected?.trade,trade]);
 const create=async()=>{
  if(saving||!uid)return;
  if(title.trim().length<3){Alert.alert('Name the work','Describe the job you want to compare.');return;}
  setSaving(true);
  const {data,error}=await supabase.from('customer_price_checks').insert({customer_id:uid,title:title.trim(),trade,quotes:[]}).select('*').single();
  setSaving(false);if(error||!data){Alert.alert('Could not create comparison',error?.message||'Try again.');return;}
  setChecks(old=>[data as Check,...old]);setSelectedId(data.id);setScreen('edit');setTitle('');
 };
 const addQuote=async()=>{
  if(!selected||saving)return;
  const price=Number(amount.trim().replace(',','.')),dep=Number(deposit.trim());
  if(!name.trim()||!Number.isFinite(price)||price<=0||price>1000000||!Number.isFinite(dep)||dep<0||dep>100){
   Alert.alert('Check the quotation','Enter a company name, valid amount and deposit between 0–100%.');return;
  }
  const next=[...(selected.quotes||[]),{id:Date.now().toString(36),name:name.trim(),amount:Math.round(price*100)/100,
    vat_included:vatIncluded,included:included.trim(),excluded:excluded.trim(),deposit_percent:dep}];
  if(next.length>10){Alert.alert('Maximum 10 quotations','Start another comparison for more quotes.');return;}
  setSaving(true);
  const {data,error}=await supabase.from('customer_price_checks').update({quotes:next,updated_at:new Date().toISOString()})
   .eq('id',selected.id).eq('customer_id',uid).select('*').single();
  setSaving(false);if(error||!data){Alert.alert('Unable to save quote',error?.message||'Try again.');return;}
  setChecks(old=>old.map(c=>c.id===selected.id?data as Check:c));setName('');setAmount('');setIncluded('');setExcluded('');setDeposit('0');setVatIncluded(true);
 };
 const deleteQuote=(id:string)=>{
  if(!selected)return;
  Alert.alert('Remove this quote?','This removes it from your private comparison, not the original document.',
   [{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{
    const next=selected.quotes.filter(q=>q.id!==id);
    const {data,error}=await supabase.from('customer_price_checks').update({quotes:next,updated_at:new Date().toISOString()})
     .eq('id',selected.id).eq('customer_id',uid).select('*').single();
    if(error||!data)Alert.alert('Could not remove quote',error?.message||'Try again.');
    else setChecks(old=>old.map(x=>x.id===selected.id?data as Check:x));
   }}]);
 };
 const deleteCheck=()=>{
  if(!selected)return;
  Alert.alert('Delete comparison?',selected.title,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{
   const {error}=await supabase.from('customer_price_checks').delete().eq('id',selected.id).eq('customer_id',uid);
   if(error)Alert.alert('Could not delete',error.message);
   else{setChecks(old=>old.filter(x=>x.id!==selected.id));setSelectedId(null);setScreen('list');}
  }}]);
 };
 const groups=useMemo(()=>{
  const map=new Map<string,Received[]>();
  for(const r of received){
   const key=r.job_id||r.urgent_request_id||r.id;
   const curr=map.get(key)||[];curr.push(r);map.set(key,curr);
  }
  return [...map.values()];
 },[received]);
 const back=()=>screen==='edit'?(setSelectedId(null),setScreen('list')):screen==='new'?setScreen('list'):goBack();
 return <View style={s.root}><View style={s.head}><MotionPressable style={s.back} onPress={back}>
  <ArrowLeft color={C.ink} size={22}/></MotionPressable><View style={{flex:1}}>
   <Text style={s.eyebrow}>PRICE INTELLIGENCE</Text><Text style={s.heading}>{screen==='edit'?'Price comparison':screen==='new'?'New price check':'Price Lens'}</Text>
  </View>{screen==='list'?<MotionPressable onPress={()=>setScreen('new')} style={s.new}><Plus color="#FFFFFF" size={18}/><Text style={s.newText}>New</Text></MotionPressable>:null}</View>
  {loading?<ActivityIndicator color={C.teal} size="large" style={{marginTop:70}}/>:
  <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
  {screen==='list'?<>
    <View style={s.hero}><Scale color="#CBE8E1" size={25}/>
     <Text style={s.heroTitle}>Compare the actual work, not just the total.</Text>
     <Text style={s.heroSub}>Understand what's included, spot missing details and keep your competing quotes together.</Text></View>
    <Text style={s.section}>Quotes received in Tradarr</Text>
    {groups.length?groups.map((g,i)=><View key={i} style={s.card}><Text style={s.cardTitle}>{g[0].document.title}</Text>
      <Text style={s.meta}>{g.length} quotation{g.length===1?'':'s'} received</Text>
      {g.map(q=><View key={q.id} style={s.quoteRow}><View style={{flex:1}}>
       <Text style={s.quoteName}>{q.document.business_name}</Text>
       <Text style={s.meta}>{q.document.scope_included?'Included work described':'Included work not specified'} · {q.document.scope_excluded?'Exclusions listed':'Exclusions not specified'}</Text>
       </View><Text style={s.price}>{pounds(q.document.total)}</Text></View>)}
      <Stats values={g.map(x=>Number(x.document.total))}/>
      <MotionPressable onPress={openQuoteCentre} style={s.textAction}><Text style={s.textActionText}>Review original proposals</Text><ChevronRight size={17} color={C.teal}/></MotionPressable>
     </View>):<View style={s.empty}><FileText size={29} color={C.teal}/>
      <Text style={s.meta}>No proposals delivered inside Tradarr yet. You can still compare quotes you've received elsewhere.</Text></View>}
    <Text style={s.section}>My saved comparisons</Text>
    {checks.length?checks.map(q=><MotionPressable key={q.id} onPress={()=>{setSelectedId(q.id);setScreen('edit')}} style={s.listCard}>
      <View style={s.iconBox}><BarChart3 color={C.teal} size={22}/></View><View style={{flex:1}}>
       <Text style={s.quoteName}>{q.title}</Text><Text style={s.meta}>{q.trade} · {q.quotes.length} quotes entered</Text>
      </View><ChevronRight color={C.teal} size={20}/></MotionPressable>):
      <View style={s.empty}><TrendingUp color={C.teal} size={29}/><Text style={s.meta}>No saved comparisons yet. Add quotes from two companies to see the differences clearly.</Text>
      <MotionPressable onPress={()=>setScreen('new')} style={s.primary}><Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Start a comparison</Text></MotionPressable></View>}
   </>:screen==='new'?<>
    <Text style={s.intro}>Compare contractor offers for the same job. This doesn't publish the prices or share any private details.</Text>
    <View style={s.card}><Field label="Job name *" value={title} change={setTitle} placeholder="e.g. Replace three radiators"/>
      <Text style={s.label}>Trade category</Text>
      <View style={s.chips}>{tradeOptions.map(t=><MotionPressable key={t} onPress={()=>setTrade(t)} style={[s.chip,trade===t&&s.chipSelected]}>
       <Text style={[s.chipText,trade===t&&s.chipTextSelected]}>{t}</Text></MotionPressable>)}</View>
      <MotionPressable onPress={()=>{void create()}} disabled={saving} style={s.primary}>
       {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Create price check</Text>}</MotionPressable>
     </View>
   </>:selected?<>
    <View style={s.hero}><Text style={s.heroMini}>PRIVATE PRICE CHECK · {selected.trade.toUpperCase()}</Text>
      <Text style={s.heroTitle}>{selected.title}</Text><Text style={s.heroSub}>{selected.quotes.length} quotation{selected.quotes.length===1?'':'s'} compared</Text></View>
    <View style={s.card}><Text style={s.cardTitle}>Quote comparison</Text><Stats values={selected.quotes.map(q=>q.amount)}/>
      {selected.quotes.length?selected.quotes.map((q,index)=><View key={q.id} style={s.quoteDetail}>
       <View style={s.row}><View style={{flex:1}}><Text style={s.quoteName}>{q.name}</Text>
        <Text style={s.meta}>Quote {index+1} · {q.vat_included?'VAT included or not applicable':'VAT not included / unknown'}</Text>
       </View><Text style={s.price}>{pounds(q.amount)}</Text>
       <MotionPressable onPress={()=>deleteQuote(q.id)} style={{padding:7}}><Trash2 color={C.coralDark} size={17}/></MotionPressable></View>
       {q.included?<Text style={s.scope}><Text style={s.scopeLabel}>Includes: </Text>{q.included}</Text>:<Text style={s.warning}>Included work not specified</Text>}
       {q.excluded?<Text style={s.scope}><Text style={s.scopeLabel}>Excludes: </Text>{q.excluded}</Text>:<Text style={s.warning}>Exclusions not specified</Text>}
       <Text style={s.meta}>Deposit requested: {q.deposit_percent}%</Text>
      </View>):<Text style={s.noteText}>Add your first quote below.</Text>}
      {selected.quotes.some(q=>!q.vat_included)&&selected.quotes.some(q=>q.vat_included)?
        <Text style={s.warning}>Different VAT treatment: totals may not be directly comparable.</Text>:null}
     </View>
    <View style={s.card}><Text style={s.cardTitle}>Add another quotation</Text>
     <Field label="Company or tradesperson *" value={name} change={setName} placeholder="e.g. ABC Plumbing"/>
     <Field label="Quoted amount (£) *" value={amount} change={setAmount} placeholder="350.00"/>
     <Field label="What's included?" value={included} change={setIncluded} multi placeholder="e.g. Supply, fitting and testing"/>
     <Field label="What's not included?" value={excluded} change={setExcluded} multi placeholder="e.g. Disposal of old radiators"/>
     <Field label="Deposit requested (%)" value={deposit} change={setDeposit} placeholder="0"/>
     <View style={s.switchRow}><View style={{flex:1}}><Text style={s.label}>Amount includes applicable VAT</Text>
        <Text style={s.meta}>Turn off if VAT will be added or isn't confirmed</Text></View>
        <Switch value={vatIncluded} onValueChange={setVatIncluded} trackColor={{true:C.teal}}/></View>
     <MotionPressable disabled={saving||selected.quotes.length>=10} onPress={()=>{void addQuote()}} style={s.primary}>
      {saving?<ActivityIndicator color="#FFFFFF"/>:<><Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Save quotation</Text></>}</MotionPressable>
    </View>
    <View style={s.card}>
      <View style={s.row}><BarChart3 color={C.teal} size={21}/><Text style={s.cardTitle}>Recorded Tradarr job prices</Text></View>
      {bandLoading?<ActivityIndicator color={C.teal}/>:band?
       <><Text style={s.meta}>{band.sample_size} separate {selected.trade.toLowerCase()} jobs recorded as completed with invoices marked paid in the last 24 months. Different job sizes and scopes may be included.</Text>
       <View style={s.bandRow}><View><Text style={s.statLabel}>Lower quartile</Text><Text style={s.bandValue}>{pounds(band.lower_quartile)}</Text></View>
        <View><Text style={s.statLabel}>Median</Text><Text style={s.bandValue}>{pounds(band.median)}</Text></View>
        <View><Text style={s.statLabel}>Upper quartile</Text><Text style={s.bandValue}>{pounds(band.upper_quartile)}</Text></View></View>
       <Text style={s.noteText}>These are observed totals from unrelated jobs, not a recommended price for your specific work.</Text></>:
       <Text style={s.noteText}>Not enough completed, paid-recorded Tradarr jobs in this trade to show a responsible public price range yet (minimum eight jobs).</Text>}
     </View>
    <View style={s.tip}><ShieldCheck size={21} color={C.teal}/><Text style={s.tipText}>Price Lens never claims the lowest quote is the best. Check credentials, insurance, scope, VAT, deposit and warranties before agreeing.</Text></View>
    <MotionPressable onPress={deleteCheck} style={s.delete}><Trash2 color={C.coralDark} size={17}/><Text style={s.deleteText}>Delete comparison</Text></MotionPressable>
   </>:null}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},head:{padding:18,flexDirection:'row',alignItems:'center',gap:12},
 back:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',color:C.teal,letterSpacing:1.4},heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:3},
 new:{backgroundColor:C.darkTeal,borderRadius:22,paddingHorizontal:13,minHeight:43,alignItems:'center',flexDirection:'row',gap:6},
 newText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},page:{padding:19,paddingBottom:50},
 hero:{padding:23,borderRadius:25,backgroundColor:C.darkTeal,gap:10},
 heroTitle:{fontSize:22,fontWeight:'800',lineHeight:29,color:'#FFFFFF'},
 heroSub:{fontSize:12,color:'#D4E7E3',lineHeight:19},heroMini:{fontSize:10,letterSpacing:1.2,fontWeight:'800',color:'#C3E6E0'},
 section:{fontSize:18,color:C.ink,fontWeight:'800',marginTop:22,marginBottom:12},
 card:{backgroundColor:'#FFFFFF',padding:18,borderRadius:22,marginBottom:11,...theme.shadow},
 cardTitle:{color:C.ink,fontSize:16,fontWeight:'800'},
 listCard:{padding:15,backgroundColor:'#FFFFFF',borderRadius:21,flexDirection:'row',alignItems:'center',gap:11,marginBottom:10,...theme.shadow},
 iconBox:{width:43,height:43,borderRadius:15,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 empty:{backgroundColor:'#FFFFFF',padding:21,borderRadius:23,gap:10,alignItems:'center'},
 meta:{fontSize:11,color:C.muted,lineHeight:18,marginTop:5},
 quoteRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomColor:C.line,borderBottomWidth:1},
 quoteDetail:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:C.line},
 quoteName:{fontSize:13,fontWeight:'800',color:C.ink},price:{fontSize:15,fontWeight:'800',color:C.ink},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:12,paddingTop:11},
 stat:{flex:1,minWidth:100,backgroundColor:C.tealTint,borderRadius:17,padding:13},
 statLabel:{fontSize:10,color:C.teal,fontWeight:'800'},statNumber:{fontSize:19,color:C.ink,fontWeight:'800',marginTop:7},
 statsNote:{fontSize:11,color:C.muted,lineHeight:18,marginTop:3},
 textAction:{marginTop:12,flexDirection:'row',alignItems:'center',gap:7},
 textActionText:{color:C.teal,fontSize:12,fontWeight:'800'},
 intro:{color:C.muted,fontSize:12,lineHeight:19,marginBottom:14},
 field:{marginBottom:14},label:{fontSize:12,color:C.ink,fontWeight:'800',marginBottom:7},
 input:{backgroundColor:'#F8FAF9',borderWidth:1,borderColor:C.line,borderRadius:14,paddingHorizontal:12,
  paddingVertical:10,minHeight:47,fontSize:14,color:C.ink},
 chips:{flexDirection:'row',gap:7,flexWrap:'wrap',marginBottom:15},
 chip:{borderWidth:1,borderColor:C.line,borderRadius:18,paddingHorizontal:12,paddingVertical:9},
 chipSelected:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextSelected:{color:C.teal},
 primary:{minHeight:53,backgroundColor:C.darkTeal,borderRadius:25,marginTop:12,paddingHorizontal:13,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 primaryText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
 row:{flexDirection:'row',alignItems:'center',gap:9},scope:{fontSize:12,lineHeight:19,color:C.ink,marginTop:8},
 scopeLabel:{fontWeight:'800',color:C.teal},warning:{fontSize:11,color:C.coralDark,marginTop:7,lineHeight:17},
 noteText:{fontSize:11,color:C.muted,lineHeight:18,marginTop:10},
 switchRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:8},
 bandRow:{flexDirection:'row',justifyContent:'space-between',gap:7,marginTop:17},bandValue:{fontSize:17,fontWeight:'800',color:C.ink,marginTop:6},
 tip:{padding:14,borderRadius:19,backgroundColor:C.tealTint,flexDirection:'row',gap:11,marginTop:10},
 tipText:{flex:1,fontSize:11,color:C.teal,lineHeight:18},
 delete:{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'center',marginTop:14,padding:14},
 deleteText:{fontSize:12,fontWeight:'800',color:C.coralDark}
});
