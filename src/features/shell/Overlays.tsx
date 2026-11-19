import { router } from 'expo-router';
import BellRing from 'lucide-react-native/icons/bell-ring';
import Square from 'lucide-react-native/icons/square';
import X from 'lucide-react-native/icons/x';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adhkarRepo, type AdhkarItemRow } from '@/database/repositories/content';
import { Button, IconButton, ProgressBar } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { HISN } from '@/content/adhkar/groups';
import { usePrayerTimes } from '@/hooks/usePrayer';
import { useDbs, useI18n, useRuntime, useSettings, useTheme, type TKey } from '@/runtime/AppProvider';
import { useAdhan, useAdhanState } from '@/services/adhan/AdhanProvider';
import { engineStatus } from '@/services/adhan/nativeEngine';
import { FARD_PRAYERS, type FardPrayer } from '@/services/prayer/times';

/** Triggers the full adhan when the app is open at a prayer time (once per prayer). */
function useAdhanWatcher() {
  const [settings] = useSettings();
  const adhan = useAdhan();
  const [now, setNow] = useState(() => new Date());
  const fired = useRef(new Set<string>());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);
  const { schedule } = usePrayerTimes(now);
  useEffect(() => {
    // On Android the native alarm service plays at prayer time (also when the app is open); do not double it.
    if (!schedule || !settings.adhan.playInApp || !settings.onboardingComplete || AppState.currentState !== 'active' || engineStatus.nativeScheduled) return;
    for (const t of schedule.times) {
      if (!FARD_PRAYERS.includes(t.name as FardPrayer)) continue;
      const p = t.name as FardPrayer;
      const key = `${p}-${t.time.toDateString()}`;
      const delta = now.getTime() - t.time.getTime();
      if (delta >= 0 && delta < 60_000 && !fired.current.has(key)) {
        fired.current.add(key);
        if (settings.notifications.prayers[p] && settings.adhan.sound[p] === 'adhan') adhan.playForPrayer(p);
      }
    }
  }, [now, schedule, settings, adhan]);
}

function AdhanOverlay() {
  const st = useAdhanState();
  const adhan = useAdhan();
  const { t } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const [settings] = useSettings();
  const insets = useSafeAreaInsets();
  if (st.mode !== 'prayer' || !st.prayer || (st.finished && !settings.adhan.showDua)) return null;
  const prayer = t(`prayers.${st.prayer}` as TKey);
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(320)}
      exiting={reducedMotion ? undefined : FadeOutUp.duration(200)}
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, alignItems: 'center' }}
      pointerEvents="box-none"
    >
      <View
        testID="adhan-overlay"
        accessibilityLiveRegion="polite"
        style={{
          width: '100%',
          maxWidth: 560,
          backgroundColor: colors.heroFrom,
          borderRadius: radius.xl,
          padding: space.lg,
          gap: space.md,
          borderWidth: 1,
          borderColor: colors.accent,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <EightPointStar size={36} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" style={{ color: colors.heroInkMuted }}>
              {st.finished ? t('adhan.duaTitle') : t('adhan.nowPlaying', { prayer })}
            </Text>
            <Text variant="title3" style={{ color: colors.heroInk }}>
              {t('adhan.timeFor', { prayer })}
            </Text>
          </View>
          <IconButton icon={X} label={t('common.close')} onPress={() => adhan.dismiss()} color="heroInk" testID="adhan-dismiss" />
        </View>
        {!st.finished ? (
          <>
            <ProgressBar progress={st.duration ? st.position / st.duration : 0} color="accent" height={4} />
            <Button label={t('adhan.stop')} icon={Square} variant="secondary" size="sm" onPress={() => adhan.stop()} testID="adhan-stop" />
          </>
        ) : (
          <Button
            label={t('adhan.duaTitle')}
            icon={BellRing}
            variant="secondary"
            size="sm"
            onPress={() => {
              adhan.dismiss();
              router.push(`/adhkar/hisn:${HISN.adhan}`);
            }}
          />
        )}
      </View>
    </Animated.View>
  );
}

/** A gentle, dismissible remembrance card shown at the configured interval while the app is open. */
function DhikrToast() {
  const [settings] = useSettings();
  const { quranStatus } = useRuntime();
  const dbs = useDbs();
  const { t, lang } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AdhkarItemRow[]>([]);
  const [shown, setShown] = useState<AdhkarItemRow | null>(null);
  const counter = useRef(0);
  const { inApp, inAppMinutes } = settings.dhikrReminders;

  useEffect(() => {
    if (quranStatus !== 'ready') return;
    adhkarRepo
      .shortDhikr(dbs.content)
      .then(setItems)
      .catch(() => undefined);
  }, [dbs, quranStatus]);

  useEffect(() => {
    if (!inApp || !items.length || !settings.onboardingComplete) return;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      setShown(items[counter.current++ % items.length] ?? null);
    }, inAppMinutes * 60_000);
    return () => clearInterval(id);
  }, [inApp, inAppMinutes, items, settings.onboardingComplete]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), 12_000);
    return () => clearTimeout(id);
  }, [shown]);

  if (!shown) return null;
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(360)}
      exiting={reducedMotion ? undefined : FadeOutUp.duration(240)}
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, alignItems: 'center' }}
      pointerEvents="box-none"
    >
      <Pressable
        testID="dhikr-toast"
        onPress={() => setShown(null)}
        accessibilityRole="button"
        accessibilityLabel={`${t('reminders.notifyDhikrTitle')}: ${shown.textAr}`}
        accessibilityHint={t('reminders.dismiss')}
        style={{
          width: '100%',
          maxWidth: 560,
          flexDirection: 'row',
          gap: space.md,
          alignItems: 'center',
          backgroundColor: colors.bgElevated,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <EightPointStar size={28} color={colors.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="accent">
            {t('reminders.notifyDhikrTitle')}
          </Text>
          <Text script="arabic" variant="callout" numberOfLines={3} style={{ fontFamily: 'Amiri_400Regular', lineHeight: 30 }}>
            {shown.textAr}
          </Text>
          {lang !== 'ar' && shown.translationEn ? (
            <Text script="latin" variant="caption" color="textMuted" numberOfLines={2}>
              {shown.translationEn}
            </Text>
          ) : null}
        </View>
        <Icon icon={X} size={16} color="textFaint" />
      </Pressable>
    </Animated.View>
  );
}

export function AppOverlays() {
  useAdhanWatcher();
  return (
    <>
      <DhikrToast />
      <AdhanOverlay />
    </>
  );
}
