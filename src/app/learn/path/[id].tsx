import { router, useLocalSearchParams } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Play from 'lucide-react-native/icons/play';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ASMA_AL_HUSNA } from '@/content/asma/asma.generated';
import { adhkarRepo, hadithRepo, quranRepo } from '@/database/repositories/content';
import { learningRepo } from '@/database/repositories/user';
import { Badge, Button, Card, IconButton, ListGroup, ListRow, ProgressBar, Skeleton } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { HadithCard } from '@/features/hadith/HadithCard';
import { ESSENTIAL_CHAPTERS, JUZ_AMMA, PATHS, pathPackageId, type PathId } from '@/features/learn/paths';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { useAudio } from '@/services/audio/AudioProvider';
import { getSurah } from '@/services/quran/navigation';

/** A learning path: step through verified items, mark each as learned. */
export default function PathScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const path = PATHS.find((p) => p.id === raw) ?? PATHS[0]!;
  const id = path.id as PathId;
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const audio = useAudio();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const pkg = pathPackageId(id);
  const progress = useLoader(() => learningRepo.forPackage(dbs.user, pkg), [pkg]);
  const learned = progress.data ?? {};
  const doneCount = Object.values(learned).filter((s) => s === 'completed').length;
  const itemId = String(index + 1);

  const item = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    if (id === 'nawawi' || id === 'qudsi') return { kind: 'hadith' as const, h: await hadithRepo.get(dbs.content, id, index + 1) };
    if (id === 'juzamma') {
      const surah = JUZ_AMMA[index]!;
      return { kind: 'surah' as const, surah, ayahs: await quranRepo.surahAyahs(dbs.content, surah), bismillah: await quranRepo.bismillah(dbs.content, surah) };
    }
    if (id === 'essentials') {
      const chapter = ESSENTIAL_CHAPTERS[index]!;
      const [cat, items] = await Promise.all([adhkarRepo.category(dbs.content, `hisn:${chapter}`), adhkarRepo.items(dbs.content, `hisn:${chapter}`)]);
      return { kind: 'dua' as const, chapter, cat, items };
    }
    return { kind: 'name' as const, name: ASMA_AL_HUSNA[index]! };
  }, [id, index, quranStatus]);

  const titles = useLoader(
    async () =>
      id === 'essentials' && quranStatus === 'ready'
        ? adhkarRepo.categoriesByIds(
            dbs.content,
            ESSENTIAL_CHAPTERS.map((c) => `hisn:${c}`),
          )
        : [],
    [id, quranStatus],
  );

  const mark = async () => {
    await learningRepo.set(dbs.user, pkg, itemId, learned[itemId] === 'completed' ? 'started' : 'completed');
    bumpDataVersion();
  };
  const go = (d: number) => {
    setRevealed(false);
    setIndex((i) => Math.min(path.total - 1, Math.max(0, i + d)));
  };

  const d = item.data;
  return (
    <Screen back title={t(path.title)} large testID={`path-screen-${id}`}>
      <View style={{ gap: space.xs, marginBottom: space.md }}>
        <Text variant="footnote" color="textMuted">
          {t('academy.progress', { done: fmt.digits(doneCount), total: fmt.digits(path.total) })}
        </Text>
        <ProgressBar progress={doneCount / path.total} color="accent" />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
        <IconButton icon={ChevronLeft} label={t('academy.previous')} onPress={() => go(-1)} directional tone="filled" testID="path-prev" />
        <Text variant="headline" align="center" style={{ flex: 1 }} testID="path-position">
          {fmt.digits(index + 1)} / {fmt.digits(path.total)}
        </Text>
        <IconButton icon={ChevronRight} label={t('academy.next')} onPress={() => go(1)} directional tone="filled" testID="path-next" />
      </View>

      {!d ? (
        <Skeleton height={220} />
      ) : d.kind === 'hadith' && d.h ? (
        <HadithCard h={d.h} />
      ) : d.kind === 'surah' ? (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title3" style={{ flex: 1 }}>
              {fmt.surahName(getSurah(d.surah))}
            </Text>
            <IconButton icon={Play} label={t('audio.play')} onPress={() => audio.play(d.surah, 1)} tone="filled" />
          </View>
          {d.bismillah ? <AyahText text={d.bismillah} size={22} align="center" /> : null}
          {d.ayahs.map((a) => (
            <AyahText key={a.id} text={a.text} ayah={a.ayah} size={24} />
          ))}
          <Button label={t('quran.memorize')} variant="ghost" size="sm" onPress={() => router.push(`/quran/${d.surah}`)} />
        </Card>
      ) : d.kind === 'dua' ? (
        <Card style={{ gap: space.md }}>
          <Text variant="title3">{lang === 'ar' ? d.cat?.titleAr : (d.cat?.titleEn ?? d.cat?.titleAr)}</Text>
          {d.items.map((it) => (
            <View key={it.id} style={{ gap: space.xs }}>
              <Text script="arabic" variant="body" style={{ fontFamily: 'Amiri_400Regular', fontSize: 20, lineHeight: 38 }}>
                {it.textAr}
              </Text>
              {lang !== 'ar' && it.translationEn ? (
                <Text script="latin" variant="subhead" color="textMuted">
                  {it.translationEn}
                </Text>
              ) : null}
              {it.repeat && it.repeat > 1 ? <Badge label={t('adhkar.repeat', { count: it.repeat })} tone="accent" /> : null}
            </View>
          ))}
          <Text variant="caption" color="textFaint">
            {t('adhkarMore.sourceHisn')}
          </Text>
        </Card>
      ) : d.kind === 'name' ? (
        <Pressable onPress={() => setRevealed((r) => !r)} accessibilityRole="button" accessibilityLabel={t('academy.flip')} testID="flashcard">
          <View
            style={{
              minHeight: 260,
              borderRadius: radius.xl,
              backgroundColor: revealed ? colors.accentSoft : colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              padding: space.xl,
              gap: space.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text script="arabic" variant="display" align="center" style={{ fontFamily: 'Amiri_700Bold', color: colors.primary, lineHeight: 64 }}>
              {d.name.arabic}
            </Text>
            {revealed ? (
              <>
                <Text script="latin" variant="title3" align="center" style={{ fontStyle: 'italic' }}>
                  {d.name.transliteration}
                </Text>
                {lang !== 'ar' ? (
                  <Text script="latin" variant="callout" color="textMuted" align="center">
                    {d.name.meaningEn}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text variant="footnote" color="textMuted">
                {t('academy.flip')}
              </Text>
            )}
          </View>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <Button
          label={learned[itemId] === 'completed' ? t('academy.learned') : t('academy.markLearned')}
          icon={Check}
          variant={learned[itemId] === 'completed' ? 'secondary' : 'primary'}
          onPress={mark}
          style={{ flex: 1 }}
          testID="path-mark"
        />
        {index < path.total - 1 ? <Button label={t('academy.next')} variant="ghost" onPress={() => go(1)} /> : null}
      </View>

      {id !== 'names' ? (
        <View style={{ marginTop: space.xl }}>
          <ListGroup>
            {Array.from({ length: Math.min(path.total, 120) }, (_, i) => {
              const label =
                id === 'juzamma'
                  ? fmt.surahName(getSurah(JUZ_AMMA[i]!))
                  : id === 'essentials'
                    ? ((lang === 'ar' ? titles.data?.[i]?.titleAr : (titles.data?.[i]?.titleEn ?? titles.data?.[i]?.titleAr)) ?? fmt.digits(i + 1))
                    : t('hadith.hadithN', { n: fmt.digits(i + 1) });
              return (
                <ListRow
                  key={i}
                  title={label}
                  onPress={() => {
                    setRevealed(false);
                    setIndex(i);
                  }}
                  trailing={learned[String(i + 1)] === 'completed' ? <Badge label={t('academy.learned')} tone="success" /> : null}
                  chevron={false}
                  last={i === path.total - 1}
                />
              );
            })}
          </ListGroup>
        </View>
      ) : null}
    </Screen>
  );
}
