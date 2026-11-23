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
   <Text style={s.caption}>STEP {active+1} OF {labels.length}</Text>
   <Text style={s.captionRight}>{Math.round((active+1)/labels.length*100)}% through</Text>
  </View>
  <View style={s.progress}>{labels.map((_,i)=><View key={i} style={[s.progressPart,i<=active&&s.progressPartOn]}/>)}</View>
  <View style={s.steps}>{labels.map((label,i)=><MotionPressable key={label} onPress={()=>onSelect(i)}
    accessibilityRole="button" accessibilityLabel={'Go to '+label}
    accessibilityState={{selected:active===i}}
    style={[s.step,active===i&&s.stepActive]}>
    <Text style={[s.stepName,active===i&&s.stepNameActive]} numberOfLines={1}>{label}</Text>
  </MotionPressable>)}</View>
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
 wrap:{padding:16,paddingBottom:11,borderRadius:21,backgroundColor:'#FFFFFF',borderColor:C.line,borderWidth:1,marginBottom:18},
 captionRow:{flexDirection:'row',justifyContent:'space-between',gap:10,marginBottom:12},
 caption:{color:C.teal,fontSize:10,fontWeight:'800',letterSpacing:1.2},
 captionRight:{color:C.muted,fontSize:10,fontWeight:'700'},
 progress:{flexDirection:'row',gap:5,marginBottom:14},
 progressPart:{flex:1,height:4,backgroundColor:'#E1E9E5',borderRadius:4},
 progressPartOn:{backgroundColor:C.teal},
 steps:{flexDirection:'row',gap:5},
 step:{flex:1,minWidth:0,minHeight:38,alignItems:'center',justifyContent:'center',paddingHorizontal:4,borderRadius:10},
 stepActive:{backgroundColor:C.tealTint},
 stepName:{color:C.muted,fontSize:11,fontWeight:'700'},
 stepNameActive:{color:C.teal,fontWeight:'800'},
 subtitle:{color:C.muted,fontSize:12,lineHeight:18,marginTop:10},
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
