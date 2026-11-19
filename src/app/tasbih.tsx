import * as Haptics from 'expo-haptics';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { tasbihRepo } from '@/database/repositories/user';
import { Button, Chip, Switch } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { BEAD_STEP, MisbahaRing } from '@/features/tasbih/MisbahaRing';
import { useFormat } from '@/hooks/useFormat';
import { useDbs, useI18n, useSettings, useTheme } from '@/runtime/AppProvider';
import { increment, resetCounter, type CounterState } from '@/services/counter/counter';

const TARGETS = [null, 33, 99, 100] as const;
const SPRING = { stiffness: 210, damping: 17, mass: 0.8 } as const;

/** A misbaha: each tap turns the ring of beads one bead; one full turn is a round of 33. */
export default function Tasbih() {
  const { t } = useI18n();
  const { reducedMotion } = useTheme();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const { width } = useWindowDimensions();
  const size = Math.min(width - space.gutter * 2, 400);
  const [state, setState] = useState<CounterState>({ count: 0, target: 33, rounds: 0 });
  const [id, setId] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const angle = useSharedValue(0);
  const pulse = useSharedValue(1);
  /** Beads turned since the last reset (never wraps, so the ring keeps turning the same way). */
  const ticks = useRef(0);
  const base = useRef(0);

  useEffect(() => {
    (async () => {
      const list = await tasbihRepo.list(dbs.user);
      const first = list[0];
      if (first) {
        setId(first.id);
        setState({ count: first.count, target: first.target, rounds: 0 });
        ticks.current = first.count;
        angle.set(first.count * BEAD_STEP);
      } else {
        setId(await tasbihRepo.create(dbs.user, 'default', 33));
      }
    })().catch(() => undefined);
  }, [dbs, angle]);

  const persist = (count: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => id !== null && tasbihRepo.setCount(dbs.user, id, count).catch(() => undefined), 400);
  };

  const turnTo = (next: number) => {
    const target = base.current + next * BEAD_STEP;
    angle.set(reducedMotion ? target : withSpring(target, SPRING));
  };

  const tap = () => {
    const r = increment(state, true);
    setState(r.state);
    persist(r.state.count);
    ticks.current += 1;
    turnTo(ticks.current);
    if (!reducedMotion)
      pulse.set(
        r.completed
          ? withSequence(withTiming(1.035, { duration: 120 }), withSpring(1, SPRING))
          : withSequence(withTiming(0.99, { duration: 50 }), withTiming(1, { duration: 120 })),
      );
    if (settings.tasbihHaptics && process.env.EXPO_OS !== 'web') {
      if (r.completed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  };

  const reset = (target: number | null) => {
    setState({ ...resetCounter(state), target });
    persist(0);
    // Come to rest with the imām bead and tassel back at the top, by the shortest way round.
    base.current = Math.round(angle.get() / 360) * 360;
    ticks.current = 0;
    angle.set(reducedMotion ? base.current : withTiming(base.current, { duration: 450 }));
  };

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  return (
    <Screen back title={t('tasbih.title')} testID="tasbih-screen">
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
        {TARGETS.map((tg) => (
          <Chip
            key={String(tg)}
            label={tg === null ? t('tasbih.noTarget') : fmt.digits(tg)}
            selected={state.target === tg}
            onPress={() => reset(tg)}
            testID={`tasbih-target-${tg ?? 'free'}`}
          />
        ))}
      </View>

      <Pressable
        onPress={tap}
        accessibilityRole="button"
        accessibilityLabel={`${t('tasbih.tap')}: ${state.count}`}
        testID="tasbih-tap"
        style={{ alignItems: 'center', paddingVertical: space.xl }}
      >
        <Animated.View style={style}>
          <MisbahaRing size={size} angle={angle}>
            <View style={{ alignItems: 'center', marginTop: size * 0.03 }}>
              <Text variant="numericLarge" align="center" testID="tasbih-count" style={{ fontSize: size * 0.2, lineHeight: size * 0.23, color: '#FFFFFF' }}>
                {fmt.digits(state.count)}
              </Text>
              {state.target ? (
                <Text variant="callout" align="center" style={{ color: '#E3BC70' }}>
                  {`\u2066/ ${fmt.digits(state.target)}\u2069`}
                </Text>
              ) : null}
            </View>
          </MisbahaRing>
        </Animated.View>
        <Text variant="subhead" color="textMuted" style={{ marginTop: space.lg }} testID="tasbih-hint">
          {state.rounds ? t('tasbih.rounds', { count: state.rounds }) : t('tasbih.tap')}
        </Text>
      </Pressable>

      <View style={{ gap: space.md }}>
        <Button label={t('common.reset')} icon={RotateCcw} variant="secondary" testID="tasbih-reset" onPress={() => reset(state.target)} />
        {process.env.EXPO_OS !== 'web' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="callout">{t('tasbih.haptics')}</Text>
            <Switch value={settings.tasbihHaptics} onValueChange={(v) => update({ tasbihHaptics: v })} label={t('tasbih.haptics')} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
