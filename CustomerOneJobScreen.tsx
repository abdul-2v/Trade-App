import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {ArrowLeft,BriefcaseBusiness,Check,ChevronDown,ChevronRight,ClipboardList,Plus,Trash2,Users} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {supabase} from './lib/supabase';
import {theme} from './theme';
const C=theme.colors;
type StageStatus='planned'|'requested'|'booked'|'done';
type Stage={id:string;trade:string;task:string;status:StageStatus};
type Project={id:string;customer_id:string;title:string;address:string|null;brief:string|null;stages:Stage[];updated_at:string};
const trades=['Plumber','Electrician','Builder','Heating','Locksmith','Carpenter','Roofer'];
const templates=[
 {name:'Bathroom refurbishment',stages:[['Plumber','Plumbing and sanitaryware'],['Electrician','Bathroom electrical work'],['Builder','Tiling and finishing']]},
 {name:'Kitchen renovation',stages:[['Builder','Preparation and installation'],['Plumber','Kitchen plumbing'],['Electrician','Sockets, lighting and testing']]},
 {name:'General renovation',stages:[['Builder','Site preparation and structural work'],['Electrician','Electrical work'],['Plumber','Plumbing work'],['Carpenter','Final carpentry and finishing']]},
] as const;
const statusName:Record<StageStatus,string>={planned:'To arrange',requested:'Finding a trade',booked:'Booked (manual)',done:'Completed (manual)'};
const generateId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
function Field({label,value,onChange,placeholder,multiline}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
  <TextInput multiline={multiline} textAlignVertical={multiline?'top':'center'} value={value} onChangeText={onChange}
   style={[s.input,multiline&&{minHeight:88}]} placeholder={placeholder} placeholderTextColor="#9AA5A5"/></View>;
}
export default function CustomerOneJobScreen({goBack,onFindTrade}:{goBack:()=>void;onFindTrade:(trade:string,task:string)=>void}){
 const [uid,setUid]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [projects,setProjects]=useState<Project[]>([]),[selectedId,setSelectedId]=useState<string|null>(null);
 const [creating,setCreating]=useState(false),[title,setTitle]=useState(''),[address,setAddress]=useState(''),[brief,setBrief]=useState('');
 const [stages,setStages]=useState<Stage[]>([]),[addTrade,setAddTrade]=useState('Plumber'),[addTask,setAddTask]=useState(''),[editStages,setEditStages]=useState(false);
 const selected=projects.find(p=>p.id===selectedId)||null;
 const load=async()=>{
  const {data:a}=await supabase.auth.getUser();
  if(!a.user){setLoading(false);return;}setUid(a.user.id);
  const {data,error}=await supabase.from('customer_onejob_projects').select('*').eq('customer_id',a.user.id)
   .order('updated_at',{ascending:false}).limit(100);
  if(error)Alert.alert('Could not load projects',error.message);
  else setProjects((data||[]) as Project[]);
  setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 const create=async()=>{
  if(saving||!uid)return;
  if(title.trim().length<3||!stages.length){Alert.alert('Project details needed','Enter a project title and at least one trade stage.');return;}
  setSaving(true);
  const {data,error}=await supabase.from('customer_onejob_projects').insert({
   customer_id:uid,title:title.trim(),address:address.trim()||null,brief:brief.trim()||null,stages
  }).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Unable to create project',error?.message||'Try again.');return;}
  setProjects(old=>[data as Project,...old]);setSelectedId(data.id);setCreating(false);setTitle('');setBrief('');setAddress('');setStages([]);
 };
 const chooseTemplate=(t:typeof templates[number])=>{
  setTitle(t.name);
  setStages(t.stages.map(([trade,task])=>({id:generateId(),trade,task,status:'planned'})));
 };
 const addStage=()=>{
  if(!addTask.trim()){Alert.alert('Describe the work','Give this stage a task, such as installing sockets or fitting pipework.');return;}
  if(stages.length>=20){Alert.alert('Stage limit','Projects can have up to 20 stages.');return;}
  setStages(old=>[...old,{id:generateId(),trade:addTrade,task:addTask.trim(),status:'planned'}]);setAddTask('');
 };
 const updateStage=async(id:string,status:StageStatus)=>{
  if(!selected||saving)return;
  const changed=selected.stages.map(x=>x.id===id?{...x,status}:x);
  await persist(selected,changed);
 };
 const persist=async(project:Project,nextStages:Stage[])=>{
  setSaving(true);
  const {data,error}=await supabase.from('customer_onejob_projects').update({stages:nextStages,updated_at:new Date().toISOString()})
   .eq('id',project.id).eq('customer_id',uid).select('*').single();
  setSaving(false);
  if(error||!data){Alert.alert('Unable to save project',error?.message||'Try again.');return false;}
  setProjects(old=>old.map(x=>x.id===project.id?data as Project:x));return true;
 };
 const deleteProject=(p:Project)=>Alert.alert('Delete this project?',p.title,[{text:'Cancel',style:'cancel'},
  {text:'Delete',style:'destructive',onPress:async()=>{
   const {error}=await supabase.from('customer_onejob_projects').delete().eq('id',p.id).eq('customer_id',uid);
   if(error)Alert.alert('Could not delete',error.message);
   else{setProjects(old=>old.filter(v=>v.id!==p.id));setSelectedId(null);}
  }}]);
 const startStage=async(stage:Stage)=>{
  if(!selected)return;
  if(stage.status==='planned'){const ok=await persist(selected,selected.stages.map(x=>x.id===stage.id?{...x,status:'requested' as StageStatus}:x));
    if(!ok)return;}
  onFindTrade(stage.trade,selected.title+' — '+stage.task+(selected.brief?'. '+selected.brief:''));
 };
 const selectStep=(index:number)=>{
  if(!selected)return;
  Alert.alert('Update stage',selected.stages[index].task,[
   {text:'Cancel',style:'cancel'},
   {text:'To arrange',onPress:()=>{void updateStage(selected.stages[index].id,'planned')}},
   {text:'Booked',onPress:()=>{void updateStage(selected.stages[index].id,'booked')}},
   {text:'Completed',onPress:()=>{void updateStage(selected.stages[index].id,'done')}}
  ]);
 };
 const back=()=>selected?setSelectedId(null):creating?setCreating(false):goBack();
 return <View style={s.root}>
  <View style={s.header}><MotionPressable onPress={back} style={s.back}><ArrowLeft color={C.ink} size={22}/></MotionPressable>
   <View style={{flex:1}}><Text style={s.eyebrow}>ONEJOB</Text><Text style={s.heading}>{selected?'Project plan':creating?'New project':'Organise the whole job'}</Text></View></View>
  {loading?<ActivityIndicator size="large" color={C.teal} style={{marginTop:60}}/>:
  <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    {!selected&&!creating?<><View style={s.hero}><Users size={24} color="#D0E6E2"/>
      <Text style={s.heroTitle}>One project. Every trade in order.</Text>
      <Text style={s.heroSub}>Plan a renovation as one job, organise trade stages and find someone for each part without losing track of the bigger picture.</Text>
     </View><MotionPressable style={s.primary} onPress={()=>setCreating(true)}><Plus size={18} color="#FFFFFF"/><Text style={s.primaryText}>Plan a multi-trade project</Text></MotionPressable>
      <Text style={s.section}>Your projects</Text>
      {projects.length?projects.map(p=><MotionPressable key={p.id} onPress={()=>setSelectedId(p.id)} style={s.project}>
        <View style={s.projectIcon}><BriefcaseBusiness color={C.teal} size={23}/></View><View style={{flex:1}}>
         <Text style={s.projectTitle}>{p.title}</Text>
         <Text style={s.meta}>{p.stages.filter(x=>x.status==='done').length}/{p.stages.length} stages completed · {p.stages.length} trade stages</Text>
        </View><ChevronRight size={20} color={C.teal}/></MotionPressable>):
        <View style={s.empty}><ClipboardList size={31} color={C.teal}/><Text style={s.meta}>No multi-trade projects yet. Start with a bathroom, kitchen or your own plan.</Text></View>}
     </>:creating?<><Text style={s.intro}>Start with a template or build your own sequence. Every stage is editable before you save.</Text>
       <Text style={s.section}>Quick project templates</Text>
       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templates}>
        {templates.map(t=><MotionPressable key={t.name} onPress={()=>chooseTemplate(t)} style={s.template}>
         <Text style={s.templateText}>{t.name}</Text><Text style={s.templateSub}>{t.stages.length} trade stages</Text></MotionPressable>)}</ScrollView>
       <View style={s.card}><Field label="Project name *" value={title} onChange={setTitle} placeholder="e.g. Bathroom refurbishment"/>
        <Field label="Property address (optional)" value={address} onChange={setAddress}/>
        <Field label="What do you want to achieve?" value={brief} onChange={setBrief} multiline
         placeholder="e.g. Replace old suite and retile the room"/>
       </View>
       <Text style={s.section}>Work stages</Text>
       {stages.map((x,i)=><View key={x.id} style={s.stage}>
         <Text style={s.number}>{i+1}</Text><View style={{flex:1}}><Text style={s.projectTitle}>{x.task}</Text><Text style={s.meta}>{x.trade}</Text></View>
         <MotionPressable onPress={()=>setStages(old=>old.filter(q=>q.id!==x.id))}><Trash2 size={18} color={C.coralDark}/></MotionPressable>
       </View>)}
       <View style={s.card}>
        <Text style={s.cardTitle}>Add another stage</Text>
        <ScrollView horizontal contentContainerStyle={s.trades} showsHorizontalScrollIndicator={false}>
         {trades.map(k=><MotionPressable key={k} style={[s.chip,addTrade===k&&s.chipOn]} onPress={()=>setAddTrade(k)}>
          <Text style={[s.chipText,addTrade===k&&s.chipTextOn]}>{k}</Text></MotionPressable>)}</ScrollView>
        <Field label="What needs doing?" value={addTask} onChange={setAddTask} placeholder="e.g. Rewire kitchen sockets"/>
        <MotionPressable style={s.outline} onPress={addStage}><Plus size={17} color={C.teal}/><Text style={s.outlineText}>Add stage to project</Text></MotionPressable>
       </View>
       <MotionPressable disabled={saving} style={s.primary} onPress={()=>{void create()}}>
        {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={s.primaryText}>Save project plan</Text>}</MotionPressable>
      </>:selected?<><View style={s.hero}><Text style={s.heroLabel}>PROJECT WORKSPACE</Text>
        <Text style={s.heroTitle}>{selected.title}</Text>
        <Text style={s.heroSub}>{selected.address||'Address not added'}</Text>
        {selected.brief?<Text style={s.heroSub}>{selected.brief}</Text>:null}
        <Text style={s.heroSub}>{selected.stages.filter(x=>x.status==='done').length} of {selected.stages.length} stages complete</Text>
       </View>
       <Text style={s.section}>Coordinate the work</Text>
       {selected.stages.map((stage,index)=><View key={stage.id} style={s.card}>
        <View style={s.row}><View style={s.stageNumber}><Text style={s.stageNumberText}>{index+1}</Text></View><View style={{flex:1}}>
         <Text style={s.projectTitle}>{stage.task}</Text><Text style={s.meta}>{stage.trade}</Text>
         <Text style={s.status}>{statusName[stage.status]}</Text></View>
         {stage.status==='done'?<Check size={21} color={C.teal}/>:null}
        </View><View style={s.actions}>
          {stage.status!=='done'?<MotionPressable style={s.stagePrimary} onPress={()=>{void startStage(stage)}} disabled={saving}>
            <Text style={s.primaryText}>Find {stage.trade.toLowerCase()}</Text><ChevronRight color="#FFFFFF" size={16}/></MotionPressable>:null}
          <MotionPressable onPress={()=>selectStep(index)} disabled={saving} style={s.stageSecondary}>
           <Text style={s.outlineText}>Update status</Text><ChevronDown size={16} color={C.teal}/></MotionPressable>
        </View></View>)}
       <Text style={s.intro}>Stage statuses are updated manually. Each trade enquiry uses the existing Tradarr booking flow—this pilot doesn't automatically allocate a whole team or guarantee a project completion date.</Text>
       <MotionPressable onPress={()=>deleteProject(selected)} style={s.delete}><Trash2 color={C.coralDark} size={16}/><Text style={s.deleteText}>Delete project</Text></MotionPressable>
      </>:null}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.customerBackground},header:{padding:18,flexDirection:'row',alignItems:'center',gap:12},
 back:{height:43,width:43,borderRadius:23,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 eyebrow:{fontSize:10,fontWeight:'800',color:C.teal,letterSpacing:1.4},heading:{fontSize:24,fontWeight:'800',color:C.ink,marginTop:4},
 page:{paddingHorizontal:19,paddingTop:8,paddingBottom:50},
 hero:{backgroundColor:C.darkTeal,padding:23,borderRadius:26,gap:9},
 heroLabel:{color:'#B7DCD5',fontWeight:'800',letterSpacing:1.4,fontSize:10},
 heroTitle:{fontSize:23,fontWeight:'800',color:'#FFFFFF',lineHeight:30},
 heroSub:{fontSize:12,lineHeight:20,color:'#D9E7E4'},
 section:{fontSize:18,fontWeight:'800',color:C.ink,marginTop:23,marginBottom:12},
 primary:{backgroundColor:C.darkTeal,minHeight:54,borderRadius:26,alignItems:'center',justifyContent:'center',
  flexDirection:'row',gap:10,marginTop:18,paddingHorizontal:15},
 primaryText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
 intro:{fontSize:12,color:C.muted,lineHeight:19,marginTop:10,marginBottom:10},
 project:{padding:16,backgroundColor:'#FFFFFF',borderRadius:21,marginBottom:11,flexDirection:'row',alignItems:'center',gap:12,...theme.shadow},
 projectIcon:{width:46,height:46,borderRadius:16,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 projectTitle:{fontSize:15,color:C.ink,fontWeight:'800'},meta:{fontSize:11,color:C.muted,lineHeight:18,marginTop:5},
 empty:{backgroundColor:'#FFFFFF',padding:24,borderRadius:23,alignItems:'center',gap:9},
 card:{backgroundColor:'#FFFFFF',padding:17,borderRadius:22,marginBottom:12,...theme.shadow},
 field:{marginBottom:12},label:{color:C.ink,fontSize:12,fontWeight:'800',marginBottom:8},
 input:{minHeight:47,borderWidth:1,borderColor:C.line,backgroundColor:'#F9FBFA',borderRadius:13,
  paddingHorizontal:12,paddingVertical:10,fontSize:14,color:C.ink},
 templates:{gap:9,marginBottom:15,paddingRight:20},
 template:{backgroundColor:C.tealTint,padding:15,borderRadius:18,minWidth:173},
 templateText:{fontSize:13,color:C.teal,fontWeight:'800'},templateSub:{fontSize:11,color:C.muted,marginTop:8},
 stage:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#FFFFFF',borderRadius:17,padding:13,marginBottom:8},
 number:{fontSize:13,color:C.teal,fontWeight:'800'},
 trades:{gap:7,marginTop:10,marginBottom:16},
 chip:{paddingHorizontal:12,paddingVertical:10,borderRadius:18,borderWidth:1,borderColor:C.line},
 chipOn:{backgroundColor:C.tealTint,borderColor:C.teal},
 chipText:{fontSize:12,fontWeight:'800',color:C.muted},chipTextOn:{color:C.teal},
 cardTitle:{fontSize:15,fontWeight:'800',color:C.ink},
 outline:{backgroundColor:C.tealTint,flexDirection:'row',gap:8,minHeight:48,borderRadius:19,
  alignItems:'center',justifyContent:'center'},
 outlineText:{fontSize:12,fontWeight:'800',color:C.teal},
 row:{flexDirection:'row',alignItems:'center',gap:13},
 stageNumber:{width:35,height:35,borderRadius:18,backgroundColor:C.tealTint,alignItems:'center',justifyContent:'center'},
 stageNumberText:{fontWeight:'800',color:C.teal},
 status:{fontSize:11,color:C.teal,fontWeight:'800',marginTop:8},
 actions:{flexDirection:'row',gap:8,marginTop:16},
 stagePrimary:{flex:1,minHeight:46,borderRadius:18,backgroundColor:C.darkTeal,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
 stageSecondary:{flex:1,minHeight:46,backgroundColor:C.tealTint,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
 delete:{flexDirection:'row',gap:7,alignSelf:'center',marginTop:12,padding:15},
 deleteText:{color:C.coralDark,fontSize:12,fontWeight:'800'}
});
