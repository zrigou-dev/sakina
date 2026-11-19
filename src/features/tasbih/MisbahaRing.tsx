import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { EightPointStar } from '@/design-system/GeometricBackdrop';

/** A traditional misbaha string of 33 beads: one full turn of the ring is one round. */
export const BEADS = 33;
export const BEAD_STEP = 360 / BEADS;

const GOLD = '#E3BC70';

/** The beads, cord, imām bead and tassel. Static: the parent rotates the whole layer. */
const Beads = memo(function Beads({ size }: { size: number }) {
  const c = size / 2;
  const R = size * 0.305;
  const r = (2 * Math.PI * R) / BEADS / 2 - 1.4;
  const pos = (i: number) => {
    const a = (i * BEAD_STEP * Math.PI) / 180;
    return { x: c + R * Math.sin(a), y: c - R * Math.cos(a) };
  };
  const knotY = c - R - r * 1.9;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="bead" cx="34%" cy="30%" r="78%">
          <Stop offset="0" stopColor="#F8E3AE" />
          <Stop offset="0.42" stopColor="#C98E3F" />
          <Stop offset="1" stopColor="#5E3612" />
        </RadialGradient>
        <RadialGradient id="imam" cx="38%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#FFF4D0" />
          <Stop offset="0.45" stopColor="#E0A94B" />
          <Stop offset="1" stopColor="#7A4B14" />
        </RadialGradient>
      </Defs>

      {/* Tassel: a knot and fanned strands hanging outward from the imām bead. */}
      <G>
        {[-14, -8, -3, 3, 8, 14].map((dx, k) => (
          <Path
            key={k}
            d={`M ${c} ${knotY} Q ${c + dx * 0.55} ${knotY - size * 0.04} ${c + dx} ${knotY - size * 0.078}`}
            stroke={k % 2 === 0 ? GOLD : '#14795F'}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <Circle cx={c} cy={knotY + 1} r={r * 0.62} fill="url(#imam)" />
        <Rect x={c - r * 0.5} y={knotY - r * 0.35} width={r} height={r * 0.5} rx={r * 0.18} fill={GOLD} />
      </G>

      {/* Cord */}
      <Circle cx={c} cy={c} r={R} fill="none" stroke={GOLD} strokeOpacity={0.85} strokeWidth={2} />

      {Array.from({ length: BEADS }, (_, i) => {
        const { x, y } = pos(i);
        const imam = i === 0;
        const rx = imam ? r * 1.12 : r;
        const ry = imam ? r * 1.62 : r;
        return (
          <G key={i}>
            <Ellipse cx={x + 1.6} cy={y + 2.6} rx={rx} ry={ry} fill="#000" opacity={0.3} />
            <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill={imam ? 'url(#imam)' : 'url(#bead)'} />
            <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke="#3B2209" strokeOpacity={0.35} strokeWidth={0.8} />
            <Ellipse cx={x - rx * 0.32} cy={y - ry * 0.36} rx={rx * 0.3} ry={ry * 0.24} fill="#fff" opacity={0.4} />
          </G>
        );
      })}
    </Svg>
  );
});

/**
 * The misbaha panel. `angle` (degrees, driven by the parent) turns the ring; the gold focus ring at the top never moves, so
 * each tap pulls the next bead into it. `children` sit in the middle (the count).
 */
export function MisbahaRing({ size, angle, children }: { size: number; angle: SharedValue<number>; children?: ReactNode }) {
  const c = size / 2;
  const R = size * 0.305;
  const r = (2 * Math.PI * R) / BEADS / 2 - 1.4;
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));
  return (
    <View style={{ width: size, height: size }}>
      {/* Panel */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="panel" cx="50%" cy="38%" r="80%">
            <Stop offset="0" stopColor="#14795F" />
            <Stop offset="0.62" stopColor="#0B4636" />
            <Stop offset="1" stopColor="#072F25" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} rx={size * 0.09} fill="url(#panel)" />
        <Circle cx={c} cy={c} r={R * 0.74} fill="none" stroke={GOLD} strokeOpacity={0.16} strokeWidth={1.2} />
        <Circle cx={c} cy={c} r={R * 1.17} fill="none" stroke={GOLD} strokeOpacity={0.12} strokeWidth={1} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: 0.1 }]} pointerEvents="none">
        <EightPointStar size={size * 0.46} color={GOLD} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, spin]} pointerEvents="none">
        <Beads size={size} />
      </Animated.View>

      {/* Focus ring: the bead in it is the one being counted. */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={c} cy={c - R} r={r * 1.55} fill="none" stroke={GOLD} strokeWidth={2.2} />
        <Circle cx={c} cy={c - R} r={r * 1.95} fill="none" stroke={GOLD} strokeOpacity={0.25} strokeWidth={5} />
      </Svg>

      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}
