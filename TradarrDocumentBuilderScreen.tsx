import React, {useMemo,useState} from 'react';
import {Alert,ScrollView,Text,TextInput,View,StyleSheet} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {ArrowLeft,ArrowRight,ClipboardCheck,FileText,Printer,ShieldCheck} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Role='tradesperson'|'customer';
type Field={key:string;label:string;multi?:boolean};
type Template={id:string;title:string;subtitle:string;fields:Field[]};
const base:Field[]=[{key:'title',label:'Job / document title'},{key:'address',label:'Property or site address'},{key:'date',label:'Date'}];
const f=(key:string,label:string,multi=false):Field=>({key,label,multi});
const templates:Record<Role,Template[]>={
 tradesperson:[
  {id:'job',title:'Job sheet',subtitle:'Work requested, labour, materials and next steps',fields:[...base,f('customer','Customer name'),f('scope','Work requested',true),f('materials','Materials and parts used',true),f('hours','Time on site'),f('notes','Site notes and next steps',true)]},
  {id:'inspection',title:'Inspection report',subtitle:'Observed conditions and recommended repairs',fields:[...base,f('customer','Customer name'),f('area','Area or equipment inspected'),f('findings','Observed findings',true),f('photos','Photograph references',true),f('recommendations','Recommendations',true)]},
  {id:'completion',title:'Completion report',subtitle:'Record finished work and handover notes',fields:[...base,f('customer','Customer name'),f('completed','Work completed',true),f('testing','Checks and tests undertaken',true),f('outstanding','Outstanding items or exclusions',true),f('aftercare','Aftercare advice',true)]},
  {id:'variation',title:'Extra work order',subtitle:'Set out additional scope and customer approval',fields:[...base,f('customer','Customer name'),f('original','Original agreed work',true),f('change','Extra work proposed',true),f('reason','Reason for change',true),f('cost','Additional price (£)'),f('timing','Effect on completion time'),f('approval','Approval status (pending / approved)')]}
 ],
 customer:[
  {id:'brief',title:'Job request brief',subtitle:'Make it easier for a tradesperson to quote',fields:[...base,f('problem','Description of the work needed',true),f('urgency','Urgency / preferred timing'),f('access','Access details',true),f('photos','Photo references and other notes',true)]},
  {id:'snagging',title:'Snagging report',subtitle:'Keep track of issues needing attention',fields:[...base,f('issues','Items needing inspection or correction',true),f('photos','Photograph references',true),f('priority','Priority'),f('resolution','Requested remedy and follow-up',true)]},
  {id:'condition',title:'Property condition report',subtitle:'Record existing conditions before a job',fields:[...base,f('condition','Current condition and visible damage',true),f('photos','Photograph references',true),f('protection','Areas needing protection',true),f('comments','Additional observations',true)]}
 ]
};
const escapeHtml=(text:string)=>String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const defaultDate=()=>new Date().toLocaleDateString('en-GB');
export default function TradarrDocumentBuilderScreen({role,goBack}:{role:Role;goBack:()=>void}){
 const [selection,setSelection]=useState('');
 const [values,setValues]=useState<Record<string,string>>({date:defaultDate()});
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const available=templates[role];
 const selected=useMemo(()=>available.find(t=>t.id===selection),[available,selection]);
 const open=(id:string)=>{setSelection(id);setValues({date:defaultDate()});setError('');};
 const exportPdf=async()=>{
  if(!selected||working)return;
  if(!values.title?.trim()||!values.address?.trim()){setError('Add a document title and property address first.');return;}
  setError('');setWorking(true);
  try{
   const rows=selected.fields.map(field=>'<section><h3>'+escapeHtml(field.label)+'</h3><p>'+escapeHtml(values[field.key]||'Not provided').replace(/\n/g,'<br>')+'</p></section>').join('');
   const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>@page{size:A4;margin:18mm}body{font:14px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#183437;margin:0}'+
    'header{display:flex;justify-content:space-between;border-bottom:2px solid #245758;padding-bottom:17px}header strong{color:#245758;letter-spacing:2px}'+
    'h1{font-size:26px;margin:24px 0 8px}h3{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#52716c;margin:0 0 6px}'+
    'section{padding:12px 0;border-bottom:1px solid #e1e9e6;break-inside:avoid}p{white-space:normal;line-height:1.5;margin:0;overflow-wrap:anywhere}'+
    'footer{font-size:10px;color:#667d77;margin-top:28px;line-height:1.5}</style></head><body>'+
    '<header><strong>TRADARR</strong><span>'+escapeHtml(values.date||defaultDate())+'</span></header>'+
    '<h1>'+escapeHtml(selected.title)+'</h1><p>Work and property record</p>'+rows+
    '<footer>Prepared using Tradarr. Verify details before sharing. This is a general record, not a statutory safety certificate or proof of regulatory compliance.</footer>'+
    '</body></html>';
   const result=await Print.printToFileAsync({html});
   if(await Sharing.isAvailableAsync())await Sharing.shareAsync(result.uri,{mimeType:'application/pdf',dialogTitle:'Share Tradarr document'});
   else Alert.alert('PDF created','This device does not support the share sheet. Please use the device print or share options when available.');
  }catch(e:any){Alert.alert('Could not export PDF',e?.message||'Please try again.');}
  finally{setWorking(false);}
 };
 return <ScrollView style={sx.page} contentContainerStyle={sx.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   <MotionPressable onPress={()=>selected?setSelection(''):goBack()} style={sx.back} accessibilityRole="button" accessibilityLabel={selected?'Back to document templates':'Back to tools'}>
    <ArrowLeft size={19} color={theme.colors.teal}/><Text style={sx.backText}>{selected?'Templates':'Tools'}</Text>
   </MotionPressable>
   <Text style={sx.eyebrow}>{role==='customer'?'CUSTOMER DOCUMENTS':'TRADARR BUSINESS DOCUMENTS'}</Text>
   <Text style={sx.heading}>{selected?selected.title:'Create documents'}</Text>
   <Text style={sx.lead}>{selected?'Complete the details below, then review and export.':'Choose the document you need. Each template creates an editable professional PDF.'}</Text>
   {!selected?<View style={sx.tiles}>{available.map(item=>
    <MotionPressable key={item.id} onPress={()=>open(item.id)} style={sx.tile} accessibilityRole="button" accessibilityLabel={'Create '+item.title}>
     <View style={sx.icon}><FileText size={23} color={theme.colors.teal}/></View>
     <View style={{flex:1}}><Text style={sx.tileTitle}>{item.title}</Text><Text style={sx.tileNote}>{item.subtitle}</Text></View>
     <ArrowRight size={18} color={theme.colors.teal}/>
    </MotionPressable>)}</View>:<>
    <View style={sx.card}>
     <Text style={sx.cardHeading}>Document details</Text>
     {selected.fields.map(field=><View key={field.key} style={sx.field}>
      <Text style={sx.label}>{field.label}{['title','address'].includes(field.key)?' *':''}</Text>
      <TextInput accessibilityLabel={field.label} value={values[field.key]||''}
       onChangeText={text=>setValues(v=>({...v,[field.key]:text}))}
       multiline={!!field.multi} textAlignVertical={field.multi?'top':'center'}
       placeholder={'Enter '+field.label.toLowerCase()} placeholderTextColor="#84928E"
       maxLength={field.multi?2500:250} style={[sx.input,field.multi&&sx.multiline]}/>
     </View>)}
     {!!error&&<Text style={sx.error}>{error}</Text>}
    </View>
    <View style={sx.card}>
     <View style={sx.previewTop}><ClipboardCheck size={19} color={theme.colors.teal}/><Text style={sx.cardHeading}>Document preview</Text></View>
     <Text style={sx.previewTitle}>{selected.title}</Text>
     {selected.fields.map(field=><View key={field.key} style={sx.previewField}>
      <Text style={sx.previewLabel}>{field.label}</Text>
      <Text style={sx.previewValue}>{values[field.key]?.trim()||'Not provided'}</Text>
     </View>)}
    </View>
    <MotionPressable onPress={()=>void exportPdf()} disabled={working} accessibilityRole="button"
      accessibilityLabel="Export document as PDF" style={[sx.export,working&&{opacity:.55}]}>
      <Printer size={20} color="#FFFFFF"/><Text style={sx.exportText}>{working?'Preparing PDF…':'Create and share PDF'}</Text>
    </MotionPressable>
   </>}
   <View style={sx.notice}><ShieldCheck size={19} color={theme.colors.teal}/><Text style={sx.noticeText}>Review each document before use. Drafts are not saved to your account; use the share sheet to keep your PDF. These templates do not replace regulated certificates.</Text></View>
 </ScrollView>;
}
const sx=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.colors.proBackground},
 content:{paddingHorizontal:20,paddingTop:21,paddingBottom:110},
 back:{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start',paddingVertical:9,marginBottom:16},
 backText:{fontFamily:theme.font.heading,fontSize:13,fontWeight:'800',color:theme.colors.teal},
 eyebrow:{fontFamily:theme.font.heading,fontSize:10,fontWeight:'800',letterSpacing:1.4,color:theme.colors.teal,marginBottom:6},
 heading:{fontFamily:theme.font.heading,fontSize:33,fontWeight:'800',letterSpacing:-.8,color:theme.colors.ink},
 lead:{fontFamily:theme.font.body,fontSize:13,lineHeight:20,color:theme.colors.muted,marginTop:8,marginBottom:20},
 tiles:{gap:11},
 tile:{flexDirection:'row',alignItems:'center',gap:13,minHeight:98,padding:16,backgroundColor:'#FFFFFF',
   borderRadius:20,borderWidth:1,borderColor:theme.colors.line},
 icon:{height:45,width:45,alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:theme.colors.tealTint},
 tileTitle:{fontFamily:theme.font.heading,fontSize:15,fontWeight:'800',color:theme.colors.ink},
 tileNote:{fontSize:12,lineHeight:18,color:theme.colors.muted,marginTop:4},
 card:{backgroundColor:'#FFFFFF',borderColor:theme.colors.line,borderWidth:1,borderRadius:23,padding:17,marginBottom:14},
 cardHeading:{fontFamily:theme.font.heading,fontWeight:'800',fontSize:17,color:theme.colors.ink,marginBottom:12},
 field:{marginBottom:15},
 label:{fontFamily:theme.font.heading,fontWeight:'700',fontSize:12,color:theme.colors.ink,marginBottom:7},
 input:{borderWidth:1,borderColor:'#DAE5DF',backgroundColor:'#FAFCFA',borderRadius:12,
  color:theme.colors.ink,fontFamily:theme.font.body,fontSize:15,minHeight:47,paddingHorizontal:13,paddingVertical:10},
 multiline:{height:94,minHeight:94},
 previewTop:{flexDirection:'row',alignItems:'center',gap:9},
 previewTitle:{fontFamily:theme.font.heading,fontSize:23,fontWeight:'800',color:theme.colors.ink,marginBottom:15},
 previewField:{paddingVertical:11,borderTopWidth:1,borderTopColor:theme.colors.line},
 previewLabel:{textTransform:'uppercase',fontSize:10,fontWeight:'800',color:theme.colors.teal,letterSpacing:.8,marginBottom:5},
 previewValue:{fontSize:13,lineHeight:20,color:theme.colors.ink},
 export:{minHeight:53,borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:theme.colors.darkTeal,marginBottom:16},
 exportText:{fontFamily:theme.font.heading,color:'#FFFFFF',fontWeight:'800',fontSize:14},
 error:{fontSize:12,color:'#A54439',lineHeight:19,marginBottom:8},
 notice:{flexDirection:'row',gap:11,marginTop:10,padding:14,borderRadius:15,backgroundColor:'#E8F0EC',alignItems:'flex-start'},
 noticeText:{flex:1,fontSize:11,lineHeight:17,color:theme.colors.muted}
});
