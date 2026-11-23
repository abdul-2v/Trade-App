import {formatTradeQuantity} from './documentUnits';
export type InvoicePdfData={
 invoice_no:number;status:string;business_name:string;business_legal_name?:string|null;business_address:string;
 business_email?:string|null;business_phone?:string|null;vat_number?:string|null;
 customer_name:string;customer_address:string;customer_email?:string|null;
 description?:string|null;items?:Array<{kind?:string;description:string;quantity:number;unit_price:number;unit?:string}>;
 invoice_date:string;service_date:string;due_date:string;
 vat_rate:number;subtotal:number;discount_amount?:number;deposit_requested?:number;vat_amount:number;total:number;
 payment_details?:string|null;notes?:string|null;
 invoice_details?:{companyNumber?:string;jobReference?:string;purchaseOrder?:string;workAddress?:string;
  workStartDate?:string;paymentTerms?:string;bankName?:string;accountName?:string;sortCode?:string;
  accountNumber?:string;paymentReference?:string};
};
const money=(value:number)=>'£'+Number(value||0).toFixed(2);
const number=(value:number)=>'INV-'+String(value).padStart(5,'0');
const safe=(v:unknown)=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const htmlText=(value:unknown)=>safe(value).replace(/\n/g,'<br/>');
const labelForKind=(kind:string)=>kind==='labour'?'Labour':kind==='material'?'Materials':'Other charges';
const linePence=(line:{quantity:number;unit_price:number})=>
 Math.round(Math.max(0,Number(line.quantity)||0)*Math.round(Math.max(0,Number(line.unit_price)||0)*100));

