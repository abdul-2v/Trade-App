import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, ChevronRight, FileText, Plus, Share2, Trash2 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MotionPressable } from './Motion';
import { supabase } from './lib/supabase';
import { theme } from './theme';

type InvoiceLineKind = 'labour' | 'material' | 'other';
type LineItem = { kind?: InvoiceLineKind; description: string; quantity: number; unit_price: number; unit?: string };
type EditableLine = { kind: InvoiceLineKind; description: string; quantity: string; unit_price: string; unit: string };
const labourTaskSuggestions: Record<string, string[]> = {
  plumber: ['Fix radiator', 'Fit pipework', 'Replace valve', 'Repair leak', 'Install tap'],
  heating: ['Service boiler', 'Replace radiator', 'Replace valve', 'Fit thermostat', 'Flush system'],
  electrician: ['Install socket', 'Replace light fitting', 'Fault finding', 'Consumer unit work'],
  builder: ['Repair brickwork', 'Prepare site', 'Fit plasterboard', 'General labour'],
  carpenter: ['Fit door', 'Repair frame', 'Install skirting', 'Joinery labour'],
  roofer: ['Repair roof', 'Replace tiles', 'Fix guttering', 'Inspect roof'],
};
const labelForKind = (kind: InvoiceLineKind) => kind === 'labour' ? 'Labour' : kind === 'material' ? 'Materials' : 'Other charges';
const numericValue = (value: string | number) => Number(String(value).replace(',', '.'));
const linePence = (line: { quantity: string | number; unit_price: string | number }) =>
  Math.round(Math.max(0, numericValue(line.quantity) || 0) * Math.round(Math.max(0, numericValue(line.unit_price) || 0) * 100));
type InvoiceCustomerDetails = { source_kind: 'job' | 'urgent'; source_id: string; customer_name: string; billing_address: string };
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

