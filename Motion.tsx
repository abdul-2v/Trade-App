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
  pressScale = 0.89,
  ...rest
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => () => scale.stopAnimation(), [scale]);

  const springTo = (value: number) => {
    if (prefersReducedMotion) return;
    scale.stopAnimation();
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: value === 1 ? 15 : 28,
      bounciness: value === 1 ? 17 : 0,
    }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
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
    />
  );
}

/** A single gentle entrance used for the customer homepage hero. */
export function FadeSlideIn({ children, delay = 70 }: React.PropsWithChildren<{ delay?: number }>) {
  const progress = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      progress.setValue(1);
      return;
    }
    const transition = Animated.spring(progress, {
      toValue: 1,
      delay,
      speed: 10,
      bounciness: 9,
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }),
        }],
      }}
    >
      {children}
    </Animated.View>
  );
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
