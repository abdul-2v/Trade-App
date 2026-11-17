import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {ArrowLeft,CalendarDays,ChevronRight,MapPin,Send,Users,XCircle} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type Group={id:string;organiser_id:string;trade:string;service:string;area_label:string;desired_window:string|null;target_homes:number;member_count:number;status:string;closes_at:string};
type Offer={id:string;collective_id:string;tradesperson_id:string;price_per_home:number;includes_vat:boolean;terms:string;earliest_date:string|null;status:string};
const money=(v:number)=>'£'+Number(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function TradeCollectiveScreen({goBack}:{goBack:()=>void}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [groups,setGroups]=useState<Group[]>([]),[offers,setOffers]=useState<Offer[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null),[saving,setSaving]=useState(false),[areaFilter,setAreaFilter]=useState('');
 const [price,setPrice]=useState(''),[terms,setTerms]=useState(''),[vat,setVat]=useState(true),[earliest,setEarliest]=useState('');
 const selected=groups.find(g=>g.id===selectedId)||null;
 const ownOffer=selected?offers.find(o=>o.collective_id===selected.id):null;
 const load=useCallback(async(refresh=false)=>{
  refresh?setRefreshing(true):setLoading(true);
  const {data:a}=await supabase.auth.getUser();if(!a.user){setLoading(false);setRefreshing(false);return;}
  setUid(a.user.id);
  const [g,o]=await Promise.all([
   supabase.from('trade_collectives').select('*').order('created_at',{ascending:false}).limit(200),
   supabase.from('trade_collective_offers').select('*').eq('tradesperson_id',a.user.id).limit(200)
  ]);
  if(g.error||o.error)Alert.alert('Could not load Collectives',g.error?.message||o.error?.message||'Please retry.');
  else{setGroups((g.data||[]) as Group[]);setOffers((o.data||[]) as Offer[]);}
  setLoading(false);setRefreshing(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const submit=async()=>{
  if(!selected||!uid||saving)return;
  const amt=Number(price.trim().replace(',','.'));
  if(!Number.isFinite(amt)||amt<=0||amt>=1000000||terms.trim().length<15){
   Alert.alert('Complete the offer','Enter a valid per-home price and explain exactly what the price includes.');return;
  }
  if(earliest.trim()&&(!/^\d{4}-\d{2}-\d{2}$/.test(earliest)||Number.isNaN(Date.parse(earliest+'T12:00:00')))){
   Alert.alert('Check earliest date','Use YYYY-MM-DD or leave it blank.');return;
  }
  Alert.alert('Publish a real per-home offer?','This offer will become visible to households who joined the Collective. It is an indicative price, subject to confirming each property\'s requirements.',
    [{text:'Cancel',style:'cancel'},{text:'Publish offer',onPress:async()=>{
      setSaving(true);
      const {data,error}=await supabase.from('trade_collective_offers').insert({
       collective_id:selected.id,tradesperson_id:uid,price_per_home:Math.round(amt*100)/100,
       terms:terms.trim(),includes_vat:vat,earliest_date:earliest.trim()||null
      }).select('*').single();
      setSaving(false);
      if(error||!data){Alert.alert('Could not publish offer',error?.message||'Please retry.');return;}
      setOffers(old=>[data as Offer,...old]);setPrice('');setTerms('');setEarliest('');
      Alert.alert('Offer published','Joined households can now enquire about your offer through Tradarr Messages.');
    }}]);
 };
 const setOfferStatus=async(offer:Offer,status:'withdrawn'|'active')=>{
  if(saving)return;
  setSaving(true);
  const {data,error}=await supabase.from('trade_collective_offers').update({status})
   .eq('id',offer.id).eq('tradesperson_id',uid).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Unable to change offer',error?.message||'Try again.');return;}
  setOffers(old=>old.map(x=>x.id===offer.id?data as Offer:x));
 };
 return <View style={s.root}><View style={s.head}>
  <MotionPressable style={s.back} onPress={()=>selected?setSelectedId(null):goBack()}>
   <ArrowLeft color={C.ink} size={22}/></MotionPressable>
  <View style={{flex:1}}><Text style={s.eyebrow}>BUSINESS OPPORTUNITIES</Text><Text style={s.heading}>{selected?'Collective offer':'Collective groups'}</Text></View>
 </View>
  {loading?<ActivityIndicator color={C.teal} size="large" style={{marginTop:60}}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   {selected?<><View style={s.hero}><Text style={s.eyebrowLight}>HOUSEHOLD GROUP WORK</Text><Text style={s.heroTitle}>{selected.service}</Text>
     <Text style={s.heroText}>{selected.trade} · {selected.area_label}</Text>
     <Text style={s.heroText}>{selected.member_count} interested household{selected.member_count===1?'':'s'} · target {selected.target_homes}</Text>
     {selected.desired_window?<Text style={s.heroText}>Preferred: {selected.desired_window}</Text>:null}
    </View>
    <View style={s.card}><Text style={s.cardTitle}>Your indicative offer</Text>
     {ownOffer?<><Text style={s.price}>{money(ownOffer.price_per_home)} per home</Text>
       <Text style={s.meta}>{ownOffer.includes_vat?'VAT included or not applicable':'VAT extra / not applicable'} · {ownOffer.status}</Text>
       <Text style={s.description}>{ownOffer.terms}</Text>
       <MotionPressable disabled={saving} style={s.secondary} onPress={()=>{void setOfferStatus(ownOffer,ownOffer.status==='active'?'withdrawn':'active')}}>
        <Text style={s.secondaryText}>{ownOffer.status==='active'?'Withdraw this offer':'Restore previous offer'}</Text>
       </MotionPressable>
      </>:selected.status!=='open'||new Date(selected.closes_at)<new Date()?
       <Text style={s.meta}>This group is no longer open to new offers.</Text>:
       <><Text style={s.description}>Set a real price per household and explain what is included. Do not claim a saving unless you have a valid comparable standard price.</Text>
         <Text style={s.label}>Indicative price per home (£) *</Text>
         <TextInput value={price} onChangeText={setPrice} style={s.input} keyboardType="decimal-pad" placeholder="e.g. 65.00" placeholderTextColor="#95A2A2"/>
         <Text style={s.label}>Included work and conditions *</Text>
         <TextInput value={terms} onChangeText={setTerms} style={[s.input,{minHeight:115,textAlignVertical:'top'}]} multiline
           placeholder="e.g. Standard gutter clean for a two-storey home, accessible ladder access, excluding repairs"
           placeholderTextColor="#95A2A2"/>
         <Text style={s.label}>Earliest available date (optional)</Text>
         <TextInput value={earliest} onChangeText={setEarliest} style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#95A2A2"/>
         <View style={s.switchRow}><Text style={[s.meta,{flex:1}]}>Price includes any applicable VAT</Text>
           <Switch value={vat} onValueChange={setVat} trackColor={{true:C.teal}}/></View>
         <MotionPressable disabled={saving} onPress={()=>{void submit()}} style={s.primary}>
          {saving?<ActivityIndicator color="#FFFFFF"/>:<><Send size={18} color="#FFFFFF"/><Text style={s.primaryText}>Publish group offer</Text></>}</MotionPressable>
        </>}
    </View>
    <View style={s.info}><Users size={21} color={C.teal}/><Text style={s.infoText}>Tradarr doesn't share participant identities or exact addresses. Interested households contact you individually, and the final scope, dates and cost must be agreed with each one.</Text></View>
   </>:<>
    <View style={s.hero}><Users color="#D0E8E1" size={27}/><Text style={s.heroTitle}>One local route. Several customers.</Text>
     <Text style={s.heroText}>Find groups of nearby homeowners requesting the same service. Publish your actual per-home offer and arrange work directly with each customer.</Text></View>
    <Text style={s.section}>Browse service groups</Text>
    <TextInput value={areaFilter} onChangeText={setAreaFilter} style={s.input}
      placeholder="Filter by local area or service" placeholderTextColor="#95A2A2"/>
    {groups.filter(g=>g.status==='open'&&new Date(g.closes_at)>new Date()&&
      (!areaFilter.trim()||(g.area_label+' '+g.service+' '+g.trade).toLowerCase().includes(areaFilter.toLowerCase()))).length?
      groups.filter(g=>g.status==='open'&&new Date(g.closes_at)>new Date()&&
       (!areaFilter.trim()||(g.area_label+' '+g.service+' '+g.trade).toLowerCase().includes(areaFilter.toLowerCase()))).map(g=>
      <MotionPressable key={g.id} style={s.groupCard} onPress={()=>setSelectedId(g.id)}>
       <View style={s.groupIcon}><Users size={22} color={C.teal}/></View>
       <View style={{flex:1}}><Text style={s.groupTitle}>{g.service}</Text>
        <Text style={s.meta}>{g.trade} · {g.area_label}</Text>
        <Text style={s.count}>{g.member_count} interested · target {g.target_homes}</Text>
        {offers.some(o=>o.collective_id===g.id)?<Text style={s.meta}>Your offer is already recorded</Text>:null}
       </View><ChevronRight color={C.teal} size={19}/>
      </MotionPressable>):
      <View style={s.empty}><CalendarDays color={C.teal} size={30}/>
       <Text style={s.meta}>No matching open neighbourhood groups right now. Try another area or check again later.</Text>
      </View>}
   </>}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.proBackground},head:{padding:18,flexDirection:'row',alignItems:'center',gap:11},
 back:{width:43,height:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:C.teal},
 eyebrowLight:{fontSize:10,letterSpacing:1.3,fontWeight:'800',color:'#C7E6DE'},
 heading:{fontSize:25,fontWeight:'800',color:C.ink,marginTop:4},
 page:{padding:19,paddingBottom:45},
 hero:{padding:23,borderRadius:25,backgroundColor:C.darkTeal,gap:10},
 heroTitle:{fontSize:22,color:'#FFFFFF',fontWeight:'800',lineHeight:28},
 heroText:{fontSize:12,color:'#D7E7E4',lineHeight:19},
 section:{fontSize:19,fontWeight:'800',color:C.ink,marginTop:23,marginBottom:12},
 card:{backgroundColor:'#FFFFFF',borderRadius:23,padding:19,marginTop:15,...theme.shadow},
 cardTitle:{fontSize:17,fontWeight:'800',color:C.ink},
 input:{minHeight:49,borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF',borderRadius:14,
  paddingHorizontal:12,paddingVertical:11,fontSize:14,color:C.ink,marginBottom:12},
 label:{fontSize:12,fontWeight:'800',color:C.ink,marginTop:16,marginBottom:8},
 description:{fontSize:12,color:C.muted,lineHeight:19,marginTop:12},
 price:{fontSize:26,fontWeight:'800',color:C.teal,marginTop:15},
 meta:{fontSize:11,color:C.muted,lineHeight:18,marginTop:7},
 switchRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:12},
 primary:{minHeight:54,backgroundColor:C.darkTeal,borderRadius:27,marginTop:18,paddingHorizontal:13,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 primaryText:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},
 secondary:{minHeight:50,backgroundColor:C.tealTint,borderRadius:23,marginTop:15,alignItems:'center',justifyContent:'center'},
 secondaryText:{fontSize:12,color:C.teal,fontWeight:'800'},
 groupCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFFFFF',borderRadius:21,
  padding:15,marginTop:11,...theme.shadow},
 groupIcon:{height:43,width:43,borderRadius:15,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 groupTitle:{fontSize:15,fontWeight:'800',color:C.ink},count:{fontSize:11,color:C.teal,fontWeight:'800',marginTop:7},
 info:{marginTop:16,backgroundColor:C.tealTint,borderRadius:19,padding:15,flexDirection:'row',gap:10},
 infoText:{flex:1,fontSize:11,color:C.teal,lineHeight:18},
 empty:{padding:24,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',marginTop:12,gap:9}
});
