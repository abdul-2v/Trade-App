import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {ArrowRight,ChevronRight,Eye,FileCheck2} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

type Section={title:string;label:string;detail:string;done?:boolean};
const C=theme.colors;
export default function DocumentComposerOverview({title,description,sections,amount,onEdit,onPreview,children}:{
 title:string;description:string;sections:Section[];amount?:string;onEdit:(index:number)=>void;onPreview:()=>void;children?:React.ReactNode;
}){
 const done=sections.filter(s=>s.done).length;
 return <View style={s.wrapper}>
  <View style={s.intro}><Text style={s.eyebrow}>DOCUMENT COMPOSER</Text>
   <Text style={s.title}>{title}</Text><Text style={s.description}>{description}</Text>
   <Text style={s.progress}>{done} of {sections.length} sections have information</Text>
  </View>
  {children}
  <View style={s.card}>
   {sections.map((section,i)=><MotionPressable key={section.title} onPress={()=>onEdit(i)}
     accessibilityRole="button" accessibilityLabel={'Edit '+section.title}
     style={[s.row,i>0&&s.rowLine]}>
    <View style={[s.number,section.done&&s.numberDone]}>
     <Text style={[s.numberText,section.done&&s.numberTextDone]}>{i+1}</Text>
    </View>
    <View style={{flex:1}}><Text style={s.sectionTitle}>{section.title}</Text>
     <Text style={s.sectionDetail} numberOfLines={2}>{section.detail}</Text>
     {section.label?<Text style={s.sectionHint} numberOfLines={1}>{section.label}</Text>:null}
    </View>
    <ChevronRight color={C.teal} size={19}/>
   </MotionPressable>)}
  </View>
  <View style={s.total}>
   <View style={{flex:1}}><Text style={s.amountLabel}>DOCUMENT TOTAL</Text>
    <Text style={s.amount}>{amount||'Review the details'}</Text></View>
   <MotionPressable onPress={onPreview} style={s.preview} accessibilityRole="button" accessibilityLabel="Preview completed document">
    <Eye color="#FFFFFF" size={18}/><Text style={s.previewText}>Preview</Text><ArrowRight color="#FFFFFF" size={17}/>
   </MotionPressable>
  </View>
  <Text style={s.note}>Tap any section to change it. Saved prices are suggestions, not fixed charges. Nothing is sent until you choose to share or issue it.</Text>
 </View>;
}
const s=StyleSheet.create({
 wrapper:{gap:12},
 intro:{paddingVertical:7},eyebrow:{fontSize:10,color:C.teal,fontWeight:'800',letterSpacing:1.4},
 title:{fontSize:24,color:C.ink,fontWeight:'800',marginTop:6},
 description:{fontSize:12,lineHeight:19,color:C.muted,marginTop:7},
 progress:{fontSize:10,color:C.teal,fontWeight:'800',marginTop:12},
 card:{borderRadius:21,overflow:'hidden',backgroundColor:'#FFFFFF',borderColor:C.line,borderWidth:1},
 row:{flexDirection:'row',alignItems:'center',gap:12,padding:16,minHeight:85},
 rowLine:{borderTopWidth:1,borderTopColor:C.line},
 number:{width:36,height:36,backgroundColor:'#EFF3F0',borderRadius:12,alignItems:'center',justifyContent:'center'},
 numberDone:{backgroundColor:C.tealTint},
 numberText:{color:C.muted,fontSize:13,fontWeight:'800'},
 numberTextDone:{color:C.teal},
 sectionTitle:{fontSize:14,fontWeight:'800',color:C.ink},
 sectionDetail:{fontSize:11,color:C.muted,marginTop:4,lineHeight:17},
 sectionHint:{fontSize:10,color:C.teal,marginTop:5},
 total:{backgroundColor:'#FFFFFF',borderRadius:20,borderWidth:1,borderColor:C.line,padding:15,flexDirection:'row',alignItems:'center',gap:9},
 amountLabel:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:1},
 amount:{fontSize:22,fontWeight:'800',color:C.teal,marginTop:5},
 preview:{backgroundColor:C.darkTeal,borderRadius:15,minHeight:46,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:6},
 previewText:{fontWeight:'800',fontSize:12,color:'#FFFFFF'},
 note:{fontSize:11,lineHeight:17,color:C.muted,marginTop:5}
});
