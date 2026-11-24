import React,{useState} from 'react';
import {Modal,SafeAreaView,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {ChevronRight,Clock3,Eye,FileCheck2,Files,X} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Section={title:string;detail:string;label:string;done?:boolean};
type Props={
 title:string;description:string;sections:Section[];amount:string;
 onEdit:(index:number)=>void;onPreview:()=>void;onSave:()=>void;saving?:boolean;
 renderWorkLibrary:(close:()=>void)=>React.ReactNode;
 renderInvoiceSetups:(close:()=>void)=>React.ReactNode;
};

/** Invoice-only layout, deliberately separate from the quote and report composer.
 * Keeps the original invoice data, validation and saving flows unchanged.
 */
export default function InvoiceComposerOverview({
 title,description,sections,amount,onEdit,onPreview,onSave,saving=false,renderWorkLibrary,renderInvoiceSetups
}:Props){
 const [sheet,setSheet]=useState<'work'|'setups'|null>(null);
 const {width}=useWindowDimensions();
 const narrow=width<365;
 const firstIncomplete=sections.findIndex(section=>!section.done);
 const currentStep=firstIncomplete<0?sections.length-1:firstIncomplete;
 const close=()=>setSheet(null);
 return <View style={s.wrap}>
  <View style={s.intro}>
   <Text style={s.heading}>{title}</Text>
   <Text style={s.description}>{description}</Text>
  </View>

  <View style={s.stepsOuter} accessibilityLabel="Invoice sections">
   <View pointerEvents="none" style={s.progressTrack}/>
   <View style={s.steps}>
    {sections.map((section,index)=><MotionPressable key={section.title} style={s.step}
     onPress={()=>onEdit(index)} accessibilityRole="button"
     accessibilityLabel={'Open '+section.title} accessibilityState={{selected:currentStep===index}}>
     <View style={[s.stepCircle,index===currentStep&&s.stepCircleOn]}>
      <Text style={[s.stepNumber,index===currentStep&&s.stepNumberOn]}>{index+1}</Text>
     </View>
     <Text style={[s.stepText,index===currentStep&&s.stepTextOn]} numberOfLines={2}>
      {section.title}
     </Text>
    </MotionPressable>)}
   </View>
  </View>

  <View style={s.quickRow}>
   <MotionPressable onPress={()=>setSheet('work')} style={s.quickCard} accessibilityRole="button"
    accessibilityLabel="Saved jobs and previous prices">
    <View style={s.quickIcon}><Clock3 color={C.teal} size={20}/></View>
    <View style={s.quickCopy}>
     <Text style={s.quickTitle}>Saved jobs</Text>
     <Text style={s.quickSub}>Past prices</Text>
    </View>
    <ChevronRight color={C.teal} size={17}/>
   </MotionPressable>
   <MotionPressable onPress={()=>setSheet('setups')} style={s.quickCard} accessibilityRole="button"
    accessibilityLabel="Saved invoice templates">
    <View style={s.quickIcon}><Files color={C.teal} size={20}/></View>
    <View style={s.quickCopy}>
     <Text style={s.quickTitle}>Invoice templates</Text>
     <Text style={s.quickSub}>Reuse fields</Text>
    </View>
    <ChevronRight color={C.teal} size={17}/>
   </MotionPressable>
  </View>

  <View style={s.sectionsCard}>
   {sections.map((section,index)=><MotionPressable
     key={section.title} onPress={()=>onEdit(index)} style={[s.sectionRow,index>0&&s.sectionDivider]}
     accessibilityRole="button" accessibilityLabel={'Edit '+section.title}>
    <View style={[s.sectionNumber,section.done&&s.sectionNumberDone]}>
     <Text style={[s.sectionNumberText,section.done&&s.sectionNumberTextDone]}>{index+1}</Text>
    </View>
    <View style={s.sectionCopy}>
     <Text style={s.sectionTitle}>{section.title}</Text>
     <Text style={s.sectionDetail} numberOfLines={2}>{section.detail}</Text>
     <Text style={s.sectionValue} numberOfLines={1}>{section.label}</Text>
    </View>
    <ChevronRight color={C.teal} size={19}/>
   </MotionPressable>)}
  </View>

  <View style={[s.totalCard,narrow&&s.totalCardNarrow]}>
   <View style={s.totalAmount}>
    <Text style={s.totalLabel}>DOCUMENT TOTAL</Text>
    <Text style={s.totalValue} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text>
   </View>
   {!narrow&&<View style={s.verticalDivider}/>}
   <View style={[s.totalButtons,narrow&&s.totalButtonsNarrow]}>
    <MotionPressable onPress={onPreview} style={s.secondaryButton}
     accessibilityRole="button" accessibilityLabel="Preview invoice">
     <Eye size={17} color={C.teal}/>
     <Text style={s.secondaryText}>Preview</Text>
    </MotionPressable>
    <MotionPressable onPress={onSave} disabled={saving} style={[s.primaryButton,saving&&s.buttonDisabled]}
     accessibilityRole="button" accessibilityLabel={saving?'Saving invoice':'Save invoice'}
     accessibilityState={{disabled:saving}}>
     <FileCheck2 color="#FFFFFF" size={17}/>
     <Text style={s.primaryText}>{saving?'Saving…':'Save'}</Text>
    </MotionPressable>
   </View>
  </View>
  <Text style={s.note}>Tap any section to change it. Saved prices are suggestions, not fixed charges.</Text>

  <Modal visible={sheet!==null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
   <SafeAreaView style={s.sheet}>
    <View style={s.sheetHeader}>
     <View style={{flex:1}}>
      <Text style={s.sheetEyebrow}>INVOICE SHORTCUTS</Text>
      <Text style={s.sheetTitle}>{sheet==='work'?'Saved work & prices':'Saved invoice setups'}</Text>
     </View>
     <MotionPressable onPress={close} accessibilityRole="button" accessibilityLabel="Close saved invoice shortcuts"
      style={s.closeButton}><X size={22} color={C.ink}/></MotionPressable>
    </View>
    <ScrollView contentContainerStyle={s.sheetScroll} keyboardShouldPersistTaps="handled"
     showsVerticalScrollIndicator={false}>
     {sheet==='work'?renderWorkLibrary(close):sheet==='setups'?renderInvoiceSetups(close):null}
     <Text style={s.sheetNote}>Changes are copied into your current draft. Nothing is sent to the customer.</Text>
    </ScrollView>
   </SafeAreaView>
  </Modal>
 </View>;
}
const C=theme.colors;
const s=StyleSheet.create({
 wrap:{gap:14,paddingBottom:12},
 intro:{paddingTop:2},
 heading:{fontSize:23,fontWeight:'800',color:C.ink,letterSpacing:-.55},
 description:{color:C.muted,fontSize:12,lineHeight:18,marginTop:5},
 stepsOuter:{position:'relative',marginTop:3,marginBottom:1},
 progressTrack:{position:'absolute',left:'12.5%',right:'12.5%',top:14,height:2,backgroundColor:'#C7D9D3'},
 steps:{flexDirection:'row'},
 step:{flex:1,minWidth:0,alignItems:'center',justifyContent:'flex-start',gap:7,paddingHorizontal:3},
 stepCircle:{width:29,height:29,backgroundColor:'#ECF3F0',borderRadius:16,
  borderWidth:1,borderColor:'#D3E0DA',alignItems:'center',justifyContent:'center'},
 stepCircleOn:{backgroundColor:C.darkTeal,borderColor:C.darkTeal},
 stepNumber:{fontSize:13,fontWeight:'800',color:C.muted},
 stepNumberOn:{color:'#FFFFFF'},
 stepText:{fontSize:10.5,color:C.muted,fontWeight:'700',lineHeight:14,textAlign:'center',minHeight:29},
 stepTextOn:{color:C.teal,fontWeight:'800'},
 quickRow:{flexDirection:'row',gap:8,marginTop:0},
 quickCard:{flex:1,minWidth:0,minHeight:77,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:8,paddingVertical:9,
  borderRadius:17,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line},
 quickIcon:{width:31,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:C.tealTint},
 quickCopy:{flex:1,minWidth:0,gap:4},
 quickTitle:{fontSize:11.5,fontWeight:'800',lineHeight:15,color:C.ink,flexShrink:1},
 quickSub:{fontSize:10,color:C.muted,marginTop:1},
 sectionsCard:{borderRadius:19,borderWidth:1,borderColor:C.line,backgroundColor:'#FFFFFF',overflow:'hidden'},
 sectionRow:{flexDirection:'row',gap:13,alignItems:'center',paddingHorizontal:15,paddingVertical:11,minHeight:69},
 sectionDivider:{borderTopWidth:1,borderTopColor:C.line},
 sectionNumber:{width:37,height:37,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#EFF3F0'},
 sectionNumberDone:{backgroundColor:C.tealTint},
 sectionNumberText:{fontSize:14,fontWeight:'800',color:C.muted},
 sectionNumberTextDone:{color:C.teal},
 sectionCopy:{flex:1,minWidth:0},
 sectionTitle:{fontSize:14,fontWeight:'800',color:C.ink,lineHeight:18},
 sectionDetail:{fontSize:11,color:C.muted,lineHeight:16,marginTop:3},
 sectionValue:{fontSize:10.5,color:C.teal,marginTop:4},
 totalCard:{flexDirection:'row',alignItems:'center',borderRadius:18,padding:12,minHeight:70,
  backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,gap:10},
 totalCardNarrow:{alignItems:'stretch',flexDirection:'column'},
 totalAmount:{flex:1,minWidth:75,gap:4},
 totalLabel:{fontSize:9,fontWeight:'800',letterSpacing:1.1,color:C.muted},
 totalValue:{fontSize:21,fontWeight:'800',color:C.teal},
 verticalDivider:{width:1,height:39,backgroundColor:C.line},
 totalButtons:{flexDirection:'row',alignItems:'center',gap:6},
 buttonDisabled:{opacity:.55},
 totalButtonsNarrow:{justifyContent:'flex-end'},
 secondaryButton:{minHeight:39,borderRadius:24,borderWidth:1,borderColor:'#A6CEC4',
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:10},
 secondaryText:{color:C.teal,fontSize:11.5,fontWeight:'800'},
 primaryButton:{minHeight:39,borderRadius:24,backgroundColor:C.darkTeal,
  flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:12},
 primaryText:{fontWeight:'800',fontSize:12,color:'#FFFFFF'},
 note:{fontSize:10.5,lineHeight:16,color:C.muted,textAlign:'center',paddingHorizontal:3,marginTop:-5},
 sheet:{flex:1,backgroundColor:C.proBackground},
 sheetHeader:{flexDirection:'row',alignItems:'center',padding:18,paddingBottom:13,gap:12,
  borderBottomWidth:1,borderBottomColor:C.line},
 sheetEyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:'800',color:C.teal},
 sheetTitle:{fontSize:21,fontWeight:'800',color:C.ink,marginTop:5},
 closeButton:{height:40,width:40,borderRadius:20,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 sheetScroll:{paddingHorizontal:17,paddingTop:10,paddingBottom:40},
 sheetNote:{fontSize:11,lineHeight:17,color:C.muted,padding:12}
});