import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/runtime/AppProvider';

import { duration, PRESS_SCALE, spring } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
  readonly scaleTo?: number;
  readonly haptic?: 'light' | 'selection' | 'none';
}

/** Gentle press feedback: a slight scale and dim on the UI thread; honours reduced motion. */
export function PressableScale({
  style,
  children,
  scaleTo = PRESS_SCALE,
  haptic = 'none',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const { reducedMotion } = useTheme();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    opacity: 1 - 0.12 * pressed.value,
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      aria-disabled={!!disabled}
      onPressIn={(e) => {
        pressed.value = reducedMotion ? withTiming(1, { duration: duration.instant }) : withSpring(1, spring.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = reducedMotion ? withTiming(0, { duration: duration.instant }) : withSpring(0, spring.press);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'light' && process.env.EXPO_OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        if (haptic === 'selection' && process.env.EXPO_OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: 0.45 } : null]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
