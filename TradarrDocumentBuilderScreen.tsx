import React,{useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Platform,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {WebView} from 'react-native-webview';
import {ArrowLeft,ArrowRight,ClipboardCheck,Eye,FileText,Printer,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';
import {FormFlowSteps,FormFlowFooter,FormFlowFloatingPreview} from './PremiumFormFlow';

type Role='tradesperson'|'customer';
type DocField={key:string;label:string;multi?:boolean;required?:boolean;date?:boolean;hint?:string};
type DocGroup={title:string;fields:DocField[]};
type DocTemplate={id:string;title:string;subtitle:string;tag:string;intro:string;groups:DocGroup[]};
const f=(key:string,label:string,multi=false,required=false,hint=''):DocField=>({key,label,multi,required,hint});
const date=(key:string,label:string,required=false):DocField=>({key,label,date:true,required});
const common:DocGroup={title:'Job & property',fields:[f('title','Job / document title',false,true),f('reference','Job reference'),
 f('address','Property / site address',true,true),date('date','Date',true)]};
const templates:Record<Role,DocTemplate[]>={
 tradesperson:[
  {id:'job',title:'Job sheet',subtitle:'Work order, labour, materials and next steps',tag:'JOB RECORD',
   intro:'Record the work requested, attended and carried out.',groups:[common,
    {title:'People',fields:[f('customer','Customer / company'),f('trader','Tradesperson / business'),f('contact','Contact details')]},
    {title:'Work',fields:[f('scope','Work requested',true,true),f('work','Work carried out',true),
     f('time','Arrival / time on site'),f('materials','Materials / parts used',true),f('outstanding','Outstanding work and next actions',true)]},
    {title:'Handover',fields:[f('photos','Photo references / filenames',true),f('notes','Site notes / customer instructions',true),f('acknowledgement','Customer acknowledgement status')]}]},
  {id:'inspection',title:'Inspection report',subtitle:'Condition, findings and recommendations',tag:'INSPECTION REPORT',
   intro:'Keep observed findings separate from the recommended action.',groups:[common,
    {title:'Inspection details',fields:[f('customer','Customer / company'),f('inspector','Inspected by'),
      f('area','Area or equipment inspected',true,true),f('reason','Reason for inspection',true)]},
    {title:'Findings',fields:[f('findings','Observed findings',true,true),f('priority','Priority / urgency'),f('limitations','Areas not inspected / limitations',true),f('photos','Photograph references',true)]},
    {title:'Recommendations',fields:[f('recommendations','Recommended action',true),f('followup','Recommended follow-up'),f('notes','Other notes',true)]}]},
  {id:'completion',title:'Completion & handover report',subtitle:'Completed work, checks and aftercare',tag:'COMPLETION RECORD',
   intro:'Document what was completed and any outstanding work.',groups:[common,
    {title:'People & work',fields:[f('customer','Customer / company'),f('trader','Tradesperson / business'),f('completed','Work completed',true,true),f('materials','Products and parts installed',true)]},
    {title:'Checks & outstanding',fields:[f('checks','Checks or tests actually performed',true),f('limitations','Checks not completed / exclusions',true),f('outstanding','Outstanding items',true),f('photos','Before / after photograph references',true)]},
    {title:'Handover & aftercare',fields:[f('aftercare','Aftercare / maintenance advice',true),f('warranty','Agreed workmanship warranty (if any)',true),f('acknowledgement','Customer acknowledgement status')]}]},
  {id:'variation',title:'Extra work / variation',subtitle:'Agree additional scope, cost and time',tag:'PROPOSED CHANGE',
   intro:'This is a proposed change unless the customer has explicitly approved it.',groups:[common,
    {title:'Original agreement',fields:[f('customer','Customer / company'),f('trader','Tradesperson / business'),f('original','Original agreed work',true,true)]},
    {title:'Proposed variation',fields:[f('change','Additional or changed work',true,true),f('reason','Reason for change',true),
     f('cost','Additional cost / VAT treatment',false,true),f('timing','Impact on schedule'),f('exclusions','Exclusions or assumptions',true)]},
    {title:'Approval',fields:[f('approval','Customer approval status',false,true,'e.g. Awaiting customer approval'),
      date('approvalDate','Actual approval date (if approved)'),f('notes','Approval evidence / reference',true)]}]},
  {id:'service',title:'Service & maintenance record',subtitle:'Maintenance work, faults and next visit',tag:'SERVICE REPORT',
   intro:'Maintain a service history with observations and actions taken.',groups:[common,
    {title:'Service information',fields:[f('customer','Customer / company'),f('trader','Serviced by'),f('equipment','Equipment / installation details',true,true),f('previous','Previous service reference')]},
    {title:'Work & results',fields:[f('condition','Condition on arrival',true),f('work','Service tasks performed',true,true),
     f('parts','Parts / consumables',true),f('checks','Checks actually completed',true),f('faults','Faults / issues',true)]},
    {title:'Recommendations',fields:[f('recommendations','Recommended actions',true),date('nextVisit','Suggested next service'),f('notes','Customer advice',true)]}]},
  {id:'guarantee',title:'Workmanship guarantee record',subtitle:'Cover, dates, exclusions and claim process',tag:'GUARANTEE RECORD',
   intro:'Written record of workmanship cover actually offered by the business.',groups:[common,
    {title:'Provider & customer',fields:[f('trader','Guarantee provider',false,true),f('customer','Customer'),f('contact','Contact details'),f('original','Related job / invoice number')]},
    {title:'Terms of cover',fields:[f('covered','Workmanship covered',true,true),date('start','Start date',true),
      date('end','End date',true),f('exclusions','Exclusions / limits',true),f('claims','How to make a claim',true)]},
    {title:'Notes',fields:[f('products','Separate manufacturer warranties (if any)',true),f('notes','Terms actually agreed',true)]}]}
 ],
 customer:[
  {id:'brief',title:'Job request brief',subtitle:'Describe the problem, access and requirements',tag:'JOB BRIEF',
   intro:'A clear brief to share with the people quoting for your project.',groups:[common,
    {title:'The work required',fields:[f('problem','Problem / work required',true,true),f('trade','Type of trade'),f('priority','Urgency / priority'),date('preferred','Preferred visit date')]},
    {title:'Practical details',fields:[f('access','Access / parking information',true),f('known','Measurements or model details',true),
     f('photos','Photo references / filenames',true),f('budget','Budget guidance (optional)'),f('notes','Additional considerations',true)]}]},
  {id:'snagging',title:'Snagging & remedial report',subtitle:'Issues, supporting evidence and follow-up',tag:'SNAGGING REPORT',
   intro:'A record of reported issues, not an automatic finding of liability.',groups:[common,
    {title:'Project details',fields:[f('trader','Contractor / tradesperson'),f('customer','Customer'),date('completed','Original completion date')]},
    {title:'Items to review',fields:[f('issues','Numbered snagging / defect items',true,true),f('location','Locations affected',true),f('photos','Photograph references',true),f('impact','Impact / urgency',true)]},
    {title:'Next steps',fields:[f('remedy','Requested remedy',true),date('due','Requested response date'),
      f('status','Current status',false,false,'e.g. Reported, scheduled, resolved'),f('notes','Correspondence references',true)]}]},
  {id:'condition',title:'Property condition report',subtitle:'Record existing damage before work',tag:'CONDITION REPORT',
   intro:'A dated record of observed property condition.',groups:[common,
    {title:'Inspection details',fields:[f('area','Rooms / areas checked',true,true),f('inspectedBy','Recorded by'),f('work','Planned work',true)]},
    {title:'Condition',fields:[f('condition','Existing condition and visible damage',true,true),f('photos','Dated photograph references',true),
      f('protection','Items to protect during work',true),f('limitations','Areas not inspected',true)]},
    {title:'Notes',fields:[f('notes','Agreed precautions / other observations',true),f('acknowledgement','Acknowledgement status (if any)')]}]},
  {id:'handover',title:'Property handover checklist',subtitle:'Keys, manuals, warranties and open items',tag:'HANDOVER CHECKLIST',
   intro:'Record what was actually handed over and what remains open.',groups:[common,
    {title:'Project handover',fields:[f('project','Completed project',true,true),f('trader','Handed over by'),f('customer','Received by'),f('keys','Keys / access details received',true)]},
    {title:'Records supplied',fields:[f('docs','Manuals, receipts and applicable certificates supplied',true),f('warranties','Warranty documents supplied',true),f('demonstration','Equipment instructions / demonstration',true)]},
    {title:'Outstanding items',fields:[f('outstanding','Outstanding items',true),f('actions','Who is responsible and next dates',true),f('acknowledgement','Acknowledgement status')]}]}
 ]
};
const note=(id:string)=>{
 if(id==='variation')return 'Proposed change only — not approved until the customer expressly agrees.';
 if(id==='guarantee')return 'Record only the terms that the named business is actually offering.';
 if(['inspection','completion','service'].includes(id))return 'General work record only. Not a regulated safety or compliance certificate.';
 return 'Verify all details and supporting records before sharing.';
};
const escape=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clean=(v:unknown)=>escape(v).replace(/\n/g,'<br/>');
const localDate=()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
const formatDate=(v:string)=>{if(!v)return '';const t=new Date(v+'T12:00:00Z');return Number.isNaN(t.getTime())?escape(v):
 t.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});};
