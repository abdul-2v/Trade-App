import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,BarChart3,CalendarClock,MapPin,RefreshCw,TrendingUp,Users,Wallet} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';

type Point={day:string;registrations:number;jobs_posted:number;jobs_accepted:number;
 completed_standard_jobs:number;completed_bookings:number;cancelled_appointments_last_updated:number};
type Area={area:string;requests:number};
type Analysis={window_days:number;generated_at:string;registrations:number;active_traders_30d:number;
 jobs_posted:number;jobs_accepted:number;jobs_completed_current:number;jobs_cancelled_current:number;
 jobs_expired_current:number;acceptance_rate_pct:number;completion_rate_pct:number;cancellation_rate_pct:number;
 completed_appointments:number;cancelled_appointments:number;quotes_delivered:number;quotes_accepted:number;
 quote_conversion_pct:number;trade_invoice_amount_gbp:number;platform_revenue_gbp:number|null;
 series:Point[];geo_demand:Area[]};
type Metric='registrations'|'jobs_posted'|'jobs_accepted'|'completed_bookings'|'cancelled_appointments_last_updated';
const METRICS:{key:Metric;title:string}[]=[
 {key:'registrations',title:'Registrations'},{key:'jobs_posted',title:'Jobs posted'},
 {key:'jobs_accepted',title:'Accepted jobs'},{key:'completed_bookings',title:'Completed bookings'},
 {key:'cancelled_appointments_last_updated',title:'Cancelled bookings'}
];
const C=theme.colors;
const money=(v:any)=>'£'+Number(v||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const number=(v:any)=>Number(v||0).toLocaleString('en-GB');
function Info({label,value,description}:{label:string;value:string;description?:string}){
 return <View style={s.stat}>
  <Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text>
  {description?<Text style={s.statHint}>{description}</Text>:null}
 </View>;
}
export default function TradarrAdminAnalyticsScreen({goBack}:{goBack:()=>void}){
 const [days,setDays]=useState<7|30|90>(30);
 const [metric,setMetric]=useState<Metric>('registrations');
 const [data,setData]=useState<Analysis|null>(null);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{
  if(refresh)setRefreshing(true);else setLoading(true);
  try{
   const {data:result,error:e}=await supabase.rpc('tradarr_admin_analytics',{p_days:days});
   if(e||!result)throw e||new Error('Analytics data unavailable.');
   setData(result as Analysis);setError('');
  }catch(e:any){setError(e?.message||'Failed to load analytics.');}
  finally{setLoading(false);setRefreshing(false);}
 },[days]);
 useEffect(()=>{void load();},[load]);
 const series=data?.series||[];
 const max=useMemo(()=>Math.max(1,...series.map(p=>Number(p[metric]||0))),[series,metric]);
 return <View style={s.root}>
  <View style={s.header}>
   <MotionPressable onPress={goBack} style={s.back} accessibilityRole="button" accessibilityLabel="Back to Admin Gateway">
    <ArrowLeft size={20} color={C.ink}/>
   </MotionPressable>
   <View style={{flex:1}}>
    <Text style={s.overline}>TRADARR / PLATFORM INTELLIGENCE</Text>
    <Text style={s.heading}>Business analytics</Text>
   </View>
   <MotionPressable onPress={()=>{void load(true)}} style={s.back}
    accessibilityRole="button" accessibilityLabel="Refresh charts">
    <RefreshCw size={18} color={C.teal}/>
   </MotionPressable>
  </View>
  <ScrollView contentContainerStyle={s.page}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{void load(true)}} tintColor={C.teal}/>}>
   <View style={s.hero}>
    <BarChart3 size={28} color="#DBF0E6"/>
    <Text style={s.heroTitle}>Understand what is growing.</Text>
    <Text style={s.heroText}>Registrations, bookings and marketplace conversion calculated from real Tradarr records. Metrics with no data remain at zero rather than being invented.</Text>
    <View style={s.range}>
     {([7,30,90] as const).map(v=><MotionPressable key={v} onPress={()=>setDays(v)}
       style={[s.rangeButton,days===v&&s.rangeActive]} accessibilityRole="button">
       <Text style={[s.rangeText,days===v&&s.rangeActiveText]}>{v} days</Text>
      </MotionPressable>)}
    </View>
   </View>
   {error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null}
   {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:70}}/>:data?<>
    <Text style={s.section}>Marketplace performance</Text>
    <View style={s.stats}>
     <Info label="New accounts" value={number(data.registrations)}/>
     <Info label="Active trades / 30d" value={number(data.active_traders_30d)}
      description="Available or had job-offer activity"/>
     <Info label="Jobs created" value={number(data.jobs_posted)}/>
     <Info label="Jobs accepted" value={number(data.jobs_accepted)}/>
     <Info label="Completed jobs" value={number(data.jobs_completed_current)}
      description="Current status of jobs in period"/>
     <Info label="Completed bookings" value={number(data.completed_appointments)}/>
    </View>
    <View style={s.card}>
     <Text style={s.section}>Daily trends</Text>
     <Text style={s.muted}>Choose a metric; daily bars use recorded creation, acceptance or appointment dates.</Text>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metrics}>
      {METRICS.map(m=><MotionPressable key={m.key} onPress={()=>setMetric(m.key)}
        style={[s.metricChip,metric===m.key&&s.metricActive]}>
        <Text style={[s.metricText,metric===m.key&&s.metricTextActive]}>{m.title}</Text>
       </MotionPressable>)}
     </ScrollView>
     <ScrollView horizontal showsHorizontalScrollIndicator style={{marginTop:16}}>
      <View style={s.barChart}>
       {series.map((p,index)=>{
        const val=Number(p[metric]||0);
        return <View key={p.day} style={s.barColumn}>
         <Text style={s.barValue}>{val?String(val):''}</Text>
         <View style={s.barTrack}>
          <View style={[s.bar,{height:Math.max(val?5:2,138*val/max),opacity:val?1:.18}]}/>
         </View>
         <Text style={s.axisLabel}>{index===0||index===series.length-1||index%Math.max(1,Math.ceil(series.length/8))===0?
           p.day.slice(5):''}</Text>
        </View>;
       })}
      </View>
     </ScrollView>
     <Text style={s.footnote}>Daily cancelled bookings are grouped by their latest update date, not a dedicated cancellation-event timestamp. Completed standard jobs use recorded completion dates.</Text>
    </View>
    <Text style={s.section}>Conversion funnel</Text>
    <View style={s.card}>
     <View style={s.funnelRow}><Text style={s.funnelLabel}>Jobs created</Text><Text style={s.funnelValue}>{number(data.jobs_posted)}</Text></View>
     <View style={[s.funnelBand,{width:'100%'}]}/>
     <View style={s.funnelRow}><Text style={s.funnelLabel}>Jobs accepted</Text><Text style={s.funnelValue}>{number(data.jobs_accepted)} · {data.acceptance_rate_pct}%</Text></View>
     <View style={[s.funnelBand,{width:Math.max(2,Math.min(100,data.acceptance_rate_pct))+'%',opacity:.8}]}/>
     <View style={s.funnelRow}><Text style={s.funnelLabel}>Currently completed</Text><Text style={s.funnelValue}>{number(data.jobs_completed_current)} · {data.completion_rate_pct}% of accepted</Text></View>
     <View style={[s.funnelBand,{width:Math.max(2,Math.min(100,data.jobs_posted?data.jobs_completed_current/data.jobs_posted*100:0))+'%',opacity:.6}]}/>
     <View style={s.divider}/>
     <Text style={s.muted}>Current cancellation rate: {data.cancellation_rate_pct}% ({number(data.jobs_cancelled_current)} jobs). These funnel values are based on the jobs created during the selected period; pending jobs can reduce the rate.</Text>
    </View>
    <Text style={s.section}>Quotes and appointments</Text>
    <View style={s.stats}>
     <Info label="Delivered quotes" value={number(data.quotes_delivered)}/>
     <Info label="Accepted quotes" value={number(data.quotes_accepted)}/>
     <Info label="Quote acceptance" value={String(data.quote_conversion_pct)+'%'}/>
     <Info label="Cancelled bookings" value={number(data.cancelled_appointments)}/>
    </View>
    <Text style={s.section}>Geographical demand</Text>
    <View style={s.card}>
     <View style={s.row}><MapPin size={19} color={C.teal}/>
      <Text style={s.muted}>Approximate coordinate grid areas (around 11 km). Individual locations and areas with fewer than three requests are excluded.</Text>
     </View>
     {data.geo_demand?.length?data.geo_demand.map((a,i)=><View key={i} style={s.areaRow}>
      <Text style={[s.funnelLabel,{flex:1}]}>{a.area}</Text>
      <Text style={s.funnelValue}>{number(a.requests)} requests</Text>
     </View>):<Text style={s.muted}>Not enough location-grouped requests for a privacy-safe area breakdown yet.</Text>}
    </View>
    <Text style={s.section}>Money and revenue</Text>
    <View style={s.card}>
     <View style={s.row}><Wallet size={23} color={C.teal}/>
      <View style={{flex:1}}>
       <Text style={s.overline}>TRADESPEOPLE'S ISSUED INVOICES</Text>
       <Text style={s.money}>{money(data.trade_invoice_amount_gbp)}</Text>
      </View>
     </View>
     <View style={s.divider}/>
     <Text style={s.overline}>TRADARR'S OWN PLATFORM REVENUE</Text>
     <Text style={s.money}>Not connected</Text>
     <Text style={s.muted}>Invoices issued by tradespeople are not payments to Tradarr. Platform revenue requires a separate verified Stripe or accounting integration.</Text>
    </View>
    <Text style={s.footer}>Private analytics · updated {new Date(data.generated_at).toLocaleString('en-GB')} · This is a reporting snapshot, not live device tracking.</Text>
   </>:null}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.customerBackground},
 header:{padding:17,flexDirection:'row',alignItems:'center',gap:13},
 back:{height:43,width:43,backgroundColor:'#FFFFFF',borderRadius:15,alignItems:'center',justifyContent:'center'},
 overline:{fontSize:10,color:theme.colors.teal,fontWeight:'900',letterSpacing:.7},
 heading:{fontSize:23,color:theme.colors.ink,fontWeight:'900'},
 page:{paddingHorizontal:17,gap:13,paddingBottom:110},
 hero:{backgroundColor:theme.colors.darkTeal,borderRadius:22,padding:21,gap:11},
 heroTitle:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},
 heroText:{fontSize:12,lineHeight:20,color:'#D7EAE4'},
 range:{flexDirection:'row',gap:7,marginTop:7},
 rangeButton:{borderRadius:12,paddingHorizontal:14,paddingVertical:11,backgroundColor:'#FFFFFF20'},
 rangeActive:{backgroundColor:'#FFFFFF'},
 rangeText:{fontSize:12,color:'#FFFFFF',fontWeight:'900'},
 rangeActiveText:{color:theme.colors.teal},
 section:{fontSize:16,fontWeight:'900',color:theme.colors.ink,marginTop:7},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:9},
 stat:{width:'48%',backgroundColor:'#FFFFFF',borderRadius:17,padding:15,gap:7,minHeight:95},
 statLabel:{fontSize:11,color:theme.colors.muted,fontWeight:'800'},
 statValue:{fontSize:23,color:theme.colors.ink,fontWeight:'900'},
 statHint:{fontSize:10,color:theme.colors.muted},
 card:{backgroundColor:'#FFFFFF',borderRadius:19,padding:18,gap:11},
 muted:{fontSize:12,lineHeight:19,color:theme.colors.muted},
 metrics:{gap:7},
 metricChip:{borderRadius:13,paddingHorizontal:12,paddingVertical:10,backgroundColor:'#EDF3EF'},
 metricActive:{backgroundColor:theme.colors.darkTeal},
 metricText:{fontSize:11,fontWeight:'800',color:theme.colors.ink},
 metricTextActive:{color:'#FFFFFF'},
 barChart:{height:205,flexDirection:'row',alignItems:'flex-end',gap:6,paddingBottom:4},
 barColumn:{width:29,justifyContent:'flex-end',alignItems:'center'},
 barValue:{fontSize:9,fontWeight:'900',color:theme.colors.teal},
 barTrack:{height:140,width:17,justifyContent:'flex-end'},
 bar:{width:17,backgroundColor:theme.colors.teal,borderTopLeftRadius:5,borderTopRightRadius:5},
 axisLabel:{fontSize:8,color:theme.colors.muted,minHeight:26,paddingTop:8,width:30,textAlign:'center'},
 footnote:{fontSize:10,color:theme.colors.muted,lineHeight:17},
 funnelRow:{flexDirection:'row',justifyContent:'space-between',gap:11},
 funnelLabel:{fontSize:12,fontWeight:'800',color:theme.colors.ink},
 funnelValue:{fontSize:12,fontWeight:'900',color:theme.colors.teal},
 funnelBand:{height:11,borderRadius:8,backgroundColor:theme.colors.teal},
 divider:{height:1,backgroundColor:'#E4EEE8',marginVertical:7},
 row:{flexDirection:'row',alignItems:'flex-start',gap:10},
 areaRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomColor:'#EAF1EC',borderBottomWidth:1},
 money:{fontSize:22,fontWeight:'900',color:theme.colors.ink,marginTop:6},
 footer:{color:theme.colors.muted,fontSize:10,lineHeight:18,textAlign:'center',padding:10},
 error:{borderRadius:13,backgroundColor:'#FFF1E5',padding:14},
 errorText:{color:'#9C4C31',fontSize:12}
});
