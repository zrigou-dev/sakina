import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/runtime/AppProvider';

import { duration } from './motion';

/**
 * Eight-fold "khatam" lattice: two overlapping squares (one rotated 45°) per cell,
 * joined by small diamonds. Drawn once as an SVG pattern at very low opacity.
 */
const CELL = 64;
const c = CELL / 2;
const r = CELL * 0.34;
const star = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.62;
    pts.push(`${(c + rad * Math.cos(angle)).toFixed(2)},${(c + rad * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();
const links = `M0,${c}L${c - r},${c}M${c + r},${c}L${CELL},${c}M${c},0L${c},${c - r}M${c},${c + r}L${c},${CELL}`;

export interface GeometricBackdropProps {
  readonly opacity?: number;
  readonly animated?: boolean;
  readonly color?: string;
}

export const GeometricBackdrop = memo(function GeometricBackdrop({ opacity, animated = true, color }: GeometricBackdropProps) {
  const { colors, scheme, reducedMotion } = useTheme();
  const drift = useSharedValue(0);
  const shouldAnimate = animated && !reducedMotion;

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(withTiming(1, { duration: duration.ambient, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [shouldAnimate, drift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value * 6 }, { translateY: drift.value * -4 }] }));
  const stroke = color ?? colors.pattern;
  const alpha = opacity ?? (scheme === 'dark' ? 0.07 : 0.055);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[{ position: 'absolute', top: -CELL, left: -CELL, right: -CELL, bottom: -CELL }, style]}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="khatam" patternUnits="userSpaceOnUse" width={CELL} height={CELL}>
              <G stroke={stroke} strokeOpacity={alpha} strokeWidth={1} fill="none">
                <Path d={star} />
                <Path d={links} />
              </G>
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#khatam)" />
        </Svg>
      </Animated.View>
    </View>
  );
});

/** A single eight-point star glyph (completion bloom, ayah markers, empty states). */
export function EightPointStar({ size, color, fill = 'none', strokeWidth = 1.4 }: { size: number; color: string; fill?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${CELL} ${CELL}`}>
      <Path d={star} stroke={color} strokeWidth={strokeWidth * (CELL / size)} fill={fill} strokeLinejoin="round" />
    </Svg>
  );
}
