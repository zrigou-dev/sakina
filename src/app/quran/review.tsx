import { router } from 'expo-router';
import Eye from 'lucide-react-native/icons/eye';
import { useState } from 'react';
import { View } from 'react-native';

import { quranRepo } from '@/database/repositories/content';
import { memorizationRepo, type MemorizationRow } from '@/database/repositories/user';
import { Button, Card, EmptyState, ProgressBar } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useTheme } from '@/runtime/AppProvider';
import { dueDateAfter, isMemorized, review, type ReviewGrade } from '@/services/memorization/scheduler';
import { getSurah, previousVerse } from '@/services/quran/navigation';

/** Review session: show the preceding ayah as a cue, recall, reveal, then grade gently. */
export default function Review() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const fmt = useFormat();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const queue = useLoader(() => memorizationRepo.due(dbs.user, new Date(), 30), [dbs]);
  const items = queue.data ?? [];
  const current: MemorizationRow | undefined = items[index];
  const texts = useLoader(async () => {
    if (!current) return null;
    const prev = previousVerse(current);
    const [ayah, cue] = await Promise.all([
      quranRepo.ayah(dbs.content, current.surah, current.ayah),
      prev ? quranRepo.ayah(dbs.content, prev.surah, prev.ayah) : null,
    ]);
    return { ayah, cue };
  }, [current?.surah, current?.ayah]);

  const grade = async (g: ReviewGrade) => {
    if (!current) return;
    const next = review(current, g);
    await memorizationRepo.upsert(dbs.user, {
      surah: current.surah,
      ayah: current.ayah,
      status: isMemorized(next) ? 'memorized' : 'learning',
      ...next,
      dueDate: dueDateAfter(new Date(), next),
      reviewedAt: new Date().toISOString(),
    });
    setReviewed((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (queue.data && !current) {
    return (
      <Screen back title={t('memorization.title')} testID="review-screen">
        <View style={{ alignItems: 'center', paddingTop: space.xxxl, gap: space.lg }}>
          <EightPointStar size={80} color={colors.accent} fill={colors.accentSoft} />
          <Text variant="title2" align="center">
            {reviewed ? t('memorization.sessionDone') : t('memorization.noneDue')}
          </Text>
          {reviewed ? (
            <Text variant="body" color="textMuted" align="center">
              {t('memorization.sessionDoneBody', { count: reviewed })}
            </Text>
          ) : null}
          <Button
            label={t('common.done')}
            onPress={() => {
              bumpDataVersion();
              router.back();
            }}
            testID="review-done"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen back title={t('memorization.title')} testID="review-screen">
      {!current ? (
        <EmptyState title={t('common.loading')} />
      ) : (
        <View style={{ gap: space.lg }}>
          <ProgressBar progress={index / Math.max(1, items.length)} color="accent" />
          <Text variant="callout" color="accent">
            {fmt.surahName(getSurah(current.surah))} · {fmt.digits(current.surah)}:{fmt.digits(current.ayah)}
          </Text>
          {texts.data?.cue ? (
            <Card tone="muted">
              <AyahText text={texts.data.cue.text} ayah={texts.data.cue.ayah} size={20} color={colors.textMuted} />
            </Card>
          ) : null}
          <Card style={{ minHeight: 160, justifyContent: 'center' }}>
            {revealed && texts.data?.ayah ? (
              <AyahText text={texts.data.ayah.text} ayah={texts.data.ayah.ayah} size={28} />
            ) : (
              <Button label={t('memorization.reveal')} icon={Eye} variant="secondary" onPress={() => setRevealed(true)} testID="reveal" />
            )}
          </Card>
          {revealed ? (
            <>
              <Text variant="callout" align="center">
                {t('memorization.howWell')}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {(['again', 'hard', 'good', 'easy'] as const).map((g) => (
                  <Button
                    key={g}
                    label={t(`memorization.${g}`)}
                    variant={g === 'good' ? 'primary' : 'secondary'}
                    size="sm"
                    style={{ flex: 1, paddingHorizontal: space.xs }}
                    onPress={() => grade(g)}
                    testID={`grade-${g}`}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
