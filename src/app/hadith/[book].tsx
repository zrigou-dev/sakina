import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hadithRepo, type HadithRow } from '@/database/repositories/content';
import { hadithBookmarksRepo } from '@/database/repositories/user';
import { Chip, EmptyState, Skeleton } from '@/design-system/components';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, space } from '@/design-system/tokens';
import { HadithCard, hadithBookName } from '@/features/hadith/HadithCard';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';

const PAGE = 40;

/** Virtualised, paginated reader for one collection, with book (section) filter. */
export default function HadithBook() {
  const { book, n } = useLocalSearchParams<{ book: string; n?: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<number | null>(null);
  const [rows, setRows] = useState<HadithRow[]>([]);
  const [done, setDone] = useState(false);
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const loading = useRef(false);
  const listRef = useRef<FlatList<HadithRow>>(null);
  const target = Number(n) || 0;

  const meta = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const [info, sections] = await Promise.all([hadithRepo.book(dbs.content, book ?? ''), hadithRepo.sections(dbs.content, book ?? '')]);
    return { info, sections };
  }, [book, quranStatus]);

  useEffect(() => {
    hadithBookmarksRepo
      .keys(dbs.user)
      .then(setMarks)
      .catch(() => undefined);
  }, [dbs]);

  const loadMore = useCallback(
    async (reset = false) => {
      if (loading.current || (!reset && done)) return;
      loading.current = true;
      const offset = reset ? 0 : rows.length;
      const page = await hadithRepo.page(dbs.content, book ?? '', section, offset, PAGE);
      setRows((r) => (reset ? page : [...r, ...page]));
      if (reset) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setDone(page.length < PAGE);
      loading.current = false;
    },
    [book, dbs, done, rows.length, section],
  );

  const loadFirstPage = useEffectEvent(() => void loadMore(true));
  useEffect(() => {
    if (quranStatus === 'ready') loadFirstPage();
  }, [section, book, quranStatus]);

  const chooseSection = (n: number | null) => {
    setRows([]);
    setDone(false);
    setSection(n);
  };

  // Deep link (e.g. hadith of the day): make sure the target is loaded, then scroll to it.
  useEffect(() => {
    if (!target || !rows.length) return;
    const idx = rows.findIndex((r) => r.number === target);
    if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0 }), 50);
    else if (!done && rows.length < target + PAGE) void loadMore();
  }, [rows, target, done, loadMore]);

  const toggle = async (h: HadithRow) => {
    const on = await hadithBookmarksRepo.toggle(dbs.user, h.book, h.number);
    setMarks((m) => {
      const next = new Set(m);
      const k = `${h.book}:${h.number}`;
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
    bumpDataVersion();
  };

  const sections = meta.data?.sections ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="hadith-book">
      <View style={{ paddingTop: insets.top }}>
        <Header back title={hadithBookName(t, book ?? '')} />
        {sections.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.xs, paddingBottom: space.sm }}
          >
            <Chip label={t('hadith.allSections')} selected={section === null} onPress={() => chooseSection(null)} />
            {sections.map((s) => (
              <Chip key={s.n} label={`${fmt.digits(s.n)}. ${s.name}`} selected={section === s.n} onPress={() => chooseSection(s.n)} />
            ))}
          </ScrollView>
        ) : null}
      </View>
      {meta.data && !meta.data.info ? (
        <EmptyState title={t('errors.notFound')} />
      ) : rows.length === 0 ? (
        <View style={{ padding: space.gutter, gap: space.md }}>
          <Skeleton height={180} />
          <Skeleton height={180} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(h) => `${h.book}-${h.number}`}
          renderItem={({ item }) => (
            <View style={{ marginBottom: space.md }}>
              <HadithCard h={item} bookmarked={marks.has(`${item.book}:${item.number}`)} onBookmark={() => toggle(item)} />
            </View>
          )}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          initialNumToRender={6}
          windowSize={9}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 120);
          }}
          ListFooterComponent={
            <Text variant="caption" color="textFaint" align="center" style={{ paddingVertical: space.lg }}>
              {t('hadith.translationNote')}
            </Text>
          }
          contentContainerStyle={{
            padding: space.gutter,
            paddingBottom: insets.bottom + space.xxl,
            width: '100%',
            maxWidth: MAX_READING_WIDTH + space.gutter * 2,
            alignSelf: 'center',
          }}
        />
      )}
    </View>
  );
}
