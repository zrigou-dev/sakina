import { router } from 'expo-router';
import Search from 'lucide-react-native/icons/search';
import { useEffect, useState } from 'react';

import { useDebounced } from '@/hooks/useDebounced';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { quranRepo, type QuranSearchHit } from '@/database/repositories/content';
import { EmptyState, TextField } from '@/design-system/components';
import { PressableScale } from '@/design-system/PressableScale';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { getSurah } from '@/services/quran/navigation';

export default function QuranSearch() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const [result, setResult] = useState<{ query: string; hits: QuranSearchHit[]; ms: number } | null>(null);
  const active = quranStatus === 'ready' && debounced.length >= 2;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const started = Date.now();
    quranRepo
      .search(dbs.content, debounced, 100)
      .then((r) => !cancelled && setResult({ query: debounced, hits: r, ms: Date.now() - started }))
      .catch(() => !cancelled && setResult({ query: debounced, hits: [], ms: 0 }));
    return () => {
      cancelled = true;
    };
  }, [active, debounced, dbs]);

  const hits = active && result?.query === debounced ? result.hits : null;
  const ms = hits ? (result?.ms ?? null) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="quran-search-screen">
      <View style={{ paddingTop: insets.top }}>
        <Header back title={t('quran.searchPlaceholder')} />
        <View
          style={{
            paddingHorizontal: space.gutter,
            paddingBottom: space.md,
            gap: space.xs,
            width: '100%',
            maxWidth: MAX_READING_WIDTH + space.gutter * 2,
            alignSelf: 'center',
          }}
        >
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('quran.searchPlaceholder')}
            autoFocus
            autoCorrect={false}
            testID="quran-search-input"
            returnKeyType="search"
          />
          {hits ? (
            <Text variant="caption" color="textMuted" testID="search-count">
              {t('quran.resultsCount', { count: hits.length })}
              {ms !== null ? ` · ${fmt.digits(ms)} ms` : ''}
            </Text>
          ) : null}
        </View>
      </View>
      <FlatList
        data={hits ?? []}
        keyExtractor={(h) => `${h.source}-${h.id}-${h.edition ?? ''}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.xxl,
          width: '100%',
          maxWidth: MAX_READING_WIDTH + space.gutter * 2,
          alignSelf: 'center',
        }}
        ListEmptyComponent={
          hits ? (
            <EmptyState icon={Search} title={t('quran.searchEmpty', { query: debounced })} />
          ) : (
            <EmptyState icon={Search} title={t('quran.searchPlaceholder')} body={t('quran.searchHint')} />
          )
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(`/quran/${item.surah}?ayah=${item.ayah}`)}
            testID={`hit-${item.surah}-${item.ayah}`}
            scaleTo={0.99}
            style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: space.xs }}
          >
            <Text variant="caption" color="accent" weight="semibold">
              {fmt.surahName(getSurah(item.surah))} · {fmt.digits(item.surah)}:{fmt.digits(item.ayah)}
              {item.edition ? ` · ${t('quran.inTranslation', { edition: item.edition })}` : ''}
            </Text>
            <AyahText text={item.text} size={22} numberOfLines={3} />
            {item.snippet ? (
              <Text variant="footnote" color="textMuted" script="latin" numberOfLines={3}>
                {item.snippet}
              </Text>
            ) : null}
          </PressableScale>
        )}
      />
    </View>
  );
}
