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
  pressScale = 0.97,
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
      speed: 25,
      bounciness: value === 1 ? 5 : 0,
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
    const transition = Animated.timing(progress, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.cubic),
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
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [13, 0] }),
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
