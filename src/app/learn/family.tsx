import { router } from 'expo-router';
import BookOpen from 'lucide-react-native/icons/book-open';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Headphones from 'lucide-react-native/icons/headphones';
import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ASMA_AL_HUSNA } from '@/content/asma/asma.generated';
import { adhkarRepo, quranRepo, type AdhkarCategoryRow } from '@/database/repositories/content';
import { Button, Card, FadeIn, IconButton, ListGroup, ListRow, SectionHeader } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { JUZ_AMMA, KIDS_DUAS } from '@/features/learn/paths';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { useAudio } from '@/services/audio/AudioProvider';
import { getSurah } from '@/services/quran/navigation';

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};

type Question = { prompt: string; isAyah: boolean; options: { key: string; label: string }[]; answer: string };

/** Quiz questions are generated from the verified Quran text and the Names list — nothing invented. */
function useQuiz(kind: 'surah' | 'names') {
  const dbs = useDbs();
  const { lang } = useI18n();
  const [q, setQ] = useState<Question | null>(null);
  const next = useCallback(async () => {
    if (kind === 'surah') {
      const pool = JUZ_AMMA.filter((s) => s >= 93);
      const answer = pool[Math.floor(Math.random() * pool.length)]!;
      const ayahs = await quranRepo.surahAyahs(dbs.content, answer);
      const ayah = ayahs[Math.floor(Math.random() * ayahs.length)]!;
      const others = shuffle(pool.filter((s) => s !== answer)).slice(0, 3);
      const name = (n: number) => (lang === 'ar' ? getSurah(n).nameArabic : getSurah(n).nameTransliterated);
      setQ({ prompt: ayah.text, isAyah: true, answer: String(answer), options: shuffle([answer, ...others]).map((n) => ({ key: String(n), label: name(n) })) });
    } else {
      const idx = Math.floor(Math.random() * 99);
      const right = ASMA_AL_HUSNA[idx]!;
      const others = shuffle(ASMA_AL_HUSNA.filter((n) => n.number !== right.number)).slice(0, 3);
      setQ({
        prompt: right.transliteration,
        isAyah: false,
        answer: String(right.number),
        options: shuffle([right, ...others]).map((n) => ({ key: String(n.number), label: n.arabic })),
      });
    }
  }, [dbs, kind, lang]);
  return { q, next };
}

function Quiz({ kind }: { kind: 'surah' | 'names' }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  const { q, next } = useQuiz(kind);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const { quranStatus } = useRuntime();
  useEffect(() => {
    if (quranStatus === 'ready') void next();
  }, [next, quranStatus]);
  if (!q) return null;
  const correct = picked === q.answer;
  return (
    <Card style={{ gap: space.md }} testID={`quiz-${kind}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="headline">{kind === 'surah' ? t('kids.quizBody') : t('kids.namesQuizBody')}</Text>
        <Text variant="callout" color="accent">
          {t('kids.score', { score: fmt.digits(score) })}
        </Text>
      </View>
      {q.isAyah ? (
        <AyahText text={q.prompt} size={24} align="center" />
      ) : (
        <Text script="latin" variant="title2" align="center" style={{ fontStyle: 'italic' }}>
          {q.prompt}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {q.options.map((o) => {
          const isAnswer = o.key === q.answer;
          const bg = picked ? (isAnswer ? colors.successSoft : o.key === picked ? colors.dangerSoft : colors.surfaceMuted) : colors.surfaceMuted;
          return (
            <PressableScale
              key={o.key}
              disabled={!!picked && correct}
              haptic="selection"
              testID={`quiz-option-${o.key}`}
              onPress={() => {
                setPicked(o.key);
                if (isAnswer && picked !== q.answer) setScore((s) => s + 1);
              }}
              style={{
                width: '47%',
                flexGrow: 1,
                minHeight: 64,
                borderRadius: radius.lg,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
                padding: space.sm,
              }}
            >
              <Text script="arabic" variant="title3" align="center" style={{ fontFamily: 'Amiri_700Bold' }}>
                {o.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {picked ? (
        <View style={{ alignItems: 'center', gap: space.sm }}>
          {correct ? <EightPointStar size={40} color={colors.accent} fill={colors.accentSoft} /> : null}
          <Text variant="headline" color={correct ? 'success' : 'danger'} align="center">
            {correct ? t('kids.correct') : t('kids.wrong')}
          </Text>
          {correct ? (
            <Button
              label={t('kids.nextQuestion')}
              size="sm"
              onPress={() => {
                setPicked(null);
                void next();
              }}
              testID={`quiz-next-${kind}`}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function Family() {
  const { t, lang } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const audio = useAudio();
  const fmt = useFormat();
  const duas = useLoader<AdhkarCategoryRow[]>(
    async () =>
      quranStatus === 'ready'
        ? adhkarRepo.categoriesByIds(
            dbs.content,
            KIDS_DUAS.map((c) => `hisn:${c}`),
          )
        : [],
    [quranStatus],
  );

  return (
    <Screen back title={t('kids.title')} subtitle={t('kids.intro')} large testID="learn-family">
      <FadeIn index={0}>
        <SectionHeader title={t('kids.quiz')} style={{ marginTop: 0 }} />
        <Quiz kind="surah" />
      </FadeIn>
      <FadeIn index={1}>
        <SectionHeader title={t('kids.namesQuiz')} />
        <Quiz kind="names" />
      </FadeIn>
      <FadeIn index={2}>
        <SectionHeader title={t('kids.duas')} />
        <ListGroup>
          {(duas.data ?? []).map((c, i, all) => (
            <ListRow
              key={c.id}
              icon={HeartHandshake}
              iconTone={i % 2 ? 'accent' : 'primary'}
              title={lang === 'ar' ? c.titleAr : (c.titleEn ?? c.titleAr)}
              onPress={() => router.push(`/adhkar/${encodeURIComponent(c.id)}`)}
              last={i === all.length - 1}
            />
          ))}
        </ListGroup>
      </FadeIn>
      <FadeIn index={3}>
        <SectionHeader title={t('kids.shortSurahs')} />
        <ListGroup>
          {[...JUZ_AMMA]
            .reverse()
            .slice(0, 15)
            .map((n, i, all) => (
              <ListRow
                key={n}
                icon={Sparkles}
                iconTone="accent"
                title={fmt.surahName(getSurah(n))}
                subtitle={t('common.ayahs', { count: getSurah(n).ayahCount })}
                chevron={false}
                trailing={
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon={Headphones} label={t('audio.play')} onPress={() => audio.play(n, 1)} size={18} />
                    <IconButton icon={BookOpen} label={t('common.open')} onPress={() => router.push(`/quran/${n}`)} size={18} />
                  </View>
                }
                last={i === all.length - 1}
              />
            ))}
        </ListGroup>
      </FadeIn>
      <View style={{ alignItems: 'center', marginTop: space.lg }}>
        <Button label={t('academy.pathsTitle')} icon={Gamepad2} variant="ghost" onPress={() => router.push('/learn/academy')} />
      </View>
    </Screen>
  );
}
