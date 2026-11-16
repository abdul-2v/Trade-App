import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CheckCircle2,ChevronRight,FileText,MessageSquare,Scale,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import {formatTradeQuantity} from './lib/documentUnits';

const C=theme.colors;
type Decision='pending'|'accepted'|'declined'|'changes_requested';
type QuoteLine={kind:string;description:string;quantity:number;unit:string;unit_price:number};
type Extra={name:string;price:number};
type QuoteDocument={
 quote_no:number;quote_date:string;valid_until:string;business_name:string;business_address:string;
 business_email?:string|null;business_phone?:string|null;customer_name:string;
 title:string;description?:string|null;scope_included?:string|null;scope_excluded?:string|null;
 estimated_duration?:string|null;items?:QuoteLine[];subtotal:number;vat_rate:number;vat_amount:number;total:number;
 deposit_percent?:number;notes?:string|null;optional_extras?:Extra[];
};
type Delivered={
 id:string;quote_id:string;tradesperson_id:string;customer_id:string;job_id:string|null;
 urgent_request_id:string|null;document:QuoteDocument;decision:Decision;feedback:string|null;
 delivered_at:string;responded_at:string|null;
};
const money=(n:number)=>'£'+Number(n||0).toFixed(2);
const dd=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})};
const stateLabel:Record<Decision,string>={pending:'Awaiting your response',accepted:'Accepted',declined:'Declined',changes_requested:'Changes requested'};
function Detail({label,value}:{label:string;value?:string|null}){return value?
 <View style={s.detail}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailBody}>{value}</Text></View>:null;}
