import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme';

// Use React Native's built-in Animated API; no extra native package or rebuild.
let prefersReducedMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then(value => { prefersReducedMotion = value; })
  .catch(() => {});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = PressableProps & {
  pressScale?: number;
  disableFlash?: boolean;
};

/**
 * A small spring on press and release, without a wrapper View.
 * Preserves the existing onPress, disabled, layout and accessibility props.
 */
export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  disabled,
  pressScale = 0.94,
  disableFlash = false,
  children,
  onPress,
  ...rest
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { scale.stopAnimation(); flash.stopAnimation(); }, [scale, flash]);

  const springTo = (value: number) => {
    if (prefersReducedMotion) return;
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: value === 1 ? 23 : 28,
      bounciness: value === 1 ? 4 : 0,
    }).start();
  };

  const activate = (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (!disabled && !prefersReducedMotion && !disableFlash) {
      flash.stopAnimation();
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
        if (!disabled) springTo(pressScale);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        springTo(1);
        onPressOut?.(event);
      }}
      style={[style as StyleProp<ViewStyle>, { transform: [{ scale }] }]}
    >
      {typeof children === 'function' ? children : (
        <>
          {children}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            borderRadius: 18, borderWidth: 2, borderColor: '#F07A51',
            backgroundColor: '#F07A5126',
            opacity: flash,
            transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.025] }) }],
          }} />
        </>
      )}
    </AnimatedPressable>
  );
}

/** Fast, low-distance entrance. Keeps Home from replaying a slow spring after each tab tap. */
export function FadeSlideIn({ children, delay = 0 }: React.PropsWithChildren<{ delay?: number }>) {
  const progress = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1, delay, duration: 170,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View style={{
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
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
  const tabs=scope==='customer'?customerTabs:tradeTabs;
  const index=tabs[route]??-1;
  const previous=lastTabIndex[scope];
  const direction=useRef(previous<0||index<0||previous===index?0:index>previous?1:-1).current;
  const progress=useRef(new Animated.Value(prefersReducedMotion?1:0)).current;
  useEffect(()=>{
    if(index>=0)lastTabIndex[scope]=index;
    if(prefersReducedMotion){progress.setValue(1);return;}
    const animation=Animated.timing(progress,{
      toValue:1,duration:235,easing:Easing.out(Easing.cubic),useNativeDriver:true
    });
    animation.start();
    return ()=>animation.stop();
  },[index,progress,scope]);
  return <Animated.View style={{flex:1,opacity:progress,
   transform:[
    {translateX:progress.interpolate({inputRange:[0,1],outputRange:[direction*24,0]})},
    {scale:progress.interpolate({inputRange:[0,1],outputRange:[0.992,1]})}
   ]}}>
   {children}
  </Animated.View>;
}

/** The selection pill eases in instead of snapping on every tab switch. */
export function NavPill({active,children,background}:
 React.PropsWithChildren<{active:boolean;background:string}>){
  const selected=useRef(new Animated.Value(active?(prefersReducedMotion?1:0.67):0)).current;
  useEffect(()=>{
    if(prefersReducedMotion){selected.setValue(active?1:0);return;}
    const movement=Animated.timing(selected,{
      toValue:active?1:0,duration:220,
      easing:Easing.out(Easing.cubic),useNativeDriver:true
    });
    movement.start();
    return ()=>movement.stop();
  },[active,selected]);
  return <Animated.View style={{alignItems:'center',justifyContent:'center',width:'100%',height:'100%'}}>
   <Animated.View pointerEvents="none" style={{
      position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:22,
      backgroundColor:background,opacity:selected,
      transform:[{scale:selected.interpolate({inputRange:[0,1],outputRange:[0.80,1]})}]
   }}/>
   <Animated.View style={{transform:[{translateY:selected.interpolate({inputRange:[0,1],outputRange:[1,-0.5]})}]}}>
     {children}
   </Animated.View>
  </Animated.View>;
}

/** Compact, illustrative match journey. Not a live job/availability claim. */
export function JobMatchJourney(){
  const flight=useRef(new Animated.Value(0)).current;
  const [trackWidth,setTrackWidth]=React.useState(80);
  useEffect(()=>{
    if(prefersReducedMotion)return;
    const loop=Animated.loop(Animated.sequence([
      Animated.delay(420),
      Animated.timing(flight,{toValue:1,duration:1050,
        easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
      Animated.delay(700),
      Animated.timing(flight,{toValue:0,duration:250,
        easing:Easing.in(Easing.cubic),useNativeDriver:true}),
      Animated.delay(950)
    ]));
    loop.start();
    return ()=>loop.stop();
  },[flight]);
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
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (!online || prefersReducedMotion) return;

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
  }, [online, pulse]);

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
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(travel, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(travel, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1800),
    ]));
    loop.start();
    return () => loop.stop();
  }, [travel]);
  return <Animated.View style={{ transform: [{ translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] }}>{children}</Animated.View>;
}

/** Radar on the home map: an unmistakable double wave, not a decorative dot. */
export function RadarBeacon({ active = true }: { active?: boolean }) {
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    wave.stopAnimation();
    wave.setValue(0);
    if (!active || prefersReducedMotion) return;
    const loop = Animated.loop(Animated.timing(wave, {
      toValue: 1, duration: 2300, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [active, wave]);
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
