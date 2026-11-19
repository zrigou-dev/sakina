import { router } from 'expo-router';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import Plus from 'lucide-react-native/icons/plus';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { memorizationRepo } from '@/database/repositories/user';
import { Button, Card, Chip, EmptyState, FadeIn, ProgressRing, SectionHeader, Sheet, Stepper } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n } from '@/runtime/AppProvider';
import { NEW_REVIEW_STATE } from '@/services/memorization/scheduler';
import { getSurah, SURAHS, TOTAL_AYAHS } from '@/services/quran/navigation';
import { toISODate } from '@/utils/date';

export default function Memorization() {
  const { t } = useI18n();
  const dbs = useDbs();
  const fmt = useFormat();
  const [adding, setAdding] = useState(false);
  const [surah, setSurah] = useState(114);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(6);
  const stats = useLoader(() => memorizationRepo.stats(dbs.user, new Date()), [dbs]);
  const s = getSurah(surah);
  const shortSurahs = useMemo(
    () => SURAHS.filter((x) => x.number >= 78 || x.number === 1 || x.number === 18 || x.number === 36 || x.number === 67).reverse(),
    [],
  );

  const total = (stats.data?.memorized ?? 0) + (stats.data?.learning ?? 0);
  return (
    <Screen back title={t('memorization.title')} subtitle={t('memorization.intro')} large testID="memorization-screen">
      <FadeIn index={0}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <ProgressRing progress={(stats.data?.memorized ?? 0) / TOTAL_AYAHS} size={96} stroke={7} color="accent">
              <Text variant="headline" align="center">
                {fmt.digits(stats.data?.memorized ?? 0)}
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="callout">
                {t('memorization.memorized')}: {fmt.digits(stats.data?.memorized ?? 0)}
              </Text>
              <Text variant="callout">
                {t('memorization.learning')}: {fmt.digits(stats.data?.learning ?? 0)}
              </Text>
              <Text variant="callout" color="accent">
                {t('memorization.due')}: {fmt.digits(stats.data?.due ?? 0)}
              </Text>
            </View>
          </View>
          <Button
            label={t('memorization.reviewNow')}
            icon={BookOpenCheck}
            style={{ marginTop: space.lg }}
            disabled={!stats.data?.due}
            onPress={() => router.push('/quran/review')}
            testID="start-review"
          />
          {stats.data && stats.data.due === 0 && total > 0 ? (
            <Text variant="footnote" color="textMuted" align="center" style={{ marginTop: space.sm }}>
              {t('memorization.noneDue')}
            </Text>
          ) : null}
        </Card>
      </FadeIn>
      {total === 0 ? <EmptyState icon={BookOpenCheck} title={t('memorization.empty')} /> : null}
      <SectionHeader title={t('memorization.addSurah')} />
      <Button label={t('memorization.addSurah')} icon={Plus} variant="secondary" onPress={() => setAdding(true)} testID="add-memorization" />

      <Sheet visible={adding} onClose={() => setAdding(false)} title={t('memorization.addSurah')}>
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {shortSurahs.map((x) => (
              <Chip
                key={x.number}
                label={fmt.surahShort(x)}
                selected={x.number === surah}
                onPress={() => {
                  setSurah(x.number);
                  setFrom(1);
                  setTo(Math.min(x.ayahCount, 10));
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="callout">{t('quran.goToAyah')}</Text>
            <Stepper label={t('quran.goToAyah')} value={from} min={1} max={to} onChange={setFrom} format={(v) => fmt.digits(v)} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="callout">→</Text>
            <Stepper label={t('quran.goToAyah')} value={to} min={from} max={s.ayahCount} onChange={setTo} format={(v) => fmt.digits(v)} />
          </View>
          <Button
            label={t('memorization.addRange', { from: fmt.digits(from), to: fmt.digits(to) })}
            testID="confirm-add-memorization"
            onPress={async () => {
              const today = toISODate(new Date());
              for (let a = from; a <= to; a++) {
                const existing = await memorizationRepo.get(dbs.user, surah, a);
                if (!existing) await memorizationRepo.upsert(dbs.user, { surah, ayah: a, status: 'learning', ...NEW_REVIEW_STATE, dueDate: today });
              }
              bumpDataVersion();
              setAdding(false);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
