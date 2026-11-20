import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme';

// Use React Native's built-in Animated API; no extra native package or rebuild.
let prefersReducedMotion=false;
const motionSubscribers=new Set<()=>void>();
const updateMotionPreference=(enabled:boolean)=>{
  if(prefersReducedMotion===enabled)return;
  prefersReducedMotion=enabled;
  motionSubscribers.forEach(notify=>notify());
};
AccessibilityInfo.isReduceMotionEnabled()
  .then(updateMotionPreference).catch(()=>{});
AccessibilityInfo.addEventListener('reduceMotionChanged',updateMotionPreference);
const subscribeMotion=(notify:()=>void)=>{
 motionSubscribers.add(notify);return()=>{motionSubscribers.delete(notify);};
};
const reducedMotionSnapshot=()=>prefersReducedMotion;
/** Active loops stop immediately when reduced motion is changed in Settings. */
function useReducedMotion(){
 return React.useSyncExternalStore(subscribeMotion,reducedMotionSnapshot,()=>false);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = PressableProps & {
  pressScale?: number;
  disableFlash?: boolean;
};

/**
 * Premium tactile feedback: light press-in, smooth release, one teal highlight.
 * No spring overshoot, wrapper, layout shift or intercepted accessibility tap.
 */
export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  disabled,
  pressScale = 0.977,
  disableFlash = false,
  children,
  onPress,
  ...rest
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  // Match the existing button/card shape instead of drawing a square halo
  // over circular avatar buttons or pill-shaped primary actions.
  const flattenedStyle=StyleSheet.flatten(style as StyleProp<ViewStyle>);
  const flashRadius=typeof flattenedStyle?.borderRadius==='number'
    ?flattenedStyle.borderRadius:16;

  useEffect(() => () => {
    scale.stopAnimation(); flash.stopAnimation(); lift.stopAnimation();
  }, [scale, flash, lift]);

  const animatePress = (pressed:boolean) => {
    if(prefersReducedMotion){
      scale.setValue(1);lift.setValue(0);return;
    }
    scale.stopAnimation();lift.stopAnimation();
    Animated.parallel([
      Animated.timing(scale,{
        toValue:pressed?pressScale:1,duration:pressed?98:205,
        easing:pressed?Easing.out(Easing.quad):Easing.out(Easing.cubic),
        useNativeDriver:true
      }),
      Animated.timing(lift,{
        toValue:pressed?1.7:0,duration:pressed?98:205,
        easing:Easing.out(Easing.cubic),useNativeDriver:true
      }),
    ]).start();
  };

  const activate = (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (!disabled && !prefersReducedMotion && !disableFlash) {
      flash.stopAnimation();
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash,{toValue:1,duration:105,
          easing:Easing.out(Easing.quad),useNativeDriver:true}),
        Animated.timing(flash,{toValue:0,duration:275,
          easing:Easing.out(Easing.cubic),useNativeDriver:true}),
      ]).start();
    }
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPress={activate}
      disabled={disabled}
      onPressIn={event => {
        if (!disabled) animatePress(true);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        animatePress(false);
        onPressOut?.(event);
      }}
      style={[style as StyleProp<ViewStyle>,{transform:[{translateY:lift},{scale}]}]}
    >
      {typeof children === 'function' ? children : (
        <>
          {children}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            borderRadius: flashRadius, borderWidth: 1.5, borderColor: '#73C5B1',
            backgroundColor: '#3F927D16',
            opacity: flash.interpolate({inputRange:[0,1],outputRange:[0,.74]}),
            transform: [{scale:flash.interpolate({inputRange:[0,1],outputRange:[.975,1.018]})}],
          }} />
        </>
      )}
    </AnimatedPressable>
  );
}

/** Polished feature entrance: visible, restrained fade with no overshoot. */
export function FadeSlideIn({ children, delay = 0 }: React.PropsWithChildren<{ delay?: number }>) {
  const reduced=useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { progress.stopAnimation();progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1, delay, duration: 290,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);

  return (
    <Animated.View style={{
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [17, 0] }) }],
    }}>{children}</Animated.View>
  );
}

