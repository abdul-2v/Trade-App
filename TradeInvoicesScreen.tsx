import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type {ScrollViewInstance} from 'react-native';
import { ArrowLeft, Check, ChevronRight, FileText, Plus, Share2, Trash2 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { MotionPressable } from './Motion';
import { supabase } from './lib/supabase';
import { theme } from './theme';
import {formatTradeQuantity,hasInvalidTradeQuantity,unitOptionLabel} from './lib/documentUnits';
import {invoiceHtml} from './lib/tradarrInvoicePdf';
import {FormFlowSteps,FormFlowFooter,FormFlowFloatingPreview} from './PremiumFormFlow';
import {SavedWorkLibrary,SaveWorkPreset,DocumentPresetBar,type WorkHistory,type WorkLine} from './SavedWorkLibrary';
import DocumentComposerOverview from './DocumentComposerOverview';

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
  id: string; invoice_no: number; tradesperson_id: string; quote_id?: string|null;
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
  invoice_details?: {companyNumber?:string;jobReference?:string;purchaseOrder?:string;workAddress?:string;workStartDate?:string;paymentTerms?:string;bankName?:string;accountName?:string;sortCode?:string;accountNumber?:string;paymentReference?:string};
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
const dateFromInvoice=(value:string,days:number)=>{
 const source=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:dateToday();
 const d=new Date(source+'T12:00:00');d.setDate(d.getDate()+days);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const safe = (v: unknown) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const htmlText = (v: unknown) => safe(v).replace(/\n/g, '<br/>');
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + 'T12:00:00').getTime());
const invoiceStatusLabel = (status: Invoice['status']) =>
  status === 'draft' ? 'READY TO SEND' :
  status === 'sent' ? 'SENT · UNPAID' :
  status === 'paid' ? 'PAID' : 'VOID';


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

