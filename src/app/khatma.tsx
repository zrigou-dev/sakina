import { router } from 'expo-router';
import BookOpen from 'lucide-react-native/icons/book-open';
import Check from 'lucide-react-native/icons/check';
import { View } from 'react-native';

import { khatmaRepo } from '@/database/repositories/user';
import { Button, Card, Chip, FadeIn, ProgressRing, SectionHeader } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useSettings, useTheme } from '@/runtime/AppProvider';
import { KHATMA_PRESETS, khatmaDay, khatmaPortion, khatmaProgress } from '@/services/quran/khatma';
import { getSurah } from '@/services/quran/navigation';
import { toISODate } from '@/utils/date';

export default function Khatma() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const dbs = useDbs();
  const fmt = useFormat();
  const done = useLoader(() => khatmaRepo.doneDays(dbs.user), [dbs]);
  const plan = settings.khatma;
  const doneSet = done.data ?? new Set<number>();
  const label = (v: { surah: number; ayah: number }) => `${fmt.surahShort(getSurah(v.surah))} ${fmt.digits(v.ayah)}`;

  if (!plan) {
    return (
      <Screen back title={t('khatma.title')} subtitle={t('khatma.intro')} large testID="khatma-screen">
        <Card style={{ gap: space.md }}>
          <Text variant="headline">{t('khatma.choose')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {KHATMA_PRESETS.map((d) => (
              <Chip
                key={d}
                label={t('khatma.days', { count: d })}
                testID={`khatma-${d}`}
                onPress={async () => {
                  await khatmaRepo.reset(dbs.user);
                  await update({ khatma: { days: d, startedOn: toISODate(new Date()) } });
                  bumpDataVersion();
                }}
              />
            ))}
          </View>
          {KHATMA_PRESETS.map((d) => (
            <Text key={d} variant="footnote" color="textMuted">
              {t('khatma.days', { count: d })} → {t('khatma.ayahsToday', { count: khatmaPortion(d, 1).ayahs })} ≈ {fmt.digits(Math.round(604 / d))}{' '}
              {t('quran.pageN', { n: '' }).trim()}
            </Text>
          ))}
        </Card>
      </Screen>
    );
  }

  const today = khatmaDay(plan.startedOn, plan.days, new Date());
  const portion = khatmaPortion(plan.days, today);
  const progress = khatmaProgress(plan.days, doneSet);
  const finished = doneSet.size >= plan.days;

  return (
    <Screen back title={t('khatma.title')} large testID="khatma-screen">
      <FadeIn index={0}>
        <Card style={{ alignItems: 'center', gap: space.md }}>
          <ProgressRing progress={progress} size={140} stroke={9} color="accent">
            <Text variant="title2" align="center">
              {t('common.percent', { value: Math.round(progress * 100) })}
            </Text>
          </ProgressRing>
          <Text variant="callout" color="textMuted">
            {t('khatma.dayOf', { day: fmt.digits(today), total: fmt.digits(plan.days) })}
          </Text>
          {finished ? (
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <EightPointStar size={48} color={colors.accent} fill={colors.accentSoft} />
              <Text variant="headline" align="center">
                {t('khatma.finished')}
              </Text>
            </View>
          ) : null}
        </Card>
      </FadeIn>
      <SectionHeader title={t('khatma.today')} />
      <Card tone="primary" style={{ gap: space.sm }}>
        <Text variant="headline">{t('khatma.portion', { from: label(portion.from), to: label(portion.to) })}</Text>
        <Text variant="footnote" color="textMuted">
          {t('khatma.ayahsToday', { count: portion.ayahs })} · {t('quran.pageN', { n: `${fmt.digits(portion.fromPage)}–${fmt.digits(portion.toPage)}` })}
        </Text>
        <Button
          label={t('khatma.read')}
          icon={BookOpen}
          onPress={() => router.push(`/quran/${portion.from.surah}?ayah=${portion.from.ayah}`)}
          testID="khatma-read"
        />
      </Card>
      <SectionHeader title={t('khatma.title')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {Array.from({ length: plan.days }, (_, i) => i + 1).map((d) => {
          const isDone = doneSet.has(d);
          return (
            <PressableScale
              key={d}
              testID={`khatma-day-${d}`}
              accessibilityRole="checkbox"
              aria-checked={isDone}
              accessibilityLabel={`${t('khatma.dayOf', { day: d, total: plan.days })}${isDone ? `, ${t('common.done')}` : ''}`}
              onPress={async () => {
                await khatmaRepo.toggle(dbs.user, d);
                bumpDataVersion();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDone ? colors.accent : d === today ? colors.primarySoft : colors.surface,
                borderWidth: 1,
                borderColor: d === today ? colors.primary : colors.border,
              }}
            >
              {isDone ? (
                <Icon icon={Check} size={18} color="accentInk" />
              ) : (
                <Text variant="footnote" fixedSize>
                  {fmt.digits(d)}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </View>
      <Text variant="footnote" color="textMuted" style={{ marginTop: space.md }}>
        {t('khatma.behind')}
      </Text>
      <Button
        label={t('khatma.stop')}
        variant="ghost"
        style={{ marginTop: space.lg }}
        onPress={async () => {
          await khatmaRepo.reset(dbs.user);
          await update({ khatma: null });
          bumpDataVersion();
        }}
        testID="khatma-stop"
      />
    </Screen>
  );
}
