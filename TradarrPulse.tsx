import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Activity,Bell,BriefcaseBusiness,MapPin,RefreshCw,TrendingUp} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {theme} from './theme';
import WorkAreaMapPreview from './WorkAreaMapPreview';

type Zone={lat:number;lng:number;band:string};
type Opportunity={id:string;summary:string;trade:string;timing:string;distance_miles:number;interest_status:string|null};
type Snapshot={configured:boolean;trade?:string;radius?:number;origin?:{lat:number;lng:number};searches?:number|string|null;activity?:{label:string;count:number|string}[];zones?:Zone[];opportunities?:Opportunity[];reach?:Record<string,number>;missed?:number;alerts?:boolean;updated_at?:string};
type Mode='compact'|'board'|'map'|'reach';
const C=theme.colors;
function Button({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[S.button,secondary&&S.secondary,disabled&&{opacity:.5}]}><Text style={[S.buttonText,secondary&&{color:C.teal}]}>{label}</Text></Pressable>
}
function usePulse(){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const version=useRef(0);
 const refresh=useCallback(async()=>{const v=++version.current;setLoading(true);
  try{const {data,error}=await supabase.rpc('tradarr_pulse_snapshot');if(error)throw error;if(v===version.current){setData(data as Snapshot);setError('')}}
  catch(e:any){if(v===version.current)setError(e?.message||'Could not load local activity')}
  finally{if(v===version.current)setLoading(false)}
 },[]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh()});const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh()},60000);return()=>{version.current++;sub.remove();clearInterval(timer)}},[refresh]);
 return {data,error,loading,refresh};
}
function Metric({label,value}:{label:string;value:number|string|null|undefined}){return <View style={S.metric}><Text style={S.number}>{value??'—'}</Text><Text style={S.small}>{label}</Text></View>}
export function TradarrPulse({mode='compact',onOpen,onProfile}:{mode?:Mode;onOpen?:()=>void;onProfile?:()=>void}){
 const {data,error,loading,refresh}=usePulse();
 const [busy,setBusy]=useState('');
 const action=async(name:string,args:Record<string,unknown>,key:string)=>{if(busy)return;setBusy(key);try{const {error}=await supabase.rpc(name,args);if(error)throw error;await refresh()}catch(e:any){Alert.alert('Could not update',e?.message||'Try again.')}finally{setBusy('')}};
 const jobs=data?.opportunities||[],activity=data?.activity||[],reach=data?.reach||{};
 const heading=mode==='reach'?'Your business reach':mode==='map'?'Demand near you':mode==='board'?'Open opportunities':'Tradarr Pulse';
 const found=(label:string)=>activity.find(a=>a.label===label)?.count;
 return <View style={S.card}>
 <View style={S.head}><View style={S.icon}>{mode==='reach'?<TrendingUp size={21} color={C.teal}/>:mode==='map'?<MapPin size={21} color={C.teal}/>:mode==='board'?<BriefcaseBusiness size={21} color={C.teal}/>:<Activity size={21} color={C.teal}/>}</View><View style={{flex:1,minWidth:0}}><Text style={S.title}>{heading}</Text><Text style={S.small}>{data?.configured?data.trade+' · '+data.radius+' mile work area':'Genuine local activity'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh activity" onPress={refresh} style={S.refresh}><RefreshCw size={18} color={C.teal}/></Pressable></View>
 {error?<><Text style={S.copy}>Activity could not refresh. {data?'Last available figures are shown.':''}</Text><Button label="Retry" onPress={refresh} secondary/></>:null}
 {!data&&loading?<ActivityIndicator color={C.teal}/>:null}
 {data&&!data.configured?<><Text style={S.copy}>Set your work area to see relevant local demand and opportunities.</Text>{onProfile&&<Button label="Set work area" onPress={onProfile}/>}</>:null}
 {data?.configured&&<>
 {(mode==='compact'||mode==='board')&&<><View style={S.metrics}><Metric label="Customers searching · 7 days" value={data.searches}/><Metric label="Open opportunities" value={jobs.length===40?'40+':jobs.length}/></View><View style={S.metrics}><Metric label="Urgent requests · 7 days" value={found('Urgent requests')}/><Metric label="Completed · 7 days" value={found('Completed jobs')}/></View><Text style={S.small}>Activity is shown in ranges to protect customer privacy. A dash means insufficient data.</Text></>}
 {mode==='compact'&&<Button label="Explore local opportunities" onPress={()=>onOpen?.()}/>}
 {mode==='board'&&<>
 <View style={S.divider}/><Text style={S.section}>Available to express interest</Text><Text style={S.small}>Customers choose to share these jobs. Interest is not a booking; wait for their invitation.</Text>
 {jobs.length===0?<View style={S.empty}><Text style={S.bold}>No open opportunities yet</Text><Text style={S.small}>New customer-shared jobs will appear here when they match your trade and work area.</Text></View>:jobs.map(job=><View key={job.id} style={S.job}><Text style={S.bold}>{job.summary}</Text><Text style={S.small}>{job.trade} · {job.timing} · within {job.distance_miles} mi of work area</Text>{job.interest_status==='pending'?<Button secondary label="Interest sent · withdraw" disabled={!!busy} onPress={()=>void action('tradarr_pulse_interest',{p_job:job.id,p_withdraw:true},job.id)}/>:job.interest_status?<Text style={S.small}>{job.interest_status==='invited'?'Invitation sent — check Jobs':job.interest_status==='withdrawn'?'Interest withdrawn':'Customer declined'}</Text>:<Button label="Interested in this job" disabled={!!busy} onPress={()=>void action('tradarr_pulse_interest',{p_job:job.id},job.id)}/>}</View>)}
 <View style={S.divider}/><Text style={S.section}>Local activity · last 7 days</Text>{activity.length?activity.map(a=><View key={a.label} style={S.line}><Text style={S.copy}>{a.label}</Text><Text style={S.bold}>{a.count}</Text></View>):<Text style={S.small}>Not enough activity yet for a privacy-safe local summary.</Text>}
 <View style={S.divider}/><View style={S.head}><Bell color={C.teal} size={20}/><View style={{flex:1}}><Text style={S.bold}>Local opportunity alerts</Text><Text style={S.small}>Optional notifications for new eligible work.</Text></View></View><Button secondary label={data.alerts?'Turn alerts off':'Turn alerts on'} disabled={!!busy} onPress={()=>void action('tradarr_pulse_alerts',{p_enabled:!data.alerts},'alerts')}/>
 <Text style={S.small}>{data.missed??0} expired invitations in the last 7 days. Expired doesn't necessarily mean you were offline.</Text>
 </>}
 {mode==='map'&&<><Text style={S.small}>Last 7 days · broad areas with at least five distinct customers. No customer pins or addresses.</Text>{data.origin&&<View style={S.map}><WorkAreaMapPreview latitude={data.origin.lat} longitude={data.origin.lng} showPin={false} demandZones={data.zones||[]} demandRadius={data.radius}/></View>}<Text style={S.small}>{data.zones?.length?'Shaded circles represent grouped local activity, not individual jobs.':'No qualifying demand areas yet. Your work area is shown without invented hotspots.'}</Text></>}
 {mode==='reach'&&<><Text style={S.small}>Last 7 days · measured customer interactions only.</Text><View style={S.metrics}><Metric label="Profile viewers" value={reach.profile_views}/><Metric label="New saves" value={reach.saved}/></View><View style={S.metrics}><Metric label="New conversations" value={reach.enquiries}/><Metric label="Jobs won" value={reach.won}/></View><Text style={S.small}>Profile views are counted once per customer in the period. Search appearances aren't measured yet.</Text></>}
 </>}
 </View>
}
type Interest={trader_id:string;name:string;status:string};
export function CustomerOpportunity({jobId,onChanged}:{jobId:string;onChanged?:()=>void}){
 const [state,setState]=useState<{summary:string|null;interests:Interest[]}|null>(null),[summary,setSummary]=useState(''),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const seq=useRef(0);
 const load=useCallback(async()=>{const v=++seq.current;const {data,error}=await supabase.rpc('tradarr_pulse_customer',{p_job:jobId});if(v!==seq.current)return;if(error){setError(error.message);return;}setState(data);setSummary(data?.summary||'');setError('')},[jobId]);
 useEffect(()=>{void load();return()=>{seq.current++}},[load]);
 const act=async(name:string,args:Record<string,unknown>)=>{if(busy)return;setBusy(true);setError('');try{const {error}=await supabase.rpc(name,{p_job:jobId,...args});if(error)throw error;await load();onChanged?.()}catch(e:any){setError(e?.message||'Could not update')}finally{setBusy(false)}};
 const pending=(state?.interests||[]).filter(x=>x.status==='pending');
 return <View style={S.card}><Text style={S.title}>Open to local trades</Text><Text style={S.small}>{state?.summary?'Your request is on the opportunities board.':'Share a short work-only summary with suitable local tradespeople. You choose who to invite.'}</Text>
 {error?<Text accessibilityRole="alert" style={S.copy}>{error}</Text>:null}
 <Button secondary label={expanded?'Hide options':state?.summary?'Manage shared job'+(pending.length?' · '+pending.length+' interested':''):'Share with local trades'} onPress={()=>{setExpanded(v=>!v);void load()}}/>
 {expanded&&<><Text style={S.small}>Do not include your name, address, phone, email or other private details. Only your summary, trade, timing and approximate distance are shown.</Text><TextInput style={S.input} value={summary} onChangeText={setSummary} maxLength={140} multiline placeholder="e.g. Replace a leaking kitchen tap" placeholderTextColor={C.muted} accessibilityLabel="Public work summary"/>
 <Button label={state?.summary?'Update summary':'Publish to opportunities'} disabled={busy||summary.trim().length<5} onPress={()=>void act('tradarr_pulse_publish',{p_summary:summary.trim()})}/>
 {state?.summary&&<Button secondary disabled={busy} label="Stop sharing" onPress={()=>void act('tradarr_pulse_publish',{p_summary:null})}/>}
 {pending.map(i=><View style={S.job} key={i.trader_id}><Text style={S.bold}>{i.name||'Local tradesperson'}</Text><Text style={S.small}>Interested in your job</Text><Button label="Send job invitation" disabled={busy} onPress={()=>void act('tradarr_pulse_decide',{p_trader:i.trader_id,p_invite:true})}/><Button secondary label="Decline interest" disabled={busy} onPress={()=>void act('tradarr_pulse_decide',{p_trader:i.trader_id,p_invite:false})}/></View>)}</>}
 </View>
}
export function recordPulseSearch(trade:string,lat:number,lon:number){if(trade==='All'||!Number.isFinite(lat)||!Number.isFinite(lon))return;void supabase.rpc('tradarr_pulse_record',{p_kind:'search',p_trade:trade,p_lat:Math.floor(lat*10)/10+.05,p_lon:Math.floor(lon*10)/10+.05}).then(()=>{},()=>{})}
export function recordPulseProfile(id:string,trade:string){if(id.startsWith('live-'))void supabase.rpc('tradarr_pulse_record',{p_kind:'profile',p_trade:trade,p_target:id.slice(5)}).then(()=>{},()=>{})}
const S=StyleSheet.create({card:{backgroundColor:C.white,borderRadius:22,borderWidth:1,borderColor:C.line,padding:15,gap:10,marginBottom:12},head:{flexDirection:'row',alignItems:'center',gap:10},icon:{width:40,height:40,borderRadius:13,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},title:{fontSize:19,fontWeight:'800',color:C.ink,letterSpacing:-.4},section:{fontSize:16,fontWeight:'800',color:C.ink},bold:{fontSize:15,fontWeight:'700',color:C.ink},copy:{fontSize:14,color:C.ink,lineHeight:20},small:{fontSize:12,color:C.muted,lineHeight:17},metrics:{flexDirection:'row',gap:8},metric:{flex:1,minWidth:0,padding:10,borderRadius:13,backgroundColor:C.soft,gap:3},number:{fontSize:24,fontWeight:'800',color:C.teal},refresh:{width:44,height:44,alignItems:'center',justifyContent:'center'},button:{minHeight:44,backgroundColor:C.darkTeal,borderRadius:13,alignItems:'center',justifyContent:'center',padding:9},secondary:{backgroundColor:C.tealTint},buttonText:{fontSize:14,fontWeight:'700',color:C.white,textAlign:'center'},job:{borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,gap:8},line:{flexDirection:'row',justifyContent:'space-between',gap:10},divider:{height:1,backgroundColor:C.line,marginVertical:3},empty:{padding:12,borderRadius:14,backgroundColor:C.soft,gap:5},map:{height:260,borderRadius:16,overflow:'hidden'},input:{borderWidth:1,borderColor:C.line,borderRadius:12,padding:10,minHeight:70,color:C.ink,fontSize:14,textAlignVertical:'top'}});
