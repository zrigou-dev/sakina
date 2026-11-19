import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { GeometricBackdrop } from '@/design-system/GeometricBackdrop';
import { easing, duration } from '@/design-system/motion';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { formatDuration } from '@/localization/format';
import { useI18n, useTheme, type TKey } from '@/runtime/AppProvider';
import { splitDuration, type NextPrayer, type PrayerTime } from '@/services/prayer/times';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const W = 280;
const H = 120;
const PAD = 14;
/** Quadratic "sun path" arc from the previous time to the next one. */
const P0 = { x: PAD, y: H - PAD };
const P1 = { x: W / 2, y: -H * 0.35 };
const P2 = { x: W - PAD, y: H - PAD };
const ARC = `M${P0.x},${P0.y} Q${P1.x},${P1.y} ${P2.x},${P2.y}`;

/** Sun-path arc: a gold dot travels between the previous and next prayer. */
const SunArc = memo(function SunArc({ progress, color, track, isRTL }: { progress: number; color: string; track: string; isRTL: boolean }) {
  const { reducedMotion } = useTheme();
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = reducedMotion ? progress : withTiming(progress, { duration: duration.slow, easing: easing.standard });
  }, [progress, reducedMotion, p]);
  const props = useAnimatedProps(() => {
    const t = isRTL ? 1 - p.value : p.value;
    const x = (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x;
    const y = (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y;
    return { cx: x, cy: y };
  });
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <Path d={ARC} stroke={track} strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" fill="none" />
      <Circle cx={P0.x} cy={P0.y} r={3} fill={track} />
      <Circle cx={P2.x} cy={P2.y} r={3} fill={track} />
      <AnimatedCircle r={14} fill={color} opacity={0.22} animatedProps={props} />
      <AnimatedCircle r={6.5} fill={color} animatedProps={props} />
    </Svg>
  );
});

export interface PrayerHeroProps {
  readonly next: NextPrayer;
  readonly today: readonly PrayerTime[];
  readonly now: Date;
  readonly placeName: string;
  readonly onPress?: () => void;
}

/** The signature next-prayer card: deep gradient, faint lattice, sun-path arc and a calm countdown. */
export function PrayerHero({ next, today, now, placeName, onPress }: PrayerHeroProps) {
  const { colors } = useTheme();
  const { t, isRTL, lang } = useI18n();
  const fmt = useFormat();
  const { hours, minutes, seconds } = splitDuration(next.msRemaining);
  const countdown = formatDuration(hours, minutes, seconds, lang);
  const name = t(`prayers.${next.next.name}` as TKey);
  const accessibilityLabel = `${t('home.nextPrayer')}: ${name}, ${fmt.time(next.next.time)}, ${t('home.inTime', { time: countdown })}`;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={accessibilityLabel}
      testID="prayer-hero"
      style={{ borderRadius: radius.xl, overflow: 'hidden' }}
    >
      <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.xl, gap: space.md }}>
        <GeometricBackdrop color={colors.accent} opacity={0.12} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: space.xs, flex: 1 }}>
            <Text variant="overline" style={{ color: colors.heroInkMuted }}>
              {t('home.nextPrayer')}
            </Text>
            <Text variant="title1" style={{ color: colors.heroInk }}>
              {name}
            </Text>
            <Text variant="subhead" style={{ color: colors.heroInkMuted }} numberOfLines={1}>
              {placeName}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="title2" style={{ color: colors.heroInk, fontVariant: ['tabular-nums'] }}>
              {fmt.time(next.next.time)}
            </Text>
            {next.next.time.toDateString() !== now.toDateString() ? (
              <Text variant="caption" style={{ color: colors.accent }} testID="hero-tomorrow">
                {t('home.tomorrow')}
              </Text>
            ) : null}
            {next.next.adjustedBy !== 0 ? (
              <Text variant="caption" style={{ color: colors.accent }}>
                {t('prayer.adjusted', { value: `${next.next.adjustedBy > 0 ? '+' : ''}${next.next.adjustedBy}` })}
              </Text>
            ) : null}
          </View>
        </View>

        <View>
          <SunArc progress={next.progress} color={colors.accent} track={colors.heroInkMuted} isRTL={isRTL} />
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: space.xs }]}>
            <Text variant="numericLarge" style={{ color: colors.heroInk }} accessibilityLiveRegion="polite" testID="countdown">
              {countdown}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.xs }}>
          {today
            .filter((p) => p.name !== 'sunrise')
            .map((p) => {
              const isNext = p.name === next.next.name && p.time.getTime() === next.next.time.getTime();
              const passed = p.time.getTime() <= now.getTime();
              return (
                <View
                  key={p.name}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: space.sm,
                    borderRadius: radius.md,
                    backgroundColor: isNext ? 'rgba(255,255,255,0.14)' : 'transparent',
                    gap: 2,
                  }}
                >
                  <Text variant="caption" align="center" numberOfLines={1} style={{ color: isNext ? colors.accent : colors.heroInkMuted }}>
                    {t(`prayers.${p.name}` as TKey)}
                  </Text>
                  <Text
                    variant="footnote"
                    weight="semibold"
                    align="center"
                    style={{ color: passed && !isNext ? colors.heroInkMuted : colors.heroInk, fontVariant: ['tabular-nums'] }}
                  >
                    {fmt.time(p.time)}
                  </Text>
                </View>
              );
            })}
        </View>
      </LinearGradient>
    </PressableScale>
  );
}
