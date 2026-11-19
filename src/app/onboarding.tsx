import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Check from 'lucide-react-native/icons/check';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import MapPin from 'lucide-react-native/icons/map-pin';
import Moon from 'lucide-react-native/icons/moon';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Sun from 'lucide-react-native/icons/sun';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityPicker } from '@/features/location/CityPicker';
import { useLocate } from '@/features/location/useLocate';
import { Badge, Button, Card, Notice, ProgressBar } from '@/design-system/components';
import { EightPointStar, GeometricBackdrop } from '@/design-system/GeometricBackdrop';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, radius, space } from '@/design-system/tokens';
import { duration } from '@/design-system/motion';
import { useFormat } from '@/hooks/useFormat';
import { LANGUAGE_INFO, LANGUAGES, type Language } from '@/localization/languages';
import { useI18n, useRuntime, useSettings, useTheme } from '@/runtime/AppProvider';
import { METHOD_IDS, suggestMadhab, suggestMethod, type MethodId } from '@/services/prayer/methods';
import { notificationsSupported, requestPermission } from '@/services/notifications/scheduler';
import type { ThemePreference } from '@/state/settings';

const STEPS = ['welcome', 'language', 'theme', 'location', 'method', 'notifications', 'finish'] as const;
type Step = (typeof STEPS)[number];

function OptionCard({
  selected,
  onPress,
  title,
  subtitle,
  icon,
  testID,
  trailing,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  icon?: typeof Sun;
  testID?: string;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      haptic="selection"
      accessibilityRole="radio"
      aria-selected={selected}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {icon ? <Icon icon={icon} color={selected ? 'primary' : 'textMuted'} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="footnote" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: selected ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Icon icon={Check} size={14} color="primaryInk" strokeWidth={2.5} /> : null}
      </View>
    </PressableScale>
  );
}

