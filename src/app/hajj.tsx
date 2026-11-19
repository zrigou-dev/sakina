import Check from 'lucide-react-native/icons/check';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import { useState } from 'react';
import { View } from 'react-native';

import { quranRepo } from '@/database/repositories/content';
import { hajjRepo } from '@/database/repositories/user';
import { Button, Card, Notice, ProgressBar, ProgressRing, SectionHeader, SegmentedControl } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { HAJJ_STEPS, UMRAH_STEPS, type HajjStep } from '@/features/hajj/steps';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { globalIndex } from '@/services/quran/navigation';

function RoundCounter({ label }: { label: string }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [n, setN] = useState(0);
  return (
    <View style={{ alignItems: 'center', gap: space.sm, flex: 1 }}>
      <PressableScale
        onPress={() => setN((v) => Math.min(7, v + 1))}
        haptic="light"
        accessibilityLabel={`${label}: ${t('hajj.round', { n: Math.min(7, n + 1) })}`}
        testID={`counter-${label}`}
      >
        <ProgressRing progress={n / 7} size={96} stroke={7} color={n === 7 ? 'accent' : 'primary'}>
          <Text variant="title2" align="center" fixedSize>
            {fmt.digits(n)}
          </Text>
        </ProgressRing>
      </PressableScale>
      <Text variant="headline">{label}</Text>
      <Text variant="footnote" color="textMuted" align="center">
        {n === 7 ? t('hajj.roundsDone') : t('hajj.round', { n: fmt.digits(n + 1) })}
      </Text>
      <Button label={t('common.reset')} icon={RotateCcw} variant="ghost" size="sm" onPress={() => setN(0)} />
    </View>
  );
}

function StepVerses({ step }: { step: HajjStep }) {
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const verses = useLoader(async () => {
    if (!step.verses || quranStatus !== 'ready') return [];
    const all = await Promise.all(
      step.verses.map((v) => quranRepo.range(dbs.content, globalIndex({ surah: v.surah, ayah: v.from }), globalIndex({ surah: v.surah, ayah: v.to }))),
    );
    return all.flat();
  }, [step.id, quranStatus]);
  if (!verses.data?.length) return null;
  return (
    <View style={{ gap: space.sm, marginTop: space.sm }}>
      {verses.data.map((a) => (
        <AyahText key={a.id} text={a.text} ayah={a.ayah} size={20} />
      ))}
    </View>
  );
}

export default function Hajj() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const fmt = useFormat();
  const [journey, setJourney] = useState<'umrah' | 'hajj'>('umrah');
  const [open, setOpen] = useState<string | null>(null);
  const steps = journey === 'hajj' ? HAJJ_STEPS : UMRAH_STEPS;
  const done = useLoader(() => hajjRepo.done(dbs.user, journey), [dbs, journey]);
  const doneSet = new Set(done.data ?? []);
  const count = steps.filter((s) => doneSet.has(s.id)).length;

  return (
    <Screen back title={t('hajj.title')} subtitle={t('hajj.intro')} large testID="hajj-screen">
      <SegmentedControl
        value={journey}
        onChange={setJourney}
        testID="journey-switch"
        options={[
          { value: 'umrah', label: t('hajj.umrah') },
          { value: 'hajj', label: t('hajj.hajj') },
        ]}
      />
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Text variant="footnote" color="textMuted">
          {t('hajj.progress', { done: fmt.digits(count), total: fmt.digits(steps.length) })}
        </Text>
        <ProgressBar progress={count / steps.length} color="accent" />
        <Notice tone="warning" text={t('hajj.reviewNote')} />
      </View>

      <SectionHeader title={journey === 'hajj' ? t('hajj.hajj') : t('hajj.umrah')} />
      <View style={{ gap: space.sm }}>
        {steps.map((s, i) => {
          const isDone = doneSet.has(s.id);
          const expanded = open === s.id;
          return (
            <Card key={s.id} padded={false} testID={`step-${s.id}`}>
              <PressableScale
                onPress={() => setOpen(expanded ? null : s.id)}
                scaleTo={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}
                aria-expanded={expanded}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDone ? colors.success : colors.surfaceMuted,
                  }}
                >
                  {isDone ? (
                    <Icon icon={Check} size={18} color="primaryInk" />
                  ) : (
                    <Text variant="callout" fixedSize>
                      {fmt.digits(i + 1)}
                    </Text>
                  )}
                </View>
                <Text variant="headline" style={{ flex: 1 }} color={isDone ? 'textMuted' : 'text'}>
                  {t(s.title)}
                </Text>
              </PressableScale>
              {expanded ? (
                <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
                  {s.verses ? (
                    <>
                      <Text variant="overline" color="textMuted">
                        {t('hajj.relatedVerses')}
                      </Text>
                      <StepVerses step={s} />
                    </>
                  ) : null}
                  {s.counter ? (
                    <View style={{ borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, padding: space.md }}>
                      <RoundCounter label={s.counter === 'tawaf' ? t('hajj.tawaf') : t('hajj.sai')} />
                    </View>
                  ) : null}
                  <Button
                    label={isDone ? t('hajj.markUndone') : t('hajj.markDone')}
                    variant={isDone ? 'secondary' : 'primary'}
                    size="sm"
                    testID={`toggle-${s.id}`}
                    onPress={async () => {
                      await hajjRepo.toggle(dbs.user, journey, s.id);
                      bumpDataVersion();
                    }}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
      <SectionHeader title={t('hajj.counters')} />
      <Card>
        <View style={{ flexDirection: 'row' }}>
          <RoundCounter label={t('hajj.tawaf')} />
          <RoundCounter label={t('hajj.sai')} />
        </View>
      </Card>
      <Button
        label={t('hajj.resetJourney')}
        variant="ghost"
        style={{ marginTop: space.lg }}
        onPress={async () => {
          await hajjRepo.reset(dbs.user, journey);
          bumpDataVersion();
        }}
      />
    </Screen>
  );
}
