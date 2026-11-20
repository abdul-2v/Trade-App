import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, ChevronRight, FileText, Plus, Share2, Trash2 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { MotionPressable } from './Motion';
import { supabase } from './lib/supabase';
import { theme } from './theme';
import {formatTradeQuantity,hasInvalidTradeQuantity,unitOptionLabel} from './lib/documentUnits';

type InvoiceLineKind = 'labour' | 'material' | 'other';
type LineItem = { kind?: InvoiceLineKind; description: string; quantity: number; unit_price: number; unit?: string };
type EditableLine = { kind: InvoiceLineKind; description: string; quantity: string; unit_price: string; unit: string };
const labelForKind = (kind: InvoiceLineKind) => kind === 'labour' ? 'Labour' : kind === 'material' ? 'Materials' : 'Other charges';
const numericValue = (value: string | number) => Number(String(value).replace(',', '.'));
const linePence = (line: { quantity: string | number; unit_price: string | number }) =>
  Math.round(Math.max(0, numericValue(line.quantity) || 0) * Math.round(Math.max(0, numericValue(line.unit_price) || 0) * 100));
type InvoiceCustomerDetails = { source_kind: 'job' | 'urgent'; source_id: string; customer_name: string; billing_address: string };
type SavedCustomer = { id: string; name: string; email: string | null; address: string | null };
type AppJob = {
  key: string; id: string; kind: 'job' | 'urgent'; customer_id: string;
  trade: string; issue: string; customerName: string; address: string; suggestedPrice: number;
};
type Invoice = {
  id: string; invoice_no: number; tradesperson_id: string;
  source: 'external' | 'app'; app_job_id: string | null; urgent_request_id: string | null;
  business_name: string; business_legal_name: string | null; business_address: string;
  business_email: string | null; business_phone: string | null; vat_number: string | null;
  customer_name: string; customer_email: string | null; customer_address: string;
  description: string | null; items: LineItem[];
  invoice_date: string; service_date: string; due_date: string;
  vat_rate: number; subtotal: number; vat_amount: number; total: number;
  payment_details: string | null; notes: string | null;
  status: 'draft' | 'sent' | 'paid' | 'void'; created_at: string;
  discount_amount?: number; deposit_requested?: number;
};

const money = (n: number) => '£' + Number(n || 0).toFixed(2);
const dateToday = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const datePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const invoiceNumber = (n: number) => 'INV-' + String(n).padStart(5, '0');
const safe = (v: unknown) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const htmlText = (v: unknown) => safe(v).replace(/\n/g, '<br/>');
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + 'T12:00:00').getTime());
const invoiceStatusLabel = (status: Invoice['status']) =>
  status === 'draft' ? 'READY TO SEND' :
  status === 'sent' ? 'SENT · UNPAID' :
  status === 'paid' ? 'PAID' : 'VOID';

