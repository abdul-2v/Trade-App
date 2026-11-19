import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Platform,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,CalendarDays,CheckCircle2,ChevronRight,FileText,RefreshCw,Share2,ShieldCheck} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type Line={kind?:string;description:string;quantity:number;unit_price:number;unit?:string};
type Invoice={
 id:string;invoice_no:number;source:string;status:'sent'|'paid';created_at:string;
 tradesperson_id:string;app_job_id:string|null;urgent_request_id:string|null;quote_id:string|null;
 business_name:string;business_address:string;business_email:string|null;business_phone:string|null;
 vat_number:string|null;customer_name:string;customer_address:string;customer_email:string|null;
 description:string|null;items:Line[];invoice_date:string;service_date:string;due_date:string;
 vat_rate:number;subtotal:number;vat_amount:number;total:number;payment_details:string|null;notes:string|null;
};
const C=theme.colors;
const money=(value:number)=>'£'+Number(value||0).toFixed(2);
const date=(value:string|null)=>value?new Date(value+'T12:00:00').toLocaleDateString('en-GB',
 {day:'numeric',month:'short',year:'numeric'}):'—';
const invNo=(n:number)=>'INV-'+String(n).padStart(5,'0');
const escapeHtml=(value:unknown)=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[ch]||ch));
const htmlText=(value:unknown)=>escapeHtml(value).replace(/\n/g,'<br/>');