/**
 * Tab-aware transition. Slide comes from the direction of navigation instead
 * of every screen moving right. Reduced-motion users see an immediate change.
 */
const lastTabIndex:{customer:number;trade:number}={customer:-1,trade:-1};
const customerTabs:Record<string,number>={home:0,map:1,discover:2,requests:3,messages:4,
 customerProfile:5,grid:2,oneJob:2,firstFix:2,rescue:2,priceLens:2,collective:2,
 customerQuotes:3,myHome:5,requestDetail:3,profile:1};
const tradeTabs:Record<string,number>={tradeHome:0,tradeJobs:1,tradeMap:2,tradeMessages:3,
 tradeTools:4,tradeProfile:5,tradeGrid:4,tradeCollective:4,tradeQuotes:4,
 tradeInvoices:4,tradeCustomers:4,tradeDiary:4,tradeProfit:4,tradeMaterials:4};
export function ScreenReveal({children,scope='customer',route=''}:
 React.PropsWithChildren<{scope?:'customer'|'trade';route?:string}>){
  const reduced=useReducedMotion();
  const tabs=scope==='customer'?customerTabs:tradeTabs;
  const index=tabs[route]??-1;
  // Maps render a native WebView: move its surface less than a text screen
  // to avoid a large expensive compositing animation during map load.
  const heavyMap=route==='map'||route==='tradeMap';
  const previous=lastTabIndex[scope];
  const direction=useRef(previous<0||index<0||previous===index?0:index>previous?1:-1).current;
  const progress=useRef(new Animated.Value(reduced?1:0)).current;
  useEffect(()=>{
    if(index>=0)lastTabIndex[scope]=index;
    if(reduced){progress.stopAnimation();progress.setValue(1);return;}
    const animation=Animated.timing(progress,{
      toValue:1,duration:heavyMap?200:245,
      easing:Easing.out(Easing.cubic),useNativeDriver:true
    });
    animation.start();
    return ()=>animation.stop();
  },[index,progress,scope,reduced,heavyMap]);
  return <Animated.View style={{flex:1,
   opacity:progress.interpolate({inputRange:[0,1],outputRange:[heavyMap?.82:.65,1]}),
   transform:[
    {translateX:progress.interpolate({inputRange:[0,1],outputRange:[direction*(heavyMap?12:25),0]})},
    {scale:progress.interpolate({inputRange:[0,1],outputRange:[heavyMap?.995:.986,1]})}
   ]}}>
   {children}
  </Animated.View>;
}

/**
 * Animated content for a short, accessible multi-step form. Each new step
 * mounts once and settles towards the centre. The sheet itself stays put, so
 * keyboard insets, scroll bounds and touch targets don't jump between steps.
 */
export function FlowStep({
 children,direction=1
}:React.PropsWithChildren<{direction?:-1|1}>){
 const reduced=useReducedMotion();
 const progress=useRef(new Animated.Value(reduced?1:0)).current;
 useEffect(()=>{
  if(reduced){progress.stopAnimation();progress.setValue(1);return;}
  const animation=Animated.timing(progress,{
   toValue:1,duration:255,easing:Easing.out(Easing.cubic),
   useNativeDriver:true
  });
  animation.start();return()=>animation.stop();
 },[progress,reduced]);
 return <Animated.View style={{
  opacity:progress.interpolate({inputRange:[0,1],outputRange:[.55,1]}),
  transform:[
   {translateX:progress.interpolate({inputRange:[0,1],outputRange:[direction*22,0]})},
   {translateY:progress.interpolate({inputRange:[0,1],outputRange:[7,0]})},
  ],
 }}>
  {children}
 </Animated.View>;
}

