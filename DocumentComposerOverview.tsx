import React,{useState} from 'react';
import {Modal,SafeAreaView,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {ChevronRight,Clock3,Eye,FileCheck2,Files,X} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Section={title:string;label:string;detail:string;done?:boolean};
const C=theme.colors;
/** Compact document entry overview. State and persistence remain in parent tools. */
export default function DocumentComposerOverview({title,description,sections,amount,onEdit,onPreview,onSave,
 saveLabel='Save',saving=false,renderWorkLibrary,renderSetups,children,note}:{
 title:string;description:string;sections:Section[];amount?:string;onEdit:(i:number)=>void;onPreview:()=>void;
 onSave?:()=>void;saveLabel?:string;saving?:boolean;
 renderWorkLibrary?:(close:()=>void)=>React.ReactNode;renderSetups?:(close:()=>void)=>React.ReactNode;
 children?:React.ReactNode;note?:string;
}){
 const [shortcut,setShortcut]=useState<'work'|'setups'|null>(null);
 const {width}=useWindowDimensions(),narrow=width<365;
 const done=sections.filter(x=>x.done).length;
 const missing=sections.findIndex(x=>!x.done),current=missing<0?sections.length-1:missing;
 const close=()=>setShortcut(null);
 return <View style={s.wrapper}>
  <View><Text style={s.title}>{title}</Text><Text style={s.description}>{description}</Text></View>
  <View style={s.stepsOuter} accessibilityLabel="Document sections">
   <View pointerEvents="none" style={s.track}/>
   <View style={s.steps}>{sections.map((section,i)=><MotionPressable key={section.title} style={s.step}
      onPress={()=>onEdit(i)} accessibilityRole="button" accessibilityLabel={'Edit '+section.title}
      accessibilityState={{selected:i===current}}>
      <View style={[s.circle,i===current&&s.circleActive]}>
       <Text style={[s.circleNumber,i===current&&s.circleNumberActive]}>{i+1}</Text>
      </View><Text numberOfLines={2} style={[s.stepLabel,i===current&&s.stepLabelActive]}>{section.title}</Text>
    </MotionPressable>)}</View>
  </View>
  {(renderWorkLibrary||renderSetups)&&<View style={s.shortcuts}>
   {renderWorkLibrary&&<MotionPressable style={[s.shortcut,renderSetups&&{flex:1}]}
      accessibilityRole="button" accessibilityLabel="Saved jobs" onPress={()=>setShortcut('work')}>
     <View style={s.shortcutIcon}><Clock3 color={C.teal} size={20}/></View>
     <View style={s.shortcutCopy}><Text style={s.shortcutTitle}>Saved jobs</Text>
      <Text style={s.shortcutSub}>Past prices</Text></View><ChevronRight color={C.teal} size={17}/>
    </MotionPressable>}
   {renderSetups&&<MotionPressable style={[s.shortcut,renderWorkLibrary&&{flex:1}]}
      accessibilityRole="button" accessibilityLabel="Saved document setups" onPress={()=>setShortcut('setups')}>
     <View style={s.shortcutIcon}><Files color={C.teal} size={20}/></View>
     <View style={s.shortcutCopy}><Text style={s.shortcutTitle}>Saved setups</Text>
      <Text style={s.shortcutSub}>Reuse fields</Text></View><ChevronRight color={C.teal} size={17}/>
    </MotionPressable>}
  </View>}
  {children}
  <View style={s.card}>
   {sections.map((section,i)=><MotionPressable key={section.title} onPress={()=>onEdit(i)}
       accessibilityRole="button" accessibilityLabel={'Edit '+section.title}
       style={[s.row,i>0&&s.rowLine]}>
     <View style={[s.number,section.done&&s.numberDone]}>
      <Text style={[s.numberText,section.done&&s.numberTextDone]}>{i+1}</Text></View>
     <View style={s.rowCopy}><Text style={s.rowTitle}>{section.title}</Text>
      <Text style={s.rowDetail} numberOfLines={2}>{section.detail}</Text>
      {!!section.label&&<Text style={s.rowValue} numberOfLines={1}>{section.label}</Text>}
     </View><ChevronRight color={C.teal} size={19}/>
    </MotionPressable>)}
  </View>
  <View style={[s.summary,narrow&&s.summaryNarrow]}>
   <View style={s.summaryText}><Text style={s.totalLabel}>{amount?'DOCUMENT TOTAL':'SECTIONS COMPLETE'}</Text>
    <Text style={s.totalValue} numberOfLines={1} adjustsFontSizeToFit>{amount||(done+' of '+sections.length)}</Text></View>
   {!narrow&&<View style={s.divider}/>}
   <View style={s.buttons}>
    <MotionPressable onPress={onPreview} style={s.preview} accessibilityRole="button" accessibilityLabel="Preview document">
     <Eye color={C.teal} size={17}/><Text style={s.previewText}>Preview</Text>
    </MotionPressable>
    {onSave&&<MotionPressable onPress={onSave} disabled={saving} style={[s.save,saving&&{opacity:.5}]}
       accessibilityRole="button" accessibilityLabel={saveLabel} accessibilityState={{disabled:saving}}>
      <FileCheck2 color="#FFFFFF" size={17}/><Text style={s.saveText}>{saving?'Saving…':saveLabel}</Text>
     </MotionPressable>}
   </View>
  </View>
  <Text style={s.note}>{note||'Tap any section to edit. Nothing is sent automatically.'}</Text>
  <Modal visible={shortcut!==null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
   <SafeAreaView style={s.sheet}>
    <View style={s.sheetHead}><View style={{flex:1}}><Text style={s.sheetEyebrow}>DOCUMENT SHORTCUTS</Text>
     <Text style={s.sheetTitle}>{shortcut==='work'?'Saved jobs & prices':'Saved document setups'}</Text></View>
     <MotionPressable onPress={close} style={s.close} accessibilityRole="button" accessibilityLabel="Close shortcuts">
      <X size={22} color={C.ink}/></MotionPressable>
    </View>
    <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
     {shortcut==='work'?renderWorkLibrary?.(close):shortcut==='setups'?renderSetups?.(close):null}
     <Text style={s.sheetNote}>Copied information remains fully editable in this document.</Text>
    </ScrollView>
   </SafeAreaView>
  </Modal>
 </View>;
}
const s=StyleSheet.create({
 wrapper:{gap:14,paddingBottom:12},
 title:{fontSize:23,fontWeight:'800',color:C.ink,letterSpacing:-.4},
 description:{fontSize:12,color:C.muted,lineHeight:18,marginTop:5},
 stepsOuter:{position:'relative',marginTop:3},
 track:{position:'absolute',left:'12.5%',right:'12.5%',top:14,height:2,backgroundColor:'#C7D9D3'},
 steps:{flexDirection:'row'},step:{flex:1,minWidth:0,alignItems:'center',gap:7,paddingHorizontal:3},
 circle:{width:29,height:29,borderRadius:15,borderWidth:1,borderColor:'#D3E0DA',
  backgroundColor:'#ECF3F0',alignItems:'center',justifyContent:'center'},
 circleActive:{backgroundColor:C.darkTeal,borderColor:C.darkTeal},
 circleNumber:{fontSize:13,fontWeight:'800',color:C.muted},circleNumberActive:{color:'#FFFFFF'},
 stepLabel:{fontSize:10.5,fontWeight:'700',color:C.muted,textAlign:'center',lineHeight:14,minHeight:29},
 stepLabelActive:{fontWeight:'800',color:C.teal},
 shortcuts:{flexDirection:'row',gap:9},
 shortcut:{minWidth:0,minHeight:77,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:9,paddingVertical:10,
  backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,borderRadius:17},
 shortcutIcon:{width:31,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:C.tealTint},
 shortcutCopy:{flex:1,minWidth:0,gap:3},shortcutTitle:{fontSize:11.5,fontWeight:'800',color:C.ink,lineHeight:15},
 shortcutSub:{fontSize:10,color:C.muted},
 card:{borderWidth:1,borderColor:C.line,borderRadius:19,backgroundColor:'#FFFFFF',overflow:'hidden'},
 row:{minHeight:69,paddingHorizontal:15,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:13},
 rowLine:{borderTopWidth:1,borderTopColor:C.line},
 number:{width:37,height:37,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#EFF3F0'},
 numberDone:{backgroundColor:C.tealTint},numberText:{fontSize:14,fontWeight:'800',color:C.muted},
 numberTextDone:{color:C.teal},
 rowCopy:{flex:1,minWidth:0},rowTitle:{fontSize:14,fontWeight:'800',color:C.ink,lineHeight:18},
 rowDetail:{fontSize:11,color:C.muted,lineHeight:16,marginTop:3},
 rowValue:{fontSize:10.5,color:C.teal,marginTop:4},
 summary:{minHeight:70,flexDirection:'row',alignItems:'center',gap:10,padding:12,
  backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,borderRadius:18},
 summaryNarrow:{flexDirection:'column',alignItems:'stretch'},
 summaryText:{flex:1,minWidth:75,gap:4},totalLabel:{fontSize:9,fontWeight:'800',letterSpacing:1,color:C.muted},
 totalValue:{fontSize:20,fontWeight:'800',color:C.teal},
 divider:{height:38,width:1,backgroundColor:C.line},
 buttons:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6},
 preview:{borderWidth:1,borderColor:'#A6CEC4',borderRadius:24,minHeight:39,paddingHorizontal:11,
  flexDirection:'row',alignItems:'center',gap:5},
 previewText:{fontSize:12,fontWeight:'800',color:C.teal},
 save:{minHeight:39,borderRadius:24,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.darkTeal},
 saveText:{color:'#FFFFFF',fontSize:12,fontWeight:'800'},
 note:{fontSize:10.5,color:C.muted,lineHeight:16,textAlign:'center',paddingHorizontal:4,marginTop:-5},
 sheet:{flex:1,backgroundColor:C.proBackground},
 sheetHead:{flexDirection:'row',alignItems:'center',gap:12,padding:18,paddingBottom:13,borderBottomWidth:1,borderBottomColor:C.line},
 sheetEyebrow:{fontSize:10,color:C.teal,fontWeight:'800',letterSpacing:1.2},
 sheetTitle:{fontSize:20,fontWeight:'800',color:C.ink,marginTop:5},
 close:{height:40,width:40,borderRadius:20,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
 sheetBody:{paddingHorizontal:17,paddingTop:11,paddingBottom:40},
 sheetNote:{fontSize:11,color:C.muted,lineHeight:17,padding:12}
});