export default function TradeInvoicesScreen({ goBack, initialPreviewId, initialCreate=false, onCreateOpened }: { goBack: () => void; initialPreviewId?: string | null; initialCreate?:boolean; onCreateOpened?:()=>void }) {
  const handledCreate=useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'create' | 'draftPreview' | 'preview'>('list');
  const [formStep,setFormStep]=useState(0);
  const formScrollRef=useRef<ScrollViewInstance>(null);
  const [expandedUnitLine,setExpandedUnitLine]=useState<number|null>(null);
  const [showBusinessDetails,setShowBusinessDetails]=useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workHistory,setWorkHistory]=useState<WorkHistory[]>([]);
  const [editingDraftId,setEditingDraftId]=useState<string|null>(null);
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
  const [companyNumber,setCompanyNumber]=useState('');
  const [jobReference,setJobReference]=useState('');
  const [purchaseOrder,setPurchaseOrder]=useState('');
  const [workAddress,setWorkAddress]=useState('');
  const [workStartDate,setWorkStartDate]=useState('');
  const [paymentTerms,setPaymentTerms]=useState('');
  const [bankName,setBankName]=useState('');
  const [accountName,setAccountName]=useState('');
  const [sortCode,setSortCode]=useState('');
  const [accountNumber,setAccountNumber]=useState('');
  const [paymentReference,setPaymentReference]=useState('');
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
        const [saved, profile, business, regular, urgent, customerDetails, privateCustomers, invoicePayments, previousQuotes] = await Promise.all([
          supabase.from('trade_invoices').select('*').eq('tradesperson_id', user.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('first_name, last_name, phone').eq('id', user.id).maybeSingle(),
          supabase.from('tradesperson_profiles').select('business_name, display_name, public_phone, primary_trade').eq('user_id', user.id).maybeSingle(),
          supabase.from('jobs').select('id,customer_id,trade,issue,location_label,standard_price,route_price,job_mode,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.from('urgent_requests').select('id,customer_id,trade,issue,location_label,status').eq('accepted_tradesperson_id', user.id).order('created_at', { ascending: false }).limit(30),
          supabase.rpc('trade_invoice_customer_details'),
          supabase.from('trade_customers').select('id,name,email,address').eq('tradesperson_id', user.id).order('name'),
          supabase.from('trade_invoice_payments').select('invoice_id,amount').eq('tradesperson_id',user.id).limit(500),
          supabase.from('trade_quotes').select('items,created_at').eq('tradesperson_id',user.id).order('created_at',{ascending:false}).limit(100),
        ]);
        if (!alive) return;
        const docs = (saved.data || []) as Invoice[];
        setInvoices(docs);
        setWorkHistory([...(docs||[]),...(previousQuotes.data||[])]);
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
        setCompanyNumber(last?.invoice_details?.companyNumber || '');
        setPaymentTerms(last?.invoice_details?.paymentTerms || '');
        setBankName(last?.invoice_details?.bankName || '');
        setAccountName(last?.invoice_details?.accountName || '');
        setSortCode(last?.invoice_details?.sortCode || '');
        setAccountNumber(last?.invoice_details?.accountNumber || '');
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
    setWorkAddress(job.address || '');
    setDescription(job.issue);
    setLines([{ kind: 'labour', description: job.issue, quantity: '1', unit_price: job.suggestedPrice ? String(job.suggestedPrice) : '', unit: 'job' }]);
  };
  const startNew = () => {
    setEditingDraftId(null);
    setSource('external'); setSelectedJob(null); setSelectedCustomerId(null); setCustomerBookOpen(false); setCustomerName(''); setCustomerAddress('');
    setCustomerEmail(''); setDescription(''); setNotes('');
    setJobReference('');setPurchaseOrder('');setWorkAddress('');setWorkStartDate('');setPaymentReference('');
    setIncludePaymentDetails(false); setSelectedInvoiceId(null);
    setInvoiceDate(dateToday()); setServiceDate(dateToday()); setDueDate(datePlusDays(14));
    setLines([{ kind: 'labour', description: '', quantity: '1', unit_price: '', unit: 'job' }]);
    setDiscountInput('0');setDepositInput('0');
    setFormStep(-1);setExpandedUnitLine(null);setShowBusinessDetails(!businessName.trim()||!businessAddress.trim());
    setScreen('create');
  };
  // Wait for business defaults, then consume a new-draft shortcut exactly once.
  useEffect(()=>{
    if(!initialCreate||loading||!userId||handledCreate.current)return;
    handledCreate.current=true;
    if(!initialPreviewId&&screen==='list')startNew();
    onCreateOpened?.();
  },[initialCreate,loading,userId,initialPreviewId,screen]);
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

  const editableFrom=(doc:Invoice)=>{
    const locked=doc.status!=='draft'||!!doc.quote_id;
    setEditingDraftId(locked?null:doc.id);
    setSelectedInvoiceId(null);
    setSource(locked?'external':doc.source);
    setSelectedJob(!locked&&doc.source==='app'?
      (doc.app_job_id?'job:'+doc.app_job_id:doc.urgent_request_id?'urgent:'+doc.urgent_request_id:null):null);
    setSelectedCustomerId(locked?null:(doc as any).customer_id||null);
    setCustomerName(doc.customer_name||'');setCustomerAddress(doc.customer_address||'');setCustomerEmail(doc.customer_email||'');
    setBusinessName(doc.business_name||'');setLegalName(doc.business_legal_name||'');
    setBusinessAddress(doc.business_address||'');setBusinessEmail(doc.business_email||'');setBusinessPhone(doc.business_phone||'');
    setVatNumber(doc.vat_number||'');setVatRate(Number(doc.vat_rate)||0);
    setDescription(doc.description||'');setNotes(locked?'Correction based on '+invoiceNumber(doc.invoice_no)+(doc.notes?'\n'+doc.notes:''):doc.notes||'');
    setInvoiceDate(locked?dateToday():doc.invoice_date);setServiceDate(doc.service_date||dateToday());
    setDueDate(locked?datePlusDays(14):doc.due_date);
    setDiscountInput(String(doc.discount_amount||0));setDepositInput(String(doc.deposit_requested||0));
    setPaymentDetails(doc.payment_details||'');
    setIncludePaymentDetails(!!(doc.payment_details||doc.invoice_details?.bankName||doc.invoice_details?.accountName));
    const d=doc.invoice_details||{};
    setCompanyNumber(d.companyNumber||'');setJobReference(d.jobReference||'');setPurchaseOrder(d.purchaseOrder||'');
    setWorkAddress(d.workAddress||'');setWorkStartDate(d.workStartDate||'');setPaymentTerms(d.paymentTerms||'');
    setBankName(d.bankName||'');setAccountName(d.accountName||'');setSortCode(d.sortCode||'');
    setAccountNumber(d.accountNumber||'');setPaymentReference(d.paymentReference||'');
    setLines((doc.items||[]).length?(doc.items||[]).map(line=>({kind:line.kind||'other',description:line.description,
      quantity:String(line.quantity),unit_price:String(line.unit_price),unit:line.unit||'item'})):
       [{kind:'labour',description:'',quantity:'1',unit_price:'',unit:'job'}]);
    setFormStep(-1);setShowBusinessDetails(false);setScreen('create');
    if(locked)Alert.alert('New corrected invoice','The original issued invoice is protected. This is a new editable draft with a new invoice number when saved. The original remains in your records.');
  };
  const addSavedLine=(line:WorkLine)=>setLines(old=>{
    const valid=old.filter(v=>v.description.trim()||v.unit_price.trim());
    return [...valid,{kind:line.kind||'other',description:line.description,quantity:String(line.quantity),
     unit_price:String(line.unit_price),unit:line.unit||'item'}];
  });
  const invoiceSetup={
    businessName,legalName,businessAddress,businessEmail,businessPhone,companyNumber,vatNumber,
    customerName,customerAddress,customerEmail,description,invoiceDate,serviceDate,dueDate,
    vatRate,discountInput,depositInput,paymentDetails,includePaymentDetails,notes,
    invoiceDetails:{companyNumber,jobReference,purchaseOrder,workAddress,workStartDate,paymentTerms,
     bankName,accountName,sortCode,accountNumber,paymentReference},
    lines
  };
  const applyInvoiceSetup=(v:any)=>{
    if(!v||typeof v!=='object')return;
    setBusinessName(String(v.businessName||''));setLegalName(String(v.legalName||''));
    setBusinessAddress(String(v.businessAddress||''));setBusinessEmail(String(v.businessEmail||''));
    setBusinessPhone(String(v.businessPhone||''));setVatNumber(String(v.vatNumber||''));
    setCustomerName(String(v.customerName||''));setCustomerAddress(String(v.customerAddress||''));
    setCustomerEmail(String(v.customerEmail||''));setDescription(String(v.description||''));
    setVatRate([0,5,20].includes(Number(v.vatRate))?Number(v.vatRate):0);
    setDiscountInput(String(v.discountInput||'0'));setDepositInput(String(v.depositInput||'0'));
    setPaymentDetails(String(v.paymentDetails||''));setIncludePaymentDetails(Boolean(v.includePaymentDetails));
    setNotes(String(v.notes||''));
    const d=v.invoiceDetails||{};
    setCompanyNumber(String(d.companyNumber||''));setJobReference(String(d.jobReference||''));
    setPurchaseOrder(String(d.purchaseOrder||''));setWorkAddress(String(d.workAddress||''));
    setWorkStartDate(String(d.workStartDate||''));setPaymentTerms(String(d.paymentTerms||''));
    setBankName(String(d.bankName||''));setAccountName(String(d.accountName||''));
    setSortCode(String(d.sortCode||''));setAccountNumber(String(d.accountNumber||''));
    setPaymentReference(String(d.paymentReference||''));
    if(Array.isArray(v.lines)&&v.lines.length)setLines(v.lines.slice(0,100).map((line:any)=>({
      kind:['labour','material','other'].includes(line.kind)?line.kind:'other',
      description:String(line.description||''),quantity:String(line.quantity||1),
      unit_price:String(line.unit_price??''),unit:String(line.unit||'item')})));
    // Reset dates for new invoices. Presets never silently reissue a previous date or number.
    setInvoiceDate(dateToday());setServiceDate(dateToday());setDueDate(datePlusDays(14));
    setEditingDraftId(null);setSource('external');setSelectedJob(null);setSelectedCustomerId(null);
    setFormStep(-1);
  };
  const sharePdf = async (doc: Invoice) => {
    if (sharing) return;
    setSharing(doc.id);
    try {
      const html = invoiceHtml(doc,paymentTotals[doc.id]||0);
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
    if (workStartDate && (!validDate(workStartDate) || workStartDate>serviceDate)) {
      Alert.alert('Check work dates','The work start date must be valid and no later than the completion date.');return;
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
        invoice_details:{companyNumber:companyNumber.trim(),jobReference:jobReference.trim(),purchaseOrder:purchaseOrder.trim(),workAddress:workAddress.trim(),workStartDate:workStartDate.trim(),paymentTerms:paymentTerms.trim(),
          bankName:includePaymentDetails?bankName.trim():'',accountName:includePaymentDetails?accountName.trim():'',sortCode:includePaymentDetails?sortCode.trim():'',
          accountNumber:includePaymentDetails?accountNumber.trim():'',paymentReference:includePaymentDetails?paymentReference.trim():''},
        notes: notes.trim() || null, status: 'draft' as const,
      };
      const { data, error } = editingDraftId?
        await supabase.from('trade_invoices').update({
          ...Object.fromEntries(Object.entries(payload).filter(([key])=>!['invoice_no','tradesperson_id','source','app_job_id','urgent_request_id'].includes(key))),
          updated_at:new Date().toISOString()
        }).eq('id',editingDraftId).eq('tradesperson_id',userId).eq('status','draft').is('quote_id',null).select('*').single():
        await supabase.from('trade_invoices').insert(payload).select('*').single();
      if (error || !data) throw new Error(error?.message || 'Could not save invoice');
      const doc = data as Invoice;
      setInvoices(old => editingDraftId?old.map(x=>x.id===doc.id?doc:x):[doc,...old]);
      setEditingDraftId(null);
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
  const draftInvoice:Invoice={
    id:'draft-preview',invoice_no:0,tradesperson_id:userId,source,app_job_id:null,urgent_request_id:null,
    business_name:businessName||'Business name',business_legal_name:legalName||null,
    business_address:businessAddress||'Business address',business_email:businessEmail||null,business_phone:businessPhone||null,
    vat_number:vatRate?vatNumber||null:null,customer_name:customerName||'Customer name',
    customer_address:customerAddress||'Billing address',customer_email:customerEmail||null,
    description:description||null,
    items:lines.map(line=>({kind:line.kind,description:line.description||'Description',quantity:Math.max(0,numericValue(line.quantity)||0),
      unit_price:Math.max(0,numericValue(line.unit_price)||0),unit:line.unit})),
    invoice_date:invoiceDate,service_date:serviceDate,due_date:dueDate,
    vat_rate:vatRate,subtotal,discount_amount:discount,vat_amount:vat,total,
    deposit_requested:Math.max(0,numericValue(depositInput)||0),
    payment_details:includePaymentDetails?paymentDetails||null:null,notes:notes||null,
    invoice_details:{companyNumber,jobReference,purchaseOrder,workAddress,workStartDate,paymentTerms,
      bankName:includePaymentDetails?bankName:'',accountName:includePaymentDetails?accountName:'',sortCode:includePaymentDetails?sortCode:'',
      accountNumber:includePaymentDetails?accountNumber:'',paymentReference:includePaymentDetails?paymentReference:''},
    status:'draft',created_at:new Date().toISOString()
  };
  useEffect(()=>{if(screen==='create')formScrollRef.current?.scrollTo({y:0,animated:false});},[formStep,screen]);
  const changeFormStep=(index:number)=>{setFormStep(Math.min(3,Math.max(0,index)));};
  const goForward=()=>{
    if(formStep===0&&(!businessName.trim()||!businessAddress.trim()||!customerName.trim()||!customerAddress.trim())){
      setShowBusinessDetails(true);
      Alert.alert('Finish the people and property details','Add the trading name, business address, customer name and billing address before continuing.');
      return;
    }
    if(formStep===1){
      if(!validDate(invoiceDate)||!validDate(serviceDate)||!validDate(dueDate)){
        Alert.alert('Check the dates','Enter valid invoice, work and payment due dates.');return;
      }
      if(!lines.length||lines.some(l=>!l.description.trim()||hasInvalidTradeQuantity(numericValue(l.quantity),l.unit)||
        !Number.isFinite(numericValue(l.unit_price))||numericValue(l.unit_price)<0)){
        Alert.alert('Check the work breakdown','Each labour task or material needs a description, valid quantity and price.');return;
      }
    }
    if(formStep<3)changeFormStep(formStep+1);else setScreen('draftPreview');
  };
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId) || null;
  const paid = invoices.filter(i => i.status === 'paid').reduce((n, i) => n + Number(i.total), 0);
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((n, i) =>
    n + Math.max(0,Number(i.total)-(paymentTotals[i.id]||0)),0);
  return <View style={s.root}>
    <View style={s.header}>
      <MotionPressable style={s.back} onPress={screen === 'draftPreview' ? () => setScreen('create') : screen === 'create' ? () => formStep>=0?setFormStep(-1):setScreen('list') : screen === 'preview' ? () => setScreen('list') : goBack}
        accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft size={23} color={theme.colors.ink} />
      </MotionPressable>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>BUSINESS TOOLS</Text>
        <Text style={s.title}>{screen === 'create' ? (editingDraftId?'Edit invoice draft':'New invoice') : screen === 'draftPreview' ? 'Preview draft' : screen === 'preview' ? 'Invoice preview' : 'Invoices'}</Text></View>
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
              <MotionPressable style={s.action} onPress={()=>editableFrom(doc)} accessibilityRole="button" accessibilityLabel={doc.status==='draft'&&!doc.quote_id?'Edit invoice':'Make corrected invoice'}>
               <FileText size={17} color={theme.colors.teal}/><Text style={s.actionText}>{doc.status==='draft'&&!doc.quote_id?'Edit':'Revise'}</Text>
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
              source={{ html: invoiceHtml(selectedInvoice,paymentTotals[selectedInvoice.id]||0) }}
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
            <MotionPressable style={s.previewMarkSent} onPress={()=>editableFrom(selectedInvoice)}
              accessibilityRole="button" accessibilityLabel={selectedInvoice.status==='draft'&&!selectedInvoice.quote_id?'Edit invoice draft':'Create corrected invoice'}>
              <FileText size={18} color={theme.colors.teal}/>
              <Text style={s.previewMarkSentText}>{selectedInvoice.status==='draft'&&!selectedInvoice.quote_id?'Edit all fields':'Create corrected invoice'}</Text>
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
      ) : screen==='draftPreview' ? <View style={s.previewRoot}>
         <View style={s.previewInfo}>
          <View style={{flex:1}}>
           <Text style={s.previewInvoiceNo}>DRAFT · NOT SAVED</Text>
           <Text style={s.previewCustomer}>{customerName||'Customer name'}</Text>
          </View><Text style={s.previewAmount}>{money(total)}</Text>
         </View>
         <View style={s.previewPaper}>
          <WebView source={{html:invoiceHtml(draftInvoice)}} style={s.previewWeb}
             originWhitelist={['*']} javaScriptEnabled={false} showsVerticalScrollIndicator={false}/>
         </View>
         <View style={s.previewActions}>
          <MotionPressable style={s.previewShare} onPress={createInvoice} disabled={saving}
            accessibilityRole="button" accessibilityLabel="Save invoice draft">
           {saving?<ActivityIndicator color="#FFFFFF"/>:<Check size={20} color="#FFFFFF"/>}
           <Text style={s.previewShareText}>{saving?'Saving…':'Save invoice draft'}</Text>
          </MotionPressable>
          <MotionPressable style={s.previewMarkSent} onPress={()=>setScreen('create')}
             accessibilityRole="button" accessibilityLabel="Back to edit invoice">
            <ArrowLeft size={18} color={theme.colors.teal}/><Text style={s.previewMarkSentText}>Back to editing</Text>
          </MotionPressable>
          <Text style={s.previewHint}>Preview only. Nothing is saved or sent until you choose Save invoice draft.</Text>
         </View>
        </View> : <View style={{flex:1}}>
        <ScrollView ref={formScrollRef} automaticallyAdjustKeyboardInsets contentContainerStyle={[s.page,{paddingBottom:135}]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {formStep===-1&&<DocumentComposerOverview title={editingDraftId?'Edit your invoice':'Build your invoice'}
         description="Everything in one place. Tap the details you need to change or reuse a previous job."
         sections={[
          {title:'Customer & business',label:customerName||'Add customer',detail:customerAddress||'Customer, address, job source and business details',
           done:!!customerName.trim()&&!!customerAddress.trim()&&!!businessName.trim()&&!!businessAddress.trim()},
          {title:'Work & materials',label:lines.filter(l=>l.description.trim()).length+' itemised entries',
           detail:'Labour, materials, quantity and rates',done:lines.some(l=>l.description.trim()&&l.unit_price.trim())},
          {title:'Payment details',label:dueDate,detail:'VAT, bank details and payment terms',done:!!dueDate},
          {title:'Review & create',label:money(total),detail:'Check the A4 document before saving',done:total>0},
         ]}
         amount={money(total)} onEdit={changeFormStep} onPreview={()=>setScreen('draftPreview')}>
          <SavedWorkLibrary ownerId={userId} history={workHistory} onAdd={addSavedLine}/>
          <DocumentPresetBar ownerId={userId} scope="invoice" snapshot={invoiceSetup} onApply={applyInvoiceSetup}/>
         </DocumentComposerOverview>}
        {formStep>=0&&<FormFlowSteps labels={['People','Work','Payment','Review']} active={formStep} onSelect={changeFormStep}
         subtitle={['Who is the work for?','What was done, and when?','VAT, terms and how to pay','Check the details before saving'][formStep]}/>}
        {formStep===0&&<>
        <DocumentPresetBar ownerId={userId} scope="invoice" snapshot={invoiceSetup} onApply={applyInvoiceSetup}/>
        <Text style={s.flowIntro}>Start with the customer. Your business details are remembered, so you only need to change them when necessary.</Text>
        <Text style={s.section}>Where was the job from?</Text>
        <View style={s.pillRow}>
          <Pill label="My own customer" active={source === 'external'} onPress={() => {
            if(editingDraftId){Alert.alert('Linked source is locked','The existing invoice keeps its original source and job. Save a new invoice to use a different job.');return;}
            setSource('external');setSelectedJob(null);
          }} />
          <Pill label="Tradarr job" active={source === 'app'} onPress={() => {
            if(editingDraftId){Alert.alert('Linked source is locked','The existing invoice keeps its original source and job. Save a new invoice to use a different job.');return;}
            setSource('app');
          }} />
        </View>
        {editingDraftId?<Text style={s.helper}>Invoice job source and linked booking cannot be changed after the draft is created. All other draft details remain editable.</Text>:null}
        {source === 'app' ? <View style={s.card}>
          <Text style={s.cardTitle}>Choose an accepted job</Text>
          {!jobs.length ? <Text style={s.small}>No accepted app jobs yet. You can invoice outside work instead.</Text> :
            jobs.map(job => <MotionPressable key={job.key} onPress={() => {
             if(editingDraftId){Alert.alert('Original job is protected','To change the linked Tradarr job, create a new invoice instead.');return;}
             pickJob(job);
            }}
              style={[s.jobChoice, selectedJob === job.key && s.jobSelected]}>
              <View style={{ flex: 1 }}><Text style={s.jobTitle}>{job.trade} · {job.kind === 'urgent' ? 'Urgent callout' : 'Booking'}</Text>
                <Text style={s.small} numberOfLines={2}>{job.issue}</Text></View>
              {selectedJob === job.key ? <Check size={18} color={theme.colors.teal} /> : <ChevronRight size={18} color={theme.colors.muted} />}
            </MotionPressable>)}
          <Text style={s.helper}>Job details are suggested automatically. Check the customer's full billing address before creating the invoice.</Text>
        </View> : null}

        <MotionPressable style={s.businessCompact} onPress={()=>setShowBusinessDetails(v=>!v)} accessibilityRole="button"
          accessibilityLabel="Edit business details" accessibilityState={{expanded:showBusinessDetails}}>
          <View style={{flex:1}}><Text style={s.compactOverline}>ISSUED BY</Text>
           <Text style={s.compactTitle}>{businessName||'Add your business details'}</Text>
           <Text style={s.compactCaption} numberOfLines={1}>{businessAddress||'Business address required'}</Text>
          </View><Text style={s.compactAction}>{showBusinessDetails?'Done':'Edit'}</Text>
        </MotionPressable>
        {showBusinessDetails?<View style={s.card}>
          <Field label="Trading / business name" value={businessName} onChange={setBusinessName} required />
          <Field label="Legal name (if different)" value={legalName} onChange={setLegalName} />
          <Field label="Business address" value={businessAddress} onChange={setBusinessAddress} multi required />
          <Field label="Business email" value={businessEmail} onChange={setBusinessEmail} />
          <Field label="Business phone" value={businessPhone} onChange={setBusinessPhone} />
          <Field label="Company registration number (if limited)" value={companyNumber} onChange={setCompanyNumber} placeholder="Optional" />
          <Text style={s.helper}>These details will be remembered from your latest invoice.</Text>
        </View>:null}

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
          <Field label="Job / project reference (optional)" value={jobReference} onChange={setJobReference}/>
          <Field label="Customer purchase order (optional)" value={purchaseOrder} onChange={setPurchaseOrder}/>
          <Field label="Work address (if different)" value={workAddress} onChange={setWorkAddress} multi/>
          <Field label="Work summary (optional)" value={description} onChange={setDescription} multi placeholder="e.g. Replaced leaking kitchen tap" />
        </View>

        </>}
        {formStep===1&&<>
        <SavedWorkLibrary ownerId={userId} history={workHistory} onAdd={addSavedLine}/>
        <Text style={s.section}>Dates</Text>
        <View style={s.card}>
          <Field label="Invoice date (YYYY-MM-DD)" value={invoiceDate} onChange={setInvoiceDate} required />
          <Field label="Work start date (optional, YYYY-MM-DD)" value={workStartDate} onChange={setWorkStartDate}/>
          <Field label="Date work was completed (YYYY-MM-DD)" value={serviceDate} onChange={setServiceDate} required />
          <Field label="Payment due (YYYY-MM-DD)" value={dueDate} onChange={setDueDate} required />
          <Text style={[s.unitsLabel,{marginTop:6,marginBottom:10}]}>Quick payment terms</Text>
          <View style={s.pillRow}>{[0,7,14,30].map(days=><Pill key={days} label={days===0?'On receipt':days+' days'}
           active={dueDate===dateFromInvoice(invoiceDate,days)} onPress={()=>setDueDate(dateFromInvoice(invoiceDate,days))}/>)}</View>
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
          <MotionPressable style={s.compactUnitsHeader} onPress={()=>setExpandedUnitLine(v=>v===i?null:i)} accessibilityRole="button">
             <Text style={s.compactUnitsLabel}>CHARGE BY</Text>
             <Text style={s.compactUnitsValue}>Per {item.unit==='each'?'item':item.unit}</Text>
             <ChevronRight size={17} color={theme.colors.teal} style={expandedUnitLine===i?{transform:[{rotate:'90deg'}]}:undefined}/>
          </MotionPressable>
          {expandedUnitLine===i&&<View style={s.unitsRow}>
            <Text style={s.unitsLabel}>Select a unit</Text>
            {(item.kind === 'labour' ? ['job','hour','day','radiator','valve','item'] : item.kind === 'material'
                ? ['item','metre','radiator','valve','box','pack'] : ['job','item','hour']).map(unit =>
              <Pill key={unit} label={unitOptionLabel(unit)}
                active={item.unit === unit || (item.unit === 'each' && unit === 'item')} onPress={() => {changeLine(i, { unit, quantity: unit==='job'?'1':item.quantity });setExpandedUnitLine(null);}} />)}
          </View>}
          <View style={s.twoCols}><View style={{ flex: 1 }}>
            <Field label={item.unit === 'hour' ? 'Hours' : item.unit === 'metre' ? 'Metres' : 'Quantity'} numeric
              value={item.quantity} onChange={v => changeLine(i, { quantity: v })} required />
          </View><View style={{ flex: 1 }}>
            <Field label={'Price per ' + (item.unit === 'each' ? 'item' : item.unit) + ' (£)'}
              numeric value={item.unit_price} onChange={v => changeLine(i, { unit_price: v })} placeholder="0.00" required />
          </View></View>
          <SaveWorkPreset ownerId={userId} line={{kind:item.kind,description:item.description,quantity:numericValue(item.quantity),
             unit_price:numericValue(item.unit_price),unit:item.unit}}/>
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

        </>}
        {formStep===2&&<>
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
            <Field label="Bank name (optional)" value={bankName} onChange={setBankName}/>
            <Field label="Account name (optional)" value={accountName} onChange={setAccountName}/>
            <Field label="Sort code (optional)" value={sortCode} onChange={setSortCode} placeholder="00-00-00"/>
            <Field label="Account number (optional)" value={accountNumber} onChange={setAccountNumber}/>
            <Field label="Payment reference (optional)" value={paymentReference} onChange={setPaymentReference} placeholder="Uses invoice number if blank"/>
            <Field label="Bank transfer details (optional)" value={paymentDetails} onChange={setPaymentDetails} multi
              placeholder="Account name, sort code, account number, reference" />
          </View> : null}
          <View style={{ marginTop: 12 }}>
            <Field label="Payment terms (optional)" value={paymentTerms} onChange={setPaymentTerms} multi placeholder="e.g. Payment due within 14 days, as agreed"/>
            <Field label="Additional notes (optional)" value={notes} onChange={setNotes} multi />
          </View>
        </View>
        </>}
        {formStep===3&&<>
         <View style={s.reviewHero}><Text style={s.reviewOverline}>READY FOR YOUR REVIEW</Text>
          <Text style={s.reviewHeading}>One last look.</Text>
          <Text style={s.reviewText}>The invoice isn't saved or sent yet. Review the information and open the full A4 preview before creating it.</Text>
         </View>
         <View style={s.card}>
          <Text style={s.reviewLabel}>CUSTOMER</Text><Text style={s.reviewMain}>{customerName||'Not entered'}</Text>
          <Text style={s.reviewMuted}>{customerAddress||'No billing address'}</Text>
          <Text style={[s.reviewLabel,{marginTop:20}]}>WORK & PAYMENT</Text>
          <Text style={s.reviewMain}>{lines.filter(l=>l.description.trim()).length} itemised entries</Text>
          <Text style={s.reviewMuted}>Work completed {serviceDate} · Due {dueDate}</Text>
          <MotionPressable style={s.reviewEdit} onPress={()=>setFormStep(1)} accessibilityRole="button">
            <Text style={s.reviewEditText}>Edit the work breakdown</Text><ChevronRight size={17} color={theme.colors.teal}/>
          </MotionPressable>
         </View>
        <View style={s.totalCard}><View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalLabel}>{money(subtotal)}</Text></View>
          {discount>0?<View style={s.totalRow}><Text style={s.totalLabel}>Discount</Text><Text style={s.totalLabel}>−{money(discount)}</Text></View>:null}
          {vatRate > 0 ? <View style={s.totalRow}><Text style={s.totalLabel}>VAT ({vatRate}%)</Text><Text style={s.totalLabel}>{money(vat)}</Text></View> : null}
          <View style={s.totalRow}><Text style={s.totalTitle}>Total due</Text><Text style={s.totalNumber}>{money(total)}</Text></View>
        </View>
         <Text style={s.reviewMuted}>Your invoice number is assigned when you save the draft. Sharing is separate.</Text>
        </>}
       </ScrollView>
       {formStep>=0&&<FormFlowFooter active={formStep} total={4} onPrevious={()=>setFormStep(-1)}
        onNext={()=>setFormStep(-1)} primaryLabel="Done · Back to overview" amount={money(total)}/>}
       
       <FormFlowFloatingPreview onPress={()=>setScreen('draftPreview')} label="A4 preview"/>
      </View>}
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
  flowIntro:{fontSize:12,color:theme.colors.muted,lineHeight:18,marginBottom:16},
  businessCompact:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:19,backgroundColor:'#FFFFFF',
    borderWidth:1,borderColor:theme.colors.line,marginTop:20,marginBottom:12},
  compactOverline:{fontSize:9,fontWeight:'800',letterSpacing:1.1,color:theme.colors.teal},
  compactUnitsHeader:{flexDirection:'row',alignItems:'center',gap:8,minHeight:43,paddingHorizontal:12,borderRadius:12,backgroundColor:theme.colors.tealTint,marginBottom:10},
  compactUnitsLabel:{fontSize:9,fontWeight:'800',letterSpacing:.6,color:theme.colors.muted},
  compactUnitsValue:{flex:1,fontSize:12,fontWeight:'800',color:theme.colors.teal,textAlign:'right'},
  compactTitle:{fontSize:17,fontWeight:'800',color:theme.colors.ink,marginTop:5},
  compactCaption:{fontSize:11,color:theme.colors.muted,marginTop:4},
  compactAction:{color:theme.colors.teal,fontWeight:'800',fontSize:13},
  reviewHero:{backgroundColor:theme.colors.tealTint,borderRadius:21,padding:23,marginVertical:8},
  reviewOverline:{fontSize:10,color:theme.colors.teal,fontWeight:'800',letterSpacing:1.1},
  reviewHeading:{fontSize:26,fontWeight:'800',color:theme.colors.ink,marginTop:6},
  reviewText:{color:theme.colors.muted,fontSize:13,lineHeight:21,marginTop:7},
  reviewLabel:{fontSize:10,color:theme.colors.teal,fontWeight:'800',letterSpacing:.8},
  reviewMain:{fontSize:17,fontWeight:'800',color:theme.colors.ink,marginTop:6},
  reviewMuted:{fontSize:12,color:theme.colors.muted,lineHeight:20,marginTop:6},
  reviewEdit:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16},
  reviewEditText:{color:theme.colors.teal,fontSize:12,fontWeight:'800'},

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
  previewDraftButton:{backgroundColor:theme.colors.tealTint,borderWidth:1,borderColor:'#C5DBD7'},
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