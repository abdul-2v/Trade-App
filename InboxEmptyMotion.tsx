import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { MessageCircle, Send } from 'lucide-react-native';
import { theme } from './theme';

/**
 * Decorative empty-inbox journey. An illustrated message travels between two
 * conversation bubbles. It never represents a sent/received real message.
 * Animations pause offscreen/backgrounded and respect iOS Reduce Motion.
 */
export default function InboxEmptyMotion() {
  const flight = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (mounted) setReducedMotion(value); })
      .catch(() => {});
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSub = AppState.addEventListener('change', state =>
      setForeground(state === 'active'));
    return () => {
      mounted = false;
      motionSub.remove();
      appSub.remove();
    };
  }, []);

  useEffect(() => {
    flight.stopAnimation();
    if (reducedMotion || !foreground) {
      flight.setValue(1);
      return;
    }
    flight.setValue(0);
    const journey = Animated.loop(Animated.sequence([
      Animated.delay(450),
      Animated.timing(flight, {
        toValue: 1,
        duration: 1850,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(flight, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.delay(450),
    ]));
    journey.start();
    return () => journey.stop();
  }, [flight, reducedMotion, foreground]);

  const travel = flight.interpolate({ inputRange: [0, 1], outputRange: [0, 126] });
  const arc = flight.interpolate({
    inputRange: [0, 0.5, 1], outputRange: [0, -16, 0],
  });
  const sendOpacity = flight.interpolate({
    inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 1, 1, 0],
  });
  const receiveScale = flight.interpolate({
    inputRange: [0, 0.74, 0.94, 1], outputRange: [1, 1, 1.08, 1],
  });
  const receiveGlow = flight.interpolate({
    inputRange: [0, 0.7, 0.95, 1], outputRange: [0.12, 0.12, 0.42, 0.16],
  });

  return (
    <View accessible accessibilityRole="image"
      accessibilityLabel="Illustration of a message travelling between two people"
      style={styles.scene}>
      <View style={styles.halo} />
      <View style={styles.trail}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={[styles.trailDot, { opacity: i % 2 ? 0.55 : 1 }]} />
        ))}
      </View>
      <View style={styles.sender}>
        <View style={styles.senderBubble}>
          <MessageCircle size={34} strokeWidth={1.8} color={theme.colors.white} />
          <View style={styles.senderLine} />
        </View>
        <View style={styles.senderShadow} />
      </View>
      <Animated.View style={[styles.recipientAura, { opacity: receiveGlow, transform: [{ scale: receiveScale }] }]} />
      <Animated.View style={[styles.recipient, { transform: [{ scale: receiveScale }] }]}>
        <MessageCircle size={34} strokeWidth={1.8} color={theme.colors.teal} />
        <View style={styles.replyDots}>
          <View style={styles.replyDot} />
          <View style={styles.replyDot} />
          <View style={styles.replyDot} />
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[
        styles.paperPlane,
        { opacity: sendOpacity, transform: [{ translateX: travel }, { translateY: arc }] },
      ]}>
        <Send size={17} strokeWidth={2.3} color={theme.colors.white} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: 268, height: 176, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', marginBottom: 4, overflow: 'hidden',
  },
  halo: {
    position: 'absolute', width: 252, height: 144, borderRadius: 78,
    backgroundColor: '#E7F0ED', borderWidth: 1, borderColor: '#D7E9E3',
  },
  trail: {
    position: 'absolute', top: 85, left: 78, right: 77,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  trailDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#76A49B',
  },
  sender: {
    position: 'absolute', left: 20, top: 43,
    alignItems: 'center', justifyContent: 'center',
  },
  senderBubble: {
    width: 76, height: 76, borderRadius: 26,
    backgroundColor: theme.colors.darkTeal,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  senderLine: {
    width: 24, height: 3, borderRadius: 2,
    backgroundColor: '#A5D3C8', marginTop: 4,
  },
  senderShadow: {
    width: 47, height: 5, borderRadius: 3, marginTop: 13,
    backgroundColor: '#BED3CB', opacity: 0.7,
  },
  recipientAura: {
    position: 'absolute', right: 14, top: 37,
    width: 91, height: 91, borderRadius: 46,
    backgroundColor: '#E4A078',
  },
  recipient: {
    position: 'absolute', right: 22, top: 45,
    width: 76, height: 76, borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#A8C7BC',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '7deg' }],
  },
  replyDots: {
    flexDirection: 'row', gap: 4, marginTop: 4,
  },
  replyDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#E0704C',
  },
  paperPlane: {
    position: 'absolute', left: 68, top: 72,
    width: 31, height: 31, borderRadius: 16,
    backgroundColor: '#E0704C', borderWidth: 2,
    borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
});
