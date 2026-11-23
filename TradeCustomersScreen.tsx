import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ChevronRight, Plus, Search, Users, FileText, Receipt, CalendarDays, Pencil, Trash2 } from 'lucide-react-native';
import { MotionPressable } from './Motion';
import { supabase } from './lib/supabase';
import { theme } from './theme';

type Customer = {
  id: string; tradesperson_id: string; name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; created_at: string; updated_at: string;
};
type Doc = { id: string; customer_id: string | null; title?: string; customer_name?: string; total?: number; quote_no?: number; invoice_no?: number; status: string; created_at?: string; starts_at?: string };
const C = theme.colors;

function Field({ label, value, change, placeholder, multiline }: {
  label: string; value: string; change: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={change} style={[s.input, multiline && { minHeight: 92 }]}
      multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'}
      placeholder={placeholder} placeholderTextColor="#92A0A3" autoCapitalize="sentences" />
  </View>;
}

export default function TradeCustomersScreen({ goBack }: { goBack: () => void }) {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError,setLoadError]=useState('');
  const [historyError,setHistoryError]=useState('');
  const [loadKey,setLoadKey]=useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<Doc[]>([]);
  const [appointments, setAppointments] = useState<Doc[]>([]);
  const [search, setSearch] = useState('');
  const [screen, setScreen] = useState<'list' | 'edit' | 'detail'>('list');
  const [showContactExtras,setShowContactExtras]=useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const selected = customers.find(c => c.id === selectedId) || null;
  const visible = useMemo(() => customers.filter(c =>
    (c.name + ' ' + (c.phone || '') + ' ' + (c.email || '') + ' ' + (c.address || '')).toLowerCase().includes(search.trim().toLowerCase())
  ), [customers, search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !alive) { if (alive){setLoadError('Sign in to see your customer book.');setLoading(false);} return; }
      setUserId(uid);
      const [c, q, i, a] = await Promise.all([
        supabase.from('trade_customers').select('*').eq('tradesperson_id', uid).order('name'),
        supabase.from('trade_quotes').select('id,customer_id,title,total,quote_no,status,created_at').eq('tradesperson_id', uid).order('created_at', { ascending: false }).limit(250),
        supabase.from('trade_invoices').select('id,customer_id,customer_name,total,invoice_no,status,created_at').eq('tradesperson_id', uid).order('created_at', { ascending: false }).limit(250),
        supabase.from('trade_appointments').select('id,customer_id,title,status,starts_at').eq('tradesperson_id', uid).order('starts_at', { ascending: false }).limit(250),
      ]);
      if (!alive) return;
      if (c.error){
        setLoadError('Could not load your saved customers: '+c.error.message);
        setLoading(false);return;
      }
      setLoadError('');
      setHistoryError(q.error||i.error||a.error
        ?'Some work history could not be loaded. The customer list is still available; totals may be incomplete.'
        :'');
      setCustomers((c.data || []) as Customer[]);
      setQuotes((q.data || []) as Doc[]);
      setInvoices((i.data || []) as Doc[]);
      setAppointments((a.data || []) as Doc[]);
      setLoading(false);
    })().catch(err => { if (alive) {
      setLoadError('Customer book unavailable: '+(err?.message||String(err)));setLoading(false);
    }});
    return () => { alive = false; };
  }, [loadKey]);

  const newCustomer = () => {
    setSelectedId(null); setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    setShowContactExtras(false);setScreen('edit');
  };
  const editCustomer = (customer: Customer) => {
    setSelectedId(customer.id); setName(customer.name); setPhone(customer.phone || '');
    setEmail(customer.email || ''); setAddress(customer.address || ''); setNotes(customer.notes || '');
    setShowContactExtras(true);setScreen('edit');
  };
  const save = async () => {
    if (saving) return;
    if (!name.trim()) { Alert.alert('Customer name needed', 'Enter a name before saving.'); return; }
    if(name.trim().length>120){Alert.alert('Name too long','Please shorten the customer name.');return;}
    const normalisedEmail=email.trim().toLowerCase();
    if(normalisedEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)){
      Alert.alert('Check email address','Enter a valid customer email address or leave it blank.');return;
    }
    const normalisedPhone=phone.trim();
    if(normalisedPhone&&!/^\+?[\d ()-]{7,22}$/.test(normalisedPhone)){
      Alert.alert('Check phone number','Enter a valid phone number or leave it blank.');return;
    }
    if (!userId) { Alert.alert('Sign in required', 'Sign in to save customers.'); return; }
    setSaving(true);
    try{
    const payload = {
      tradesperson_id: userId, name: name.trim(), phone: normalisedPhone || null,
      email: normalisedEmail || null, address: address.trim() || null, notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const result = selectedId
      ? await supabase.from('trade_customers').update(payload).eq('id', selectedId).eq('tradesperson_id', userId).select('*').single()
      : await supabase.from('trade_customers').insert(payload).select('*').single();
    if (result.error || !result.data) { Alert.alert('Could not save customer', result.error?.message || 'Please try again.'); return; }
    const item = result.data as Customer;
    setCustomers(old => [...old.filter(c => c.id !== item.id), item].sort((a,b) => a.name.localeCompare(b.name)));
    setSelectedId(item.id);
    setScreen('detail');
    }catch(error:any){Alert.alert('Could not save customer',error?.message||'Check your connection and try again.');}
    finally{setSaving(false);}
  };
  const removeCustomer = (customer: Customer) => {
    Alert.alert('Delete this customer?', 'This removes the contact from your book. Existing invoices and quotes remain in your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('trade_customers').delete().eq('id', customer.id).eq('tradesperson_id', userId);
          if (error) throw error;
          setCustomers(old => old.filter(c => c.id !== customer.id));
          setScreen('list');
        }catch(error:any){Alert.alert('Could not delete customer',error?.message||'Try again.');}
      } },
    ]);
  };
  const back = () => screen === 'detail' ? setScreen('list') : screen === 'edit' ? setScreen(selectedId ? 'detail' : 'list') : goBack();
  const quotesFor = quotes.filter(q => q.customer_id === selectedId);
  const invoicesFor = invoices.filter(i => i.customer_id === selectedId);
  const appointmentsFor = appointments.filter(a => a.customer_id === selectedId);
  return <View style={s.root}>
    <View style={s.header}>
      <MotionPressable onPress={back} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft size={23} color={C.ink} />
      </MotionPressable>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>BUSINESS TOOLS</Text>
        <Text style={s.title}>{screen === 'edit' ? (selectedId ? 'Edit customer' : 'New customer') :
          screen === 'detail' ? 'Customer' : 'Customer book'}</Text>
      </View>
      {screen === 'list' ? <MotionPressable onPress={newCustomer} style={s.new}>
        <Plus size={20} color="#FFFFFF"/><Text style={s.newText}>New</Text>
      </MotionPressable> : null}
    </View>
    {loading ? <ActivityIndicator size="large" color={C.teal} style={{ marginTop: 60 }}/> :
      loadError?<View style={s.errorPanel}>
        <Users color={C.coralDark} size={32}/>
        <Text style={s.emptyTitle}>Customer book unavailable</Text>
        <Text style={s.emptySub}>{loadError}</Text>
        <MotionPressable style={s.action} onPress={()=>{setLoadError('');setLoading(true);setLoadKey(x=>x+1);}}
          accessibilityRole="button" accessibilityLabel="Retry loading customers">
          <Text style={s.actionText}>Try again</Text>
        </MotionPressable>
      </View>:
      screen === 'list' ? <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>Keep private customer contact details and work history together. Only your business account can see this book.</Text>
        {historyError?<Text style={s.warning}>{historyError}</Text>:null}
        <View style={s.searchRow}><Search size={19} color={C.muted}/>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search customers"
            style={s.searchInput} placeholderTextColor="#8C999C" />
        </View>
        {visible.length ? visible.map(item => <MotionPressable key={item.id} onPress={() => { setSelectedId(item.id); setScreen('detail'); }}
          style={s.customerCard} accessibilityRole="button" accessibilityLabel={'Open '+item.name}>
          <View style={s.avatar}><Text style={s.avatarText}>{item.name.slice(0,1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.cardSub} numberOfLines={2}>{item.address || item.phone || item.email || 'Add contact details'}</Text>
          </View><ChevronRight color={C.teal} size={20}/>
        </MotionPressable>) :
          <View style={s.empty}><Users size={33} color={C.teal}/>
            <Text style={s.emptyTitle}>{search.trim() ? 'No matching customers' : 'Start your customer book'}</Text>
            <Text style={s.emptySub}>{search.trim() ? 'Try a different name or address.' : 'Add the customers you work for outside Tradarr, and use them when creating quotes.'}</Text>
            {!search.trim() ? <MotionPressable onPress={newCustomer} style={s.action}><Plus color="#FFFFFF" size={19}/><Text style={s.actionText}>Add a customer</Text></MotionPressable> : null}
          </View>}
      </ScrollView> :
      screen === 'edit' ? <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>Save a contact once, then select them when preparing a quote or appointment.</Text>
        <View style={s.panel}>
          <Field label="Customer or company name *" value={name} change={setName} placeholder="e.g. Sarah Williams"/>
          <MotionPressable style={s.extraToggle} onPress={()=>setShowContactExtras(v=>!v)}
            accessibilityRole="button" accessibilityLabel="Additional customer information" accessibilityState={{expanded:showContactExtras}}>
           <View style={{flex:1}}><Text style={s.extraToggleTitle}>Contact & property details</Text>
            <Text style={s.extraToggleNote}>Phone, email, address and private notes · optional</Text></View>
           <ChevronRight size={19} color={C.teal} style={showContactExtras?{transform:[{rotate:'90deg'}]}:undefined}/>
          </MotionPressable>
          {showContactExtras?<View>
           <Field label="Phone (optional)" value={phone} change={setPhone} placeholder="e.g. 07..."/>
           <Field label="Email (optional)" value={email} change={setEmail} placeholder="e.g. customer@email.co.uk"/>
           <Field label="Address (optional)" value={address} change={setAddress} multiline placeholder="Street, town, postcode"/>
           <Field label="Private notes (optional)" value={notes} change={setNotes} multiline placeholder="Access instructions, property details, preferences"/>
          </View>:null}
        </View>
        <MotionPressable onPress={save} disabled={saving} style={s.action}>
          {saving ? <ActivityIndicator color="#FFFFFF"/> : <Text style={s.actionText}>Save customer</Text>}
        </MotionPressable>
      </ScrollView> : selected ? <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={s.page}>
        <View style={s.detailCard}>
          <View style={s.detailTop}>
            <View style={s.avatar}><Text style={s.avatarText}>{selected.name.slice(0,1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.detailName}>{selected.name}</Text>
              <Text style={s.cardSub}>Saved customer</Text></View>
            <MotionPressable onPress={() => editCustomer(selected)} style={s.editButton} accessibilityRole="button" accessibilityLabel="Edit customer">
              <Pencil size={19} color={C.teal}/></MotionPressable>
          </View>
          {selected.phone ? <View style={s.detailLine}><Text style={s.detailLabel}>Phone</Text><Text style={s.detailValue}>{selected.phone}</Text></View> : null}
          {selected.email ? <View style={s.detailLine}><Text style={s.detailLabel}>Email</Text><Text style={s.detailValue}>{selected.email}</Text></View> : null}
          {selected.address ? <View style={s.detailLine}><Text style={s.detailLabel}>Address</Text><Text style={s.detailValue}>{selected.address}</Text></View> : null}
          {selected.notes ? <View style={s.detailLine}><Text style={s.detailLabel}>Private notes</Text><Text style={s.detailValue}>{selected.notes}</Text></View> : null}
        </View>
        <Text style={s.section}>Work history</Text>
        {historyError?<Text style={s.warning}>{historyError}</Text>:null}
        <View style={s.stats}>
          <View style={s.stat}><FileText size={20} color={C.teal}/><Text style={s.statN}>{quotesFor.length}</Text><Text style={s.statLabel}>Quotes</Text></View>
          <View style={s.stat}><Receipt size={20} color={C.teal}/><Text style={s.statN}>{invoicesFor.length}</Text><Text style={s.statLabel}>Invoices</Text></View>
          <View style={s.stat}><CalendarDays size={20} color={C.teal}/><Text style={s.statN}>{appointmentsFor.length}</Text><Text style={s.statLabel}>Diary</Text></View>
        </View>
        <Text style={s.helper}>Records are linked when you select this customer in a quote, appointment or invoice.</Text>
        {quotesFor.slice(0,5).map(item => <View key={item.id} style={s.history}><Text style={s.cardTitle}>Quote {item.quote_no} · {item.title}</Text>
          <Text style={s.cardSub}>£{Number(item.total || 0).toFixed(2)} · {item.status}</Text></View>)}
        {invoicesFor.slice(0,5).map(item => <View key={item.id} style={s.history}><Text style={s.cardTitle}>Invoice {item.invoice_no}</Text>
          <Text style={s.cardSub}>£{Number(item.total || 0).toFixed(2)} · {item.status}</Text></View>)}
        {appointmentsFor.slice(0,5).map(item => <View key={item.id} style={s.history}><Text style={s.cardTitle}>{item.title}</Text>
          <Text style={s.cardSub}>{item.starts_at ? new Date(item.starts_at).toLocaleDateString('en-GB') : ''} · {item.status}</Text></View>)}
        <MotionPressable onPress={() => removeCustomer(selected)} style={s.delete}>
          <Trash2 size={17} color={C.coralDark}/><Text style={s.deleteText}>Delete customer</Text>
        </MotionPressable>
      </ScrollView> : <Text style={s.emptySub}>This customer is no longer available.</Text>}
  </View>;
}
const s=StyleSheet.create({
  root:{ flex:1,backgroundColor:theme.colors.proBackground },
  extraToggle:{flexDirection:'row',alignItems:'center',gap:10,minHeight:65,padding:14,backgroundColor:theme.colors.tealTint,borderRadius:16,marginBottom:14},
  extraToggleTitle:{fontSize:13,fontWeight:'800',color:theme.colors.teal},
  extraToggleNote:{fontSize:11,color:theme.colors.muted,lineHeight:17,marginTop:4},
  header:{paddingHorizontal:20,paddingTop:17,paddingBottom:14,flexDirection:'row',gap:13,alignItems:'center'},
  back:{width:45,height:45,borderRadius:25,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:theme.colors.teal},
  title:{fontSize:27,fontWeight:'800',color:theme.colors.ink,letterSpacing:-0.8,marginTop:3},
  new:{backgroundColor:theme.colors.darkTeal,borderRadius:23,minHeight:45,paddingHorizontal:15,flexDirection:'row',gap:5,alignItems:'center'},
  newText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
  page:{paddingHorizontal:20,paddingTop:8,paddingBottom:36},
  intro:{color:theme.colors.muted,fontSize:13,lineHeight:21,marginBottom:17},
  searchRow:{flexDirection:'row',alignItems:'center',gap:9,borderRadius:16,backgroundColor:'#FFFFFF',paddingHorizontal:15,minHeight:50,marginBottom:17},
  searchInput:{flex:1,color:theme.colors.ink,fontSize:14},
  customerCard:{backgroundColor:'#FFFFFF',borderRadius:22,minHeight:83,flexDirection:'row',alignItems:'center',gap:13,padding:16,marginBottom:11,...theme.shadow},
  avatar:{width:49,height:49,borderRadius:17,backgroundColor:theme.colors.tealTint,alignItems:'center',justifyContent:'center'},
  avatarText:{fontWeight:'800',fontSize:21,color:theme.colors.teal},
  cardTitle:{fontSize:15,fontWeight:'800',color:theme.colors.ink},
  cardSub:{fontSize:12,color:theme.colors.muted,marginTop:5,lineHeight:18},
  empty:{backgroundColor:'#FFFFFF',borderRadius:25,padding:25,alignItems:'center',gap:11,...theme.shadow},
  emptyTitle:{fontSize:18,fontWeight:'800',color:theme.colors.ink,textAlign:'center'},
  emptySub:{fontSize:13,color:theme.colors.muted,lineHeight:20,textAlign:'center'},
  action:{minHeight:54,backgroundColor:theme.colors.darkTeal,borderRadius:27,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:24,marginTop:12},
  actionText:{color:'#FFFFFF',fontSize:14,fontWeight:'800'},
  panel:{padding:18,backgroundColor:'#FFFFFF',borderRadius:24,...theme.shadow},
  field:{marginBottom:15},
  fieldLabel:{color:theme.colors.ink,fontWeight:'700',fontSize:12,marginBottom:8},
  input:{backgroundColor:'#F9FBFA',borderWidth:1,borderColor:theme.colors.line,borderRadius:13,minHeight:47,paddingHorizontal:13,paddingVertical:10,fontSize:14,color:theme.colors.ink},
  detailCard:{backgroundColor:'#FFFFFF',borderRadius:25,padding:20,...theme.shadow},
  detailTop:{flexDirection:'row',alignItems:'center',gap:13,marginBottom:18},
  detailName:{fontSize:20,fontWeight:'800',color:theme.colors.ink},
  editButton:{width:43,height:43,borderRadius:15,backgroundColor:theme.colors.tealTint,alignItems:'center',justifyContent:'center'},
  detailLine:{paddingVertical:11,borderTopWidth:1,borderColor:theme.colors.line,gap:5},
  detailLabel:{fontSize:11,fontWeight:'800',color:theme.colors.muted},
  detailValue:{fontSize:14,color:theme.colors.ink,lineHeight:21},
  section:{fontSize:19,fontWeight:'800',color:theme.colors.ink,marginTop:23,marginBottom:13},
  stats:{flexDirection:'row',gap:10},
  stat:{flex:1,backgroundColor:'#FFFFFF',borderRadius:19,padding:13,alignItems:'center',gap:5,...theme.shadow},
  statN:{fontSize:19,fontWeight:'800',color:theme.colors.ink},
  statLabel:{fontSize:11,color:theme.colors.muted},
  helper:{fontSize:11,color:theme.colors.muted,lineHeight:17,marginTop:12,marginBottom:10},
  history:{backgroundColor:'#FFFFFF',borderRadius:16,padding:15,marginBottom:8},
  errorPanel:{margin:20,padding:24,backgroundColor:'#FFFFFF',borderRadius:23,
    alignItems:'center',gap:12,...theme.shadow},
  warning:{fontSize:12,color:theme.colors.coralDark,backgroundColor:'#FFF1E9',
    borderRadius:14,padding:12,lineHeight:19,marginBottom:13},
  delete:{alignSelf:'center',padding:14,flexDirection:'row',alignItems:'center',gap:7,marginTop:15},
  deleteText:{color:theme.colors.coralDark,fontWeight:'800',fontSize:12},
});
