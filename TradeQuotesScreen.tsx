import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Platform,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import type {ScrollViewInstance} from 'react-native';
import {ArrowLeft,Check,ChevronRight,FileText,Plus,Send,Share2,Trash2,Users} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {WebView} from 'react-native-webview';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import {formatTradeQuantity,hasInvalidTradeQuantity,unitOptionLabel} from './lib/documentUnits';

type Kind='labour'|'material'|'other';
type Line={kind:Kind;description:string;quantity:number;unit_price:number;unit:string};
type DraftLine={kind:Kind;description:string;quantity:string;unit_price:string;unit:string};
type Customer={id:string;name:string;phone:string|null;email:string|null;address:string|null};
type Extra={name:string;price:number};
type DraftExtra={name:string;price:string};
type AppJobRecipient={id:string;customer_id:string;trade:string;issue:string;status:string;job_kind:'job'|'urgent'};
type QuoteDelivery={id:string;quote_id:string;decision:string;feedback:string|null;customer_id:string;job_id:string|null;urgent_request_id:string|null};
type Quote={
 id:string;tradesperson_id:string;quote_no:number;customer_id:string|null;business_name:string;business_address:string;
 business_email:string|null;business_phone:string|null;vat_number:string|null;
 customer_name:string;customer_address:string;customer_email:string|null;customer_phone:string|null;
 title:string;description:string|null;items:Line[];quote_date:string;valid_until:string;
 vat_rate:number;subtotal:number;vat_amount:number;total:number;notes:string|null;
 scope_included?:string|null;scope_excluded?:string|null;estimated_duration?:string|null;
 deposit_percent?:number;optional_extras?:Extra[];estimated_cost?:number|null;target_margin?:number|null;
 status:'draft'|'sent'|'accepted'|'declined'|'converted';invoice_id:string|null;created_at:string;
};
const C=theme.colors,day=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return day(d)};
const money=(v:number)=>'£'+Number(v||0).toFixed(2);
const quoteNo=(n:number)=>'QUO-'+String(n).padStart(5,'0');
const niceDate=(input:string)=>new Date(input+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
const validDay=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&day(new Date(v+'T12:00:00'))===v;
const safe=(v:unknown)=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const html=(v:unknown)=>safe(v).replace(/\n/g,'<br/>');
const val=(v:string|number)=>Number(String(v).replace(',','.'));
const pennies=(v:{quantity:number|string;unit_price:number|string})=>
 Math.round(Math.max(0,val(v.quantity)||0)*Math.round(Math.max(0,val(v.unit_price)||0)*100));
const label=(kind:Kind)=>kind==='labour'?'Labour':kind==='material'?'Materials':'Other charges';
const statusName=(v:Quote['status'])=>v==='draft'?'READY TO SEND':v==='sent'?'SENT':v==='accepted'?'ACCEPTED (MANUAL)':v==='declined'?'DECLINED':'INVOICED';
function makeQuoteHtml(q:Quote){
 const groups=(['labour','material','other'] as const).map(kind=>{
  const list=(q.items||[]).filter(i=>i.kind===kind);
  if(!list.length)return '';
  return '<tr class="group"><td colspan="4">'+label(kind)+'</td></tr>'+
   list.map(i=>'<tr><td>'+html(i.description)+'</td><td class="right">'+safe(formatTradeQuantity(i.quantity,i.unit))+'</td>'+
    '<td class="right">'+money(i.unit_price)+'</td><td class="right amount">'+money(pennies(i)/100)+'</td></tr>').join('');
 }).join('');
 const css=[
 '@page{size:A4;margin:0}','*{box-sizing:border-box}',
 'html,body{margin:0;padding:0;color:#17363D;background:white;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
 '.sheet{width:178mm;max-width:100%;margin:18mm auto 20mm;min-height:250mm}',
 'table{border-collapse:collapse;width:100%;table-layout:fixed}',
 '.head td,.info td{vertical-align:top;padding:0}',
 '.business{font-size:24px;font-weight:800;line-height:1.25;color:#0E3038;margin-bottom:12px;overflow-wrap:anywhere}',
 '.meta{color:#567075;font-size:11px;line-height:1.8;overflow-wrap:anywhere}',
 '.quoteTitle{font-size:28px;font-weight:800;text-align:right;color:#245758;letter-spacing:1px}',
 '.quoteNo{text-align:right;font-size:12px;margin-top:10px;font-weight:800}',
 '.line{height:3px;background:#245758;margin:27px 0 28px}',
 '.info td{width:50%;padding:0 23px 0 0;overflow-wrap:anywhere}',
 '.info td+td{padding-left:20px;padding-right:0}',
 '.label{font-size:10px;font-weight:800;letter-spacing:1.1px;color:#245758;margin-bottom:10px;text-transform:uppercase}',
 '.name{font-size:14px;font-weight:800;color:#18343C;margin-bottom:5px}',
 '.row{font-size:11px;color:#415961;line-height:1.9}',
 '.row b{display:inline-block;min-width:85px;color:#18343C}',
 '.subject{margin:28px 0 20px;padding:17px 19px;border-left:3px solid #245758;background:#F0F6F4;overflow-wrap:anywhere}',
 '.subjectName{font-size:14px;color:#0E3038;font-weight:800}',
 '.subjectText{margin-top:5px;color:#466169;font-size:11px}',
 '.scope{margin:20px 0 24px;overflow-wrap:anywhere}',
 '.scopeTitle{font-weight:800;font-size:12px;color:#245758;margin-bottom:7px}',
 '.scopeText{font-size:11px;line-height:1.7;color:#344C53}',
 '.scopeBox{border-left:3px solid #245758;padding-left:15px;margin-bottom:16px}',
 '.extraBox{margin-top:26px;padding:17px 18px;background:#F2F6F5;border-radius:9px;overflow-wrap:anywhere}',
 '.extraRow{margin-top:9px;font-size:11px;border-bottom:1px solid #DFE7E5;padding-bottom:8px}',
 '.deposit{margin:15px 0 0;font-size:11px;color:#245758;font-weight:800}',
 '.items{margin-top:18px}',
 '.items th{padding:12px 10px;background:#143940;color:white;text-align:left;font-size:10px}',
 '.items th.right{text-align:right}',
 '.items td{padding:12px 10px;vertical-align:top;border-bottom:1px solid #DFE8E6;font-size:11px;overflow-wrap:anywhere}',
 '.items .group td{background:#E8F2EF;color:#245758;font-weight:800;padding:8px 10px}',
 '.items tr{break-inside:avoid;page-break-inside:avoid}',
 '.right{text-align:right}.amount{font-weight:800;white-space:nowrap}',
 '.totals{width:48%;margin:22px 0 0 auto}',
 '.totals td{padding:8px 0;color:#456068}',
 '.totals td:last-child{text-align:right;font-weight:700}',
 '.totals .grand td{font-size:17px;color:#0E3038;font-weight:800;border-top:2px solid #245758;padding-top:13px}',
 '.note{padding:17px 19px;margin-top:27px;border-radius:8px;background:#F4F8F7;overflow-wrap:anywhere}',
 '.foot{font-size:9px;color:#87969B;border-top:1px solid #E3EBE9;padding-top:15px;margin-top:35px}',
 '@media screen and (max-width:650px){.sheet{width:100%;margin:0;padding:25px 17px;min-height:0}.business{font-size:21px}.quoteTitle{font-size:23px}.info td{padding-right:8px}.info td+td{padding-left:9px}.items th,.items td{padding-left:7px;padding-right:7px}.items td{font-size:10px}.totals{width:62%}}'
 ].join('');
 return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
 '<style>'+css+'</style></head><body><main class="sheet">'+
 '<table class="head"><colgroup><col style="width:62%"/><col style="width:38%"/></colgroup><tr>'+
 '<td><div class="business">'+html(q.business_name)+'</div><div class="meta">'+html(q.business_address)+
 (q.business_email?'<div>'+html(q.business_email)+'</div>':'')+
 (q.business_phone?'<div>'+html(q.business_phone)+'</div>':'')+
 (q.vat_rate&&q.vat_number?'<div>VAT: '+html(q.vat_number)+'</div>':'')+'</div></td>'+
 '<td><div class="quoteTitle">PROPOSAL</div><div class="quoteNo">QUOTE '+quoteNo(q.quote_no)+'</div></td></tr></table>'+
 '<div class="line"></div><table class="info"><tr><td><div class="label">Prepared for</div>'+
 '<div class="name">'+html(q.customer_name)+'</div><div class="row">'+html(q.customer_address)+
 (q.customer_email?'<div>'+html(q.customer_email)+'</div>':'')+'</div></td>'+
 '<td><div class="label">Quote details</div><div class="row"><b>Prepared</b>'+safe(niceDate(q.quote_date))+'</div>'+
 '<div class="row"><b>Valid until</b>'+safe(niceDate(q.valid_until))+'</div></td></tr></table>'+
 '<div class="subject"><div class="label">Your project</div><div class="subjectName">'+html(q.title)+'</div>'+
 (q.description?'<div class="subjectText">'+html(q.description)+'</div>':'')+'</div>'+
 '<div class="scope">'+
 (q.scope_included?'<div class="scopeBox"><div class="scopeTitle">Included in our price</div><div class="scopeText">'+html(q.scope_included)+'</div></div>':'')+
 (q.scope_excluded?'<div class="scopeBox"><div class="scopeTitle">What is not included</div><div class="scopeText">'+html(q.scope_excluded)+'</div></div>':'')+
 (q.estimated_duration?'<div class="scopeBox"><div class="scopeTitle">Estimated time on site</div><div class="scopeText">'+html(q.estimated_duration)+'</div></div>':'')+
 '</div>'+
 '<table class="items"><colgroup><col style="width:47%"/><col style="width:16%"/><col style="width:19%"/><col style="width:18%"/></colgroup>'+
 '<thead><tr><th>Task or material</th><th class="right">Quantity</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>'+groups+'</tbody></table>'+
 '<table class="totals"><tr><td>Subtotal</td><td>'+money(q.subtotal)+'</td></tr>'+
 (q.vat_rate?'<tr><td>VAT ('+q.vat_rate+'%)</td><td>'+money(q.vat_amount)+'</td></tr>':'')+
 '<tr class="grand"><td>Price for proposed work</td><td>'+money(q.total)+'</td></tr></table>'+
 (Number(q.deposit_percent||0)>0?'<div class="deposit">Proposed deposit ('+safe(q.deposit_percent)+'%): '+money(Math.round(q.total*Number(q.deposit_percent)/100*100)/100)+' · not charged automatically</div>':'')+
 ((q.optional_extras||[]).length?'<div class="extraBox"><div class="label">Optional upgrades · not included above</div>'+
 (q.optional_extras||[]).map(e=>'<div class="extraRow">'+html(e.name)+' — +'+money(e.price)+' (before any applicable VAT)</div>').join('')+
 '<div class="subjectText">Optional upgrades require separate agreement and are not in the total shown above.</div></div>':'')+
 (q.notes?'<div class="note"><div class="label">Additional notes</div>'+html(q.notes)+'</div>':'')+
 '<div class="foot">This quotation is not an invoice or a request for payment. Changes to the agreed scope may require a revised quotation. Created with Tradarr.</div>'+
 '</main></body></html>';
}
function Field({name,value,change,multi,placeholder,numeric,onFocus}:{
 name:string;value:string;change:(v:string)=>void;multi?:boolean;placeholder?:string;
 numeric?:boolean;onFocus?:()=>void;
}){
 return <View style={s.field}><Text style={s.label}>{name}</Text><TextInput value={value} onChangeText={change}
 style={[s.input,multi&&{minHeight:95}]} multiline={multi} textAlignVertical={multi?'top':'center'}
 keyboardType={numeric?'decimal-pad':'default'} onFocus={onFocus}
 placeholder={placeholder} placeholderTextColor="#94A1A4"/></View>;
}
function Pill({name,selected,onPress}:{name:string;selected:boolean;onPress:()=>void}){
 return <MotionPressable onPress={onPress} style={[s.pill,selected&&s.pillOn]}>
 <Text style={[s.pillText,selected&&s.pillTextOn]}>{name}</Text></MotionPressable>;
}
export default function TradeQuotesScreen({goBack,onInvoiceCreated,onMaterialsCreated}:{
 goBack:()=>void;onInvoiceCreated:(invoiceId:string)=>void;onMaterialsCreated:(kitId:string)=>void;
}){
 const scrollRef=useRef<ScrollViewInstance>(null);
 const bringBottomIntoView=()=>{setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),360);};
 const [uid,setUid]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [converting,setConverting]=useState(false);
 const [creatingKit,setCreatingKit]=useState(false);
 const [sendingToApp,setSendingToApp]=useState(false);
 const [appJobs,setAppJobs]=useState<AppJobRecipient[]>([]);
 const [deliveries,setDeliveries]=useState<QuoteDelivery[]>([]);
 const [listFilter,setListFilter]=useState<'all'|'awaiting'|'won'>('all');
 const [screen,setScreen]=useState<'list'|'new'|'preview'|'send'>('list');
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [customerId,setCustomerId]=useState<string|null>(null);
 const [showPicker,setShowPicker]=useState(false);
 const [businessName,setBusinessName]=useState('');
 const [businessAddress,setBusinessAddress]=useState('');
 const [businessEmail,setBusinessEmail]=useState('');
 const [businessPhone,setBusinessPhone]=useState('');
 const [vatNumber,setVatNumber]=useState('');
 const [customerName,setCustomerName]=useState('');
 const [customerAddress,setCustomerAddress]=useState('');
 const [customerEmail,setCustomerEmail]=useState('');
 const [customerPhone,setCustomerPhone]=useState('');
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [notes,setNotes]=useState('');
 const [stage,setStage]=useState<'scope'|'pricing'>('scope');
 const [showBusiness,setShowBusiness]=useState(false);
 const [included,setIncluded]=useState('');
 const [excluded,setExcluded]=useState('');
 const [duration,setDuration]=useState('');
 const [deposit,setDeposit]=useState('0');
 const [extras,setExtras]=useState<DraftExtra[]>([]);
 const [estimateCost,setEstimateCost]=useState('');
 const [targetMargin,setTargetMargin]=useState('30');
 const [quoteDate,setQuoteDate]=useState(day(new Date()));
 const [validUntil,setValidUntil]=useState(addDays(30));
 const [vatRate,setVatRate]=useState(0);
 const [lines,setLines]=useState<DraftLine[]>([{kind:'labour',description:'',quantity:'1',unit_price:'',unit:'job'}]);
 const selected=quotes.find(q=>q.id===selectedId)||null;
 const selectedDelivery=deliveries.find(d=>d.quote_id===selectedId);
 const awaitingQuotes=quotes.filter(q=>q.status==='sent');
 const wonQuotes=quotes.filter(q=>['accepted','converted'].includes(q.status));
 const displayedQuotes=quotes.filter(q=>listFilter==='all'||listFilter==='awaiting'&&q.status==='sent'||listFilter==='won'&&['accepted','converted'].includes(q.status));
 const valueAwaiting=awaitingQuotes.reduce((n,q)=>n+Number(q.total),0);
 const subtotal=useMemo(()=>Math.round(lines.reduce((sum,l)=>sum+pennies(l),0))/100,[lines]);
 const vat=Math.round(subtotal*vatRate)/100;
 const total=Math.round((subtotal+vat)*100)/100;
 const costEstimate=estimateCost.trim()?val(estimateCost):0;
 const marginGoal=val(targetMargin);
 const costPreview=Number.isFinite(costEstimate)&&costEstimate>=0?costEstimate:0;
 const marginPreview=subtotal>0?(subtotal-costPreview)/subtotal*100:0;
 const priceToHitGoal=Number.isFinite(marginGoal)&&marginGoal>=0&&marginGoal<100
   ?costPreview/(1-marginGoal/100):0;
 useEffect(()=>{let alive=true;(async()=>{
  const {data:a}=await supabase.auth.getUser();const id=a.user?.id;
  if(!id||!alive){if(alive)setLoading(false);return}
  setUid(id);
  const [docs,people,profile,last,assignedJobs,urgentJobs,delivered]=await Promise.all([
   supabase.from('trade_quotes').select('*').eq('tradesperson_id',id).order('created_at',{ascending:false}).limit(100),
   supabase.from('trade_customers').select('id,name,phone,email,address').eq('tradesperson_id',id).order('name'),
   supabase.from('tradesperson_profiles').select('business_name,display_name,public_phone').eq('user_id',id).maybeSingle(),
   supabase.from('trade_invoices').select('business_name,business_address,business_email,business_phone,vat_number')
    .eq('tradesperson_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
   supabase.from('jobs').select('id,customer_id,trade,issue,status').eq('accepted_tradesperson_id',id)
      .in('status',['accepted','en_route','arrived','in_progress','completed']).order('created_at',{ascending:false}).limit(50),
   supabase.from('urgent_requests').select('id,customer_id,trade,issue,status').eq('accepted_tradesperson_id',id)
      .in('status',['matched','en_route','arrived','completed']).order('created_at',{ascending:false}).limit(50),
   supabase.from('trade_customer_proposals').select('id,quote_id,decision,feedback,customer_id,job_id,urgent_request_id').eq('tradesperson_id',id),
  ]);
  if(!alive)return;
  if(docs.error)Alert.alert('Unable to load quotes',docs.error.message);
  setQuotes((docs.data||[]) as Quote[]);setCustomers((people.data||[]) as Customer[]);
  setAppJobs([
    ...(assignedJobs.data||[]).map(v=>({...v,job_kind:'job' as const})),
    ...(urgentJobs.data||[]).map(v=>({...v,job_kind:'urgent' as const})),
  ]);
  setDeliveries((delivered.data||[]) as QuoteDelivery[]);
  const latest=(docs.data||[])[0] as Quote|undefined;
  setBusinessName(latest?.business_name||last.data?.business_name||profile.data?.business_name||profile.data?.display_name||'');
  setBusinessAddress(latest?.business_address||last.data?.business_address||'');
  setBusinessEmail(latest?.business_email||last.data?.business_email||a.user?.email||'');
  setBusinessPhone(latest?.business_phone||last.data?.business_phone||profile.data?.public_phone||'');
  setVatNumber(latest?.vat_number||last.data?.vat_number||'');
  setLoading(false);
 })().catch(e=>{if(alive){setLoading(false);Alert.alert('Quote error',String(e))}});
 return()=>{alive=false};},[]);
 // Keep in-app approvals fresh even when the tradesperson leaves this screen open.
 useEffect(()=>{
  if(!uid)return;
  let alive=true;
  const refresh=async()=>{
   const [q,p]=await Promise.all([
    supabase.from('trade_quotes').select('*').eq('tradesperson_id',uid)
     .order('created_at',{ascending:false}).limit(100),
    supabase.from('trade_customer_proposals')
     .select('id,quote_id,decision,feedback,customer_id,job_id,urgent_request_id')
     .eq('tradesperson_id',uid)
   ]);
   if(!alive)return;
   if(!q.error)setQuotes((q.data||[]) as Quote[]);
   if(!p.error)setDeliveries((p.data||[]) as QuoteDelivery[]);
  };
  const channel=supabase.channel('tradarr-quote-sync-'+uid+'-'+Date.now())
   .on('postgres_changes',{event:'*',schema:'public',table:'trade_customer_proposals',
     filter:'tradesperson_id=eq.'+uid},()=>{void refresh()})
   .on('postgres_changes',{event:'*',schema:'public',table:'trade_quotes',
     filter:'tradesperson_id=eq.'+uid},()=>{void refresh()})
   .subscribe();
  const foreground=AppState.addEventListener('change',state=>{
   if(state==='active')void refresh();
  });
  return()=>{alive=false;foreground.remove();void supabase.removeChannel(channel);};
 },[uid]);
 const newQuote=()=>{
  setCustomerId(null);setCustomerName('');setCustomerEmail('');setCustomerPhone('');setCustomerAddress('');
  setTitle('');setDescription('');setNotes('');setQuoteDate(day(new Date()));setValidUntil(addDays(30));
  setStage('scope');setShowBusiness(false);setIncluded('');setExcluded('');setDuration('');
  setDeposit('0');setExtras([]);setEstimateCost('');setTargetMargin('30');
  setLines([{kind:'labour',description:'',quantity:'1',unit_price:'',unit:'job'}]);setVatRate(0);
  setSelectedId(null);setScreen('new');
 };
 const reviseQuote=(doc:Quote)=>{
   // A customer-facing quotation is an issued snapshot. Create a new numbered proposal,
   // preserving the original for records rather than silently overwriting it.
   setBusinessName(doc.business_name);setBusinessAddress(doc.business_address);
   setBusinessEmail(doc.business_email||'');setBusinessPhone(doc.business_phone||'');setVatNumber(doc.vat_number||'');
   setCustomerId(doc.customer_id);setCustomerName(doc.customer_name);setCustomerAddress(doc.customer_address);
   setCustomerEmail(doc.customer_email||'');setCustomerPhone(doc.customer_phone||'');
   setTitle(doc.title);setDescription(doc.description||'');setNotes(doc.notes||'');
   setIncluded(doc.scope_included||'');setExcluded(doc.scope_excluded||'');
   setDuration(doc.estimated_duration||'');setDeposit(String(doc.deposit_percent||0));
   setExtras((doc.optional_extras||[]).map(e=>({name:e.name,price:String(e.price)})));
   setEstimateCost(doc.estimated_cost==null?'':String(doc.estimated_cost));
   setTargetMargin(String(doc.target_margin??30));
   setVatRate(doc.vat_rate);setQuoteDate(day(new Date()));setValidUntil(addDays(30));
   setLines((doc.items||[]).map(line=>({kind:line.kind,description:line.description,
     quantity:String(line.quantity),unit_price:String(line.unit_price),unit:line.unit==='each'?'item':line.unit||'item'})));
   setShowBusiness(false);setSelectedId(null);setStage('pricing');setScreen('new');
   Alert.alert('Creating a revised proposal','A new quote number will be issued when you save. The original quotation stays in your records. Review the quantities and units before sharing.');
 };
 const chooseCustomer=(c:Customer|null)=>{
  setCustomerId(c?.id||null);
  if(c){setCustomerName(c.name);setCustomerAddress(c.address||'');setCustomerEmail(c.email||'');setCustomerPhone(c.phone||'');}
  setShowPicker(false);
 };
 const addLine=(kind:Kind)=>{setLines(old=>[...old.filter(l=>l.description.trim()||l.unit_price.trim()),{kind,description:'',quantity:'1',unit_price:'',unit:kind==='labour'?'job':kind==='material'?'item':'job'}])};
 const choicesFor=(kind:Kind):string[]=>
   kind==='labour'?['job','hour','day','radiator','valve','room','visit','item']:
   kind==='material'?['item','radiator','valve','metre','box','pack','roll','set']:
   ['job','item','hour','visit'];
 const changeUnit=(index:number,unit:string)=>{
   setLines(old=>old.map((line,i)=>i===index?{...line,unit,quantity:unit==='job'?'1':line.quantity}:line));
 };
 const updateLine=(index:number,patch:Partial<DraftLine>)=>setLines(old=>old.map((l,i)=>i===index?{...l,...patch}:l));
 const saveQuote=async()=>{
  if(saving||!uid)return;
  if(!businessName.trim()||!businessAddress.trim()||!customerName.trim()||!customerAddress.trim()||!title.trim()){
   Alert.alert('Missing details','Business and customer names and addresses, plus a quote title, are required.');return;
  }
  if(!validDay(quoteDate)||!validDay(validUntil)||validUntil<quoteDate){
   Alert.alert('Check quote dates','Use YYYY-MM-DD, and set an expiry after the quote date.');return;
  }
  if(vatRate>0&&!vatNumber.trim()){Alert.alert('VAT number needed','Only VAT-registered businesses should charge VAT. Enter a VAT number or choose No VAT.');return;}
  const items=lines.map(l=>({kind:l.kind,description:l.description.trim(),quantity:val(l.quantity),unit_price:val(l.unit_price),unit:l.unit}));
  if(!items.length||items.some(l=>!l.description||hasInvalidTradeQuantity(l.quantity,l.unit)||
   !Number.isFinite(l.unit_price)||l.unit_price<0||l.unit_price>1000000)||total<=0){
   Alert.alert('Check the quote lines','Add a description and valid price for each line. Fixed-price work must be 1 job. For several radiators or valves, choose the appropriate unit (e.g. 3 radiators).');return;
  }
  if(!Number.isFinite(val(deposit))||val(deposit)<0||val(deposit)>100){
   Alert.alert('Check deposit','Enter a percentage between 0 and 100.');return;
  }
  if(estimateCost.trim()&&(!Number.isFinite(val(estimateCost))||val(estimateCost)<0||val(estimateCost)>1000000)){
   Alert.alert('Check estimated costs','Enter a valid non-negative cost estimate.');return;
  }
  if(!Number.isFinite(val(targetMargin))||val(targetMargin)<0||val(targetMargin)>90){
   Alert.alert('Check target margin','Choose a target margin from 0 to 90%.');return;
  }
  if(extras.some(e=>!e.name.trim()||!Number.isFinite(val(e.price))||val(e.price)<0||val(e.price)>1000000)){
   Alert.alert('Check optional upgrades','Each upgrade needs a name and a valid extra price.');return;
  }
  setSaving(true);
  const payload={tradesperson_id:uid,quote_no:0,customer_id:customerId,
   business_name:businessName.trim(),business_address:businessAddress.trim(),business_email:businessEmail.trim()||null,
   business_phone:businessPhone.trim()||null,vat_number:vatRate?vatNumber.trim():null,
   customer_name:customerName.trim(),customer_address:customerAddress.trim(),customer_email:customerEmail.trim()||null,
   customer_phone:customerPhone.trim()||null,title:title.trim(),description:description.trim()||null,
   items,quote_date:quoteDate,valid_until:validUntil,vat_rate:vatRate,subtotal,vat_amount:vat,total,
   notes:notes.trim()||null,scope_included:included.trim()||null,scope_excluded:excluded.trim()||null,
   estimated_duration:duration.trim()||null,deposit_percent:val(deposit),
   optional_extras:extras.map(x=>({name:x.name.trim(),price:Math.round(val(x.price)*100)/100})),
   estimated_cost:estimateCost.trim()?costPreview:null,target_margin:val(targetMargin),status:'draft' as const};
  const {data,error}=await supabase.from('trade_quotes').insert(payload).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Could not create quote',error?.message||'Please try again');return;}
  const doc=data as Quote;setQuotes(old=>[doc,...old]);setSelectedId(doc.id);setScreen('preview');
 };
 const setStatus=async(q:Quote,status:Quote['status'])=>{
  const {data,error}=await supabase.from('trade_quotes').update({status,updated_at:new Date().toISOString()})
   .eq('id',q.id).eq('tradesperson_id',uid).select('*').single();
  if(error||!data){Alert.alert('Could not update quote',error?.message||'Please try again');return;}
  setQuotes(old=>old.map(v=>v.id===q.id?data as Quote:v));
 };
 const share=async(q:Quote)=>{
  if(sharing)return;setSharing(true);
  try{
   const markup=makeQuoteHtml(q);
   if(Platform.OS==='web')await Print.printAsync({html:markup});
   else{
    const file=await Print.printToFileAsync({html:markup});
    if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Share '+quoteNo(q.quote_no)});
    else await Print.printAsync({html:markup});
   }
  }catch(e){Alert.alert('Unable to share quote',String(e))}
  finally{setSharing(false)}
 };
 const convert=async(q:Quote)=>{
  if(converting)return;
  if(q.invoice_id){onInvoiceCreated(q.invoice_id);return;}
  const delivery=deliveries.find(d=>d.quote_id===q.id);
  if(delivery&&delivery.decision!=='accepted'){
   Alert.alert('Customer approval required',
    delivery.decision==='pending'
     ?'The customer must accept this quotation inside Tradarr before it can be invoiced.'
     :'This quotation was not accepted. Prepare a revised quote instead.');
   return;
  }
  if(q.status==='declined'){
   Alert.alert('Quote declined','A declined quotation cannot become an invoice.');return;
  }
  setConverting(true);
  try{
   // Server transaction: validated approval, job links, invoice number and idempotency.
   const {data,error}=await supabase.rpc('tradarr_convert_quote_to_invoice',{p_quote_id:q.id});
   if(error||!data)throw new Error(error?.message||'The invoice could not be created.');
   const invoiceId=String(data);
   setQuotes(old=>old.map(v=>v.id===q.id?{...v,invoice_id:invoiceId,status:'converted'}:v));
   onInvoiceCreated(invoiceId);
  }catch(e:any){Alert.alert('Could not create invoice',e?.message||'Please retry.');}
  finally{setConverting(false);}
 };
 const createMaterials=async(q:Quote)=>{
  if(creatingKit)return;
  const materials=(q.items||[]).filter(i=>i.kind==='material');
  if(!materials.length){Alert.alert('No material items','Add materials to the quote before making a job shopping list.');return;}
  setCreatingKit(true);
  try{
    const existing=await supabase.from('trade_material_kits').select('id').eq('source_quote_id',q.id).eq('tradesperson_id',uid).maybeSingle();
    if(existing.data?.id){onMaterialsCreated(existing.data.id);return;}
    const checklist=materials.map((i,index)=>({
      id:'quote-'+q.id.slice(0,8)+'-'+index,name:i.description,
      qty:Number(i.quantity),unit:i.unit||'each',unit_cost:0,merchant:'',done:false
    }));
    const {data,error}=await supabase.from('trade_material_kits').insert({
      tradesperson_id:uid,source_quote_id:q.id,name:q.title,job_address:q.customer_address,items:checklist
    }).select('id').single();
    if(error||!data){
      const retry=await supabase.from('trade_material_kits').select('id').eq('source_quote_id',q.id).eq('tradesperson_id',uid).maybeSingle();
      if(retry.data?.id){onMaterialsCreated(retry.data.id);return;}
      throw new Error(error?.message||'Could not save checklist.');
    }
    onMaterialsCreated(data.id);
  }catch(e){Alert.alert('Materials checklist',String(e))}
  finally{setCreatingKit(false);}
 };
 const followUp=async(q:Quote)=>{
   try{await Share.share({message:
    'Hi '+q.customer_name+', just checking whether you had any questions about the proposal for '+q.title+
    ' ('+quoteNo(q.quote_no)+'). The quote is valid until '+q.valid_until+
    '. Happy to discuss the scope or any optional upgrades. Thanks!'
   });}catch(e){Alert.alert('Could not share message',String(e))}
 };
 const sendInsideApp=async(q:Quote,job:AppJobRecipient)=>{
  if(sendingToApp)return;
  Alert.alert('Send quote to this customer?',
    'Tradarr will send quote '+quoteNo(q.quote_no)+' ('+money(q.total)+') to the customer on the selected accepted job: '+job.issue+
    '. Check that the name and scope match. This will not take a payment.',
    [{text:'Cancel',style:'cancel'},{text:'Send in Tradarr',onPress:async()=>{
      setSendingToApp(true);
      const payload={quote_id:q.id,tradesperson_id:uid,customer_id:job.customer_id,
        job_id:job.job_kind==='job'?job.id:null,urgent_request_id:job.job_kind==='urgent'?job.id:null};
      const {data,error}=await supabase.from('trade_customer_proposals').insert(payload)
        .select('id,quote_id,decision,feedback,customer_id,job_id,urgent_request_id').single();
      setSendingToApp(false);
      if(error||!data){Alert.alert('Could not deliver proposal',error?.message||'Please try again.');return;}
      setDeliveries(old=>[data as QuoteDelivery,...old]);
      if(q.status==='draft')await setStatus(q,'sent');
      setScreen('preview');
      Alert.alert('Delivered','The customer can review the quotation in their Quote Centre and respond inside Tradarr.');
    }}]);
 };
 const back=()=>screen==='list'?goBack():screen==='send'?setScreen('preview'):screen==='new'&&stage==='pricing'?setStage('scope'):setScreen('list');
 return <View style={s.root}>
  <View style={s.header}><MotionPressable style={s.back} onPress={back}><ArrowLeft size={23} color={C.ink}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>BUSINESS TOOLS</Text>
    <Text style={s.title}>{screen==='new'?(stage==='scope'?'Plan a job':'Build your price'):screen==='preview'?'Customer proposal':screen==='send'?'Send to customer':'Quotes'}</Text></View>
   {screen==='list'?<MotionPressable style={s.add} onPress={newQuote}><Plus size={19} color="#FFFFFF"/><Text style={s.addText}>New</Text></MotionPressable>:null}
  </View>
  {loading?<ActivityIndicator style={{marginTop:50}} color={C.teal} size="large"/>:
   screen==='list'?<ScrollView contentContainerStyle={s.page}>
    <Text style={s.intro}>Win work with confident pricing, a clear job scope and options your customer can choose. Turn an accepted proposal into a job.</Text>
    <MotionPressable style={s.primary} onPress={newQuote}><Plus size={20} color="#FFFFFF"/><Text style={s.primaryText}>Plan a new job</Text><ChevronRight size={19} color="#FFFFFF"/></MotionPressable>
    <View style={s.pipelineRow}>
       <View style={s.pipelineCard}><Text style={s.pipelineLabel}>Awaiting decision</Text>
         <Text style={s.pipelineValue}>{awaitingQuotes.length}</Text>
         <Text style={s.pipelineHint}>{money(valueAwaiting)} quoted</Text></View>
       <View style={s.pipelineCard}><Text style={s.pipelineLabel}>Won / approved</Text>
         <Text style={s.pipelineValue}>{wonQuotes.length}</Text>
         <Text style={s.pipelineHint}>Includes manually accepted quotes</Text></View>
     </View>
     <Text style={s.section}>Your proposals</Text>
     <View style={s.pills}>
       <Pill name={'All · '+quotes.length} selected={listFilter==='all'} onPress={()=>setListFilter('all')}/>
       <Pill name={'Awaiting · '+awaitingQuotes.length} selected={listFilter==='awaiting'} onPress={()=>setListFilter('awaiting')}/>
       <Pill name={'Won · '+wonQuotes.length} selected={listFilter==='won'} onPress={()=>setListFilter('won')}/>
     </View>
    {displayedQuotes.length?displayedQuotes.map(q=><View key={q.id} style={s.quoteCard}>
     <MotionPressable onPress={()=>{setSelectedId(q.id);setScreen('preview')}} style={s.quoteTop}>
      <View style={{flex:1}}><Text style={s.quoteNo}>{quoteNo(q.quote_no)}</Text><Text style={s.quoteName}>{q.customer_name}</Text>
       <Text style={s.small}>{q.title} · Valid to {q.valid_until}</Text></View>
      <View style={{alignItems:'flex-end',gap:8}}><Text style={s.amount}>{money(q.total)}</Text><Text style={s.status}>{statusName(q.status)}</Text></View>
     </MotionPressable>
     <View style={s.quoteActions}><MotionPressable onPress={()=>{setSelectedId(q.id);setScreen('preview')}} style={s.action}>
      <FileText size={17} color={C.teal}/><Text style={s.actionText}>View</Text></MotionPressable>
      <MotionPressable onPress={()=>share(q)} style={s.action}><Share2 size={17} color={C.teal}/><Text style={s.actionText}>Share PDF</Text></MotionPressable>
       {q.status==='sent'?<MotionPressable onPress={()=>followUp(q)} style={s.action}><Send size={16} color={C.teal}/><Text style={s.actionText}>Follow up</Text></MotionPressable>:null}
     </View>
    </View>):<View style={s.empty}><FileText size={35} color={C.teal}/><Text style={s.emptyTitle}>No quotes yet</Text>
     <Text style={s.intro}>{listFilter==='all'?'Start with your next repair or installation proposal.':'No proposals in this category yet.'}</Text></View>}
   </ScrollView>:
   screen==='send'&&selected?<ScrollView contentContainerStyle={s.page}>
    <View style={s.stepBanner}><Text style={s.stepSmall}>SHARE INSIDE TRADARR</Text>
      <Text style={s.stepTitle}>Choose the correct job</Text>
      <Text style={s.stepDesc}>A quote can be sent directly to a customer only for an app job you have accepted. This protects private quote information.</Text>
    </View>
    <View style={s.projectSummary}><Text style={s.projectSummaryTitle}>{selected.title}</Text>
      <Text style={s.projectSummarySub}>{quoteNo(selected.quote_no)} · {money(selected.total)} · Prepared for {selected.customer_name}</Text>
    </View>
    <Text style={s.section}>Your accepted Tradarr jobs</Text>
    {appJobs.length?appJobs.map(job=><MotionPressable key={job.job_kind+job.id}
       onPress={()=>{void sendInsideApp(selected,job)}} disabled={sendingToApp}
       style={s.sendJobCard} accessibilityRole="button" accessibilityLabel={'Send to '+job.issue}>
       <View style={{flex:1}}><Text style={s.sendJobTitle}>{job.issue}</Text>
       <Text style={s.sendJobMeta}>{job.trade} · {job.job_kind==='urgent'?'Urgent call-out':'Scheduled job'} · {job.status}</Text></View>
       {sendingToApp?<ActivityIndicator color={C.teal}/>:<ChevronRight size={20} color={C.teal}/>}
    </MotionPressable>):
      <View style={s.card}><Text style={s.sectionSub}>No accepted app jobs are linked to this tradesperson account yet. You can still share this PDF externally.</Text></View>}
    <Text style={s.helper}>Only select a job belonging to the customer this proposal was prepared for. Sending creates a read-only customer-facing snapshot; your estimated costs and margin are not shared.</Text>
   </ScrollView>:
   screen==='preview'&&selected?<View style={s.previewRoot}>
    <View style={s.previewInfo}><View style={{flex:1}}><Text style={s.quoteNo}>{quoteNo(selected.quote_no)} · {statusName(selected.status)}</Text>
      <Text style={s.quoteName}>{selected.customer_name}</Text></View><Text style={s.amount}>{money(selected.total)}</Text></View>
    <View style={s.previewPaper}><WebView source={{html:makeQuoteHtml(selected)}} originWhitelist={['*']}
      javaScriptEnabled={false} style={{flex:1,backgroundColor:'#FFFFFF'}}/></View>
    <View style={s.previewBottom}>
      {selectedDelivery?<View style={s.deliveryStatus}>
        <Text style={s.deliveryStatusTitle}>Sent in Tradarr · {selectedDelivery.decision==='pending'?'Awaiting customer decision':
          selectedDelivery.decision==='accepted'?'Customer accepted':
          selectedDelivery.decision==='declined'?'Customer declined':'Changes requested'}</Text>
        {selectedDelivery.job_id||selectedDelivery.urgent_request_id?
         <Text style={s.deliveryStatusText}>Linked to {selectedDelivery.job_id?'scheduled job':'urgent job'} · {appJobs.find(j=>j.id===(selectedDelivery.job_id||selectedDelivery.urgent_request_id))?.issue||'Tradarr work'}</Text>:null}
        {selectedDelivery.feedback?<Text style={s.deliveryStatusText}>Customer message: {selectedDelivery.feedback}</Text>:null}
      </View>:<MotionPressable style={s.sendInApp} onPress={()=>setScreen('send')} accessibilityRole="button">
        <Send color="#FFFFFF" size={18}/><Text style={s.sendInAppText}>Send inside Tradarr</Text><ChevronRight size={19} color="#FFFFFF"/>
      </MotionPressable>}
      <MotionPressable style={s.primary} onPress={()=>share(selected)} disabled={sharing}><Share2 size={19} color="#FFFFFF"/>
        <Text style={s.primaryText}>{sharing?'Preparing PDF…':'Share quote PDF'}</Text></MotionPressable>
      <View style={s.statusRow}>
        {selected.status==='draft'?<MotionPressable style={s.action} onPress={()=>setStatus(selected,'sent')}><Check size={16} color={C.teal}/><Text style={s.actionText}>Mark sent</Text></MotionPressable>:null}
        {!selectedDelivery&&(selected.status==='sent'||selected.status==='draft')?<MotionPressable style={s.action} onPress={()=>setStatus(selected,'accepted')}>
         <Check size={16} color={C.teal}/><Text style={s.actionText}>Mark accepted</Text></MotionPressable>:null}
        {!selectedDelivery&&selected.status==='sent'?<MotionPressable style={s.action} onPress={()=>setStatus(selected,'declined')}>
         <Text style={s.actionText}>Mark declined</Text></MotionPressable>:null}
      </View>
      {selected.status!=='declined'&&(!selectedDelivery||selectedDelivery.decision==='accepted'||!!selected.invoice_id)?
       <MotionPressable style={s.convert} onPress={()=>{void convert(selected)}} disabled={converting}>
       {converting?<ActivityIndicator color={C.teal}/>:<Text style={s.convertText}>{selected.invoice_id?'View linked invoice':'Convert to invoice'}</Text>}
       <ChevronRight size={19} color={C.teal}/></MotionPressable>:null}
      <MotionPressable style={s.partsAction} onPress={()=>reviseQuote(selected)} accessibilityRole="button"
          accessibilityLabel="Create corrected version of this proposal">
         <FileText size={16} color={C.teal}/><Text style={s.partsActionText}>Create a corrected version</Text>
         <ChevronRight size={18} color={C.teal}/>
       </MotionPressable>
       {selected.items.some(i=>i.kind==='material')?<MotionPressable style={s.partsAction} onPress={()=>createMaterials(selected)}
         disabled={creatingKit} accessibilityRole="button" accessibilityLabel="Make a shopping list from quoted materials">
          {creatingKit?<ActivityIndicator color={C.teal}/>:<Plus size={18} color={C.teal}/>}
          <Text style={s.partsActionText}>Make shopping list from this quote</Text><ChevronRight size={18} color={C.teal}/>
        </MotionPressable>:null}
       {selected.status==='sent'?<MotionPressable style={s.partsAction} onPress={()=>followUp(selected)}>
         <Send size={16} color={C.teal}/><Text style={s.partsActionText}>Prepare follow-up message</Text></MotionPressable>:null}
       <Text style={s.previewHint}>Statuses are marked manually. Sharing a PDF does not mean the customer has accepted it.</Text>
    </View>
   </View>:<ScrollView ref={scrollRef} style={{flex:1}}
     contentContainerStyle={[s.page,{paddingBottom:180}]}
     automaticallyAdjustKeyboardInsets={Platform.OS==='ios'}
     keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'}
     keyboardShouldPersistTaps="handled">
    <View style={s.stepBanner}>
      <Text style={s.stepSmall}>CUSTOMER PROPOSAL · {stage==='scope'?'STEP 1 OF 2':'STEP 2 OF 2'}</Text>
      <Text style={s.stepTitle}>{stage==='scope'?'Plan the work':'Price the job'}</Text>
      <Text style={s.stepDesc}>{stage==='scope'
        ?'Explain exactly what your customer gets — and what is excluded. Good quotes win trust before work starts.'
        :'Work out a fair charge, protect your margin and offer useful upgrades. The customer only sees the final proposal.'}</Text>
      <View style={s.stepTrack}><View style={[s.stepFill,{width:stage==='scope'?'50%':'100%'}]}/></View>
    </View>
    {stage==='scope'?<>
      <Text style={s.section}>Who is the job for?</Text>
      <View style={s.card}>
        <MotionPressable style={s.picker} onPress={()=>setShowPicker(x=>!x)}
          accessibilityRole="button" accessibilityLabel="Choose customer from your book">
          <Users size={18} color={C.teal}/>
          <Text style={s.pickerText}>{customerId?customers.find(x=>x.id===customerId)?.name:'Use someone from your customer book'}</Text>
          <ChevronRight size={18} color={C.teal}/>
        </MotionPressable>
        {showPicker?<View style={s.options}>
          <MotionPressable onPress={()=>chooseCustomer(null)} style={s.option}><Text style={s.optionText}>Enter customer manually</Text></MotionPressable>
          {customers.map(x=><MotionPressable key={x.id} onPress={()=>chooseCustomer(x)} style={s.option}><Text style={s.optionText}>{x.name}</Text></MotionPressable>)}
        </View>:null}
        <Field name="Customer name *" value={customerName} change={setCustomerName} placeholder="e.g. Sarah Williams"/>
        <Field name="Job / billing address *" value={customerAddress} change={setCustomerAddress} multi placeholder="Street, town, postcode"/>
        <Field name="Email (optional)" value={customerEmail} change={setCustomerEmail}/>
        <Field name="Phone (optional)" value={customerPhone} change={setCustomerPhone}/>
      </View>
      <Text style={s.section}>The job at a glance</Text>
      <View style={s.card}>
        <Field name="Project title *" value={title} change={setTitle} placeholder="e.g. Replace and balance 3 radiators"/>
        <Field name="What does the customer need?" value={description} change={setDescription} multi
          placeholder="Brief description of the problem or installation"/>
        <View style={s.scopeHelper}><Text style={s.scopeHelperTitle}>Make the scope unmistakable</Text>
          <Text style={s.scopeHelperText}>The customer should know exactly what they're agreeing to. These details appear on the proposal, not just your app.</Text></View>
        <Field name="What's included in the price?" value={included} change={setIncluded} multi
          placeholder="e.g. Isolate heating, replace valves, refill and test the system"/>
        <Field name="What's NOT included?" value={excluded} change={setExcluded} multi
          placeholder="e.g. Making good existing damaged plasterwork"/>
        <Field name="Estimated time on site" value={duration} change={setDuration} onFocus={bringBottomIntoView}
          placeholder="e.g. 2 days, subject to access"/>
      </View>
      <MotionPressable style={s.primary} onPress={()=>{
        if(!customerName.trim()||!customerAddress.trim()||!title.trim()){
          Alert.alert('Finish the job brief','Add a customer, address and project title first.');return;
        }
        setStage('pricing');
      }} accessibilityRole="button">
        <Text style={s.primaryText}>Continue to pricing</Text><ChevronRight size={20} color="#FFFFFF"/>
      </MotionPressable>
      <Text style={[s.helper,{textAlign:'center',marginTop:7}]}>Nothing is sent to the customer at this stage.</Text>
    </>:<>
      <View style={s.projectSummary}><Text style={s.projectSummaryTitle}>{title}</Text>
        <Text style={s.projectSummarySub}>For {customerName} · {customerAddress}</Text>
        <MotionPressable onPress={()=>setStage('scope')} style={s.editScope}><Text style={s.editScopeText}>Edit scope</Text><ChevronRight size={16} color={C.teal}/></MotionPressable>
      </View>
      <Text style={s.section}>Build the job price</Text>
      <Text style={s.sectionSub}>Price each labour task and part separately. Only this breakdown goes into the final quote and later invoice.</Text>
    <View style={s.sectionRow}><Text style={s.section}>Labour & materials</Text></View>
    <View style={s.twoButtons}><MotionPressable style={s.addLine} onPress={()=>addLine('labour')}><Plus size={16} color={C.teal}/><Text style={s.addLineText}>Add labour</Text></MotionPressable>
     <MotionPressable style={s.addLine} onPress={()=>addLine('material')}><Plus size={16} color={C.teal}/><Text style={s.addLineText}>Add material</Text></MotionPressable></View>
    {lines.map((v,i)=><View style={s.card} key={i}>
     <View style={s.sectionRow}><Text style={s.lineTitle}>{label(v.kind)} · {lines.slice(0,i+1).filter(x=>x.kind===v.kind).length}</Text>
      {lines.length>1?<MotionPressable onPress={()=>setLines(old=>old.filter((_,j)=>j!==i))}><Trash2 size={18} color={C.coralDark}/></MotionPressable>:null}</View>
     <Field name="Work or item description *" value={v.description} change={x=>updateLine(i,{description:x})} placeholder="e.g. Fit pipework"/>
     <View style={s.two}><View style={{flex:1}}><Field name="Quantity" numeric value={v.quantity} change={x=>updateLine(i,{quantity:x})}/></View>
      <View style={{flex:1}}><Field name="Price per unit (£)" numeric value={v.unit_price} change={x=>updateLine(i,{unit_price:x})} placeholder="0.00"/></View></View>
     <View style={s.pills}>{choicesFor(v.kind).map(unit=>
      <Pill key={unit} name={unitOptionLabel(unit)} selected={v.unit===unit} onPress={()=>changeUnit(i,unit)}/>)}</View>
     <Text style={s.lineTotal}>Customer sees: {formatTradeQuantity(v.quantity,v.unit)} × {money(val(v.unit_price)||0)} = {money(pennies(v)/100)}</Text>
     {v.unit==='job'&&val(v.quantity)!==1?<Text style={s.unitWarning}>Fixed-price work must be 1 job. Choose Per radiator, Per valve or Per item for multiple units.</Text>:null}
    </View>)}
    <MotionPressable style={s.extraLine} onPress={()=>addLine('other')}><Plus size={16} color={C.teal}/>
     <Text style={s.extraLineText}>Add call-out fee or other charge</Text></MotionPressable>

      <View style={s.priceCoach}>
        <Text style={s.priceCoachEyebrow}>PRIVATE PRICE CHECK</Text>
        <Text style={s.priceCoachTitle}>Will this job be worth doing?</Text>
        <Text style={s.priceCoachDetail}>Enter your expected cost to complete the work, including materials, paid labour and travel. We'll compare it with what you're charging.</Text>
        <View style={s.two}><View style={{flex:1}}>
          <Field name="Estimated costs (£)" value={estimateCost} change={setEstimateCost} placeholder="e.g. 140.00"/>
        </View><View style={{flex:1}}>
          <Field name="Target margin (%)" value={targetMargin} change={setTargetMargin} placeholder="30"/>
        </View></View>
        <View style={s.priceCoachStats}>
          <View style={{flex:1}}><Text style={s.priceCoachStatLabel}>Current est. margin</Text>
            <Text style={s.priceCoachNumber}>{estimateCost.trim()&&subtotal>0?marginPreview.toFixed(1)+'%':'—'}</Text></View>
          <View style={{flex:1}}><Text style={s.priceCoachStatLabel}>Price to reach target (ex VAT)</Text>
            <Text style={s.priceCoachNumber}>{estimateCost.trim()&&marginGoal>=0&&marginGoal<=90?money(priceToHitGoal):'—'}</Text></View>
        </View>
        <Text style={s.coachFine}>For your eyes only — never shown in the PDF. This is a calculation based on your own costs, not an externally verified market price or guaranteed profit. Overheads and tax are not included unless you enter them.</Text>
      </View>
      <Text style={s.section}>Let customers choose extras</Text>
      <Text style={s.sectionSub}>Offer upgrades without forcing them into the base price. These appear as optional choices on the proposal.</Text>
      <View style={s.card}>
        {extras.map((extra,index)=><View key={index} style={s.extraEntry}>
          <View style={s.sectionRow}><Text style={s.lineTitle}>Optional upgrade {index+1}</Text>
            <MotionPressable onPress={()=>setExtras(old=>old.filter((_,i)=>i!==index))}><Trash2 size={18} color={C.coralDark}/></MotionPressable></View>
          <Field name="Upgrade description" value={extra.name}
            change={v=>setExtras(old=>old.map((e,i)=>i===index?{...e,name:v}:e))}
            placeholder="e.g. Upgrade to premium thermostatic valves"/>
          <Field name="Additional price excluding VAT (£)" value={extra.price}
            change={v=>setExtras(old=>old.map((e,i)=>i===index?{...e,price:v}:e))} placeholder="50.00"/>
        </View>)}
        <MotionPressable onPress={()=>setExtras(old=>[...old,{name:'',price:''}])} disabled={extras.length>=15}
          style={s.addExtra}><Plus size={18} color={C.teal}/><Text style={s.addLineText}>Add an optional upgrade</Text></MotionPressable>
      </View>
      <Text style={s.section}>Quote validity & terms</Text>
      <View style={s.card}>
        <View style={s.two}><View style={{flex:1}}>
          <Field name="Quote date" value={quoteDate} change={setQuoteDate} placeholder="YYYY-MM-DD"/></View>
          <View style={{flex:1}}><Field name="Valid until" value={validUntil} change={setValidUntil} placeholder="YYYY-MM-DD"/></View></View>
        <Field name="Deposit to request (%)" value={deposit} change={setDeposit} placeholder="0"/>
        <Text style={s.helper}>Deposit is a term on the proposal. Tradarr doesn't automatically charge anyone.</Text>
        <Field name="Other terms / assumptions" value={notes} change={setNotes} multi placeholder="e.g. Price subject to safe access"/>
      </View>
      <Text style={s.section}>VAT</Text><View style={s.card}>
        <Text style={s.small}>Only charge VAT if you are VAT registered. Choose the correct rate for this work.</Text>
        <View style={s.pills}>{[0,5,20].map(rate=><Pill key={rate} name={rate?rate+'% VAT':'No VAT'}
          selected={vatRate===rate} onPress={()=>setVatRate(rate)}/>)}</View>
        {vatRate>0?<Field name="VAT registration number *" value={vatNumber} change={setVatNumber}/>:null}
      </View>
      <MotionPressable style={s.businessToggle} onPress={()=>setShowBusiness(x=>!x)}>
        <View style={{flex:1}}><Text style={s.businessToggleTitle}>Your business details</Text>
          <Text style={s.businessToggleSub}>{businessName&&businessAddress?'Saved from your previous paperwork':'Required to create the proposal'}</Text>
        </View><ChevronRight size={18} color={C.teal} style={showBusiness?{transform:[{rotate:'90deg'}]}:undefined}/></MotionPressable>
      {showBusiness?<View style={s.card}>
        <Field name="Business / trading name *" value={businessName} change={setBusinessName}/>
        <Field name="Business address *" value={businessAddress} change={setBusinessAddress} multi/>
        <Field name="Business email (optional)" value={businessEmail} change={setBusinessEmail}/>
        <Field name="Business phone (optional)" value={businessPhone} change={setBusinessPhone}/>
      </View>:null}
      <View style={s.proposalSummary}>
        <Text style={s.proposalSummaryCaption}>CUSTOMER'S PROPOSED PRICE</Text>
        <Text style={s.proposalSummaryTotal}>{money(total)}</Text>
        <Text style={s.proposalSummaryDetail}>Includes {money(vat)} VAT · optional upgrades excluded</Text>
        <View style={s.summaryDivider}/>
        <Text style={s.proposalSummaryDetail}>Validity: until {validUntil} · Deposit requested: {val(deposit)||0}%</Text>
      </View>
      <MotionPressable style={s.primary} disabled={saving} onPress={()=>{
        if(!businessName.trim()||!businessAddress.trim()){setShowBusiness(true);
          Alert.alert('Finish business details','Please check your business name and full address before creating the proposal.');return;}
        void saveQuote();
      }}>
        {saving?<ActivityIndicator color="#FFFFFF"/>:<FileText size={20} color="#FFFFFF"/>}
        <Text style={s.primaryText}>{saving?'Creating…':'Generate customer proposal'}</Text>
      </MotionPressable>
      <Text style={[s.helper,{textAlign:'center',marginTop:8}]}>You'll preview it inside Tradarr first. Nothing gets sent automatically.</Text>
    </>}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 sendJobCard:{minHeight:75,padding:16,backgroundColor:'#FFFFFF',borderRadius:20,marginBottom:10,flexDirection:'row',gap:11,alignItems:'center',...theme.shadow},
 sendJobTitle:{fontSize:14,fontWeight:'800',color:C.ink},
 sendJobMeta:{color:C.muted,fontSize:11,marginTop:5,lineHeight:17},
 sendInApp:{minHeight:47,borderRadius:24,backgroundColor:'#245758',paddingHorizontal:17,marginBottom:7,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
 sendInAppText:{fontWeight:'800',fontSize:13,color:'#FFFFFF'},
 deliveryStatus:{padding:12,backgroundColor:C.tealTint,borderRadius:17,marginBottom:9},
 deliveryStatusTitle:{fontSize:12,fontWeight:'800',color:C.teal},
 deliveryStatusText:{fontSize:11,color:C.ink,lineHeight:16,marginTop:5},

 pipelineRow:{flexDirection:'row',gap:11,marginTop:17,marginBottom:9},
 pipelineCard:{flex:1,padding:16,backgroundColor:'#FFFFFF',borderRadius:22,...theme.shadow},
 pipelineLabel:{fontSize:11,color:C.muted,lineHeight:17},
 pipelineValue:{fontSize:26,fontWeight:'800',color:C.ink,marginTop:7},
 pipelineHint:{fontSize:11,color:C.muted,marginTop:5,lineHeight:16},
 partsAction:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,padding:10,marginTop:8},
 partsActionText:{fontSize:12,fontWeight:'800',color:C.teal},
 unitWarning:{fontSize:11,lineHeight:17,color:C.coralDark,marginTop:9},

 stepBanner:{backgroundColor:C.darkTeal,borderRadius:25,padding:22,marginBottom:13},
 stepSmall:{fontSize:10,color:'#B4D6D2',letterSpacing:1.4,fontWeight:'800'},
 stepTitle:{fontSize:26,fontWeight:'800',color:'#FFFFFF',marginTop:9},
 stepDesc:{fontSize:13,color:'#D6E5E2',lineHeight:20,marginTop:8},
 stepTrack:{height:5,backgroundColor:'#476266',borderRadius:5,overflow:'hidden',marginTop:18},
 stepFill:{height:5,backgroundColor:'#B4DBCD',borderRadius:5},
 scopeHelper:{backgroundColor:C.tealTint,borderRadius:15,padding:14,marginBottom:16},
 scopeHelperTitle:{color:C.teal,fontSize:13,fontWeight:'800'},
 scopeHelperText:{color:C.muted,fontSize:11,lineHeight:18,marginTop:6},
 sectionSub:{fontSize:12,color:C.muted,lineHeight:19,marginTop:-4,marginBottom:15},
 projectSummary:{backgroundColor:'#FFFFFF',borderRadius:21,padding:17,...theme.shadow},
 projectSummaryTitle:{fontSize:18,fontWeight:'800',color:C.ink},
 projectSummarySub:{fontSize:12,color:C.muted,marginTop:7,lineHeight:18},
 editScope:{flexDirection:'row',alignItems:'center',gap:5,marginTop:10,alignSelf:'flex-start'},
 editScopeText:{color:C.teal,fontSize:12,fontWeight:'800'},
 priceCoach:{backgroundColor:C.tealTint,borderRadius:25,padding:18,marginTop:13},
 priceCoachEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:C.teal},
 priceCoachTitle:{fontSize:18,color:C.ink,fontWeight:'800',marginTop:8},
 priceCoachDetail:{fontSize:12,lineHeight:19,color:C.muted,marginTop:8,marginBottom:16},
 priceCoachStats:{flexDirection:'row',gap:12,marginTop:7},
 priceCoachStatLabel:{fontSize:11,color:C.muted,lineHeight:17},
 priceCoachNumber:{fontSize:19,fontWeight:'800',color:C.teal,marginTop:8},
 coachFine:{fontSize:10,color:C.muted,lineHeight:16,marginTop:15},
 extraEntry:{borderBottomColor:C.line,borderBottomWidth:1,marginBottom:15},
 addExtra:{minHeight:47,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.tealTint,borderRadius:16},
 businessToggle:{marginTop:18,marginBottom:11,backgroundColor:'#FFFFFF',borderRadius:21,padding:16,flexDirection:'row',alignItems:'center'},
 businessToggleTitle:{fontSize:15,color:C.ink,fontWeight:'800'},
 businessToggleSub:{fontSize:11,color:C.muted,marginTop:4},
 proposalSummary:{backgroundColor:C.darkTeal,borderRadius:24,padding:22,marginTop:16,marginBottom:18},
 proposalSummaryCaption:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#B7D8D4'},
 proposalSummaryTotal:{fontSize:34,fontWeight:'800',color:'#FFFFFF',marginTop:7},
 proposalSummaryDetail:{fontSize:12,color:'#D7E6E4',marginTop:9,lineHeight:18},
 summaryDivider:{height:1,backgroundColor:'#456468',marginTop:16,marginBottom:6},

 root:{flex:1,backgroundColor:C.proBackground},
 header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:15},
 back:{width:44,height:44,borderRadius:24,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:C.teal},title:{fontSize:27,fontWeight:'800',color:C.ink,marginTop:3},
 add:{flexDirection:'row',minHeight:44,paddingHorizontal:16,backgroundColor:C.darkTeal,borderRadius:24,gap:6,alignItems:'center'},addText:{fontSize:13,color:'#FFFFFF',fontWeight:'800'},
 page:{paddingHorizontal:20,paddingTop:9,paddingBottom:40},intro:{fontSize:13,lineHeight:21,color:C.muted,marginBottom:17},
 section:{fontSize:18,fontWeight:'800',color:C.ink,marginTop:20,marginBottom:12},
 primary:{minHeight:55,borderRadius:28,backgroundColor:C.darkTeal,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingHorizontal:18,marginBottom:8},
 primaryText:{color:'#FFFFFF',fontSize:14,fontWeight:'800',flex:1,textAlign:'center'},
 quoteCard:{backgroundColor:'#FFFFFF',borderRadius:24,padding:17,marginBottom:12,...theme.shadow},
 quoteTop:{flexDirection:'row',gap:11,alignItems:'flex-start'},
 quoteNo:{fontSize:11,fontWeight:'800',color:C.teal},
 quoteName:{fontSize:16,fontWeight:'800',color:C.ink,marginTop:4},
 amount:{fontSize:17,fontWeight:'800',color:C.ink},
 status:{fontSize:9,fontWeight:'800',color:C.teal,backgroundColor:C.tealTint,overflow:'hidden',paddingVertical:6,paddingHorizontal:9,borderRadius:11},
 small:{fontSize:12,color:C.muted,lineHeight:18,marginTop:6},
 quoteActions:{flexDirection:'row',gap:9,marginTop:15,borderTopWidth:1,borderTopColor:C.line,paddingTop:12,flexWrap:'wrap'},
 action:{flexDirection:'row',minHeight:36,paddingHorizontal:13,backgroundColor:C.tealTint,borderRadius:19,alignItems:'center',gap:7},
 actionText:{fontSize:12,fontWeight:'800',color:C.teal},
 empty:{backgroundColor:'#FFFFFF',borderRadius:26,padding:26,alignItems:'center',gap:11,...theme.shadow},
 emptyTitle:{fontSize:18,fontWeight:'800',color:C.ink},
 card:{backgroundColor:'#FFFFFF',borderRadius:24,padding:17,marginBottom:12,...theme.shadow},
 field:{marginBottom:13},label:{fontSize:12,fontWeight:'800',color:C.ink,marginBottom:7},
 input:{minHeight:47,borderWidth:1,borderColor:C.line,backgroundColor:'#F9FBFA',borderRadius:13,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:C.ink},
 picker:{flexDirection:'row',minHeight:46,alignItems:'center',gap:8,backgroundColor:C.tealTint,borderRadius:14,paddingHorizontal:12,marginBottom:14},
 pickerText:{color:C.teal,fontWeight:'800',fontSize:12,flex:1},
 options:{maxHeight:235,backgroundColor:'#F6F9F8',paddingHorizontal:10,borderRadius:14,marginBottom:15},
 option:{paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.line},
 optionText:{color:C.ink,fontSize:13,fontWeight:'700'},
 helper:{color:C.muted,fontSize:11,lineHeight:17},
 two:{flexDirection:'row',gap:11},twoButtons:{flexDirection:'row',gap:10,marginBottom:13},
 addLine:{flex:1,minHeight:49,backgroundColor:C.tealTint,borderRadius:16,borderWidth:1,borderColor:'#C6DCD8',flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center'},
 addLineText:{fontSize:13,fontWeight:'800',color:C.teal},
 sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
 lineTitle:{color:C.ink,fontSize:15,fontWeight:'800'},
 pills:{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:11},
 pill:{borderRadius:19,paddingHorizontal:13,paddingVertical:9,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line},
 pillOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 pillText:{fontSize:12,color:C.muted,fontWeight:'800'},pillTextOn:{color:C.teal},
 lineTotal:{textAlign:'right',fontSize:13,color:C.teal,fontWeight:'800'},
 extraLine:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:13},
 extraLineText:{color:C.teal,fontSize:12,fontWeight:'800'},
 totalCard:{backgroundColor:'#FFFFFF',padding:20,borderRadius:23,marginTop:8,marginBottom:20,...theme.shadow},
 totalRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8},
 totalLabel:{fontSize:13,color:C.muted},totalTitle:{fontSize:17,fontWeight:'800',color:C.ink},
 totalAmount:{fontSize:23,color:C.teal,fontWeight:'800'},
 previewRoot:{flex:1,backgroundColor:C.proBackground},
 previewInfo:{flexDirection:'row',alignItems:'center',paddingHorizontal:19,paddingVertical:11,gap:12},
 previewPaper:{flex:1,marginHorizontal:12,backgroundColor:'#FFFFFF',borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.line,...theme.shadow},
 previewBottom:{paddingHorizontal:16,paddingVertical:10},
 statusRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:5,flexWrap:'wrap'},
 convert:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,padding:11,marginTop:5},
 convertText:{fontSize:13,fontWeight:'800',color:C.teal},
 previewHint:{color:C.muted,fontSize:10,textAlign:'center',marginTop:5,lineHeight:15}
});
