import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,StyleSheet,Text,View,Pressable,AppState} from 'react-native';
import Svg,{Path,Rect,Circle} from 'react-native-svg';
import {ArrowRight,Zap,Map as MapIcon,Wrench,PlugZap,Hammer,Flame,Ruler,KeyRound} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';
import {HOME_TRADE_GROUPS,nextHomeTradeGroup} from './lib/homeMapMotion';

const roads=['M-15 140 L125 65 L365 12','M-10 100 L365 155','M20 -10 L95 185','M82 -10 L185 185','M160 -10 L265 185','M235 -10 L330 185','M-10 32 L365 100','M-10 67 L365 130','M-10 167 L365 57','M-5 185 L365 110','M115 -10 L25 185','M275 -10 L188 185'];
export type HomeMapTrade=(typeof HOME_TRADE_GROUPS)[number][number];
const details={Plumber:{Icon:Wrench,label:'Plumbers'},Electrician:{Icon:PlugZap,label:'Electricians'},Builder:{Icon:Hammer,label:'Builders'},Heating:{Icon:Flame,label:'Heating engineers'},Carpenter:{Icon:Ruler,label:'Carpenters'},Locksmith:{Icon:KeyRound,label:'Locksmiths'}};
const slots=[{x:91,y:65},{x:270,y:54},{x:245,y:130}];
export default function CustomerHomeMapHero({onPost,onExplore,onAddress,compact=false}:{onPost:(trade?:HomeMapTrade)=>void;onExplore:(trade?:HomeMapTrade)=>void;onAddress:()=>void;compact?:boolean}){
 const pulse=useRef(new Animated.Value(0)).current;
 const [reduce,setReduce]=useState(true);
 const [selected,setSelected]=useState<HomeMapTrade|null>(null);
 const selectedPin=selected?details[selected]:null;
 const [group,setGroup]=useState(0);
 const groupRef=useRef(0);
 const fade=useRef(new Animated.Value(0)).current;
 const [foreground,setForeground]=useState(AppState.currentState!=='background');
 const switchGroup=()=>{
  const next=nextHomeTradeGroup(groupRef.current);
  groupRef.current=next;setSelected(null);setGroup(next);
  if(reduce){fade.stopAnimation();fade.setValue(next);return;}
  Animated.timing(fade,{toValue:next,duration:260,easing:Easing.inOut(Easing.cubic),useNativeDriver:true,isInteraction:false}).start();
 };
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove()},[]);
 useEffect(()=>()=>fade.stopAnimation(),[fade]);
 useEffect(()=>{if(reduce||!foreground){fade.stopAnimation();fade.setValue(groupRef.current)}},[reduce,foreground,fade]);
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduce(v)}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>{active=false;sub.remove()}},[]);
 useEffect(()=>{pulse.stopAnimation();pulse.setValue(0);if(reduce||!foreground)return;const anim=Animated.loop(Animated.timing(pulse,{toValue:1,duration:4200,easing:Easing.out(Easing.cubic),useNativeDriver:true,isInteraction:false}));anim.start();return()=>anim.stop()},[reduce,foreground,pulse]);
 return <View style={S.hero}>
  <View style={S.header}><Text style={S.title}>Find help near you</Text><Text style={S.subtitle}>{selectedPin?selectedPin.label+' selected · tap again to clear':'Tap a trade to get started'}</Text></View>
  <View style={S.map}>
   <Pressable style={StyleSheet.absoluteFill} onPress={()=>setSelected(null)} accessible={false}/>
   <View pointerEvents="box-none" style={S.overscan}>
   <View pointerEvents="none" style={StyleSheet.absoluteFill}>
   <Svg width="100%" height="100%" viewBox="-108 -33 576 231" preserveAspectRatio="none">
    <Rect x="-108" y="-33" width="576" height="231" fill="#E9E3D6"/>
    <Path d="M-108 -20 L-42 -33 -7 2 -31 41 -108 38Z M-108 112 L-55 96 -28 128 -49 164 -108 182Z M369 70 L431 51 468 88 468 131 414 137Z M374 145 L428 158 451 198 379 198Z" fill="#BED5A4"/>
    <Path d="M-108 30 L0 50 M-108 115 L0 100 M-108 184 L0 140 M-85 -33 L-22 198 M-35 -33 L42 198 M365 12 L468 -12 M365 100 L468 128 M365 155 L468 173 M350 -33 L421 198 M405 -33 L468 160 M-108 73 L0 67 M360 57 L468 19" stroke="#FAF8F0" strokeWidth="4" fill="none"/>
    <Path d="M0 18 L43 8 62 30 42 57 0 50 Z M290 0 L360 0 360 36 313 42 280 22 Z M0 103 L34 85 60 105 49 147 0 155 Z M290 69 L354 52 360 87 330 110 293 97 Z M117 133 L153 121 179 144 163 165 106 165 Z" fill="#BED5A4"/>
    <Path d="M360 43 C300 54 329 91 285 111 S256 140 246 180" stroke="#9FCADB" strokeWidth="18" fill="none"/>
    {roads.map(d=><Path key={d} d={d} stroke="#FAF8F0" strokeWidth="4" fill="none"/>)}
    <Path d="M-10 122 Q92 52 170 81 T370 57 M45 -10 Q77 61 162 100 T337 170" stroke="#FFFDF8" strokeWidth="8" fill="none"/>
    <Path d="M8 18 L40 0 67 8 M315 114 L345 136 360 132" stroke="#DCE7B9" strokeWidth="4" fill="none"/>
    <Circle cx="173" cy="89" r="29" fill="#E0704C" opacity=".16"/>
   </Svg></View>
   <Pressable onPress={onAddress} accessibilityRole="button" accessibilityLabel="Choose your search address" style={[S.pinAt,{left:'48.7847%',top:'52.8139%'}]}>
    <Animated.View pointerEvents="none" style={[S.ripple,{opacity:reduce ? .16 : pulse.interpolate({inputRange:[0,1],outputRange:[.18,0]}),transform:[{scale:reduce?1:pulse.interpolate({inputRange:[0,1],outputRange:[.75,1.85]})}]}]}/>
    {!reduce&&<Animated.View pointerEvents="none" style={[S.ripple,{opacity:pulse.interpolate({inputRange:[0,.35,.58,1],outputRange:[0,0,.13,0]}),transform:[{scale:pulse.interpolate({inputRange:[0,.35,1],outputRange:[.75,.75,2.2]})}]}]}/>}
    <View pointerEvents="none" style={S.centerPin}><View style={S.centerDot}/></View>
   </Pressable>
   {HOME_TRADE_GROUPS.map((trades,index)=><Animated.View key={index} pointerEvents={group===index?'box-none':'none'} accessibilityElementsHidden={group!==index} importantForAccessibility={group===index?'auto':'no-hide-descendants'} style={[StyleSheet.absoluteFill,{opacity:index===0?fade.interpolate({inputRange:[0,1],outputRange:[1,0]}):fade}]}>
    {trades.map((trade,slot)=>{const {x,y}=slots[slot];const {Icon,label}=details[trade];return <Pressable key={trade} style={[S.pinAt,{left:((x+108)/576*100)+'%' as `${number}%`,top:((y+33)/231*100)+'%' as `${number}%`}]} onPress={()=>setSelected(current=>current===trade?null:trade)} accessibilityRole="button" accessibilityLabel={'Select '+label.toLowerCase()} accessibilityState={{selected:selected===trade}}>
     <View pointerEvents="none" style={S.pinMotion}>
      {selected===trade&&<View style={S.selectionHalo}/>}
      <View style={[S.pinTail,selected===trade&&S.pinSelected]}/><View style={[S.pin,selected===trade&&S.pinSelected]}><Icon size={17} color="#fff" strokeWidth={2.5}/></View>
     </View>
    </Pressable>})}
   </Animated.View>)}
   </View>
   <View pointerEvents="none" style={[StyleSheet.absoluteFill,{zIndex:3}]}><Svg width="100%" height="100%" viewBox="0 0 360 165" preserveAspectRatio="none"><Path d="M0 0 H360 V0 Q339 -2 316 3 Q260 7 210 26 Q182 32 144 31 H42 Q10 31 0 49 Z" fill="#0F2A30"/></Svg></View>
   <Pressable style={S.moreTrades} onPress={switchGroup} accessibilityRole="button" accessibilityLabel={group===0?'Show more trade categories':'Show main trade categories'}><View style={S.morePill}><View style={[S.groupDot,group===0&&S.groupDotActive]}/><View style={[S.groupDot,group===1&&S.groupDotActive]}/><Text style={S.moreText}>{group===0?'More trades':'Main trades'}</Text></View></Pressable>
  </View>
  <View style={[S.actions,compact&&{flexDirection:'column'}]}>
   <MotionPressable style={[S.button,{backgroundColor:'#D9633C'}]} onPress={()=>onPost(selected||undefined)} accessibilityRole="button" accessibilityLabel={selected?'Post a job for a '+selected.toLowerCase():'Post a job'}><Zap size={19} color="#fff"/><Text style={[S.actionText,{color:'#fff'}]}>Post a job</Text><ArrowRight size={18} color="#fff"/></MotionPressable>
   <MotionPressable style={[S.button,{backgroundColor:'#E1EFED'}]} onPress={()=>onExplore(selected||undefined)} accessibilityRole="button" accessibilityLabel={selected?'Explore '+selected.toLowerCase()+' listings':'Explore map'}><MapIcon size={19} color={theme.colors.teal}/><Text style={S.actionText}>Explore map</Text><ArrowRight size={18} color={theme.colors.ink}/></MotionPressable>
  </View>
 </View>
}
const S=StyleSheet.create({
 hero:{backgroundColor:theme.colors.darkTeal,borderRadius:26,overflow:'hidden'},
 header:{paddingHorizontal:18,paddingTop:13,paddingBottom:0,zIndex:2},
 title:{fontFamily:theme.font.heading,color:'#fff',fontSize:24,fontWeight:'800',letterSpacing:-.6},
 subtitle:{color:'#DDE9E8',fontSize:13,marginTop:2},
 map:{height:154,position:'relative',overflow:'hidden',borderBottomLeftRadius:17,borderBottomRightRadius:17,backgroundColor:'#E9E3D6'},
 overscan:{position:'absolute',left:'-30%',top:'-20%',width:'160%',height:'140%'},
 pinAt:{position:'absolute',width:44,height:44,marginLeft:-22,marginTop:-22,alignItems:'center',justifyContent:'center'},
 pinMotion:{width:34,height:34,alignItems:'center',justifyContent:'center'},
 selectionHalo:{position:'absolute',width:40,height:40,borderRadius:20,backgroundColor:'#E0704C55',borderWidth:1,borderColor:'#E0704C'},
 pinSelected:{backgroundColor:'#C74D28'},
 pin:{width:30,height:30,borderRadius:15,backgroundColor:'#17434A',borderWidth:1.5,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
 pinTail:{position:'absolute',width:15,height:15,bottom:0,backgroundColor:'#17434A',borderRightWidth:1.5,borderBottomWidth:1.5,borderColor:'#fff',transform:[{rotate:'45deg'}]},
 centerPin:{width:26,height:26,borderRadius:13,backgroundColor:'#D9633C',borderWidth:2,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
 centerDot:{width:9,height:9,borderRadius:5,backgroundColor:'#fff'},
 ripple:{position:'absolute',width:42,height:42,borderRadius:21,backgroundColor:'#E0704C'},
 moreTrades:{position:'absolute',left:7,bottom:0,minHeight:44,alignItems:'center',justifyContent:'center',zIndex:5},
 morePill:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#FFFDF8',borderRadius:12,paddingHorizontal:9,minHeight:26},
 groupDot:{width:5,height:5,borderRadius:3,backgroundColor:'#C8D6D2'},
 groupDotActive:{backgroundColor:'#245758'},
 moreText:{fontSize:11,fontWeight:'700',color:theme.colors.teal,marginLeft:2},
 actions:{flexDirection:'row',gap:9,padding:11},
 button:{flex:1,minWidth:0,minHeight:43,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8},
 actionText:{flexShrink:1,fontSize:13,fontWeight:'800',color:theme.colors.ink}
});