export default function CustomerQuotesScreen({goBack,openActivity}:{goBack:()=>void;openActivity:()=>void}){
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [rows,setRows]=useState<Delivered[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [working,setWorking]=useState(false),[feedback,setFeedback]=useState(''),[editingFeedback,setEditingFeedback]=useState(false);
 const [showCompare,setShowCompare]=useState(false),[error,setError]=useState('');
 const chosen=rows.find(x=>x.id===selected)||null;
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user){setError('Please sign in again to view your quotes.');setRows([]);setLoading(false);setRefreshing(false);return;}
  const {data,error:e}=await supabase.from('trade_customer_proposals')
   .select('id,quote_id,tradesperson_id,customer_id,job_id,urgent_request_id,document,decision,feedback,delivered_at,responded_at')
   .eq('customer_id',auth.user.id).order('delivered_at',{ascending:false}).limit(100);
  if(e)setError(e.message);else{setRows((data||[]) as Delivered[]);setError('');}
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const comparable=useMemo(()=>chosen?rows.filter(x=>x.id!==chosen.id&&
  (chosen.job_id&&x.job_id===chosen.job_id||chosen.urgent_request_id&&x.urgent_request_id===chosen.urgent_request_id)
 ):[],[rows,chosen]);
 const decide=async(decision:Exclude<Decision,'pending'>)=>{
  if(!chosen||chosen.decision!=='pending'||working)return;
  if(decision==='changes_requested'&&!feedback.trim()){Alert.alert('Describe your changes','Explain what needs changing before sending your request.');return;}
  const submit=async()=>{
   setWorking(true);
   const {data:auth}=await supabase.auth.getUser();
   if(!auth.user){Alert.alert('Sign in required');setWorking(false);return;}
   const {data,error:e}=await supabase.from('trade_customer_proposals')
    .update({decision,feedback:feedback.trim()||null}).eq('id',chosen.id)
    .eq('customer_id',auth.user.id).eq('decision','pending')
    .select('id,quote_id,tradesperson_id,customer_id,job_id,urgent_request_id,document,decision,feedback,delivered_at,responded_at').single();
   setWorking(false);
   if(e||!data){Alert.alert('Could not respond',e?.message||'This quote may already have been answered. Refresh and try again.');return;}
   setRows(old=>old.map(row=>row.id===chosen.id?data as Delivered:row));
   setEditingFeedback(false);setFeedback('');
   Alert.alert(decision==='accepted'?'Quote accepted':decision==='declined'?'Quote declined':'Changes requested',
     decision==='accepted'?'Your acceptance is recorded. Confirm the start date and deposit arrangements with the tradesperson.':'Your response is saved for the tradesperson to review.');
  };
  if(decision==='accepted'||decision==='declined'){
   Alert.alert(decision==='accepted'?'Accept this quotation?':'Decline this quotation?',
    decision==='accepted'?'You are approving the proposed work for '+money(chosen.document.total)+'. No payment will be taken by Tradarr.':
     'This will record that you do not wish to proceed with this quotation.',
    [{text:'Cancel',style:'cancel'},{text:decision==='accepted'?'Accept quote':'Decline',onPress:()=>{void submit()}}]);
  }else await submit();
 };
 return <View style={s.root}>
   <View style={s.header}>
     <MotionPressable onPress={selected?()=>{setSelected(null);setShowCompare(false)}:goBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
       <ArrowLeft size={22} color={C.ink}/></MotionPressable>
     <View style={{flex:1}}><Text style={s.overline}>YOUR JOBS</Text>
       <Text style={s.heading}>{selected?'Review quotation':'Quote Centre'}</Text></View>
   </View>
   {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:70}}/>:
   <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
    {error?<View style={s.infoCard}><Text style={s.meta}>{error}</Text></View>:null}
    {!selected?<>
      <View style={s.hero}><FileText size={26} color="#C6E0DC"/><Text style={s.heroTitle}>Quotes, without the confusion.</Text>
        <Text style={s.heroSub}>Review prices, see exactly what's included and respond to proposals sent by tradespeople for your Tradarr jobs.</Text>
      </View>
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statNumber}>{rows.filter(x=>x.decision==='pending').length}</Text><Text style={s.statLabel}>Need a response</Text></View>
        <View style={s.stat}><Text style={s.statNumber}>{rows.filter(x=>x.decision==='accepted').length}</Text><Text style={s.statLabel}>Accepted</Text></View>
      </View>
      <Text style={s.section}>Your quotations</Text>
      {rows.length?rows.map(row=><View style={s.quoteCard} key={row.id}>
       <MotionPressable onPress={()=>{setSelected(row.id);setFeedback('');setEditingFeedback(false);setShowCompare(false)}} accessibilityRole="button"
        accessibilityLabel={'View quote for '+row.document.title} style={s.quoteTap}>
        <View style={{flex:1}}>
         <Text style={s.overline}>{'QUOTE '+String(row.document.quote_no||0).padStart(5,'0')}</Text>
         <Text style={s.quoteName}>{row.document.title}</Text>
         <Text style={s.meta}>{row.document.business_name} · Received {dd(row.delivered_at)}</Text>
         <Text style={s.chip}>{stateLabel[row.decision]}</Text>
        </View><View style={{alignItems:'flex-end',gap:11}}><Text style={s.quoteAmount}>{money(row.document.total)}</Text><ChevronRight size={20} color={C.teal}/></View>
       </MotionPressable>
      </View>):<View style={s.empty}><FileText size={34} color={C.teal}/>
        <Text style={s.emptyTitle}>No quotes received yet</Text>
        <Text style={s.emptyText}>When a tradesperson sends a quote to one of your Tradarr bookings, it appears securely here. Private emailed PDFs won't appear automatically.</Text>
        <MotionPressable onPress={openActivity} style={s.primary}><Text style={s.primaryText}>View my job requests</Text></MotionPressable>
      </View>}
    </>:chosen?<>
      <View style={s.projectHeader}><Text style={s.overline}>{'QUOTE '+String(chosen.document.quote_no||0).padStart(5,'0')}</Text>
        <Text style={s.projectTitle}>{chosen.document.title}</Text><Text style={s.meta}>{chosen.document.business_name}</Text>
        <Text style={s.price}>{money(chosen.document.total)}</Text>
        <Text style={s.priceNote}>Total including any applicable VAT</Text>
        <View style={s.decisionPill}><Text style={s.decisionText}>{stateLabel[chosen.decision]}</Text></View>
      </View>
      <View style={s.infoCard}>
       <Text style={s.sectionWithin}>What you're being quoted for</Text>
       <Detail label="Project" value={chosen.document.description}/>
       <Detail label="Included" value={chosen.document.scope_included}/>
       <Detail label="Not included" value={chosen.document.scope_excluded}/>
       <Detail label="Estimated time on site" value={chosen.document.estimated_duration}/>
       <Detail label="Additional terms" value={chosen.document.notes}/>
      </View>
      <View style={s.infoCard}>
       <Text style={s.sectionWithin}>Itemised price</Text>
       {(chosen.document.items||[]).map((line,index)=><View key={index} style={s.item}>
         <View style={{flex:1}}><Text style={s.itemName}>{line.description}</Text><Text style={s.meta}>
           {formatTradeQuantity(line.quantity,line.unit)} × {money(line.unit_price)}</Text></View>
         <Text style={s.itemTotal}>{money(Number(line.quantity)*Number(line.unit_price))}</Text>
       </View>)}
       <View style={s.sumRow}><Text style={s.meta}>Subtotal</Text><Text style={s.itemTotal}>{money(chosen.document.subtotal)}</Text></View>
       {Number(chosen.document.vat_rate)>0?<View style={s.sumRow}><Text style={s.meta}>VAT ({chosen.document.vat_rate}%)</Text>
         <Text style={s.itemTotal}>{money(chosen.document.vat_amount)}</Text></View>:null}
       <View style={s.totalRow}><Text style={s.totalLabel}>Total quoted</Text><Text style={s.totalLabel}>{money(chosen.document.total)}</Text></View>
       {Number(chosen.document.deposit_percent)>0?<Text style={s.explain}>
         Proposed deposit: {chosen.document.deposit_percent}% ({money(chosen.document.total*Number(chosen.document.deposit_percent||0)/100)}).
         No payment is taken in this screen.</Text>:null}
       {(chosen.document.optional_extras||[]).length?<View style={s.extras}><Text style={s.sectionWithin}>Optional extras — not included in total</Text>
         {(chosen.document.optional_extras||[]).map((e,i)=><Text key={i} style={s.meta}>{e.name}: +{money(e.price)} before any applicable VAT</Text>)}</View>:null}
      </View>
      <View style={s.infoCard}>
       <Text style={s.sectionWithin}>Important dates</Text>
       <Text style={s.meta}>Prepared {dd(chosen.document.quote_date)}</Text>
       <Text style={[s.meta,{marginTop:7}]}>Valid until {dd(chosen.document.valid_until)}</Text>
      </View>
      {comparable.length?<View style={s.infoCard}><MotionPressable onPress={()=>setShowCompare(v=>!v)} style={s.compareButton}>
        <Scale size={20} color={C.teal}/><Text style={s.compareText}>Compare other quotes for this job ({comparable.length})</Text>
        <ChevronRight size={18} color={C.teal}/></MotionPressable>
        {showCompare?[chosen,...comparable].map(row=><View key={row.id} style={s.compareRow}>
          <View style={{flex:1}}><Text style={s.itemName}>{row.document.business_name}</Text><Text style={s.meta}>
           {row.document.scope_included?'Scope provided':'Scope not specified'} · {row.document.estimated_duration||'Time not specified'}
          </Text></View><Text style={s.itemTotal}>{money(row.document.total)}</Text></View>):null}
       </View>:null}
      <View style={s.infoCard}><ShieldCheck size={22} color={C.teal}/>
       <Text style={s.safeText}>Check the scope, exclusions, timing, deposit and VAT before agreeing. Tradarr doesn't verify that a quote is the cheapest or guarantee the work.</Text>
      </View>
      {chosen.decision==='pending'?<View style={s.response}>
       <Text style={s.sectionWithin}>Your decision</Text>
       <MotionPressable disabled={working} style={s.primary} onPress={()=>{void decide('accepted')}}>
        {working?<ActivityIndicator color="#FFFFFF"/>:<CheckCircle2 size={19} color="#FFFFFF"/>}<Text style={s.primaryText}>Accept this quotation</Text></MotionPressable>
       <MotionPressable disabled={working} style={s.outline} onPress={()=>setEditingFeedback(v=>!v)}>
        <MessageSquare size={18} color={C.teal}/><Text style={s.outlineText}>Ask for changes</Text></MotionPressable>
       {editingFeedback?<View style={{marginTop:12}}>
        <Text style={s.meta}>Describe the changes you'd like (up to 1,500 characters)</Text>
        <TextInput multiline value={feedback} maxLength={1500} onChangeText={setFeedback} placeholder="E.g. Please include removing the old radiator."
         placeholderTextColor="#899C9D" style={s.feedback}/>
        <MotionPressable disabled={working||!feedback.trim()} onPress={()=>{void decide('changes_requested')}} style={s.primary}><Text style={s.primaryText}>Send change request</Text></MotionPressable>
       </View>:null}
       <MotionPressable disabled={working} style={s.decline} onPress={()=>{void decide('declined')}}><Text style={s.declineText}>Decline quote</Text></MotionPressable>
      </View>:<View style={s.infoCard}><Text style={s.sectionWithin}>{chosen.decision==='accepted'?'You approved this quote':
       chosen.decision==='declined'?'You declined this quote':'You asked for a revised quote'}</Text>
        {chosen.feedback?<Text style={s.meta}>Your message: {chosen.feedback}</Text>:null}
        <Text style={s.explain}>Your response has been saved for the tradesperson to see. Discuss the next steps in Messages.</Text>
      </View>}
    </>:null}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 header:{paddingHorizontal:20,paddingTop:16,paddingBottom:14,flexDirection:'row',gap:12,alignItems:'center'},
 back:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,fontWeight:'800',color:C.teal,letterSpacing:1.3},
 heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:3},
 page:{padding:19,paddingBottom:42},
 hero:{backgroundColor:C.darkTeal,borderRadius:25,padding:23,gap:10},
 heroTitle:{fontSize:22,color:'#FFFFFF',fontWeight:'800'},
 heroSub:{color:'#D0E2DE',fontSize:12,lineHeight:20},
 stats:{flexDirection:'row',gap:12,marginTop:18},
 stat:{flex:1,padding:17,borderRadius:21,backgroundColor:'#FFFFFF',...theme.shadow},
 statNumber:{color:C.ink,fontSize:27,fontWeight:'800'},statLabel:{color:C.muted,fontSize:12,marginTop:4},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:24,marginBottom:13},
 quoteCard:{borderRadius:23,backgroundColor:'#FFFFFF',marginBottom:12,padding:16,...theme.shadow},
 quoteTap:{flexDirection:'row',alignItems:'flex-start',gap:10},
 quoteName:{fontSize:16,color:C.ink,fontWeight:'800',marginTop:7},quoteAmount:{fontSize:17,fontWeight:'800',color:C.ink},
 chip:{fontSize:10,fontWeight:'800',color:C.teal,backgroundColor:C.tealTint,borderRadius:12,overflow:'hidden',padding:7,alignSelf:'flex-start',marginTop:11},
 meta:{fontSize:12,lineHeight:18,color:C.muted,marginTop:5},
 empty:{backgroundColor:'#FFFFFF',borderRadius:25,padding:26,alignItems:'center',gap:10},
 emptyTitle:{fontSize:18,color:C.ink,fontWeight:'800',textAlign:'center'},
 emptyText:{fontSize:12,color:C.muted,lineHeight:20,textAlign:'center'},
 primary:{backgroundColor:C.darkTeal,borderRadius:25,minHeight:54,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:12},
 primaryText:{fontSize:14,color:'#FFFFFF',fontWeight:'800'},
 projectHeader:{backgroundColor:'#FFFFFF',borderRadius:25,padding:22,marginBottom:13,...theme.shadow},
 projectTitle:{fontSize:23,fontWeight:'800',color:C.ink,marginTop:7},
 price:{fontSize:34,fontWeight:'800',color:C.teal,marginTop:17},
 priceNote:{fontSize:11,color:C.muted,marginTop:4},
 decisionPill:{backgroundColor:C.tealTint,padding:10,marginTop:13,borderRadius:15,alignSelf:'flex-start'},
 decisionText:{fontSize:12,fontWeight:'800',color:C.teal},
 infoCard:{backgroundColor:'#FFFFFF',borderRadius:23,padding:19,marginBottom:13,gap:4,...theme.shadow},
 sectionWithin:{fontSize:17,color:C.ink,fontWeight:'800',marginBottom:10},
 detail:{paddingTop:12,paddingBottom:9,borderTopColor:C.line,borderTopWidth:1},
 detailLabel:{color:C.teal,fontSize:12,fontWeight:'800'},detailBody:{fontSize:13,color:C.ink,lineHeight:20,marginTop:6},
 item:{flexDirection:'row',gap:11,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.line},
 itemName:{fontSize:13,fontWeight:'800',color:C.ink},
 itemTotal:{fontSize:13,fontWeight:'800',color:C.ink},
 sumRow:{flexDirection:'row',justifyContent:'space-between',marginTop:8},
 totalRow:{flexDirection:'row',justifyContent:'space-between',paddingTop:16,marginTop:12,borderTopWidth:2,borderTopColor:C.teal},
 totalLabel:{fontSize:17,color:C.ink,fontWeight:'800'},explain:{fontSize:11,color:C.muted,lineHeight:18,marginTop:10},
 extras:{paddingTop:15,gap:8},
 compareButton:{flexDirection:'row',alignItems:'center',gap:8,minHeight:42},
 compareText:{flex:1,color:C.teal,fontSize:13,fontWeight:'800'},
 compareRow:{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:12,borderTopWidth:1,borderColor:C.line},
 safeText:{fontSize:12,color:C.muted,lineHeight:19,marginTop:8},
 response:{backgroundColor:'#FFFFFF',borderRadius:23,padding:18},
 outline:{borderRadius:23,minHeight:50,marginTop:10,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},
 outlineText:{fontSize:13,fontWeight:'800',color:C.teal},
 feedback:{borderRadius:13,minHeight:100,backgroundColor:'#F8FAF9',borderWidth:1,borderColor:C.line,
  padding:13,color:C.ink,textAlignVertical:'top',marginTop:10},
 decline:{padding:15,alignItems:'center'},declineText:{fontSize:12,fontWeight:'800',color:C.coralDark},
});