function invoiceHtml(doc:Invoice){
 const rows=(Array.isArray(doc.items)?doc.items:[]).map(item=>
  '<tr><td>'+escapeHtml(item.description)+'</td><td>'+
  escapeHtml(String(item.quantity))+' '+escapeHtml(item.unit||'')+
  '</td><td>'+escapeHtml(money(Number(item.unit_price)))+
  '</td><td>'+escapeHtml(money(Number(item.quantity)*Number(item.unit_price)))+'</td></tr>'
 ).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"/>'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>'+
  '<style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#183238;margin:35px;font-size:12px}'+
  'h1{font-size:27px;margin:0 0 8px;color:#144F50}.top{display:flex;justify-content:space-between;gap:25px}'+
  'h2{font-size:13px;margin:18px 0 7px}.small{font-size:11px;color:#52706F;line-height:1.6}'+
  'table{border-collapse:collapse;width:100%;margin-top:23px}th,td{border-bottom:1px solid #DCE5E3;padding:11px 5px;text-align:left}'+
  'th{background:#EDF4F0;font-size:11px}.totals{margin-left:auto;max-width:260px;margin-top:16px}'+
  '.total{font-size:18px;font-weight:bold;border-top:2px solid #144F50;padding-top:8px}'+
  '.note{margin-top:20px;padding:12px;background:#F1F7F4;white-space:normal;line-height:1.6}'+
  '</style></head><body><div class="top"><div><h1>INVOICE</h1><b>'+
  escapeHtml(invNo(doc.invoice_no))+'</b><p class="small">'+
  escapeHtml(doc.status==='paid'?'Marked paid by tradesperson':'Issued · payment status not confirmed')+
  '</p></div><div class="small"><b>'+escapeHtml(doc.business_name)+'</b><br/>'+
  htmlText(doc.business_address)+'<br/>'+escapeHtml(doc.business_email||'')+
  '<br/>'+escapeHtml(doc.business_phone||'')+'</div></div>'+
  '<h2>Bill to</h2><div>'+escapeHtml(doc.customer_name)+'<br/>'+htmlText(doc.customer_address)+
  (doc.customer_email?'<br/>'+escapeHtml(doc.customer_email):'')+'</div>'+
  '<h2>Dates</h2><div class="small">Invoice '+escapeHtml(date(doc.invoice_date))+
  ' · Work '+escapeHtml(date(doc.service_date))+' · Due '+escapeHtml(date(doc.due_date))+'</div>'+
  (doc.description?'<h2>Work description</h2><div>'+htmlText(doc.description)+'</div>':'')+
  '<table><thead><tr><th>Item</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '<div class="totals"><p>Subtotal: '+escapeHtml(money(doc.subtotal))+
  '</p><p>VAT ('+escapeHtml(String(doc.vat_rate))+'%): '+escapeHtml(money(doc.vat_amount))+
  '</p><p class="total">Total: '+escapeHtml(money(doc.total))+'</p></div>'+
  (doc.vat_number?'<p class="small">VAT number: '+escapeHtml(doc.vat_number)+'</p>':'')+
  (doc.payment_details?'<div class="note"><b>Payment details</b><br/>'+htmlText(doc.payment_details)+'</div>':'')+
  (doc.notes?'<div class="note"><b>Notes</b><br/>'+htmlText(doc.notes)+'</div>':'')+
  '<p class="small">This document was issued by the named tradesperson using Tradarr. Tradarr does not process or verify the payment.</p></body></html>';
}
export default function CustomerInvoicesScreen({goBack,openActivity}:{
 goBack:()=>void;openActivity:()=>void
}){
 const [rows,setRows]=useState<Invoice[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [sharing,setSharing]=useState(false);
 const chosen=rows.find(x=>x.id===selectedId)||null;
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(authError||!auth.user)throw new Error('Sign in to view your issued invoices.');
   const result=await Promise.race([
    supabase.from('trade_invoices').select('*').eq('source','app')
     .in('status',['sent','paid']).order('created_at',{ascending:false}).limit(100),
    new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Connection timed out. Pull down to retry.')),15000))
   ]);
   if(result.error)throw result.error;
   setRows((result.data||[]) as Invoice[]);
   setError('');
  }catch(e:any){setError(e?.message||'Could not load invoices. Check your connection and retry.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{
  void load();
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void load(true);});
  return()=>listener.remove();
 },[load]);
 const totalDue=useMemo(()=>rows.filter(x=>x.status==='sent').reduce((n,x)=>n+Number(x.total),0),[rows]);
 const share=async(doc:Invoice)=>{
  if(sharing)return;
  setSharing(true);
  try{
   if(Platform.OS==='web')await Print.printAsync({html:invoiceHtml(doc)});
   else{
    const file=await Print.printToFileAsync({html:invoiceHtml(doc)});
    if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri,{
      mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Save or share '+invNo(doc.invoice_no)
    });
    else await Print.printAsync({html:invoiceHtml(doc)});
   }
  }catch(e:any){Alert.alert('Unable to export invoice',e?.message||'Please retry.');}
  finally{setSharing(false);}
 };
 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={selectedId?()=>setSelectedId(null):goBack}
     style={s.back} accessibilityRole="button" accessibilityLabel="Back">
    <ArrowLeft size={22} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.overline}>YOUR JOB RECORDS</Text>
    <Text style={s.heading}>{chosen?'Invoice details':'Invoices & receipts'}</Text>
   </View>
  </View>
  {loading?<View style={s.loading}><ActivityIndicator color={C.teal} size="large"/>
    <Text style={s.muted}>Loading your issued invoices…</Text></View>:
   <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
    {error?<View style={s.error}>
      <Text style={s.errorText}>{error}</Text>
      <MotionPressable onPress={()=>{void load(true)}} style={s.retry} accessibilityRole="button">
       <RefreshCw size={15} color={C.teal}/><Text style={s.link}>Try again</Text>
      </MotionPressable>
     </View>:null}
    {!chosen?<>
     <View style={s.hero}>
      <FileText size={28} color="#C5E4DD"/>
      <Text style={s.heroTitle}>Your invoices, in one place.</Text>
      <Text style={s.heroSub}>See invoices issued for your Tradarr bookings. Download a PDF and keep the job paperwork together.</Text>
     </View>
     <View style={s.stats}>
      <View style={s.stat}><Text style={s.statNumber}>{rows.length}</Text><Text style={s.statLabel}>Issued invoices</Text></View>
      <View style={s.stat}><Text style={s.statNumber}>{money(totalDue)}</Text><Text style={s.statLabel}>Marked unpaid</Text></View>
     </View>
     <Text style={s.section}>Your documents</Text>
     {rows.length?rows.map(doc=><MotionPressable key={doc.id}
      onPress={()=>setSelectedId(doc.id)} accessibilityRole="button" style={s.card}
      accessibilityLabel={'View invoice '+invNo(doc.invoice_no)}>
       <View style={{flex:1,gap:5}}>
        <Text style={s.overline}>{invNo(doc.invoice_no)}</Text>
        <Text style={s.cardTitle} numberOfLines={2}>{doc.business_name}</Text>
        <Text style={s.muted}>Issued {date(doc.invoice_date)} · Due {date(doc.due_date)}</Text>
        <Text style={[s.status,doc.status==='paid'&&s.statusPaid]}>
         {doc.status==='paid'?'Marked paid':'Issued · unpaid'}
        </Text>
       </View>
       <View style={{alignItems:'flex-end',gap:12}}>
        <Text style={s.amount}>{money(doc.total)}</Text><ChevronRight size={19} color={C.teal}/>
       </View>
      </MotionPressable>):
      <View style={s.empty}><FileText color={C.teal} size={34}/>
       <Text style={s.cardTitle}>No issued invoices yet</Text>
       <Text style={[s.muted,{textAlign:'center'}]}>When a tradesperson issues an invoice for your Tradarr job, it will appear here. Drafts and invoices sent outside Tradarr are not included.</Text>
       <MotionPressable style={s.primary} onPress={openActivity}>
        <Text style={s.primaryText}>View my jobs</Text>
       </MotionPressable>
      </View>}
    </>:<>
     <View style={s.card}>
      <Text style={s.overline}>{invNo(chosen.invoice_no)}</Text>
      <Text style={s.cardTitle}>{chosen.business_name}</Text>
      <Text style={s.muted}>{chosen.status==='paid'?'Tradesperson marked this invoice paid':'Issued · payment not yet recorded'}</Text>
      <Text style={s.bigTotal}>{money(chosen.total)}</Text>
      <View style={s.metaRow}><CalendarDays size={16} color={C.teal}/>
       <Text style={s.muted}>Issued {date(chosen.invoice_date)} · Due {date(chosen.due_date)}</Text>
      </View>
      <View style={s.divider}/>
      <Text style={s.section}>Invoice items</Text>
      {(Array.isArray(chosen.items)?chosen.items:[]).map((line,i)=>
       <View key={i} style={s.line}>
        <View style={{flex:1}}>
         <Text style={s.lineName}>{line.description}</Text>
         <Text style={s.muted}>{line.quantity} {line.unit||''} × {money(line.unit_price)}</Text>
        </View>
        <Text style={s.lineAmount}>{money(line.quantity*line.unit_price)}</Text>
       </View>)}
      <View style={s.totals}><Text style={s.muted}>Subtotal</Text><Text style={s.lineAmount}>{money(chosen.subtotal)}</Text></View>
      <View style={s.totals}><Text style={s.muted}>VAT ({chosen.vat_rate}%)</Text><Text style={s.lineAmount}>{money(chosen.vat_amount)}</Text></View>
      <View style={s.totals}><Text style={s.totalLabel}>Total</Text><Text style={s.bigTotalSmall}>{money(chosen.total)}</Text></View>
     </View>
     <View style={s.card}>
      <Text style={s.section}>Business & billing details</Text>
      <Text style={s.muted}>{chosen.business_name}{'\n'}{chosen.business_address}</Text>
      <Text style={[s.muted,{marginTop:8}]}>Billed to {chosen.customer_name}{'\n'}{chosen.customer_address}</Text>
      {chosen.payment_details?<View style={s.payment}><Text style={s.lineName}>Payment instructions</Text>
       <Text style={s.muted}>{chosen.payment_details}</Text></View>:null}
      {chosen.notes?<Text style={[s.muted,{marginTop:10}]}>{chosen.notes}</Text>:null}
     </View>
     <MotionPressable style={s.primary} disabled={sharing} onPress={()=>{void share(chosen)}}
      accessibilityRole="button" accessibilityLabel="Download or share invoice PDF">
      {sharing?<ActivityIndicator color="#FFFFFF"/>:<Share2 color="#FFFFFF" size={18}/>}
      <Text style={s.primaryText}>{sharing?'Preparing PDF…':'Save or share invoice PDF'}</Text>
     </MotionPressable>
     <View style={s.footer}><ShieldCheck color={C.teal} size={18}/>
      <Text style={[s.muted,{flex:1}]}>Only invoices linked to your own jobs are shown. “Paid” reflects the tradesperson’s record, not a payment processed by Tradarr.</Text>
     </View>
    </>}
   </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},
 header:{flexDirection:'row',gap:14,alignItems:'center',paddingHorizontal:17,paddingTop:15,paddingBottom:13},
 back:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#FFFFFF'},
 overline:{fontSize:10,letterSpacing:1,textTransform:'uppercase',fontWeight:'900',color:C.teal},
 heading:{fontSize:22,fontWeight:'900',color:C.ink,marginTop:3},
 page:{paddingHorizontal:18,paddingTop:8,paddingBottom:100,gap:13},
 loading:{paddingTop:85,alignItems:'center',gap:14},
 hero:{borderRadius:22,backgroundColor:C.darkTeal,padding:22,gap:10},
 heroTitle:{fontSize:20,fontWeight:'900',color:'#FFFFFF'},
 heroSub:{fontSize:12,lineHeight:19,color:'#D5E9E4'},
 muted:{fontSize:12,lineHeight:19,color:C.muted},
 section:{fontSize:14,fontWeight:'900',color:C.ink,marginBottom:4},
 stats:{flexDirection:'row',gap:9},
 stat:{flex:1,borderRadius:18,backgroundColor:'#FFFFFF',padding:15,gap:6},
 statNumber:{fontSize:19,fontWeight:'900',color:C.teal},
 statLabel:{fontSize:11,color:C.muted},
 card:{borderRadius:20,backgroundColor:'#FFFFFF',padding:17,flexDirection:'row',gap:12,justifyContent:'space-between',alignItems:'flex-start',...theme.shadow},
 cardTitle:{fontSize:16,fontWeight:'900',color:C.ink},
 amount:{fontSize:18,fontWeight:'900',color:C.ink},
 status:{fontSize:11,fontWeight:'900',color:'#9A6210',backgroundColor:'#FFF5E4',
  paddingHorizontal:10,paddingVertical:7,overflow:'hidden',borderRadius:12,alignSelf:'flex-start'},
 statusPaid:{color:'#14744B',backgroundColor:'#E5F5ED'},
 empty:{alignItems:'center',backgroundColor:'#FFFFFF',borderRadius:21,padding:25,gap:12},
 primary:{backgroundColor:C.darkTeal,paddingHorizontal:22,minHeight:50,borderRadius:17,
  flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},
 primaryText:{fontWeight:'900',fontSize:13,color:'#FFFFFF'},
 bigTotal:{fontSize:31,fontWeight:'900',color:C.ink,marginVertical:13},
 bigTotalSmall:{fontSize:19,fontWeight:'900',color:C.ink},
 metaRow:{flexDirection:'row',alignItems:'center',gap:9},
 divider:{height:1,backgroundColor:'#E7EFEB',marginVertical:14},
 line:{flexDirection:'row',gap:12,paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#E7EFEB'},
 lineName:{fontSize:12,fontWeight:'800',color:C.ink,flexWrap:'wrap'},
 lineAmount:{fontSize:12,fontWeight:'900',color:C.ink},
 totals:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:11},
 totalLabel:{fontSize:15,fontWeight:'900',color:C.ink},
 payment:{marginTop:12,padding:14,borderRadius:14,backgroundColor:'#EFF6F3',gap:7},
 footer:{flexDirection:'row',gap:9,padding:12,alignItems:'flex-start'},
 error:{borderRadius:14,backgroundColor:'#FFF2E7',padding:14,gap:8},
 errorText:{fontSize:12,color:'#8C4C22'},
 retry:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:5},
 link:{fontSize:12,color:C.teal,fontWeight:'800'}
});
