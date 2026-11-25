import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {ArrowLeft,ArrowRight,Eye} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

const C=theme.colors;
/** Shared navigation shell for Trade documents. UI only: business calculations and saving stay in their original screens. */
export function FormFlowSteps({labels,active,onSelect,subtitle}:{
 labels:string[];active:number;onSelect:(index:number)=>void;subtitle?:string;
}){
 return <View style={s.wrap}>
  <View style={s.captionRow}>
   <Text style={s.caption}>SECTION {active+1} OF {labels.length}</Text>
   <Text style={s.captionRight}>Tap a section to edit</Text>
  </View>
  <View style={s.timeline}>
   <View pointerEvents="none" style={s.timelineLine}/>
   <View style={s.steps}>{labels.map((label,i)=><MotionPressable key={i} onPress={()=>onSelect(i)}
    accessibilityRole="button" accessibilityLabel={'Go to '+label}
    accessibilityState={{selected:active===i}} style={s.step}>
    <View style={[s.stepCircle,active===i&&s.stepCircleActive]}>
     <Text style={[s.stepNumber,active===i&&s.stepNumberActive]}>{i+1}</Text>
    </View>
    <Text style={[s.stepName,active===i&&s.stepNameActive]} numberOfLines={2}>{label}</Text>
   </MotionPressable>)}</View>
  </View>
  {subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}
 </View>;
}
export function FormFlowFooter({active,total,onPrevious,onNext,primaryLabel,nextDisabled=false,amount,preview}:{
 active:number;total:number;onPrevious:()=>void;onNext:()=>void;primaryLabel:string;
 nextDisabled?:boolean;amount?:string;preview?:()=>void;
}){
 return <View style={s.footer}>
  {amount?<View style={s.footerTotal}><Text style={s.totalLabel}>RUNNING TOTAL</Text><Text style={s.totalAmount}>{amount}</Text></View>:null}
  <View style={s.actions}>
   {active>0?<MotionPressable onPress={onPrevious} style={s.back}
       accessibilityRole="button" accessibilityLabel="Previous step">
     <ArrowLeft color={C.teal} size={19}/><Text style={s.backText}>Back</Text>
    </MotionPressable>:null}
   <MotionPressable onPress={onNext} disabled={nextDisabled}
     style={[s.next,nextDisabled&&{opacity:.55}]} accessibilityRole="button" accessibilityLabel={primaryLabel}>
    <Text style={s.nextText}>{primaryLabel}</Text><ArrowRight color="#FFFFFF" size={18}/>
   </MotionPressable>
  </View>
  {preview?<MotionPressable style={s.previewInline} onPress={preview}
    accessibilityRole="button" accessibilityLabel="Preview document">
    <Eye size={17} color={C.teal}/><Text style={s.previewInlineText}>Preview document</Text>
   </MotionPressable>:null}
 </View>;
}
export function FormFlowFloatingPreview({onPress,label='Preview'}:{onPress:()=>void;label?:string}){
 return <MotionPressable onPress={onPress} style={s.floating} accessibilityRole="button"
   accessibilityLabel={'Open '+label.toLowerCase()}>
   <Eye size={18} color={C.teal}/><Text style={s.floatingText}>{label}</Text>
 </MotionPressable>;
}
const s=StyleSheet.create({
 wrap:{padding:14,paddingBottom:12,borderRadius:18,backgroundColor:'#FFFFFF',borderColor:C.line,borderWidth:1,marginBottom:16},
 captionRow:{flexDirection:'row',justifyContent:'space-between',gap:10,marginBottom:12},
 caption:{color:C.teal,fontSize:10,fontWeight:'800',letterSpacing:1.1},
 captionRight:{color:C.muted,fontSize:10,fontWeight:'700'},
 timeline:{position:'relative'},
 timelineLine:{position:'absolute',height:2,left:'12.5%',right:'12.5%',top:14,backgroundColor:'#C7D9D3'},
 steps:{flexDirection:'row'},
 step:{flex:1,minWidth:0,alignItems:'center',gap:7,paddingHorizontal:3},
 stepCircle:{height:29,width:29,borderRadius:15,backgroundColor:'#ECF3F0',borderWidth:1,borderColor:'#D3E0DA',alignItems:'center',justifyContent:'center'},
 stepCircleActive:{backgroundColor:C.darkTeal,borderColor:C.darkTeal},
 stepNumber:{fontSize:13,fontWeight:'800',color:C.muted},
 stepNumberActive:{color:'#FFFFFF'},
 stepName:{fontSize:10.5,fontWeight:'700',lineHeight:14,color:C.muted,textAlign:'center',minHeight:27},
 stepNameActive:{color:C.teal,fontWeight:'800'},
 subtitle:{color:C.muted,fontSize:11.5,lineHeight:17,marginTop:10},
 footer:{paddingHorizontal:18,paddingTop:11,paddingBottom:13,borderTopWidth:1,borderTopColor:C.line,backgroundColor:'#FFFFFF'},
 footerTotal:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginBottom:9},
 totalLabel:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:.7},
 totalAmount:{color:C.teal,fontSize:20,fontWeight:'800'},
 actions:{flexDirection:'row',gap:10,alignItems:'center'},
 back:{minHeight:49,minWidth:90,paddingHorizontal:17,backgroundColor:C.tealTint,borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 backText:{color:C.teal,fontSize:13,fontWeight:'800'},
 next:{flex:1,minHeight:49,paddingHorizontal:15,backgroundColor:C.darkTeal,borderRadius:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 nextText:{color:'#FFFFFF',fontWeight:'800',fontSize:14},
 previewInline:{flexDirection:'row',alignItems:'center',alignSelf:'center',gap:7,padding:8,marginTop:5},
 previewInlineText:{fontSize:12,fontWeight:'800',color:C.teal},
 floating:{position:'absolute',right:19,bottom:112,zIndex:30,minHeight:43,paddingHorizontal:16,gap:8,alignItems:'center',justifyContent:'center',flexDirection:'row',
  backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#A8CEC5',borderRadius:23,elevation:5,
  shadowColor:'#193A37',shadowOpacity:.12,shadowRadius:10,shadowOffset:{width:0,height:5}},
 floatingText:{fontSize:12,color:C.teal,fontWeight:'800'}
});