/** A progress segment fills with the same restrained easing as the form. */
export function FlowProgressSegment({active}: {active:boolean}){
 const reduced=useReducedMotion();
 const value=useRef(new Animated.Value(active?1:0)).current;
 useEffect(()=>{
  if(reduced){value.stopAnimation();value.setValue(active?1:0);return;}
  const animation=Animated.timing(value,{
    toValue:active?1:0,duration:260,easing:Easing.out(Easing.cubic),
    useNativeDriver:true
  });
  animation.start();return()=>animation.stop();
 },[active,value,reduced]);
 return <Animated.View style={{
    flex:1,height:4,borderRadius:2,backgroundColor:'#DDD8CB',overflow:'hidden',
 }}>
   <Animated.View style={{
     position:'absolute',left:0,right:0,top:0,bottom:0,
     backgroundColor:theme.colors.teal,
     opacity:value,
     transform:[{scaleX:value.interpolate({inputRange:[0,1],outputRange:[.02,1]})}]
   }}/>
 </Animated.View>;
}

/** Smooth visual confirmation for a selected radio/timing option. */
export function ChoiceIndicator({active,color=theme.colors.teal}:{
 active:boolean;color?:string
}){
 const reduced=useReducedMotion();
 const value=useRef(new Animated.Value(active?1:0)).current;
 useEffect(()=>{
  if(reduced){value.stopAnimation();value.setValue(active?1:0);return;}
  const animation=Animated.timing(value,{
   toValue:active?1:0,duration:190,
   easing:Easing.out(Easing.cubic),useNativeDriver:true
  });
  animation.start();return()=>animation.stop();
 },[active,value,reduced]);
 return <Animated.View pointerEvents="none" style={{
  width:12,height:12,borderRadius:6,backgroundColor:color,
  opacity:value,
  transform:[{scale:value.interpolate({inputRange:[0,1],outputRange:[.35,1]})}],
 }}/>;
}

/** The selection pill eases in instead of snapping on every tab switch. */
export function NavPill({active,children,background}:
 React.PropsWithChildren<{active:boolean;background:string}>){
  const reduced=useReducedMotion();
  const selected=useRef(new Animated.Value(active?(reduced?1:.25):0)).current;
  useEffect(()=>{
    if(reduced){selected.stopAnimation();selected.setValue(active?1:0);return;}
    const movement=Animated.timing(selected,{
      toValue:active?1:0,duration:230,
      easing:Easing.out(Easing.cubic),useNativeDriver:true
    });
    movement.start();
    return ()=>movement.stop();
  },[active,selected,reduced]);
  return <Animated.View style={{alignItems:'center',justifyContent:'center',width:'100%',height:'100%'}}>
   <Animated.View pointerEvents="none" style={{
      position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:22,
      backgroundColor:background,opacity:selected,
      transform:[{scale:selected.interpolate({inputRange:[0,1],outputRange:[0.72,1]})}]
   }}/>
   <Animated.View style={{transform:[{translateY:selected.interpolate({inputRange:[0,1],outputRange:[1,-1.4]})},
     {scale:selected.interpolate({inputRange:[0,1],outputRange:[1,1.06]})}]}}>
     {children}
   </Animated.View>
  </Animated.View>;
}