export function invoiceHtml(doc: InvoicePdfData, paidAmount:number|null = 0) {
  const extra=doc.invoice_details||{};
  const isVat=Number(doc.vat_rate)>0 && !!doc.vat_number;
  const lineGroups=(['labour','material','other'] as const).map(kind=>{
    const entries=(doc.items||[]).filter(item=>(item.kind||'other')===kind);
    if(!entries.length)return '';
    return '<tr class="group"><td colspan="6">'+safe(labelForKind(kind))+'</td></tr>'+
      entries.map(item=>'<tr class="line"><td class="desc">'+htmlText(item.description)+'</td>'+
        '<td class="right">'+safe(formatTradeQuantity(item.quantity,item.unit).replace(/\s*[^\d.,].*$/,''))+'</td>'+
        '<td>'+safe(item.unit==='each'?'item':item.unit||'item')+'</td>'+
        '<td class="right">'+money(item.unit_price)+'</td>'+
        '<td class="right">'+(Number(doc.vat_rate)>0?safe(doc.vat_rate)+'%':'—')+'</td>'+
        '<td class="right bold">'+money(linePence(item)/100)+'</td></tr>').join('');
  }).join('');
  const dateLabel=(value:string)=>{
    if(!value)return '—';
    const d=new Date(value+'T12:00:00Z');
    return Number.isNaN(d.getTime())?safe(value):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
  };
  const detail=(name:string,value:unknown)=>'<div class="detail"><span>'+safe(name)+'</span><strong>'+safe(value)+'</strong></div>';
  const showDate=(name:string,value:string)=>'<div class="detail"><span>'+safe(name)+'</span><strong>'+dateLabel(value)+'</strong></div>';
  const workDate=extra.workStartDate && extra.workStartDate!==doc.service_date
   ?showDate('Work started',extra.workStartDate)+showDate('Work finished',doc.service_date)
   :showDate('Date of work',doc.service_date);
  const company=[
    doc.business_legal_name && doc.business_legal_name!==doc.business_name ? '<div>'+htmlText(doc.business_legal_name)+'</div>':'',
    '<div>'+htmlText(doc.business_address)+'</div>',
    doc.business_email?'<div>'+htmlText(doc.business_email)+'</div>':'',
    doc.business_phone?'<div>'+htmlText(doc.business_phone)+'</div>':'',
    extra.companyNumber?'<div>Company no. '+safe(extra.companyNumber)+'</div>':'',
    isVat?'<div>VAT registration: '+safe(doc.vat_number)+'</div>':''
  ].join('');
  const discount=Math.max(0,Number(doc.discount_amount||0));
  const total=Math.max(0,Number(doc.total||0));
  const received=paidAmount===null?null:Math.min(total,Math.max(0,Number(paidAmount)||0));
  const balance=received===null?total:Math.max(0,Math.round((total-received)*100)/100);
  const invoiceRef=Number(doc.invoice_no)>0?number(doc.invoice_no):'DRAFT · NUMBER ON SAVE';
  const vat=Number(doc.vat_rate)>0&&!!doc.vat_number;
  const css=[
    '@page{size:A4;margin:0}*{box-sizing:border-box}',
    'html,body{padding:0;margin:0;width:100%;background:#fff;color:#25323B;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.sheet{width:178mm;max-width:100%;margin:17mm auto 22mm;min-height:252mm}',
    'header{display:flex;justify-content:space-between;gap:26px;align-items:flex-start}',
    '.company{max-width:60%;color:#657276;overflow-wrap:anywhere;line-height:1.65}',
    '.businessName{font-size:23px;line-height:1.25;color:#182b34;font-weight:800;letter-spacing:-.5px;margin:4px 0 12px}',
    '.overline{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#5e716f;font-weight:800}',
    '.title{text-align:right;font-size:30px;font-weight:850;letter-spacing:1px;color:#162f34}',
    '.invoiceNo{text-align:right;font-size:11px;color:#496060;font-weight:800;margin-top:8px}',
    '.draft{text-align:right;color:#B35D42;font-weight:800;font-size:9px;letter-spacing:.5px;margin-top:5px}',
    '.divider{border-bottom:1px solid #849894;margin:23px 0 19px}',
    '.billing{display:flex;justify-content:space-between;gap:30px;margin-bottom:22px}',
    '.billing>section{flex:1;min-width:0}.billing>section+section{max-width:47%}',
    '.billing h3,.site h3,.summary h3,.notes h3{font-size:9px;letter-spacing:1.2px;color:#58716d;text-transform:uppercase;margin:0 0 8px}',
    '.clientName{font-size:13px;font-weight:800;line-height:1.4;color:#25343b;margin-bottom:4px}',
    '.clientAddress{white-space:pre-wrap;line-height:1.55;color:#52646b;overflow-wrap:anywhere}',
    '.detail{display:flex;gap:10px;justify-content:space-between;margin:4px 0}',
    '.detail span{color:#617174}.detail strong{text-align:right;font-weight:700;overflow-wrap:anywhere}',
    '.site{margin-bottom:18px;padding:13px 14px;background:#f6f9f8;border:1px solid #e5eae8}',
    '.summary{padding:14px 17px;background:#f1f5f3;margin-bottom:19px;overflow-wrap:anywhere}',
    '.summary>div,.notes p{white-space:pre-wrap;overflow-wrap:anywhere}',
    '.sectionTitle{font-size:13px;font-weight:800;margin:0 0 10px;color:#273b3f}',
    'table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:10px}',
    'thead th{background:#e7ece9;color:#354b4c;font-size:9px;text-align:left;padding:10px 5px;font-weight:850}',
    'th:nth-child(1){width:37%}th:nth-child(2){width:9%;text-align:right}th:nth-child(3){width:10%}th:nth-child(4){width:16%;text-align:right}th:nth-child(5){width:9%;text-align:right}th:nth-child(6){width:19%;text-align:right}',
    'tbody td{border-bottom:1px solid #e4eae8;padding:11px 5px;vertical-align:top;overflow-wrap:anywhere}',
    'tr.line{break-inside:avoid;page-break-inside:avoid}.right{text-align:right}.bold{font-weight:800;white-space:nowrap}',
    '.group td{text-align:left;background:#f6f8f7;color:#43615b;font-weight:800;font-size:9px;padding:7px 8px}',
    '.foot{display:flex;justify-content:space-between;gap:24px;margin-top:26px;align-items:flex-start}',
    '.notesColumn{flex:1;min-width:0}.totals{width:46%;min-width:210px}',
    '.totals .row{display:flex;justify-content:space-between;gap:10px;padding:5px 0}',
    '.totals .row span{color:#586b6d}.totals .row strong{font-weight:750}',
    '.totals .invoiceTotal{border-top:2px solid #33494b;margin-top:7px;padding-top:11px;font-weight:800;font-size:13px}',
    '.totals .invoiceTotal span,.totals .invoiceTotal strong{color:#243538;font-weight:800}',
    '.totals .due{background:#1d3536;color:#fff;border-radius:5px;margin-top:10px;padding:13px 12px;align-items:center;font-weight:850}',
    '.totals .due span,.totals .due strong{color:#fff;font-weight:850;font-size:13px}',
    '.notes{background:#f6f8f7;padding:12px 15px;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid;overflow-wrap:anywhere}',
    '.notes p{margin:0;font-size:10px;line-height:1.55}',
    '.payment{background:#eef5f5;margin-top:22px;padding:15px 17px;break-inside:avoid;page-break-inside:avoid}',
    '.bankGrid{display:table;width:100%;border-spacing:0 8px}.bankRow{display:table-row}.bankLabel,.bankValue{display:table-cell;width:50%;padding:3px 8px 3px 0;vertical-align:top;overflow-wrap:anywhere}.bankLabel{color:#607673;font-size:10px}.bankValue{font-weight:800;color:#263b3d}',
    'footer{border-top:1px solid #d1dcd9;margin-top:27px;padding-top:12px;color:#889695;font-size:9px}',
    '@media screen and (max-width:650px){.sheet{width:100%;min-height:0;margin:0;padding:26px 18px 36px}.businessName{font-size:19px}.title{font-size:23px}.billing{gap:14px}.billing>section+section{max-width:55%}table{font-size:9px}thead th,tbody td{padding-left:5px;padding-right:5px}.foot{gap:14px}.totals{min-width:0;width:52%}}'
  ].join('');
  const hasBank=!!(extra.bankName||extra.accountName||extra.sortCode||extra.accountNumber||extra.paymentReference);
  const bankField=(label:string,value:string|undefined)=>value?'<div class="bankRow"><span class="bankLabel">'+safe(label)+'</span><span class="bankValue">'+safe(value)+'</span></div>':'';
  const bankSection=(hasBank||doc.payment_details)?'<section class="payment notes"><h3>HOW TO PAY</h3>'+
    (hasBank?'<div class="bankGrid">'+bankField('Bank',extra.bankName)+bankField('Account name',extra.accountName)+
     bankField('Sort code',extra.sortCode)+bankField('Account number',extra.accountNumber)+
     bankField('Reference',extra.paymentReference||invoiceRef)+'</div>':'')+
    (doc.payment_details?'<p>'+htmlText(doc.payment_details)+'</p>':'')+'</section>':'';
  return '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>'+
    '<style>'+css+'</style></head><body><main class="sheet">'+
    '<header><div class="company"><div class="overline">FROM</div><div class="businessName">'+htmlText(doc.business_name)+'</div>'+company+'</div>'+
    '<div><div class="title">INVOICE</div><div class="invoiceNo">'+invoiceRef+'</div>'+
    (Number(doc.invoice_no)>0&&doc.status==='draft'?'<div class="draft">DRAFT · NOT SENT</div>':'')+'</div></header>'+
    '<div class="divider"></div><div class="billing"><section><h3>BILL TO</h3><div class="clientName">'+htmlText(doc.customer_name)+'</div>'+
    '<div class="clientAddress">'+htmlText(doc.customer_address)+'</div>'+
    (doc.customer_email?'<div class="clientAddress">'+htmlText(doc.customer_email)+'</div>':'')+'</section>'+
    '<section><h3>INVOICE DETAILS</h3>'+
    showDate('Invoice date',doc.invoice_date)+workDate+showDate('Payment due',doc.due_date)+
    (extra.jobReference?detail('Job reference',extra.jobReference):'')+
    (extra.purchaseOrder?detail('Purchase order',extra.purchaseOrder):'')+'</section></div>'+
    (extra.workAddress?'<div class="site"><h3>JOB / SITE ADDRESS</h3><div class="clientAddress">'+htmlText(extra.workAddress)+'</div></div>':'')+
    (doc.description?'<div class="summary"><h3>DESCRIPTION OF WORK</h3><div>'+htmlText(doc.description)+'</div></div>':'')+
    '<div class="sectionTitle">Itemised work & materials</div>'+
    '<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>VAT</th><th>Amount</th></tr></thead><tbody>'+
    lineGroups+'</tbody></table>'+
    '<div class="foot"><div class="notesColumn">'+
    (Number(doc.deposit_requested)>0?'<section class="notes"><h3>DEPOSIT REQUESTED</h3><p>'+money(Number(doc.deposit_requested))+
      ' is included in the total; this is not a recorded payment.</p></section>':'')+
    (extra.paymentTerms?'<section class="notes"><h3>PAYMENT TERMS</h3><p>'+htmlText(extra.paymentTerms)+'</p></section>':'')+
    (doc.notes?'<section class="notes"><h3>NOTES</h3><p>'+htmlText(doc.notes)+'</p></section>':'')+
    '</div><div class="totals">'+
    '<div class="row"><span>Subtotal</span><strong>'+money(doc.subtotal)+'</strong></div>'+
    (discount>0?'<div class="row"><span>Discount</span><strong>−'+money(discount)+'</strong></div>'+
       '<div class="row"><span>Net after discount</span><strong>'+money(Number(doc.subtotal)-discount)+'</strong></div>':'')+
    (vat?'<div class="row"><span>VAT ('+safe(doc.vat_rate)+'%)</span><strong>'+money(doc.vat_amount)+'</strong></div>':'')+
    '<div class="row invoiceTotal"><span>Invoice total</span><strong>'+money(total)+'</strong></div>'+
    (received!==null&&received>0?'<div class="row"><span>Payments received</span><strong>−'+money(received)+'</strong></div>':'')+
    '<div class="row due"><span>'+(received===null?'INVOICE AMOUNT':'BALANCE DUE')+'</span><strong>'+money(balance)+'</strong></div></div></div>'+
    bankSection+
    '<footer>Prepared with Tradarr · Keep this invoice for your records. Payment due '+dateLabel(doc.due_date)+'.</footer>'+
    '</main></body></html>';
}

