import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,StyleSheet,Text,View} from 'react-native';
import Svg,{Path,Rect,Circle,G,Defs,ClipPath} from 'react-native-svg';
import {ArrowRight,Zap,Map as MapIcon,Wrench,PlugZap,Hammer} from 'lucide-react-native';
import {MotionPressable} from './Motion';
import {theme} from './theme';

const roads=['M-15 140 L125 65 L365 12','M-10 100 L365 155','M20 -10 L95 185','M82 -10 L185 185','M160 -10 L265 185','M235 -10 L330 185','M-10 32 L365 100','M-10 67 L365 130','M-10 167 L365 57','M-5 185 L365 110','M115 -10 L25 185','M275 -10 L188 185'];
const pins=[{x:91,y:65,Icon:Wrench},{x:270,y:54,Icon:PlugZap},{x:245,y:130,Icon:Hammer}];
export default function CustomerHomeMapHero({onPost,onExplore,compact=false}:{onPost:()=>void;onExplore:()=>void;compact?:boolean}){
 const pulse=useRef(new Animated.Value(0)).current;
 const [reduce,setReduce]=useState(true);
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(active)setReduce(v)}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>{active=false;sub.remove()}},[]);
 useEffect(()=>{pulse.stopAnimation();pulse.setValue(0);if(reduce)return;const anim=Animated.loop(Animated.timing(pulse,{toValue:1,duration:2900,easing:Easing.out(Easing.cubic),useNativeDriver:true,isInteraction:false}));anim.start();return()=>anim.stop()},[reduce,pulse]);
 return <View style={S.hero}>
  <View style={S.header}><Text style={S.title}>Find help near you</Text><Text style={S.subtitle}>Search local trades or post a job.</Text></View>
  <MotionPressable style={S.map} onPress={onExplore} accessibilityRole="button" accessibilityLabel="Explore map, illustrated preview" pressScale={1} disableFlash>
   <Svg width="100%" height="100%" viewBox="0 0 360 165" preserveAspectRatio="none">
    <Defs><ClipPath id="mapEdge"><Path d="M0 18 Q14 0 45 0 L192 0 Q218 0 246 -13 L360 -25 L360 165 L0 165 Z"/></ClipPath></Defs>
    <G clipPath="url(#mapEdge)"><Rect width="360" height="165" fill="#E9E3D6"/>
    <Path d="M0 18 L43 8 62 30 42 57 0 50 Z M290 0 L360 0 360 36 313 42 280 22 Z M0 103 L34 85 60 105 49 147 0 155 Z M290 69 L354 52 360 87 330 110 293 97 Z M117 133 L153 121 179 144 163 165 106 165 Z" fill="#BED5A4"/>
    <Path d="M360 43 C300 54 329 91 285 111 S256 140 246 180" stroke="#9FCADB" strokeWidth="18" fill="none"/>
    {roads.map(d=><Path key={d} d={d} stroke="#FAF8F0" strokeWidth="4" fill="none"/>)}
    <Path d="M-10 122 Q92 52 170 81 T370 57 M45 -10 Q77 61 162 100 T337 170" stroke="#FFFDF8" strokeWidth="8" fill="none"/>
    <Path d="M8 18 L40 0 67 8 M315 114 L345 136 360 132" stroke="#DCE7B9" strokeWidth="4" fill="none"/>
    </G>
    <Path d="M0 0 H360 V0 Q339 -2 316 3 Q260 7 210 26 Q182 32 144 31 H42 Q10 31 0 49 Z" fill="#0F2A30"/>
    <Circle cx="173" cy="89" r="29" fill="#E0704C" opacity=".16"/>
   </Svg>
   <View pointerEvents="none" style={[S.pinAt,{left:'48.05%',top:'54%'}]}>
    <Animated.View style={[S.ripple,{opacity:reduce ? .16 : pulse.interpolate({inputRange:[0,1],outputRange:[.28,0]}),transform:[{scale:reduce?1:pulse.interpolate({inputRange:[0,1],outputRange:[.5,2.4]})}]}]}/>
    <View style={S.centerPin}><View style={S.centerDot}/></View>
   </View>
   {pins.map(({x,y,Icon},index)=><Animated.View key={index} pointerEvents="none" style={[S.pinAt,{left:(x/360*100)+'%' as `${number}%`,top:(y/165*100)+'%' as `${number}%`,transform:[{translateY:reduce?0:pulse.interpolate({inputRange:[0,.35,.7,1],outputRange:[0,-(index+2),-1,0]})}]}]}><View style={S.pinTail}/><View style={S.pin}><Icon size={17} color="#fff" strokeWidth={2.5}/></View></Animated.View>)}
   <View pointerEvents="none" style={S.previewLabel}><Text style={S.previewText}>Illustrated preview</Text></View>
  </MotionPressable>
  <View style={[S.actions,compact&&{flexDirection:'column'}]}>
   <MotionPressable style={[S.button,{backgroundColor:'#D9633C'}]} onPress={onPost} accessibilityRole="button" accessibilityLabel="Post a job"><Zap size={19} color="#fff"/><Text style={[S.actionText,{color:'#fff'}]}>Post a job</Text><ArrowRight size={18} color="#fff"/></MotionPressable>
   <MotionPressable style={[S.button,{backgroundColor:'#E1EFED'}]} onPress={onExplore} accessibilityRole="button" accessibilityLabel="Explore map"><MapIcon size={19} color={theme.colors.teal}/><Text style={S.actionText}>Explore map</Text><ArrowRight size={18} color={theme.colors.ink}/></MotionPressable>
  </View>
 </View>
}
const S=StyleSheet.create({
 hero:{backgroundColor:theme.colors.darkTeal,borderRadius:26,overflow:'hidden'},
 header:{paddingHorizontal:18,paddingTop:13,paddingBottom:0,zIndex:2},
 title:{fontFamily:theme.font.heading,color:'#fff',fontSize:24,fontWeight:'800',letterSpacing:-.6},
 subtitle:{color:'#DDE9E8',fontSize:13,marginTop:2},
 map:{height:154,position:'relative',overflow:'hidden',borderBottomLeftRadius:17,borderBottomRightRadius:17},
 pinAt:{position:'absolute',width:34,height:34,marginLeft:-17,marginTop:-17,alignItems:'center',justifyContent:'center'},
 pin:{width:30,height:30,borderRadius:15,backgroundColor:'#17434A',borderWidth:1.5,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
 pinTail:{position:'absolute',width:15,height:15,bottom:0,backgroundColor:'#17434A',borderRightWidth:1.5,borderBottomWidth:1.5,borderColor:'#fff',transform:[{rotate:'45deg'}]},
 centerPin:{width:26,height:26,borderRadius:13,backgroundColor:'#D9633C',borderWidth:2,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
 centerDot:{width:9,height:9,borderRadius:5,backgroundColor:'#fff'},
 ripple:{position:'absolute',width:42,height:42,borderRadius:21,backgroundColor:'#E0704C'},
 previewLabel:{position:'absolute',right:8,bottom:5,paddingHorizontal:5,paddingVertical:2,backgroundColor:'#FFFCF5DD',borderRadius:5},
 previewText:{fontSize:8,color:'#52646A',fontWeight:'600'},
 actions:{flexDirection:'row',gap:9,padding:11},
 button:{flex:1,minWidth:0,minHeight:43,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8},
 actionText:{flexShrink:1,fontSize:13,fontWeight:'800',color:theme.colors.ink}
});
