import * as Location from 'expo-location';
import { router } from 'expo-router';
import MapPin from 'lucide-react-native/icons/map-pin';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Card, EmptyState, Notice } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings, useTheme } from '@/runtime/AppProvider';
import {
  ALIGNED_TOLERANCE,
  distanceToKaabaKm,
  headingQuality,
  normalizeDegrees,
  qiblaBearing,
  relativeAngle,
  type HeadingQuality,
} from '@/services/qibla/qibla';

const SIZE = 300;
const C = SIZE / 2;

function Dial({ bearing, color, accent, faint, text }: { bearing: number; color: string; accent: string; faint: string; text: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={C} cy={C} r={C - 4} stroke={faint} strokeWidth={1} fill="none" />
      {ticks.map((d) => {
        const long = d % 30 === 0;
        const r1 = C - 10;
        const r2 = C - (long ? 24 : 16);
        return (
          <Line
            key={d}
            x1={C + r1 * Math.cos(rad(d))}
            y1={C + r1 * Math.sin(rad(d))}
            x2={C + r2 * Math.cos(rad(d))}
            y2={C + r2 * Math.sin(rad(d))}
            stroke={long ? text : faint}
            strokeWidth={long ? 1.6 : 1}
          />
        );
      })}
      {(['N', 'E', 'S', 'W'] as const).map((l, i) => (
        <SvgText
          key={l}
          x={C + (C - 40) * Math.cos(rad(i * 90))}
          y={C + (C - 40) * Math.sin(rad(i * 90)) + 6}
          fill={l === 'N' ? accent : text}
          fontSize={16}
          fontWeight="700"
          textAnchor="middle"
        >
          {l}
        </SvgText>
      ))}
      <G transform={`rotate(${bearing} ${C} ${C})`}>
        <Line x1={C} y1={C} x2={C} y2={58} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Path d={`M${C - 14},${70} L${C},${44} L${C + 14},${70} Z`} fill={color} />
        <Path d={`M${C - 11},${24} h22 v22 h-22 Z`} fill={text} stroke={accent} strokeWidth={2} />
      </G>
      <Circle cx={C} cy={C} r={6} fill={color} />
    </Svg>
  );
}

export default function Qibla() {
  const { t } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const [settings] = useSettings();
  const fmt = useFormat();
  const [heading, setHeading] = useState<number | null>(null);
  const [quality, setQuality] = useState<HeadingQuality>('unavailable');
  const [denied, setDenied] = useState(false);
  const loc = settings.location;
  const bearing = loc ? qiblaBearing(loc.latitude, loc.longitude) : 0;
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (process.env.EXPO_OS === 'web' || !loc) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setDenied(true);
        return;
      }
      try {
        sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(value);
          setQuality(headingQuality(h.accuracy, process.env.EXPO_OS === 'ios' ? 'ios' : 'android'));
        });
      } catch {
        setQuality('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [loc]);

  // Rotate the dial opposite to the heading so the Kaaba marker points the right way.
  const dialTarget = heading === null ? 0 : -heading;
  useEffect(() => {
    const cur = rotation.value;
    const delta = relativeAngle(normalizeDegrees(cur), normalizeDegrees(dialTarget));
    rotation.value = reducedMotion ? cur + delta : withTiming(cur + delta, { duration: 180 });
  }, [dialTarget, reducedMotion, rotation]);
  const dialStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (!loc) {
    return (
      <Screen back title={t('qibla.title')}>
        <EmptyState icon={MapPin} title={t('qibla.noLocation')} action={t('prayer.changeLocation')} onAction={() => router.push('/settings/location')} />
      </Screen>
    );
  }

  const rel = heading === null ? null : relativeAngle(heading, bearing);
  const aligned = rel !== null && Math.abs(rel) <= ALIGNED_TOLERANCE;

  return (
    <Screen back title={t('qibla.title')} testID="qibla-screen">
      <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.lg }}>
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: aligned ? colors.successSoft : colors.surface,
            borderWidth: 1,
            borderColor: aligned ? colors.success : colors.border,
          }}
        >
          <Animated.View style={dialStyle}>
            <Dial bearing={bearing} color={aligned ? colors.success : colors.primary} accent={colors.accent} faint={colors.borderStrong} text={colors.text} />
          </Animated.View>
        </View>
        <Text variant="title2" align="center" testID="qibla-instruction" accessibilityLiveRegion="polite">
          {rel === null
            ? t('qibla.bearing', { degrees: fmt.number(Math.round(bearing * 10) / 10, 1) })
            : aligned
              ? t('qibla.facing')
              : rel > 0
                ? t('qibla.turnRight', { degrees: fmt.digits(Math.round(rel)) })
                : t('qibla.turnLeft', { degrees: fmt.digits(Math.round(-rel)) })}
        </Text>
        {rel !== null ? (
          <Text variant="subhead" color="textMuted">
            {t('qibla.bearing', { degrees: fmt.number(Math.round(bearing * 10) / 10, 1) })}
          </Text>
        ) : null}
        <Text variant="subhead" color="textMuted" testID="qibla-distance">
          {t('qibla.distance', { km: fmt.number(Math.round(distanceToKaabaKm(loc.latitude, loc.longitude))) })} · {fmt.placeName(loc)}
        </Text>
      </View>
      <View style={{ gap: space.md }}>
        {denied ? <Notice tone="warning" text={t('qibla.permission')} /> : null}
        {heading === null ? (
          <Notice text={t('qibla.unavailable')} />
        ) : (
          <Notice
            tone={quality === 'good' ? 'accent' : 'warning'}
            text={t('qibla.accuracy', { level: t(`qibla.${quality === 'unavailable' ? 'poor' : quality}`) })}
          />
        )}
        <Card tone="muted">
          <Text variant="headline">{t('qibla.calibrateTitle')}</Text>
          <Text variant="subhead" color="textMuted" style={{ marginTop: space.xs }}>
            {t('qibla.calibrate')}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