function invoiceHtml(doc: Invoice) {
  const groups = (['labour', 'material', 'other'] as const).map(kind => {
    const entries = (doc.items || []).filter(item => (item.kind || 'other') === kind);
    if (!entries.length) return '';
    return '<tr class="group"><td colspan="4">' + labelForKind(kind) + '</td></tr>' +
      entries.map(item => '<tr class="line"><td class="desc">' + htmlText(item.description) +
        '</td><td class="right">' + safe(formatTradeQuantity(item.quantity,item.unit)) +
        '</td><td class="right">' + money(item.unit_price) +
        '</td><td class="right amount">' + money(linePence(item) / 100) + '</td></tr>').join('');
  }).join('');
  const vat = doc.vat_rate > 0 && !!doc.vat_number;
  // Explicit A4-width document margins rather than relying on CSS @page margins.
  // iOS WebKit's PDF printer may ignore @page margins for flex-based layouts.
  const css = [
    '@page{size:A4;margin:0}',
    '*{box-sizing:border-box}',
    'html,body{padding:0;margin:0;width:100%;color:#20333B;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.sheet{width:178mm;max-width:100%;margin:18mm auto 20mm;min-height:255mm}',
    'table{border-collapse:collapse;border-spacing:0;width:100%;table-layout:fixed}',
    '.heading td{vertical-align:top;padding:0}',
    '.businessName{font-weight:800;font-size:24px;line-height:1.2;color:#0E3038;margin-bottom:13px;overflow-wrap:anywhere}',
    '.businessMeta{font-size:11px;line-height:1.8;color:#52676D;overflow-wrap:anywhere}',
    '.documentTitle{text-align:right;color:#124A4A;font-size:28px;letter-spacing:1.8px;font-weight:800;line-height:1.25}',
    '.documentNo{text-align:right;margin-top:13px;font-size:12px;color:#243C42;font-weight:700}',
    '.divider{height:3px;background:#225C5C;margin-top:26px;margin-bottom:28px}',
    '.meta{margin:0 0 28px}',
    '.meta td{width:50%;vertical-align:top;padding:0 24px 0 0;overflow-wrap:anywhere}',
    '.meta td+td{padding:0 0 0 18px}',
    '.label{color:#245758;font-weight:800;font-size:10px;letter-spacing:1.1px;text-transform:uppercase;margin-bottom:11px}',
    '.contactName{font-weight:800;font-size:14px;margin-bottom:6px;color:#20333B}',
    '.contactText{font-size:11px;line-height:1.9;color:#4E6268;overflow-wrap:anywhere}',
    '.detailRow{font-size:11px;color:#3A5158;margin-bottom:6px}',
    '.detailRow strong{display:inline-block;min-width:90px;color:#20333B}',
    '.workSummary{padding:17px 18px;background:#F1F6F5;border-left:3px solid #2A6263;margin:0 0 24px;overflow-wrap:anywhere}',
    '.workSummary .label{margin:0 0 6px}',
    '.sectionTitle{font-size:13px;color:#20333B;font-weight:800;margin-bottom:11px}',
    '.items{margin:0 0 26px}',
    '.items th{background:#12353C;color:#FFFFFF;font-size:10px;text-align:left;padding:12px 11px;line-height:1.4}',
    '.items th.right{text-align:right}',
    '.items td{vertical-align:top;padding:13px 11px;border-bottom:1px solid #E2E9E7;font-size:11px;line-height:1.6;overflow-wrap:anywhere}',
    '.items .group td{background:#EDF4F2;color:#245758;font-weight:800;font-size:11px;padding:8px 11px;letter-spacing:.3px}',
    '.items .line{page-break-inside:avoid;break-inside:avoid}',
    '.right{text-align:right;white-space:normal}',
    '.amount{font-weight:700;white-space:nowrap}',
    '.totals{width:48%;margin:14px 0 0 auto}',
    '.totals td{font-size:12px;padding:8px 0;color:#41585E}',
    '.totals td:last-child{text-align:right;font-weight:700}',
    '.totals .grand td{border-top:2px solid #2B6263;padding-top:14px;font-size:16px;font-weight:800;color:#10383D}',
    '.notes{background:#F5F8F7;border:1px solid #E8EEEC;border-radius:8px;padding:16px 19px;margin-top:27px;overflow-wrap:anywhere;page-break-inside:avoid;break-inside:avoid}',
    '.notes .label{margin-bottom:7px}',
    '.finePrint{margin-top:35px;padding-top:14px;border-top:1px solid #E5EBE9;color:#87979A;font-size:9px}',
    '@media screen and (max-width:650px){.sheet{width:100%;min-height:0;margin:0;padding:28px 18px 36px}.businessName{font-size:21px}.documentTitle{font-size:23px}.meta td{padding-right:11px}.meta td+td{padding-left:10px}.items th,.items td{padding-left:7px;padding-right:7px}.items td{font-size:10px}.totals{width:60%}}'
  ].join('');
  const contact = [
    doc.business_legal_name ? '<div>' + htmlText(doc.business_legal_name) + '</div>' : '',
    '<div>' + htmlText(doc.business_address) + '</div>',
    doc.business_email ? '<div>' + htmlText(doc.business_email) + '</div>' : '',
    doc.business_phone ? '<div>' + htmlText(doc.business_phone) + '</div>' : '',
    vat ? '<div>VAT registration: ' + htmlText(doc.vat_number) + '</div>' : ''
  ].join('');
  return '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>' +
    '<style>' + css + '</style></head><body><main class="sheet">' +
    '<table class="heading"><colgroup><col style="width:62%"/><col style="width:38%"/></colgroup><tr>' +
    '<td><div class="businessName">' + htmlText(doc.business_name) + '</div><div class="businessMeta">' + contact + '</div></td>' +
    '<td><div class="documentTitle">INVOICE</div><div class="documentNo">' + invoiceNumber(doc.invoice_no) + '</div></td>' +
    '</tr></table><div class="divider"></div>' +
    '<table class="meta"><tr><td><div class="label">Billed to</div><div class="contactName">' + htmlText(doc.customer_name) + '</div>' +
    '<div class="contactText">' + htmlText(doc.customer_address) + (doc.customer_email ? '<div>' + htmlText(doc.customer_email) + '</div>' : '') +
    '</div></td><td><div class="label">Invoice details</div>' +
    '<div class="detailRow"><strong>Issued</strong>' + safe(doc.invoice_date) + '</div>' +
    '<div class="detailRow"><strong>Work date</strong>' + safe(doc.service_date) + '</div>' +
    '<div class="detailRow"><strong>Payment due</strong>' + safe(doc.due_date) + '</div>' +
    '</td></tr></table>' +
    (doc.description ? '<div class="workSummary"><div class="label">Work carried out</div>' + htmlText(doc.description) + '</div>' : '') +
    '<div class="sectionTitle">Itemised charges</div>' +
    '<table class="items"><colgroup><col style="width:48%"/><col style="width:15%"/><col style="width:19%"/><col style="width:18%"/></colgroup>' +
    '<thead><tr><th>Work / materials</th><th class="right">Quantity</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>' +
    groups + '</tbody></table>' +
    '<table class="totals"><tr><td>Subtotal</td><td>' + money(doc.subtotal) + '</td></tr>' +
    (Number(doc.discount_amount || 0) > 0 ? '<tr><td>Discount</td><td>−' + money(Number(doc.discount_amount)) + '</td></tr>' : '') +
    (vat ? '<tr><td>VAT (' + safe(doc.vat_rate) + '%)</td><td>' + money(doc.vat_amount) + '</td></tr>' : '') +
    '<tr class="grand"><td>Total due</td><td>' + money(doc.total) + '</td></tr></table>' +
    (Number(doc.deposit_requested || 0) > 0 ? '<div class="notes"><div class="label">Deposit requested</div>' + money(Number(doc.deposit_requested)) + ' within the total due above. Record any payment received.</div>' : '') +
    (doc.payment_details ? '<div class="notes"><div class="label">Payment instructions</div>' + htmlText(doc.payment_details) + '</div>' : '') +
    (doc.notes ? '<div class="notes"><div class="label">Additional notes</div>' + htmlText(doc.notes) + '</div>' : '') +
    '<div class="finePrint">Created with Tradarr. Please keep this invoice for your records.</div></main></body></html>';
}

function Field({ label, value, onChange, placeholder, multi, numeric, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multi?: boolean; numeric?: boolean; required?: boolean;
}) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}{required ? ' *' : ''}</Text>
    <TextInput style={[s.input, multi && s.multiInput]} value={value} onChangeText={onChange}
      placeholder={placeholder || ''} placeholderTextColor="#8B9B9C"
      keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multi} textAlignVertical={multi ? 'top' : 'center'}
      autoCapitalize={numeric ? 'none' : 'sentences'} />
  </View>;
}
function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <MotionPressable onPress={onPress} style={[s.pill, active && s.pillActive]}>
    <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
  </MotionPressable>;
}