/** Compact, illustrative match journey. Not a live job/availability claim. */
export function JobMatchJourney(){
  const reduced=useReducedMotion();
  const flight=useRef(new Animated.Value(0)).current;
  const [trackWidth,setTrackWidth]=React.useState(80);
  useEffect(()=>{
    if(reduced){flight.stopAnimation();flight.setValue(0);return;}
    // Travel only forwards. At 1 the indicator has faded fully out;
    // reset it instantly while invisible instead of racing visibly backwards.
    const loop=Animated.loop(Animated.sequence([
      Animated.delay(420),
      Animated.timing(flight,{toValue:1,duration:1180,
        easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
      Animated.delay(650),
      Animated.timing(flight,{toValue:0,duration:0,
        useNativeDriver:true}),
      Animated.delay(950)
    ]));
    loop.start();
    return ()=>loop.stop();
  },[flight,reduced]);
  return <Animated.View
     accessible accessibilityLabel="Illustration: your job request travels to a matched local tradesperson"
     style={{height:47,marginHorizontal:1,marginTop:11,
       flexDirection:'row',alignItems:'center',justifyContent:'space-between',
       paddingHorizontal:12,borderRadius:15,
       backgroundColor:'#FFFFFF0E',borderWidth:1,borderColor:'#FFFFFF2A'}}>
    <Animated.View style={{gap:2}}>
      <Animated.Text style={{color:'#DDF1EC',fontSize:10,fontWeight:'800'}}>01 · POST A JOB</Animated.Text>
      <Animated.Text style={{color:'#A9D5CA',fontSize:9}}>Your request</Animated.Text>
    </Animated.View>
    <Animated.View onLayout={event=>setTrackWidth(event.nativeEvent.layout.width)}
      style={{flex:1,height:3,backgroundColor:'#83B3A977',
      marginHorizontal:13,borderRadius:3,position:'relative'}}>
      <Animated.View style={{
        position:'absolute',top:-10,width:23,height:23,borderRadius:12,
        alignItems:'center',justifyContent:'center',borderWidth:2,
        borderColor:'#FFFFFF',backgroundColor:'#F4B786',
        opacity:flight.interpolate({inputRange:[0,0.08,0.92,1],outputRange:[0,1,1,0]}),
        transform:[{translateX:flight.interpolate({inputRange:[0,1],
          outputRange:[0,Math.max(0,trackWidth-23)]})}]
      }}><Animated.Text style={{fontWeight:'900',fontSize:13,color:'#153E3A'}}>➜</Animated.Text></Animated.View>
      <Animated.View style={{
        position:'absolute',right:-4,top:-6,width:15,height:15,borderRadius:8,
        backgroundColor:'#8EE7B7',borderWidth:2,borderColor:'#FFFFFF',
        opacity:flight.interpolate({inputRange:[0,.65,.93,1],outputRange:[0,0,1,0]}),
        transform:[{scale:flight.interpolate({inputRange:[0,.75,.93,1],outputRange:[.5,.65,1.2,.5]})}]
      }}/>
    </Animated.View>
    <Animated.View style={{alignItems:'flex-end',gap:2}}>
      <Animated.Text style={{color:'#DDF1EC',fontSize:10,fontWeight:'800'}}>02 · GET MATCHED</Animated.Text>
      <Animated.Text style={{color:'#A9D5CA',fontSize:9}}>Pros can respond</Animated.Text>
    </Animated.View>
  </Animated.View>;
}

/** A calm, low-amplitude pulse that runs only while the pro is online. */
export function LiveStatusDot({
  online,
  style,
}: {
  online: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced=useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (!online || reduced) return;

    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1450,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1450,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    cycle.start();
    return () => cycle.stop();
  }, [online, pulse, reduced]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          backgroundColor: online ? theme.colors.success : '#A9B9BD',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
          transform: [{
            scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }),
          }],
        },
      ]}
    />
  );
}

/** Visible animated CTA arrow: glides forward and returns while the hero is visible. */
export function MovingArrow({ children }: React.PropsWithChildren) {
  const reduced=useReducedMotion();
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced){travel.stopAnimation();travel.setValue(0);return;}
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(travel, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(travel, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1800),
    ]));
    loop.start();
    return () => loop.stop();
  }, [travel,reduced]);
  return <Animated.View style={{ transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] }}>{children}</Animated.View>;
}

/** Radar on the home map: an unmistakable double wave, not a decorative dot. */
export function RadarBeacon({ active = true }: { active?: boolean }) {
  const reduced=useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    wave.stopAnimation();
    wave.setValue(0);
    if (!active || reduced) return;
    const loop = Animated.loop(Animated.timing(wave, {
      toValue: 1, duration: 2300, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [active, wave,reduced]);
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: '42%', left: '45%', width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 0.5].map((offset, index) => {
        const phase = Animated.modulo(Animated.add(wave, offset), 1);
        return (
          <Animated.View key={index} style={{
            position: 'absolute', width: 38, height: 38, borderRadius: 19,
            borderColor: '#F07850', borderWidth: 2.5, backgroundColor: '#F0785014',
            opacity: phase.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.85, 0.25, 0] }),
            transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [0.45, 3.2] }) }],
          }} />
        );
      })}
      <Animated.View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#F07850', borderWidth: 3, borderColor: '#FFFFFF', elevation: 4 }} />
    </Animated.View>
  );
}