function invoiceHtml(doc: Invoice) {
  const rows = (['labour', 'material', 'other'] as const).map(kind => {
    const entries = (doc.items || []).filter(item => (item.kind || 'other') === kind);
    if (!entries.length) return '';
    return '<tr class="group"><td colspan="4">' + labelForKind(kind) + '</td></tr>' +
      entries.map(item => '<tr><td>' + htmlText(item.description) +
        '</td><td class="right">' + safe(item.quantity) + (item.unit ? ' ' + safe(item.unit) : '') +
        '</td><td class="right">' + money(item.unit_price) +
        '</td><td class="right">' + money(linePence(item) / 100) + '</td></tr>').join('');
  }).join('');
  const vat = doc.vat_rate > 0 && !!doc.vat_number;
  return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<style>@page{size:A4;margin:24mm 18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#183039;font-size:11px;line-height:1.55;margin:0}' +
    '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #245758;padding-bottom:22px}.brand{font-size:22px;font-weight:800;color:#0F2A30;max-width:60%;word-wrap:break-word}' +
    '.title{text-align:right;font-size:29px;font-weight:bold;color:#245758;letter-spacing:2px}.muted{color:#607276}.blocks{display:flex;justify-content:space-between;gap:32px;margin:30px 0}' +
    '.block{width:47%;overflow-wrap:anywhere}.label{font-weight:bold;color:#245758;text-transform:uppercase;font-size:10px;letter-spacing:1px;margin-bottom:9px}' +
    '.details{border:1px solid #dae6e3;border-radius:9px;padding:15px;margin:10px 0 26px}.details td{padding:4px 10px 4px 0}' +
    'table.items{border-collapse:collapse;width:100%;table-layout:fixed}table.items th{background:#0F2A30;color:white;text-align:left;padding:12px 9px;font-size:10px}' +
    'table.items td{padding:12px 9px;border-bottom:1px solid #e1e7e5;vertical-align:top;overflow-wrap:anywhere}table.items tr.group td{background:#E8F0EF;color:#245758;font-weight:800;font-size:11px;padding:8px 10px;border-bottom:1px solid #CFDFDB}table.items th:first-child{width:55%}' +
    '.right{text-align:right}.totals{margin-left:auto;margin-top:20px;width:46%;border-collapse:collapse}.totals td{padding:8px 5px}.totals .grand{font-size:18px;font-weight:bold;color:#0F2A30;border-top:2px solid #245758}' +
    '.foot{margin-top:34px;padding:17px;background:#F1F5F3;border-radius:8px;overflow-wrap:anywhere}.small{font-size:10px;color:#607276}</style></head><body>' +
    '<div class="head"><div><div class="brand">' + htmlText(doc.business_name) + '</div><div class="muted">' + htmlText(doc.business_address) + '</div>' +
    (doc.business_legal_name ? '<div>' + htmlText(doc.business_legal_name) + '</div>' : '') +
    (doc.business_email ? '<div>' + htmlText(doc.business_email) + '</div>' : '') +
    (doc.business_phone ? '<div>' + htmlText(doc.business_phone) + '</div>' : '') +
    (vat ? '<div>VAT registration: ' + safe(doc.vat_number) + '</div>' : '') +
    '</div><div><div class="title">INVOICE</div><div class="right"><b>' + invoiceNumber(doc.invoice_no) + '</b></div></div></div>' +
    '<div class="blocks"><div class="block"><div class="label">Bill to</div><b>' + htmlText(doc.customer_name) + '</b><br/>' +
    htmlText(doc.customer_address) + (doc.customer_email ? '<br/>' + htmlText(doc.customer_email) : '') +
    '</div><div class="block"><div class="label">Invoice details</div><div>Issued: ' + safe(doc.invoice_date) + '</div><div>Work completed: ' + safe(doc.service_date) +
    '</div><div>Payment due: ' + safe(doc.due_date) + '</div></div></div>' +
    (doc.description ? '<div class="details"><div class="label">Work carried out</div>' + htmlText(doc.description) + '</div>' : '') +
    '<table class="items"><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>' +
    rows + '</tbody></table>' +
    '<table class="totals"><tr><td>Subtotal</td><td class="right">' + money(doc.subtotal) + '</td></tr>' +
    (vat ? '<tr><td>VAT (' + doc.vat_rate + '%)</td><td class="right">' + money(doc.vat_amount) + '</td></tr>' : '') +
    '<tr class="grand"><td>Total due</td><td class="right">' + money(doc.total) + '</td></tr></table>' +
    (doc.payment_details ? '<div class="foot"><div class="label">Payment details</div>' + htmlText(doc.payment_details) + '</div>' : '') +
    (doc.notes ? '<div class="foot"><div class="label">Notes</div>' + htmlText(doc.notes) + '</div>' : '') +
    '<p class="small">Invoice generated using Tradarr. Please retain a copy for your records.</p></body></html>';
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

export default function TradeInvoicesScreen({ goBack }: { goBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'create'>('list');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<AppJob[]>([]);
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
  const [paymentDetails, setPaymentDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [primaryTrade, setPrimaryTrade] = useState('plumber');
  const [lines, setLines] = useState<EditableLine[]>([{ kind: 'labour', description: '', quantity: '1', unit_price: '', unit: 'job' }]);

  const breakdown = useMemo(() => {
    const pence = { labour: 0, material: 0, other: 0 };
    lines.forEach(line => { pence[line.kind] += linePence(line); });
    return { labour: pence.labour / 100, material: pence.material / 100, other: pence.other / 100 };
  }, [lines]);
  const subtotal = Math.round((breakdown.labour + breakdown.material + breakdown.other) * 100) / 100;
  const quickTasks = labourTaskSuggestions[primaryTrade.toLowerCase()] || ['Call-out', 'Inspection', 'Repair work', 'Installation'];
  const vat = Math.round(subtotal * vatRate) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user || !alive) return;
        setUserId(user.id);
        const [saved, profile, business, regular, urgent, customerDetails] = await Promise.all([
          supabase.from('trade_invoices').select('*').eq('tradesperson_id', user.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('first_name, last_name, phone').eq('id', user.id).maybeSingle(),
          supabase.from('tradesperson_profiles').select('business_name, display_name, public_phone, primary_trade').eq('user_id', user.id).maybeSingle(),
          supabase.from('jobs').select('id,customer_id,trade,issue,location_label,standard_price,route_price,job_mode,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.from('urgent_requests').select('id,customer_id,trade,issue,location_label,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.rpc('trade_invoice_customer_details'),
        ]);
        if (!alive) return;
        const docs = (saved.data || []) as Invoice[];
        setInvoices(docs);
        const last = docs[0];
        setBusinessName(last?.business_name || business.data?.business_name || business.data?.display_name || '');
        setLegalName(last?.business_legal_name || [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(' '));
        setBusinessAddress(last?.business_address || '');
        setBusinessEmail(last?.business_email || user.email || '');
        setBusinessPhone(last?.business_phone || business.data?.public_phone || profile.data?.phone || '');
        setVatNumber(last?.vat_number || '');
        setPaymentDetails(last?.payment_details || '');
        if (business.data?.primary_trade) setPrimaryTrade(business.data.primary_trade);
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
    setSelectedJob(job.key);
    setCustomerName(job.customerName || '');
    setCustomerAddress(job.address || '');
    setDescription(job.issue);
    setLines([{ kind: 'labour', description: job.issue, quantity: '1', unit_price: job.suggestedPrice ? String(job.suggestedPrice) : '', unit: 'job' }]);
  };
  const startNew = () => {
    setSource('external'); setSelectedJob(null); setCustomerName(''); setCustomerAddress('');
    setCustomerEmail(''); setDescription(''); setNotes('');
    setInvoiceDate(dateToday()); setServiceDate(dateToday()); setDueDate(datePlusDays(14));
    setLines([{ kind: 'labour', description: '', quantity: '1', unit_price: '', unit: 'job' }]);
    setScreen('create');
  };
  const changeLine = (index: number, patch: Partial<EditableLine>) =>
    setLines(existing => existing.map((item, i) => i === index ? { ...item, ...patch } : item));
  const addLine = (kind: InvoiceLineKind, description = '') => {
    const newLine: EditableLine = { kind, description, quantity: '1', unit_price: '', unit: kind === 'labour' ? 'job' : 'each' };
    setLines(existing => {
      // A quick-add should replace the empty starter row, not leave a blank
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
    if (vatRate && !vatNumber.trim()) {
      Alert.alert('VAT registration needed', 'Only VAT-registered businesses should charge VAT. Enter your VAT number or select No VAT.'); return;
    }
    const items = lines.map(l => ({
      kind: l.kind, description: l.description.trim(), quantity: numericValue(l.quantity),
      unit_price: numericValue(l.unit_price), unit: l.unit
    }));
    if (!items.length || items.some(l => !l.description || !Number.isFinite(l.quantity) || l.quantity <= 0 ||
      !Number.isFinite(l.unit_price) || l.unit_price < 0 || l.unit_price > 1000000 || l.quantity > 100000)) {
      Alert.alert('Check the breakdown', 'Give each task or material a description, a quantity and a valid price.'); return;
    }
    if (!total && !items.some(l => l.unit_price > 0)) {
      Alert.alert('Enter a charge', 'Add at least one priced item.'); return;
    }
    const job = jobs.find(j => j.key === selectedJob);
    if (source === 'app' && !job) { Alert.alert('Select a job', 'Choose one of your accepted Tradarr jobs, or select Outside Tradarr.'); return; }
    setSaving(true);
    try {
      const payload = {
        tradesperson_id: userId, invoice_no: 0,
        source, app_job_id: source === 'app' && job?.kind === 'job' ? job.id : null,
        urgent_request_id: source === 'app' && job?.kind === 'urgent' ? job.id : null,
        business_name: businessName.trim(), business_legal_name: legalName.trim() || null,
        business_address: businessAddress.trim(), business_email: businessEmail.trim() || null,
        business_phone: businessPhone.trim() || null, vat_number: vatRate ? vatNumber.trim() : null,
        customer_name: customerName.trim(), customer_address: customerAddress.trim(), customer_email: customerEmail.trim() || null,
        description: description.trim() || null, items, invoice_date: invoiceDate, service_date: serviceDate, due_date: dueDate,
        vat_rate: vatRate, subtotal, vat_amount: vat, total, payment_details: paymentDetails.trim() || null,
        notes: notes.trim() || null, status: 'draft' as const,
      };
      const { data, error } = await supabase.from('trade_invoices').insert(payload).select('*').single();
      if (error || !data) throw new Error(error?.message || 'Could not save invoice');
      const doc = data as Invoice;
      setInvoices(old => [doc, ...old]);
      setScreen('list');
      await sharePdf(doc);
    } catch (e) { Alert.alert('Could not create invoice', String(e)); }
    finally { setSaving(false); }
  };
  const setStatus = async (doc: Invoice, status: Invoice['status']) => {
    const { data, error } = await supabase.from('trade_invoices').update({ status, updated_at: new Date().toISOString() })
      .eq('id', doc.id).eq('tradesperson_id', userId).select('*').single();
    if (error || !data) { Alert.alert('Could not update invoice', error?.message || 'Please try again.'); return; }
    setInvoices(old => old.map(item => item.id === doc.id ? data as Invoice : item));
  };
  const paid = invoices.filter(i => i.status === 'paid').reduce((n, i) => n + Number(i.total), 0);
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((n, i) => n + Number(i.total), 0);
  return <View style={s.root}>
    <View style={s.header}>
      <MotionPressable style={s.back} onPress={screen === 'create' ? () => setScreen('list') : goBack}
        accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft size={23} color={theme.colors.ink} />
      </MotionPressable>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>BUSINESS TOOLS</Text>
        <Text style={s.title}>{screen === 'create' ? 'New invoice' : 'Invoices'}</Text></View>
      {screen === 'list' ? <MotionPressable style={s.addTop} onPress={startNew} accessibilityRole="button" accessibilityLabel="Create invoice">
        <Plus color="#FFFFFF" size={21} /><Text style={s.addTopText}>New</Text></MotionPressable> : null}
    </View>

    {loading ? <ActivityIndicator style={{ marginTop: 60 }} size="large" color={theme.colors.teal} /> :
      screen === 'list' ? <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
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
                <Text style={s.invoiceMeta}>{doc.invoice_date} · Due {doc.due_date}</Text></View>
              <View style={{ alignItems: 'flex-end', gap: 7 }}><Text style={s.invoiceTotal}>{money(doc.total)}</Text>
                <Text style={[s.status, doc.status === 'paid' && s.paidStatus]}>{doc.status.toUpperCase()}</Text></View>
            </View>
            <View style={s.cardActions}>
              <MotionPressable style={s.action} onPress={() => sharePdf(doc)} disabled={sharing === doc.id}>
                <Share2 size={17} color={theme.colors.teal} /><Text style={s.actionText}>{sharing === doc.id ? 'Opening…' : 'Share PDF'}</Text>
              </MotionPressable>
              {doc.status === 'draft' ? <MotionPressable style={s.action} onPress={() => setStatus(doc, 'sent')}>
                <Check size={17} color={theme.colors.teal} /><Text style={s.actionText}>Mark sent</Text></MotionPressable> : null}
              {doc.status === 'sent' ? <MotionPressable style={s.action} onPress={() => setStatus(doc, 'paid')}>
                <Check size={17} color={theme.colors.teal} /><Text style={s.actionText}>Mark paid</Text></MotionPressable> : null}
            </View>
          </View>)}
      </ScrollView> : <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
        <View style={s.suggestionCard}>
          <Text style={s.suggestionTitle}>QUICK ADD · COMMON TASKS</Text>
          <View style={s.suggestionRow}>
            {quickTasks.map(task => <MotionPressable key={task} onPress={() => addLine('labour', task)} style={s.suggestionChip}
              accessibilityRole="button" accessibilityLabel={'Add labour task: ' + task}>
              <Plus size={12} color={theme.colors.teal} /><Text style={s.suggestionText}>{task}</Text>
            </MotionPressable>)}
          </View>
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
            {(item.kind === 'labour' ? ['job', 'hour'] : ['each', 'metre']).map(unit =>
              <Pill key={unit} label={unit === 'job' ? 'Per job' : unit === 'hour' ? 'Per hour' : unit === 'metre' ? 'Per metre' : 'Per item'}
                active={item.unit === unit} onPress={() => changeLine(i, { unit })} />)}
          </View>
          <View style={s.twoCols}><View style={{ flex: 1 }}>
            <Field label={item.unit === 'hour' ? 'Hours' : item.unit === 'metre' ? 'Metres' : 'Quantity'} numeric
              value={item.quantity} onChange={v => changeLine(i, { quantity: v })} required />
          </View><View style={{ flex: 1 }}>
            <Field label={'Price per ' + (item.unit === 'hour' ? 'hour' : item.unit === 'metre' ? 'metre' : item.unit === 'job' ? 'job' : 'item') + ' (£)'}
              numeric value={item.unit_price} onChange={v => changeLine(i, { unit_price: v })} placeholder="0.00" required />
          </View></View>
          <View style={s.lineTotalBar}><Text style={s.lineTotalLabel}>Line total</Text><Text style={s.lineTotal}>{money(linePence(item) / 100)}</Text></View>
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

        <Text style={s.section}>VAT</Text>
        <View style={s.card}>
          <Text style={s.small}>Only add VAT if your business is VAT registered.</Text>
          <View style={s.pillRow}>
            {[0, 5, 20].map(rate => <Pill key={rate} label={rate === 0 ? 'No VAT' : rate + '% VAT'}
              active={vatRate === rate} onPress={() => setVatRate(rate)} />)}
          </View>
          {vatRate > 0 ? <Field label="VAT registration number" value={vatNumber} onChange={setVatNumber} required /> : null}
        </View>

        <Text style={s.section}>Payment</Text>
        <View style={s.card}>
          <Field label="Bank transfer / payment details" value={paymentDetails} onChange={setPaymentDetails} multi
            placeholder="Account name, sort code, account number, reference" />
          <Field label="Additional notes (optional)" value={notes} onChange={setNotes} multi />
        </View>
        <View style={s.totalCard}><View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalLabel}>{money(subtotal)}</Text></View>
          {vatRate > 0 ? <View style={s.totalRow}><Text style={s.totalLabel}>VAT ({vatRate}%)</Text><Text style={s.totalLabel}>{money(vat)}</Text></View> : null}
          <View style={s.totalRow}><Text style={s.totalTitle}>Total due</Text><Text style={s.totalNumber}>{money(total)}</Text></View>
        </View>
        <MotionPressable style={[s.heroButton, saving && { opacity: 0.55 }]} onPress={createInvoice} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <FileText size={20} color="#FFFFFF" />}
          <Text style={s.heroButtonText}>{saving ? 'Creating…' : 'Generate and share PDF'}</Text>
        </MotionPressable>
        <Text style={[s.helper, { textAlign: 'center', marginBottom: 12 }]}>Invoices are saved securely to your account. Sharing a PDF does not automatically mark it as sent.</Text>
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
  suggestionCard: { marginBottom: 15 },
  suggestionTitle: { color: theme.colors.muted, fontWeight: '800', letterSpacing: 1, fontSize: 10, marginBottom: 9 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line },
  suggestionText: { color: theme.colors.teal, fontSize: 12, fontWeight: '700' },
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