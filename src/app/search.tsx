import { router } from 'expo-router';
import SearchIcon from 'lucide-react-native/icons/search';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ASMA_AL_HUSNA } from '@/content/asma/asma.generated';
import { adhkarRepo, quranRepo, type AdhkarItemRow, type QuranSearchHit } from '@/database/repositories/content';
import { Card, EmptyState, SectionHeader, TextField } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { useDebounced } from '@/hooks/useDebounced';
import { useFormat } from '@/hooks/useFormat';
import { useDbs, useI18n, useRuntime } from '@/runtime/AppProvider';
import { getSurah } from '@/services/quran/navigation';
import { normalizeArabic, normalizeLatin } from '@/services/search/normalize';

interface Results {
  readonly quran: QuranSearchHit[];
  readonly adhkar: AdhkarItemRow[];
  readonly names: (typeof ASMA_AL_HUSNA)[number][];
}

/** Unified offline search across the Quran, installed adhkar and the Beautiful Names. */
export default function UnifiedSearch() {
  const { t } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [settled, setSettled] = useState<{ query: string; results: Results } | null>(null);

  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const arabic = /[\u0600-\u06FF]/.test(query);
    const nq = arabic ? normalizeArabic(query) : normalizeLatin(query);
    Promise.all([
      quranStatus === 'ready' ? quranRepo.search(dbs.content, query, 20) : Promise.resolve([]),
      arabic ? adhkarRepo.search(dbs.content, query, 10) : Promise.resolve([]),
    ])
      .then(([quran, adhkar]) => {
        if (cancelled) return;
        const names = ASMA_AL_HUSNA.filter((n) =>
          arabic ? normalizeArabic(n.arabic).includes(nq) : normalizeLatin(`${n.transliteration} ${n.meaningEn}`).includes(nq),
        ).slice(0, 10);
        setSettled({ query, results: { quran, adhkar, names } });
      })
      .catch(() => !cancelled && setSettled({ query, results: { quran: [], adhkar: [], names: [] } }));
    return () => {
      cancelled = true;
    };
  }, [query, dbs, quranStatus]);

  const results = query.length >= 2 && settled?.query === query ? settled.results : null;
  const empty = results && !results.quran.length && !results.adhkar.length && !results.names.length;

  return (
    <Screen back title={t('search.title')} testID="search-screen">
      <TextField value={q} onChangeText={setQ} placeholder={t('search.placeholder')} autoFocus autoCorrect={false} testID="unified-search-input" />
      {!results ? <EmptyState icon={SearchIcon} title={t('search.title')} body={t('search.hint')} /> : null}
      {empty ? <EmptyState icon={SearchIcon} title={t('search.empty', { query })} body={t('search.hint')} /> : null}
      {results?.quran.length ? (
        <>
          <SectionHeader title={`${t('search.quran')} · ${fmt.digits(results.quran.length)}`} />
          <View style={{ gap: space.sm }}>
            {results.quran.map((h) => (
              <Card
                key={`${h.id}-${h.edition ?? ''}`}
                onPress={() => router.push(`/quran/${h.surah}?ayah=${h.ayah}`)}
                testID={`search-hit-${h.surah}-${h.ayah}`}
              >
                <Text variant="caption" color="accent">
                  {fmt.surahName(getSurah(h.surah))} · {fmt.digits(h.surah)}:{fmt.digits(h.ayah)}
                </Text>
                <AyahText text={h.text} size={20} numberOfLines={3} />
                {h.snippet ? (
                  <Text variant="footnote" color="textMuted" script="latin" numberOfLines={2}>
                    {h.snippet}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        </>
      ) : null}
      {results?.adhkar.length ? (
        <>
          <SectionHeader title={t('search.adhkar')} />
          <View style={{ gap: space.sm }}>
            {results.adhkar.map((a) => (
              <Card key={a.id} onPress={() => router.push(`/adhkar/${encodeURIComponent(a.categoryId)}`)}>
                <Text script="arabic" variant="callout" numberOfLines={3}>
                  {a.textAr}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
      {results?.names.length ? (
        <>
          <SectionHeader title={t('search.names')} />
          <Card padded={false}>
            {results.names.map((n) => (
              <View key={n.number} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.lg }}>
                <Text script="arabic" variant="headline">
                  {n.arabic}
                </Text>
                <Text variant="footnote" color="textMuted" script="latin">
                  {n.transliteration}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