const shown=(field:DocField,values:Record<string,string>)=>field.date?formatDate(values[field.key]):clean(values[field.key]);
export function tradarrDocumentHtml(template:DocTemplate,values:Record<string,string>){
 const head=common.fields.filter(field=>String(values[field.key]||'').trim()).map(field=>
  '<div class="fact"><label>'+escape(field.label)+'</label><strong>'+shown(field,values)+'</strong></div>').join('');
 const metaKeys=new Set(common.fields.map(field=>field.key));
 const blocks=template.groups.map((group,index)=>{
  const fields=group.fields.filter(field=>!metaKeys.has(field.key)&&String(values[field.key]||'').trim());
  const body=fields.length?fields.map(field=>
   '<div class="value '+(field.multi?'wide':'')+'"><label>'+escape(field.label)+'</label><div>'+shown(field,values)+'</div></div>').join(''):
   '<div class="empty">No additional information recorded.</div>';
  return '<section class="section"><div class="sectionHead"><span>'+String(index+1).padStart(2,'0')+'</span><h3>'+escape(group.title)+'</h3></div>'+
   '<div class="fieldGrid">'+body+'</div></section>';
 }).join('');
 const css=[
 '@page{size:A4;margin:0}*{box-sizing:border-box}',
 'html,body{margin:0;padding:0;width:100%;background:#fff;color:#263b3c;font-family:-apple-system,BlinkMacSystemFont,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
 '.sheet{width:177mm;max-width:100%;min-height:252mm;margin:18mm auto 22mm}',
 '.head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:2px solid #2b605a;padding-bottom:16px}',
 '.brand{font-size:20px;letter-spacing:1px;font-weight:850;color:#17524c}.brand span{display:block;font-size:8px;letter-spacing:2px;color:#899b96;font-weight:800;margin-top:2px}',
 '.tag{font-size:9px;letter-spacing:1.2px;font-weight:800;color:#5e7770;margin-top:12px}',
 '.draft{font-size:9px;font-weight:850;color:#b05c46;text-align:right;letter-spacing:.4px}',
 '.title{margin-top:23px;margin-bottom:17px}.title small{font-size:9px;letter-spacing:1px;color:#69847b;font-weight:850}',
 'h1{font-size:27px;color:#1d363b;line-height:1.28;letter-spacing:-.5px;margin:7px 0 7px;font-weight:850}.lead{margin:0;font-size:11px;color:#6a7d78}',
 '.facts{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#edf4f0;padding:18px;border-radius:5px;margin-bottom:24px}',
 '.fact{min-width:0}.fact label,.value label{font-size:9px;color:#69817a;font-weight:850;text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:5px}',
 '.fact strong{font-weight:780;color:#23403d;white-space:normal;overflow-wrap:anywhere}',
 '.section{margin-bottom:25px;break-inside:avoid;page-break-inside:avoid}',
 '.sectionHead{display:flex;align-items:center;gap:9px;border-bottom:1px solid #d9e5dd;padding-bottom:10px;margin-bottom:14px}',
 '.sectionHead span{font-size:11px;font-weight:850;color:#7b9990}',
 '.sectionHead h3{font-size:13px;letter-spacing:0;margin:0;color:#263c3f}',
 '.fieldGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px 22px}',
 '.value{min-width:0;overflow-wrap:anywhere}.value div{font-size:11px;line-height:1.6;color:#273f40}',
 '.wide{grid-column:1/-1}.empty{font-size:10px;color:#92a49e}',
 'footer{border-top:1px solid #d9e5dd;display:flex;justify-content:space-between;gap:20px;padding-top:14px;margin-top:30px;color:#70857d;font-size:9px}',
 '@media screen and (max-width:650px){.sheet{width:100%;min-height:0;margin:0;padding:23px 17px}.facts{gap:10px}.brand{font-size:17px}h1{font-size:23px}.fieldGrid{gap:11px}}'
 ].join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
  '<style>'+css+'</style></head><body><main class="sheet"><header class="head"><div><div class="brand">TRADARR<span>DOCUMENTS</span></div>'+
  '<div class="tag">'+escape(template.tag)+'</div></div><div class="draft">DRAFT · REVIEW BEFORE SHARING</div></header>'+
  '<div class="title"><small>WORK & PROPERTY DOCUMENT</small><h1>'+escape(template.title)+'</h1><p class="lead">'+escape(template.intro)+'</p></div>'+
  '<div class="facts">'+head+'</div>'+blocks+'<footer><span>'+escape(note(template.id))+'</span><span>Tradarr · '+
  formatDate(values.date||'')+'</span></footer></main></body></html>';
}
export default function TradarrDocumentBuilderScreen({role,goBack}:{role:Role;goBack:()=>void}){
 const [selectedId,setSelectedId]=useState('');
 const [fieldStep,setFieldStep]=useState(0);
 const [values,setValues]=useState<Record<string,string>>({date:localDate()});
 const [preview,setPreview]=useState(false);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const available=templates[role];
 const selected=available.find(template=>template.id===selectedId);
 const html=useMemo(()=>selected?tradarrDocumentHtml(selected,values):'', [selected,values]);
 const open=(id:string)=>{setSelectedId(id);setValues({date:localDate()});setError('');setPreview(false);setFieldStep(0)};
 const update=(key:string,value:string)=>{setValues(v=>({...v,[key]:value}));setError('')};
 const validate=()=>{
  if(!selected)return false;
  const missing=selected.groups.flatMap(g=>g.fields.filter(field=>field.required&&!String(values[field.key]||'').trim()).map(field=>field.label));
  if(missing.length){setError('Complete these required fields: '+missing.join(', '));return false}
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00Z').getTime());
  const invalidDates=selected.groups.flatMap(g=>g.fields.filter(field=>field.date&&values[field.key]&&!valid(values[field.key])).map(field=>field.label));
  if(invalidDates.length){setError('Check the date format (YYYY-MM-DD): '+invalidDates.join(', '));return false}
  if(selected.id==='guarantee'&&values.end<values.start){setError('The cover end date must follow the start date.');return false}
  if(selected.id==='variation'&&values.approval?.toLowerCase().trim()==='approved'&&!values.approvalDate){
   setError('Record the actual approval date, or change approval status to pending.');return false;
  }
  setError('');return true;
 };
 const exportPdf=async()=>{
  if(!selected||working||!validate())return;
  setWorking(true);
  try{
   if(Platform.OS==='web'){await Print.printAsync({html});return;}
   const file=await Print.printToFileAsync({html});
   if(await Sharing.isAvailableAsync()){
    await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Save or share '+selected.title});
   }else await Print.printAsync({html});
  }catch(e:any){Alert.alert('Unable to export PDF',e?.message||'Please try again.');}
  finally{setWorking(false);}
 };
 const advance=()=>{
  if(!selected)return;
  const group=selected.groups[fieldStep];
  const missing=group.fields.filter(f=>f.required&&!String(values[f.key]||'').trim());
  if(missing.length){setError('Please add: '+missing.map(f=>f.label).join(', '));return;}
  setError('');
  if(fieldStep<selected.groups.length-1)setFieldStep(v=>v+1);
  else setPreview(true);
 };
 const goBackOne=()=>{if(preview)setPreview(false);else if(selectedId&&fieldStep>0)setFieldStep(v=>v-1);else if(selectedId)setSelectedId('');else goBack();};
 if(preview&&selected)return <View style={sx.root}>
  <View style={sx.top}><MotionPressable onPress={goBackOne} style={sx.back} accessibilityRole="button" accessibilityLabel="Back to editing"><ArrowLeft size={19} color={theme.colors.teal}/></MotionPressable>
   <View style={{flex:1}}><Text style={sx.eyebrow}>FULL DOCUMENT PREVIEW</Text><Text style={sx.topTitle}>{selected.title}</Text></View>
  </View>
  <View style={sx.paper}><WebView originWhitelist={['*']} source={{html}} javaScriptEnabled={false} style={{flex:1,backgroundColor:'#FFFFFF'}} /></View>
  <View style={sx.bottom}>
   {!!error&&<Text style={sx.error}>{error}</Text>}
   <MotionPressable onPress={()=>void exportPdf()} disabled={working} style={[sx.primary,working&&{opacity:.6}]} accessibilityRole="button" accessibilityLabel="Save or share PDF">
    {working?<ActivityIndicator color="#FFFFFF"/>:<Printer size={18} color="#FFFFFF"/>}
    <Text style={sx.primaryText}>{working?'Preparing PDF…':'Save or share PDF'}</Text>
   </MotionPressable>
   <MotionPressable onPress={()=>setPreview(false)} style={sx.edit} accessibilityRole="button"><Text style={sx.editText}>Edit document</Text></MotionPressable>
   <Text style={sx.fine}>Preview only — nothing is sent or saved to your account.</Text>
  </View>
 </View>;
 return <View style={sx.root}><ScrollView style={{flex:1}} contentContainerStyle={[sx.content,{paddingBottom:120}]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
  <MotionPressable onPress={goBackOne} style={sx.backLabel} accessibilityRole="button" accessibilityLabel={selected?'Back to documents':'Back to tools'}>
   <ArrowLeft color={theme.colors.teal} size={19}/><Text style={sx.backText}>{selected?'Documents':'Tools'}</Text>
  </MotionPressable>
  <Text style={sx.eyebrow}>{role==='customer'?'CUSTOMER DOCUMENTS':'BUSINESS DOCUMENTS'}</Text>
  <Text style={sx.heading}>{selected?selected.title:'Create documents'}</Text>
  <Text style={sx.lead}>{selected?selected.intro:'Choose a document, fill in the sections and preview the A4 layout before export.'}</Text>
  {!selected?<View style={sx.tiles}>{available.map(template=><MotionPressable key={template.id} onPress={()=>open(template.id)}
   accessibilityRole="button" accessibilityLabel={'Create '+template.title} style={sx.tile}>
   <View style={sx.tileIcon}><FileText color={theme.colors.teal} size={22}/></View>
   <View style={{flex:1}}><Text style={sx.tileTitle}>{template.title}</Text><Text style={sx.tileSubtitle}>{template.subtitle}</Text></View>
   <ArrowRight size={18} color={theme.colors.teal}/>
  </MotionPressable>)}</View>:
  <View style={{gap:13}}>
   <FormFlowSteps labels={selected.groups.map(g=>g.title.length>20?g.title.split(' ')[0]:g.title)}
     active={fieldStep} onSelect={setFieldStep} subtitle="Focus on one group of details at a time. You can return to any previous step."/>
   {selected.groups.filter((_,i)=>i===fieldStep).map((group,i)=><View style={sx.group} key={group.title}>
    <View style={sx.groupHead}><Text style={sx.groupIndex}>{String(fieldStep+1).padStart(2,'0')}</Text><Text style={sx.groupTitle}>{group.title}</Text></View>
    {group.fields.map(field=><View style={sx.field} key={field.key}>
     <Text style={sx.fieldLabel}>{field.label}{field.required?' *':''}</Text>
     <TextInput style={[sx.input,field.multi&&sx.multi]} value={values[field.key]||''}
      onChangeText={v=>update(field.key,v)} placeholder={field.hint|| (field.date?'YYYY-MM-DD':'Enter details')}
      placeholderTextColor="#859a95" keyboardType="default" autoCapitalize={field.date?'none':'sentences'}
      multiline={!!field.multi} textAlignVertical={field.multi?'top':'center'} maxLength={field.multi?4000:500}/>
    </View>)}
   </View>)}
   {!!error&&<Text style={sx.error}>{error}</Text>}
   <Text style={sx.progressHelper}>Only the completed details appear in the final PDF. You can preview the document at any time.</Text>
  </View>}
  <View style={sx.notice}><ShieldCheck color={theme.colors.teal} size={18}/><Text style={sx.noticeText}>
   {selected?note(selected.id)+' ':''}These documents are general records and do not replace official certificates. No electronic signature is implied, and drafts are not automatically saved to your account.
  </Text></View>
 </ScrollView>
 {selected?<><FormFlowFooter active={fieldStep} total={selected.groups.length}
    onPrevious={()=>setFieldStep(v=>Math.max(0,v-1))}
    onNext={advance} primaryLabel={fieldStep===selected.groups.length-1?'Preview document':'Continue'}
    preview={()=>setPreview(true)}/>
   <FormFlowFloatingPreview onPress={()=>setPreview(true)} label="A4 preview"/>
  </>:null}
 </View>;
}
const sx=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.colors.proBackground},
 content:{paddingHorizontal:20,paddingTop:18,paddingBottom:110},
 progressHelper:{fontSize:11,lineHeight:17,color:theme.colors.muted,paddingHorizontal:4,marginVertical:8},
 top:{flexDirection:'row',alignItems:'center',gap:13,padding:17,backgroundColor:theme.colors.proBackground},
 back:{width:42,height:42,borderRadius:22,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 backLabel:{flexDirection:'row',gap:8,alignItems:'center',alignSelf:'flex-start',paddingVertical:9,marginBottom:16},
 backText:{fontFamily:theme.font.heading,color:theme.colors.teal,fontSize:13,fontWeight:'800'},
 eyebrow:{fontFamily:theme.font.heading,fontSize:10,letterSpacing:1.2,fontWeight:'800',color:theme.colors.teal},
 heading:{fontFamily:theme.font.heading,fontSize:31,fontWeight:'800',color:theme.colors.ink,letterSpacing:-.7,marginTop:6},
 topTitle:{fontFamily:theme.font.heading,fontSize:20,fontWeight:'800',color:theme.colors.ink,marginTop:3},
 lead:{fontFamily:theme.font.body,color:theme.colors.muted,fontSize:13,lineHeight:20,marginTop:10,marginBottom:22},
 tiles:{gap:12},
 tile:{flexDirection:'row',alignItems:'center',gap:13,minHeight:95,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:theme.colors.line,borderRadius:20,padding:15},
 tileIcon:{width:44,height:44,borderRadius:14,backgroundColor:theme.colors.tealTint,alignItems:'center',justifyContent:'center'},
 tileTitle:{fontFamily:theme.font.heading,color:theme.colors.ink,fontSize:14,fontWeight:'800'},
 tileSubtitle:{fontFamily:theme.font.body,color:theme.colors.muted,fontSize:12,lineHeight:18,marginTop:5},
 group:{backgroundColor:'#FFFFFF',padding:17,borderRadius:21,borderWidth:1,borderColor:theme.colors.line},
 groupHead:{flexDirection:'row',gap:9,alignItems:'center',marginBottom:20},
 groupIndex:{paddingHorizontal:10,paddingVertical:7,backgroundColor:theme.colors.tealTint,color:theme.colors.teal,borderRadius:9,fontSize:11,fontWeight:'800'},
 groupTitle:{fontFamily:theme.font.heading,color:theme.colors.ink,fontSize:17,fontWeight:'800'},
 field:{marginBottom:14},fieldLabel:{color:theme.colors.ink,fontSize:12,fontWeight:'700',marginBottom:8},
 input:{borderWidth:1,borderColor:'#dce7e1',backgroundColor:'#fafcfb',borderRadius:12,minHeight:47,paddingHorizontal:13,paddingVertical:10,
  fontFamily:theme.font.body,fontSize:14,color:theme.colors.ink},
 multi:{minHeight:95},error:{color:'#AB493B',fontSize:12,lineHeight:18,marginBottom:9},
 primary:{minHeight:55,backgroundColor:theme.colors.darkTeal,borderRadius:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingHorizontal:15},
 primaryText:{fontFamily:theme.font.heading,color:'#FFFFFF',fontSize:14,fontWeight:'800'},
 secondary:{minHeight:51,backgroundColor:theme.colors.tealTint,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:15},
 secondaryText:{fontFamily:theme.font.heading,color:theme.colors.teal,fontWeight:'800',fontSize:13},
 notice:{flexDirection:'row',gap:10,alignItems:'flex-start',borderRadius:15,backgroundColor:theme.colors.tealTint,padding:14,marginTop:23},
 noticeText:{flex:1,fontSize:11,lineHeight:17,color:theme.colors.muted},
 paper:{flex:1,marginHorizontal:13,backgroundColor:'#FFFFFF',borderRadius:15,overflow:'hidden',borderWidth:1,borderColor:theme.colors.line,...theme.shadow},
 bottom:{paddingHorizontal:18,paddingTop:13,paddingBottom:14,gap:8},
 edit:{padding:8,alignItems:'center'},editText:{color:theme.colors.teal,fontSize:13,fontWeight:'800'},
 fine:{fontSize:10,textAlign:'center',color:theme.colors.muted}
});