export default function Onboarding() {
  const { t, lang } = useI18n();
  const { colors, reducedMotion } = useTheme();
  const [settings, update] = useSettings();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [showCities, setShowCities] = useState(false);
  const [notifState, setNotifState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const { state: locateState, locate } = useLocate();
  const step: Step = STEPS[index]!;
  const total = STEPS.length - 2;

  const next = () => setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const finish = async () => {
    await update({ onboardingComplete: true });
    router.replace('/');
  };

  const suggested: MethodId = suggestMethod(settings.location?.country);

  const applyLocation = async (loc: NonNullable<typeof settings.location>) => {
    setShowCities(false);
    await update({
      location: loc,
      prayer: { method: suggestMethod(loc.country), madhab: suggestMadhab(loc.country) },
    });
  };

  let body: ReactNode = null;
  let primary: { label: string; onPress: () => void; disabled?: boolean } = { label: t('common.continue'), onPress: next };

  switch (step) {
    case 'welcome':
      body = (
        <View style={{ alignItems: 'center', gap: space.xl, paddingTop: space.xxxl }}>
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <EightPointStar size={120} color={colors.accent} strokeWidth={1.2} />
            <View style={{ position: 'absolute' }}>
              <EightPointStar size={64} color={colors.primary} strokeWidth={1.6} />
            </View>
          </View>
          <Text variant="display" align="center" script="arabic" style={{ color: colors.primary }}>
            سكينة
          </Text>
          <Text variant="title2" align="center">
            {t('onboarding.welcomeTitle')}
          </Text>
          <Text variant="body" color="textMuted" align="center" style={{ maxWidth: 440 }}>
            {t('onboarding.welcomeBody')}
          </Text>
        </View>
      );
      primary = { label: t('onboarding.begin'), onPress: next };
      break;

    case 'language':
      body = (
        <View style={{ gap: space.md }}>
          {LANGUAGES.map((l: Language) => (
            <OptionCard
              key={l}
              testID={`lang-${l}`}
              selected={settings.language === l}
              onPress={() => update({ language: l })}
              title={LANGUAGE_INFO[l].nativeName}
              subtitle={l === 'ar' ? 'من اليمين إلى اليسار' : l === 'en' ? 'Left to right' : 'De gauche à droite'}
            />
          ))}
        </View>
      );
      break;

    case 'theme':
      body = (
        <View style={{ gap: space.md }}>
          {(
            [
              ['system', t('settings.themeSystem'), Smartphone],
              ['light', t('settings.themeLight'), Sun],
              ['dark', t('settings.themeDark'), Moon],
            ] as [ThemePreference, string, typeof Sun][]
          ).map(([v, label, icon]) => (
            <OptionCard key={v} testID={`theme-${v}`} selected={settings.theme === v} onPress={() => update({ theme: v })} title={label} icon={icon} />
          ))}
        </View>
      );
      break;

    case 'location':
      body = (
        <View style={{ gap: space.md }}>
          {settings.location ? (
            <Card tone="primary" testID="location-set">
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <Icon icon={MapPin} color="primary" />
                <Text variant="headline" style={{ flex: 1 }}>
                  {t('onboarding.locationSet', { name: fmt.placeName(settings.location) })}
                </Text>
              </View>
            </Card>
          ) : null}
          {locateState === 'denied' ? <Notice tone="warning" text={t('onboarding.locationDenied')} /> : null}
          {locateState === 'failed' ? <Notice tone="warning" text={t('onboarding.locationFailed')} /> : null}
          {!showCities ? (
            <>
              <Button
                label={locateState === 'locating' ? t('onboarding.locating') : t('onboarding.useLocation')}
                icon={LocateFixed}
                loading={locateState === 'locating'}
                testID="use-location"
                onPress={async () => {
                  const loc = await locate();
                  if (loc) await applyLocation(loc);
                  else setShowCities(true);
                }}
              />
              <Button label={t('onboarding.chooseCity')} variant="secondary" icon={MapPin} testID="choose-city" onPress={() => setShowCities(true)} />
            </>
          ) : (
            <CityPicker onSelect={applyLocation} />
          )}
        </View>
      );
      primary = { label: settings.location ? t('common.continue') : t('common.skip'), onPress: next };
      break;

    case 'method':
      body = (
        <View style={{ gap: space.md }}>
          {METHOD_IDS.filter(
            (m) =>
              m === suggested ||
              m === settings.prayer.method ||
              ['muslim_world_league', 'umm_al_qura', 'egyptian', 'karachi', 'north_america', 'france_uoif', 'morocco', 'algeria', 'turkey'].includes(m),
          ).map((m) => (
            <OptionCard
              key={m}
              testID={`method-${m}`}
              selected={settings.prayer.method === m}
              onPress={() => update({ prayer: { method: m } })}
              title={fmt.methodName(m)}
              subtitle={fmt.methodAngles(m)}
              trailing={m === suggested && settings.location ? <Badge label={t('onboarding.suggested')} tone="accent" /> : null}
            />
          ))}
          <Text variant="title3" style={{ marginTop: space.lg }}>
            {t('onboarding.asrTitle')}
          </Text>
          <Text variant="subhead" color="textMuted">
            {t('onboarding.asrBody')}
          </Text>
          <OptionCard
            testID="asr-shafi"
            selected={settings.prayer.madhab === 'shafi'}
            onPress={() => update({ prayer: { madhab: 'shafi' } })}
            title={t('onboarding.asrStandard')}
            subtitle={t('onboarding.asrStandardDesc')}
          />
          <OptionCard
            testID="asr-hanafi"
            selected={settings.prayer.madhab === 'hanafi'}
            onPress={() => update({ prayer: { madhab: 'hanafi' } })}
            title={t('onboarding.asrHanafi')}
            subtitle={t('onboarding.asrHanafiDesc')}
          />
        </View>
      );
      break;

    case 'notifications':
      body = (
        <View style={{ gap: space.md, alignItems: 'stretch' }}>
          <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={Bell} size={36} color="accent" />
            </View>
          </View>
          {!notificationsSupported ? <Notice text={t('onboarding.notificationsWeb')} /> : null}
          {notifState === 'denied' ? <Notice tone="warning" text={t('onboarding.notificationsDenied')} /> : null}
          {notifState === 'granted' ? <Notice tone="accent" icon={Check} text={t('common.done')} /> : null}
          {notificationsSupported && notifState === 'idle' ? (
            <Button
              label={t('onboarding.enableNotifications')}
              icon={Bell}
              testID="enable-notifications"
              onPress={async () => {
                const p = await requestPermission();
                setNotifState(p === 'granted' ? 'granted' : 'denied');
              }}
            />
          ) : null}
        </View>
      );
      primary = { label: notifState === 'granted' || !notificationsSupported ? t('common.continue') : t('common.skip'), onPress: next };
      break;

    case 'finish':
      body = (
        <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xxxl }}>
          <EightPointStar size={96} color={colors.accent} fill={colors.accentSoft} />
          <Text variant="title1" align="center">
            {t('onboarding.finishTitle')}
          </Text>
          <Text variant="body" color="textMuted" align="center" style={{ maxWidth: 420 }}>
            {t('onboarding.finishBody')}
          </Text>
          {quranStatus === 'pending' ? (
            <Text variant="footnote" color="textFaint" align="center">
              {t('onboarding.preparingQuran')}
            </Text>
          ) : null}
        </View>
      );
      primary = { label: t('onboarding.start'), onPress: finish };
      break;
  }

  const titles: Partial<Record<Step, [string, string]>> = {
    language: [t('onboarding.languageTitle'), t('onboarding.languageBody')],
    theme: [t('onboarding.themeTitle'), t('onboarding.themeBody')],
    location: [t('onboarding.locationTitle'), t('onboarding.locationBody')],
    method: [t('onboarding.methodTitle'), t('onboarding.methodBody')],
    notifications: [t('onboarding.notificationsTitle'), t('onboarding.notificationsBody')],
  };
  const heading = titles[step];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="onboarding">
      <GeometricBackdrop />
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.gutter,
          gap: space.sm,
          width: '100%',
          maxWidth: MAX_READING_WIDTH,
          alignSelf: 'center',
        }}
      >
        {index > 0 && index < STEPS.length - 1 ? (
          <>
            <Text variant="caption" color="textMuted" testID="onboarding-step">
              {t('onboarding.step', { current: index, total })}
            </Text>
            <ProgressBar progress={index / total} color="accent" height={4} />
          </>
        ) : (
          <View style={{ height: 24 }} />
        )}
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingTop: space.lg,
          paddingBottom: space.xxl,
          width: '100%',
          maxWidth: MAX_READING_WIDTH,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={`${step}-${lang}`}
          entering={reducedMotion ? undefined : FadeIn.duration(duration.base)}
          exiting={reducedMotion ? undefined : FadeOut.duration(duration.instant)}
          style={{ gap: space.lg }}
        >
          {heading ? (
            <View style={{ gap: space.sm }}>
              <Text variant="title1" accessibilityRole="header">
                {heading[0]}
              </Text>
              <Text variant="body" color="textMuted">
                {heading[1]}
              </Text>
            </View>
          ) : null}
          {body}
        </Animated.View>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.lg,
          paddingTop: space.md,
          gap: space.sm,
          width: '100%',
          maxWidth: MAX_READING_WIDTH,
          alignSelf: 'center',
        }}
      >
        <Button label={primary.label} onPress={primary.onPress} size="lg" testID="onboarding-next" disabled={primary.disabled} />
        {index > 0 && step !== 'finish' ? <Button label={t('common.back')} variant="ghost" onPress={back} testID="onboarding-back" /> : null}
      </View>
    </View>
  );
}