export default function TradeInvoicesScreen({ goBack, initialPreviewId }: { goBack: () => void; initialPreviewId?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'create' | 'preview'>('list');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<AppJob[]>([]);
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [customerBookOpen, setCustomerBookOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [source, setSource] = useState<'external' | 'app'>('external');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(dateToday());
  const [serviceDate, setServiceDate] = useState(dateToday());
  const [dueDate, setDueDate] = useState(datePlusDays(14));
  const [vatRate, setVatRate] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [depositInput, setDepositInput] = useState('0');
  const [paymentTotals, setPaymentTotals] = useState<Record<string,number>>({});
  const [paymentDetails, setPaymentDetails] = useState('');
  const [includePaymentDetails, setIncludePaymentDetails] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([{ kind: 'labour', description: '', quantity: '1', unit_price: '', unit: 'job' }]);

  const breakdown = useMemo(() => {
    const pence = { labour: 0, material: 0, other: 0 };
    lines.forEach(line => { pence[line.kind] += linePence(line); });
    return { labour: pence.labour / 100, material: pence.material / 100, other: pence.other / 100 };
  }, [lines]);
  const subtotal = Math.round((breakdown.labour + breakdown.material + breakdown.other) * 100) / 100;
  const enteredDiscount = numericValue(discountInput);
  const discount = Number.isFinite(enteredDiscount) && enteredDiscount >= 0
    ? Math.round(Math.min(subtotal,enteredDiscount) * 100) / 100 : 0;
  const net = Math.max(0,Math.round((subtotal - discount)*100)/100);
  const vat = Math.round(net * vatRate) / 100;
  const total = Math.round((net + vat) * 100) / 100;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user || !alive) return;
        setUserId(user.id);
        const [saved, profile, business, regular, urgent, customerDetails, privateCustomers, invoicePayments] = await Promise.all([
          supabase.from('trade_invoices').select('*').eq('tradesperson_id', user.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('first_name, last_name, phone').eq('id', user.id).maybeSingle(),
          supabase.from('tradesperson_profiles').select('business_name, display_name, public_phone, primary_trade').eq('user_id', user.id).maybeSingle(),
          supabase.from('jobs').select('id,customer_id,trade,issue,location_label,standard_price,route_price,job_mode,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.from('urgent_requests').select('id,customer_id,trade,issue,location_label,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.rpc('trade_invoice_customer_details'),
          supabase.from('trade_customers').select('id,name,email,address').eq('tradesperson_id', user.id).order('name'),
          supabase.from('trade_invoice_payments').select('invoice_id,amount').eq('tradesperson_id',user.id).limit(500),
        ]);
        if (!alive) return;
        const docs = (saved.data || []) as Invoice[];
        setInvoices(docs);
        if (!invoicePayments.error) {
          const totals:Record<string,number>={};
          (invoicePayments.data||[]).forEach(entry=>{
            totals[entry.invoice_id]=(totals[entry.invoice_id]||0)+Number(entry.amount||0);
          });
          setPaymentTotals(totals);
        }
        setSavedCustomers((privateCustomers.data || []) as SavedCustomer[]);
        if (initialPreviewId && docs.some(doc => doc.id === initialPreviewId)) {
          setSelectedInvoiceId(initialPreviewId);
          setScreen('preview');
        }
        const last = docs[0];
        setBusinessName(last?.business_name || business.data?.business_name || business.data?.display_name || '');
        setLegalName(last?.business_legal_name || [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(' '));
        setBusinessAddress(last?.business_address || '');
        setBusinessEmail(last?.business_email || user.email || '');
        setBusinessPhone(last?.business_phone || business.data?.public_phone || profile.data?.phone || '');
        setVatNumber(last?.vat_number || '');
        setPaymentDetails(last?.payment_details || '');
        const raw: AppJob[] = [
          ...(regular.data || []).map(j => ({ key: 'job:' + j.id, id: j.id, kind: 'job' as const,
            customer_id: j.customer_id, trade: j.trade, issue: j.issue, customerName: '',
            address: j.location_label || '', suggestedPrice: Number(j.job_mode === 'route' ? j.route_price : j.standard_price) || 0 })),
          ...(urgent.data || []).map(j => ({ key: 'urgent:' + j.id, id: j.id, kind: 'urgent' as const,
            customer_id: j.customer_id, trade: j.trade, issue: j.issue, customerName: '',
            address: j.location_label || '', suggestedPrice: 0 })),
        ];
        // Customer details are supplied only for jobs accepted by this tradesperson.
        // The secure RPC avoids exposing unrelated customer profiles via RLS.
        const byJob = new Map<string, InvoiceCustomerDetails>(
          ((customerDetails.data || []) as InvoiceCustomerDetails[]).map(p => [p.source_kind + ':' + p.source_id, p])
        );
        for (const job of raw) {
          const details = byJob.get(job.key);
          if (details) {
            job.customerName = details.customer_name || '';
            job.address = details.billing_address || job.address;
          }
        }
        if (alive) setJobs(raw);
      } catch (e) {
        if (alive) Alert.alert('Unable to load invoices', String(e));
      } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, []);

  const pickJob = (job: AppJob) => {
    setSelectedCustomerId(null);
    setSelectedJob(job.key);
    setCustomerName(job.customerName || '');
    setCustomerAddress(job.address || '');
    setDescription(job.issue);
    setLines([{ kind: 'labour', description: job.issue, quantity: '1', unit_price: job.suggestedPrice ? String(job.suggestedPrice) : '', unit: 'job' }]);
  };
  const startNew = () => {
    setSource('external'); setSelectedJob(null); setSelectedCustomerId(null); setCustomerBookOpen(false); setCustomerName(''); setCustomerAddress('');
    setCustomerEmail(''); setDescription(''); setNotes('');
    setIncludePaymentDetails(false); setSelectedInvoiceId(null);
    setInvoiceDate(dateToday()); setServiceDate(dateToday()); setDueDate(datePlusDays(14));
    setLines([{ kind: 'labour', description: '', quantity: '1', unit_price: '', unit: 'job' }]);
    setDiscountInput('0');setDepositInput('0');
    setScreen('create');
  };
  const changeLine = (index: number, patch: Partial<EditableLine>) =>
    setLines(existing => existing.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addLine = (kind: InvoiceLineKind, description = '') => {
    const newLine: EditableLine = { kind, description, quantity: '1', unit_price: '', unit: kind === 'labour' ? 'job' : 'each' };
    setLines(existing => {
      // Adding a task should replace the empty starter row, not leave a blank
      // required line that blocks creating the invoice.
      if (existing.length === 1 && !existing[0].description.trim() && !existing[0].unit_price.trim()) {
        return [newLine];
      }
      return [...existing, newLine];
    });
  };

  const sharePdf = async (doc: Invoice) => {
    if (sharing) return;
    setSharing(doc.id);
    try {
      const html = invoiceHtml(doc);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const file = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share ' + invoiceNumber(doc.invoice_no) });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (error) { Alert.alert('Could not open PDF', String(error)); }
    finally { setSharing(null); }
  };

  const createInvoice = async () => {
    if (!userId || saving) return;
    if (!businessName.trim() || !businessAddress.trim() || !customerName.trim() || !customerAddress.trim()) {
      Alert.alert('Complete the invoice', 'Business name and address, plus customer name and address, are required.'); return;
    }
    if (![invoiceDate, serviceDate, dueDate].every(validDate)) {
      Alert.alert('Check dates', 'Use dates in YYYY-MM-DD format.'); return;
    }
    if (!Number.isFinite(enteredDiscount) || enteredDiscount < 0 || enteredDiscount > subtotal) {
      Alert.alert('Invalid discount','The discount must be between £0 and the subtotal.');return;
    }
    const requestedDeposit=numericValue(depositInput);
    if (!Number.isFinite(requestedDeposit) || requestedDeposit<0 || requestedDeposit>total) {
      Alert.alert('Invalid deposit','A deposit must be between £0 and the invoice total.');return;
    }
    if (vatRate && !vatNumber.trim()) {
      Alert.alert('VAT registration needed', 'Only VAT-registered businesses should charge VAT. Enter your VAT number or select No VAT.'); return;
    }
    const items = lines.map(l => ({
      kind: l.kind, description: l.description.trim(), quantity: numericValue(l.quantity),
      unit_price: numericValue(l.unit_price), unit: l.unit
    }));
    if (!items.length || items.some(l => !l.description || hasInvalidTradeQuantity(l.quantity,l.unit) ||
      !Number.isFinite(l.unit_price) || l.unit_price < 0 || l.unit_price > 1000000 || l.quantity > 100000)) {
      Alert.alert('Check the breakdown','Give each line a clear description, valid quantity and price. A fixed-price job must have quantity 1; choose a per-item unit for multiple radiators or valves.'); return;
    }
    if (!total && !items.some(l => l.unit_price > 0)) {
      Alert.alert('Enter a charge', 'Add at least one priced item.'); return;
    }
    const job = jobs.find(j => j.key === selectedJob);
    if (source === 'app' && !job) { Alert.alert('Select a job', 'Choose one of your accepted Tradarr jobs, or select Outside Tradarr.'); return; }
    setSaving(true);
    try {
      const payload = {
        tradesperson_id: userId, invoice_no: 0, customer_id: source === 'external' ? selectedCustomerId : null,
        source, app_job_id: source === 'app' && job?.kind === 'job' ? job.id : null,
        urgent_request_id: source === 'app' && job?.kind === 'urgent' ? job.id : null,
        business_name: businessName.trim(), business_legal_name: legalName.trim() || null,
        business_address: businessAddress.trim(), business_email: businessEmail.trim() || null,
        business_phone: businessPhone.trim() || null, vat_number: vatRate ? vatNumber.trim() : null,
        customer_name: customerName.trim(), customer_address: customerAddress.trim(), customer_email: customerEmail.trim() || null,
        description: description.trim() || null, items, invoice_date: invoiceDate, service_date: serviceDate, due_date: dueDate,
        vat_rate: vatRate, subtotal, discount_amount: discount,
         deposit_requested:Math.round(requestedDeposit*100)/100,vat_amount: vat, total,
        payment_details: includePaymentDetails ? paymentDetails.trim() || null : null,
        notes: notes.trim() || null, status: 'draft' as const,
      };
      const { data, error } = await supabase.from('trade_invoices').insert(payload).select('*').single();
      if (error || !data) throw new Error(error?.message || 'Could not save invoice');
      const doc = data as Invoice;
      setInvoices(old => [doc, ...old]);
      setSelectedInvoiceId(doc.id);
      setScreen('preview');
    } catch (e) { Alert.alert('Could not create invoice', String(e)); }
    finally { setSaving(false); }
  };
  const setStatus = async (doc: Invoice, status: Invoice['status']) => {
    const { data, error } = await supabase.from('trade_invoices').update({ status, updated_at: new Date().toISOString() })
      .eq('id', doc.id).eq('tradesperson_id', userId).select('*').single();
    if (error || !data) { Alert.alert('Could not update invoice', error?.message || 'Please try again.'); return; }
    setInvoices(old => old.map(item => item.id === doc.id ? data as Invoice : item));
  };
  const recordRemainingPayment = (doc:Invoice) => {
    if (doc.status !== 'sent') return;
    const remaining = Math.round((Number(doc.total) - (paymentTotals[doc.id]||0))*100)/100;
    if (remaining <= 0) {Alert.alert('No balance remaining','This invoice has no outstanding balance.');return;}
    Alert.alert('Confirm payment received', 'Record that you received '+money(remaining)+
      ' in full? This will not take a card or bank payment. Use the website to record partial payments.',
      [{text:'Cancel',style:'cancel'},{text:'Record payment',onPress:async()=>{
        const {error}=await supabase.from('trade_invoice_payments').insert({
          invoice_id:doc.id,tradesperson_id:userId,amount:remaining,
          paid_on:dateToday(),method:'other',reference:'Recorded on iPhone app'
        });
        if(error){Alert.alert('Payment not recorded',error.message);return;}
        setPaymentTotals(old=>({...old,[doc.id]:(old[doc.id]||0)+remaining}));
        const {data, error:loadError}=await supabase.from('trade_invoices')
          .select('*').eq('id',doc.id).eq('tradesperson_id',userId).single();
        if(!loadError&&data)setInvoices(old=>old.map(row=>row.id===doc.id?data as Invoice:row));
      }}]
    );
  };
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId) || null;
  const paid = invoices.filter(i => i.status === 'paid').reduce((n, i) => n + Number(i.total), 0);
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((n, i) =>
    n + Math.max(0,Number(i.total)-(paymentTotals[i.id]||0)),0);
  return <View style={s.root}>
    <View style={s.header}>
      <MotionPressable style={s.back} onPress={screen === 'create' || screen === 'preview' ? () => setScreen('list') : goBack}
        accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft size={23} color={theme.colors.ink} />
      </MotionPressable>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>BUSINESS TOOLS</Text>
        <Text style={s.title}>{screen === 'create' ? 'New invoice' : screen === 'preview' ? 'Invoice preview' : 'Invoices'}</Text></View>
      {screen === 'list' ? <MotionPressable style={s.addTop} onPress={startNew} accessibilityRole="button" accessibilityLabel="Create invoice">
        <Plus color="#FFFFFF" size={21} /><Text style={s.addTopText}>New</Text></MotionPressable> : null}
    </View>

    {loading ? <ActivityIndicator style={{ marginTop: 60 }} size="large" color={theme.colors.teal} /> :
      screen === 'list' ? <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Text style={s.explainer}>Professional invoices for Tradarr jobs and your own customers. Create, save and share PDFs in seconds.</Text>
        <View style={s.statRow}>
          <View style={s.stat}><Text style={s.statLabel}>Paid</Text><Text style={s.statNumber}>{money(paid)}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>Sent · unpaid</Text><Text style={s.statNumber}>{money(outstanding)}</Text></View>
        </View>
        <MotionPressable style={s.heroButton} onPress={startNew} accessibilityRole="button">
          <Plus size={21} color="#FFFFFF" /><Text style={s.heroButtonText}>Create an invoice</Text><ChevronRight size={21} color="#FFFFFF" />
        </MotionPressable>
        <Text style={s.section}>Your invoices</Text>
        {!invoices.length ? <View style={s.empty}><FileText color={theme.colors.teal} size={35} />
          <Text style={s.emptyTitle}>No invoices yet</Text>
          <Text style={s.emptySub}>Make your first invoice for a job from the app or a private customer.</Text></View> :
          invoices.map(doc => <View key={doc.id} style={s.invoiceCard}>
            <View style={s.invoiceHeader}>
              <View style={{ flex: 1 }}><Text style={s.invoiceNo}>{invoiceNumber(doc.invoice_no)}</Text>
                <Text style={s.invoiceCustomer} numberOfLines={2}>{doc.customer_name}</Text>
                <Text style={s.invoiceMeta}>{doc.invoice_date} · Due {doc.due_date}</Text>
                {doc.status==='sent' && (paymentTotals[doc.id]||0)>0 ?
                  <Text style={s.invoiceMeta}>Received {money(paymentTotals[doc.id])} · Balance {money(Math.max(0,Number(doc.total)-(paymentTotals[doc.id]||0)))}</Text> : null}</View>
              <View style={{ alignItems: 'flex-end', gap: 7 }}><Text style={s.invoiceTotal}>{money(doc.total)}</Text>
                <Text style={[s.status, doc.status === 'paid' && s.paidStatus]}>{invoiceStatusLabel(doc.status)}</Text></View>
            </View>
            <View style={s.cardActions}>
              <MotionPressable style={[s.action, s.previewAction]} onPress={() => {
                setSelectedInvoiceId(doc.id);
                setScreen('preview');
              }} accessibilityRole="button" accessibilityLabel={'View invoice ' + invoiceNumber(doc.invoice_no)}>
                <FileText size={17} color={theme.colors.teal} /><Text style={s.actionText}>View</Text>
              </MotionPressable>
              <MotionPressable style={s.action} onPress={() => sharePdf(doc)} disabled={sharing === doc.id}>
                <Share2 size={17} color={theme.colors.teal} /><Text style={s.actionText}>{sharing === doc.id ? 'Opening…' : 'Share PDF'}</Text>
              </MotionPressable>
              {doc.status === 'draft' ? <MotionPressable style={s.action} onPress={() => setStatus(doc, 'sent')}>
                <Check size={17} color={theme.colors.teal} /><Text style={s.actionText}>Mark sent</Text></MotionPressable> : null}
              {doc.status === 'sent' ? <MotionPressable style={s.action} onPress={() => recordRemainingPayment(doc)}>
                <Check size={17} color={theme.colors.teal} /><Text style={s.actionText}>Mark paid</Text></MotionPressable> : null}
            </View>
          </View>)}
      </ScrollView> : screen === 'preview' ? (
        selectedInvoice ? <View style={s.previewRoot}>
          <View style={s.previewInfo}>
            <View style={{ flex: 1 }}>
              <Text style={s.previewInvoiceNo}>{invoiceNumber(selectedInvoice.invoice_no)} · {invoiceStatusLabel(selectedInvoice.status)}</Text>
              <Text style={s.previewCustomer}>{selectedInvoice.customer_name}</Text>
            </View>
            <View><Text style={s.previewAmount}>{money(selectedInvoice.total)}</Text>
              {(paymentTotals[selectedInvoice.id]||0)>0?<Text style={s.invoiceMeta}>Balance {money(Math.max(0,Number(selectedInvoice.total)-(paymentTotals[selectedInvoice.id]||0)))}</Text>:null}
            </View>
          </View>
          <View style={s.previewPaper}>
            <WebView
              source={{ html: invoiceHtml(selectedInvoice) }}
              style={s.previewWeb}
              originWhitelist={['*']}
              javaScriptEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
          <View style={s.previewActions}>
            <MotionPressable style={s.previewShare} onPress={() => sharePdf(selectedInvoice)}
              disabled={sharing === selectedInvoice.id} accessibilityRole="button" accessibilityLabel="Share invoice PDF">
              {sharing === selectedInvoice.id ? <ActivityIndicator color="#FFFFFF" /> : <Share2 size={20} color="#FFFFFF" />}
              <Text style={s.previewShareText}>{sharing === selectedInvoice.id ? 'Preparing PDF…' : 'Share PDF'}</Text>
            </MotionPressable>
            {selectedInvoice.status === 'draft' ? <MotionPressable style={s.previewMarkSent} onPress={() => setStatus(selectedInvoice, 'sent')}
              accessibilityRole="button" accessibilityLabel="Mark invoice as sent">
              <Check size={18} color={theme.colors.teal} /><Text style={s.previewMarkSentText}>Mark sent</Text>
            </MotionPressable> : null}
            <Text style={s.previewHint}>Mark sent after you actually deliver it to the customer.</Text>
          </View>
        </View> : <View style={s.previewMissing}>
          <Text style={s.emptyTitle}>Invoice unavailable</Text>
          <MotionPressable onPress={() => setScreen('list')} style={s.heroButton}>
            <Text style={s.heroButtonText}>Back to invoices</Text>
          </MotionPressable>
        </View>
      ) : <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.explainer}>Add the job and customer details. Tradarr handles the layout, calculations, invoice number and PDF.</Text>
        <Text style={s.section}>Where was the job from?</Text>
        <View style={s.pillRow}>
          <Pill label="My own customer" active={source === 'external'} onPress={() => { setSource('external'); setSelectedJob(null); }} />
          <Pill label="Tradarr job" active={source === 'app'} onPress={() => setSource('app')} />
        </View>
        {source === 'app' ? <View style={s.card}>
          <Text style={s.cardTitle}>Choose an accepted job</Text>
          {!jobs.length ? <Text style={s.small}>No accepted app jobs yet. You can invoice outside work instead.</Text> :
            jobs.map(job => <MotionPressable key={job.key} onPress={() => pickJob(job)}
              style={[s.jobChoice, selectedJob === job.key && s.jobSelected]}>
              <View style={{ flex: 1 }}><Text style={s.jobTitle}>{job.trade} · {job.kind === 'urgent' ? 'Urgent callout' : 'Booking'}</Text>
                <Text style={s.small} numberOfLines={2}>{job.issue}</Text></View>
              {selectedJob === job.key ? <Check size={18} color={theme.colors.teal} /> : <ChevronRight size={18} color={theme.colors.muted} />}
            </MotionPressable>)}
          <Text style={s.helper}>Job details are suggested automatically. Check the customer's full billing address before creating the invoice.</Text>
        </View> : null}

        <Text style={s.section}>Your business</Text>
        <View style={s.card}>
          <Field label="Trading / business name" value={businessName} onChange={setBusinessName} required />
          <Field label="Legal name (if different)" value={legalName} onChange={setLegalName} />
          <Field label="Business address" value={businessAddress} onChange={setBusinessAddress} multi required />
          <Field label="Business email" value={businessEmail} onChange={setBusinessEmail} />
          <Field label="Business phone" value={businessPhone} onChange={setBusinessPhone} />
          <Text style={s.helper}>These details will be remembered from your latest invoice.</Text>
        </View>

        <Text style={s.section}>Bill to</Text>
        {source === 'external' ? <View style={{ marginBottom: 10 }}>
          <MotionPressable onPress={() => setCustomerBookOpen(v => !v)} style={s.customerPicker}
            accessibilityRole="button" accessibilityLabel="Choose customer from saved customer book">
            <Text style={s.customerPickerLabel}>{selectedCustomerId ? savedCustomers.find(c => c.id === selectedCustomerId)?.name : 'Choose saved customer (optional)'}</Text>
            <ChevronRight size={18} color={theme.colors.teal} />
          </MotionPressable>
          {customerBookOpen ? <View style={s.customerPickerList}>
            <MotionPressable style={s.customerPickerRow} onPress={() => { setSelectedCustomerId(null); setCustomerBookOpen(false); }}>
              <Text style={s.customerPickerText}>Enter new customer</Text>
            </MotionPressable>
            {savedCustomers.map(customer => <MotionPressable key={customer.id} style={s.customerPickerRow}
              onPress={() => { setSelectedCustomerId(customer.id); setCustomerName(customer.name);
                setCustomerAddress(customer.address || ''); setCustomerEmail(customer.email || ''); setCustomerBookOpen(false); }}>
              <Text style={s.customerPickerText}>{customer.name}</Text>
            </MotionPressable>)}
          </View> : null}
        </View> : null}
        <View style={s.card}>
          <Field label="Customer name / company" value={customerName} onChange={setCustomerName} required />
          <Field label="Billing address" value={customerAddress} onChange={setCustomerAddress} multi required />
          <Field label="Customer email (optional)" value={customerEmail} onChange={setCustomerEmail} />
          <Field label="Work summary (optional)" value={description} onChange={setDescription} multi placeholder="e.g. Replaced leaking kitchen tap" />
        </View>

        <Text style={s.section}>Dates</Text>
        <View style={s.card}>
          <Field label="Invoice date (YYYY-MM-DD)" value={invoiceDate} onChange={setInvoiceDate} required />
          <Field label="Date work was done (YYYY-MM-DD)" value={serviceDate} onChange={setServiceDate} required />
          <Field label="Payment due (YYYY-MM-DD)" value={dueDate} onChange={setDueDate} required />
        </View>

        <Text style={s.section}>Work breakdown</Text>
        <Text style={s.explainer}>Itemise each job separately. For example, add “Fix radiator” and “Replace valve” as two labour tasks, then add any parts underneath.</Text>
        <View style={s.addWorkRow}>
          <MotionPressable style={s.addWorkButton} onPress={() => addLine('labour')} accessibilityRole="button" accessibilityLabel="Add a labour task">
            <Plus size={18} color={theme.colors.teal} /><Text style={s.addWorkText}>Add labour task</Text>
          </MotionPressable>
          <MotionPressable style={s.addWorkButton} onPress={() => addLine('material')} accessibilityRole="button" accessibilityLabel="Add a material">
            <Plus size={18} color={theme.colors.teal} /><Text style={s.addWorkText}>Add material</Text>
          </MotionPressable>
        </View>
        {lines.map((item, i) => <View style={s.workCard} key={i}>
          <View style={s.workCardHead}>
            <View style={[s.kindIcon, item.kind === 'material' && s.materialIcon]}>
              <Text style={s.kindEmoji}>{item.kind === 'material' ? '◈' : item.kind === 'labour' ? '⚒' : '＋'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.workCardTitle}>{labelForKind(item.kind)} · {lines.slice(0, i + 1).filter(l => l.kind === item.kind).length}</Text>
              <Text style={s.workCardSub}>{item.kind === 'labour' ? 'Describe the actual task completed' : item.kind === 'material' ? 'Specify the part or material used' : 'Other charge'}</Text>
            </View>
            {lines.length > 1 ? <MotionPressable onPress={() => setLines(old => old.filter((_, j) => j !== i))}
              accessibilityRole="button" accessibilityLabel={'Remove ' + (item.description || labelForKind(item.kind))}>
              <Trash2 size={18} color={theme.colors.coralDark} />
            </MotionPressable> : null}
          </View>
          <Field label={item.kind === 'labour' ? 'Work carried out' : item.kind === 'material' ? 'Material / part' : 'Charge description'}
            value={item.description} onChange={v => changeLine(i, { description: v })}
            placeholder={item.kind === 'labour' ? 'e.g. Fit new radiator / replace valve' : 'e.g. TRV valve, 15mm copper pipe'} required />
          <View style={s.unitsRow}>
            <Text style={s.unitsLabel}>Charge by</Text>
            {(item.kind === 'labour' ? ['job','hour','day','radiator','valve','item'] : item.kind === 'material'
                ? ['item','metre','radiator','valve','box','pack'] : ['job','item','hour']).map(unit =>
              <Pill key={unit} label={unitOptionLabel(unit)}
                active={item.unit === unit || (item.unit === 'each' && unit === 'item')} onPress={() => changeLine(i, { unit, quantity: unit==='job'?'1':item.quantity })} />)}
          </View>
          <View style={s.twoCols}><View style={{ flex: 1 }}>
            <Field label={item.unit === 'hour' ? 'Hours' : item.unit === 'metre' ? 'Metres' : 'Quantity'} numeric
              value={item.quantity} onChange={v => changeLine(i, { quantity: v })} required />
          </View><View style={{ flex: 1 }}>
            <Field label={'Price per ' + (item.unit === 'each' ? 'item' : item.unit) + ' (£)'}
              numeric value={item.unit_price} onChange={v => changeLine(i, { unit_price: v })} placeholder="0.00" required />
          </View></View>
          <View style={s.lineTotalBar}><Text style={s.lineTotalLabel}>{formatTradeQuantity(item.quantity,item.unit)}</Text>
             <Text style={s.lineTotal}>{money(linePence(item) / 100)}</Text></View>
           {item.unit==='job'&&numericValue(item.quantity)!==1?
             <Text style={{fontSize:11,color:theme.colors.coralDark,marginTop:6}}>Use 1 job for a fixed price, or select a per-item unit for multiple items.</Text>:null}
        </View>)}
        <MotionPressable style={s.addOther} onPress={() => addLine('other')} accessibilityRole="button">
          <Plus size={16} color={theme.colors.teal} /><Text style={s.addSmallText}>Add call-out fee or other charge</Text>
        </MotionPressable>
        <View style={s.workSummary}>
          <Text style={s.workSummaryTitle}>Itemised breakdown</Text>
          <View style={s.totalRow}><Text style={s.totalLabel}>Labour · {lines.filter(l => l.kind === 'labour').length} tasks</Text><Text style={s.totalLabel}>{money(breakdown.labour)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Materials · {lines.filter(l => l.kind === 'material').length} items</Text><Text style={s.totalLabel}>{money(breakdown.material)}</Text></View>
          {breakdown.other > 0 ? <View style={s.totalRow}><Text style={s.totalLabel}>Other charges</Text><Text style={s.totalLabel}>{money(breakdown.other)}</Text></View> : null}
        </View>

        <Text style={s.section}>Discount & deposit</Text>
        <View style={s.card}>
          <Text style={s.helper}>A fixed discount reduces the amount charged and VAT is calculated after the discount.</Text>
          <Field label="Discount (£)" numeric value={discountInput} onChange={setDiscountInput} placeholder="0.00" />
          <Field label="Deposit requested (£)" numeric value={depositInput} onChange={setDepositInput} placeholder="0.00" />
          <Text style={s.helper}>A deposit request is included in the total and is not collected automatically.</Text>
        </View>
        <Text style={s.section}>VAT</Text>
        <View style={s.card}>
          <Text style={s.small}>Only add VAT if your business is VAT registered.</Text>
          <View style={s.pillRow}>
            {[0, 5, 20].map(rate => <Pill key={rate} label={rate === 0 ? 'No VAT' : rate + '% VAT'}
              active={vatRate === rate} onPress={() => setVatRate(rate)} />)}
          </View>
          {vatRate > 0 ? <Field label="VAT registration number" value={vatNumber} onChange={setVatNumber} required /> : null}
        </View>

        <Text style={s.section}>Payment & notes</Text>
        <View style={s.card}>
          <View style={s.optionalToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Include bank details?</Text>
              <Text style={s.helper}>Optional. Leave off to create an invoice without bank information.</Text>
            </View>
            <Switch value={includePaymentDetails} onValueChange={setIncludePaymentDetails}
              accessibilityLabel="Include payment details on invoice"
              trackColor={{ false: '#DCE6E4', true: '#A9CEBF' }}
              thumbColor={includePaymentDetails ? theme.colors.teal : '#FFFFFF'} />
          </View>
          {includePaymentDetails ? <View style={{ marginTop: 16 }}>
            <Field label="Bank transfer details (optional)" value={paymentDetails} onChange={setPaymentDetails} multi
              placeholder="Account name, sort code, account number, reference" />
          </View> : null}
          <View style={{ marginTop: 12 }}>
            <Field label="Additional notes (optional)" value={notes} onChange={setNotes} multi />
          </View>
        </View>
        <View style={s.totalCard}><View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalLabel}>{money(subtotal)}</Text></View>
          {discount>0?<View style={s.totalRow}><Text style={s.totalLabel}>Discount</Text><Text style={s.totalLabel}>−{money(discount)}</Text></View>:null}
          {vatRate > 0 ? <View style={s.totalRow}><Text style={s.totalLabel}>VAT ({vatRate}%)</Text><Text style={s.totalLabel}>{money(vat)}</Text></View> : null}
          <View style={s.totalRow}><Text style={s.totalTitle}>Total due</Text><Text style={s.totalNumber}>{money(total)}</Text></View>
        </View>
        <MotionPressable style={[s.heroButton, saving && { opacity: 0.55 }]} onPress={createInvoice} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <FileText size={20} color="#FFFFFF" />}
          <Text style={s.heroButtonText}>{saving ? 'Creating…' : 'Create and view invoice'}</Text>
        </MotionPressable>
        <Text style={[s.helper, { textAlign: 'center', marginBottom: 12 }]}>Invoices are saved to your account. Preview here, then share when ready.</Text>
      </ScrollView>}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.proBackground },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingTop: 18, paddingBottom: 14, paddingHorizontal: 20, backgroundColor: theme.colors.proBackground },
  back: { width: 45, height: 45, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: theme.colors.teal },
  title: { fontSize: 27, fontWeight: '800', color: theme.colors.ink, letterSpacing: -0.8, marginTop: 3 },
  addTop: { backgroundColor: theme.colors.darkTeal, borderRadius: 23, minHeight: 45, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addTopText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 35 },
  explainer: { color: theme.colors.muted, lineHeight: 21, fontSize: 13, marginBottom: 18 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 17, ...theme.shadow },
  statLabel: { color: theme.colors.muted, fontSize: 12 },
  statNumber: { color: theme.colors.ink, fontSize: 20, fontWeight: '800', marginTop: 7 },
  heroButton: { flexDirection: 'row', minHeight: 58, backgroundColor: theme.colors.darkTeal, borderRadius: 29, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 19, gap: 10, marginBottom: 8 },
  heroButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  section: { color: theme.colors.ink, fontSize: 19, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: 28, alignItems: 'center', marginTop: 5, ...theme.shadow },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.ink, marginTop: 13 },
  emptySub: { color: theme.colors.muted, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  invoiceCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 17, marginBottom: 12, ...theme.shadow },
  invoiceHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  invoiceNo: { color: theme.colors.teal, fontWeight: '800', fontSize: 12 },
  invoiceCustomer: { color: theme.colors.ink, fontWeight: '800', fontSize: 16, marginTop: 5 },
  invoiceMeta: { fontSize: 11, marginTop: 6, color: theme.colors.muted },
  invoiceTotal: { fontSize: 17, fontWeight: '800', color: theme.colors.ink },
  status: { backgroundColor: theme.colors.tealTint, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 11, fontSize: 10, overflow: 'hidden', color: theme.colors.teal, fontWeight: '800' },
  paidStatus: { color: '#14744B', backgroundColor: '#E4F4EC' },
  previewAction: { backgroundColor: '#D8EAE5' },
  customerPicker: { minHeight: 47, borderRadius: 16, backgroundColor: theme.colors.tealTint, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerPickerLabel: { color: theme.colors.teal, fontWeight: '800', fontSize: 13, flex: 1 },
  customerPickerList: { backgroundColor: '#FFFFFF', marginTop: 6, paddingHorizontal: 10, borderRadius: 16, maxHeight: 200 },
  customerPickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.colors.line },
  customerPickerText: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  optionalToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  previewRoot: { flex: 1, backgroundColor: theme.colors.proBackground },
  previewInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 21, paddingVertical: 13, gap: 15 },
  previewInvoiceNo: { fontSize: 11, fontWeight: '800', color: theme.colors.teal },
  previewCustomer: { fontSize: 15, fontWeight: '800', color: theme.colors.ink, marginTop: 3 },
  previewAmount: { fontSize: 19, fontWeight: '800', color: theme.colors.ink },
  previewPaper: { flex: 1, marginHorizontal: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 17, overflow: 'hidden', ...theme.shadow },
  previewWeb: { flex: 1, backgroundColor: '#FFFFFF' },
  previewActions: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 10, backgroundColor: theme.colors.proBackground },
  previewShare: { minHeight: 51, borderRadius: 26, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.darkTeal },
  previewShareText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  previewMarkSent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 9, padding: 8 },
  previewMarkSentText: { color: theme.colors.teal, fontSize: 13, fontWeight: '700' },
  previewHint: { color: theme.colors.muted, fontSize: 10, textAlign: 'center', marginTop: 5 },
  previewMissing: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12, marginTop: 14 },
  action: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: theme.colors.tealTint, minHeight: 37, paddingHorizontal: 12, borderRadius: 20 },
  actionText: { color: theme.colors.teal, fontWeight: '800', fontSize: 12 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: '#DCE5E2', backgroundColor: '#FFFFFF' },
  pillActive: { borderColor: theme.colors.teal, backgroundColor: theme.colors.tealTint },
  pillText: { fontWeight: '700', fontSize: 12, color: theme.colors.muted },
  pillTextActive: { color: theme.colors.teal },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 17, marginBottom: 12, ...theme.shadow },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.ink, marginBottom: 11 },
  field: { marginBottom: 13 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.ink, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: theme.colors.line, backgroundColor: '#F9FBFA', minHeight: 47, borderRadius: 13, fontSize: 14, color: theme.colors.ink, paddingHorizontal: 13, paddingVertical: 10 },
  multiInput: { minHeight: 74 },
  helper: { color: theme.colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  small: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  jobChoice: { paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: theme.colors.line },
  jobSelected: { backgroundColor: '#F0F6F4', borderRadius: 12, paddingHorizontal: 8 },
  jobTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.ink },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  addSmall: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 12 },
  addSmallText: { color: theme.colors.teal, fontSize: 13, fontWeight: '800' },
  twoCols: { flexDirection: 'row', gap: 12 },
  lineTotal: { color: theme.colors.teal, textAlign: 'right', fontWeight: '800', fontSize: 13 },
  totalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginTop: 10, marginBottom: 20, ...theme.shadow },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  totalLabel: { color: theme.colors.muted, fontSize: 13 },
  totalTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '800' },
  totalNumber: { color: theme.colors.teal, fontSize: 24, fontWeight: '800' },
  addWorkRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addWorkButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 53, gap: 5, backgroundColor: theme.colors.tealTint, borderRadius: 17, borderWidth: 1, borderColor: '#C7DCDA', paddingHorizontal: 8 },
  addWorkText: { color: theme.colors.teal, fontSize: 13, fontWeight: '800' },
  workCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 17, marginBottom: 13, ...theme.shadow },
  workCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  kindIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.colors.tealTint },
  materialIcon: { backgroundColor: theme.colors.coralTint },
  kindEmoji: { fontSize: 22, color: theme.colors.teal, fontWeight: '700' },
  workCardTitle: { color: theme.colors.ink, fontSize: 16, fontWeight: '800' },
  workCardSub: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  unitsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  unitsLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', marginRight: 2 },
  lineTotalBar: { marginTop: 2, borderTopWidth: 1, borderTopColor: theme.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  lineTotalLabel: { color: theme.colors.muted, fontSize: 12 },
  addOther: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 13, marginBottom: 7 },
  workSummary: { backgroundColor: theme.colors.tealTint, borderRadius: 21, padding: 17, marginTop: 10, marginBottom: 10 },
  workSummaryTitle: { color: theme.colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 6 },
});