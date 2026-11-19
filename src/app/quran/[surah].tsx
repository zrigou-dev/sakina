import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import Headphones from 'lucide-react-native/icons/headphones';
import Languages from 'lucide-react-native/icons/languages';
import Play from 'lucide-react-native/icons/play';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Copy from 'lucide-react-native/icons/copy';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View, type ListViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Ayah } from '@/content/quran/types';
import { quranRepo, translationRepo } from '@/database/repositories/content';
import { bookmarksRepo, memorizationRepo, readingRepo } from '@/database/repositories/user';
import { Badge, Button, Chip, Divider, EmptyState, ErrorState, IconButton, ListRow, Sheet, Skeleton, Stepper } from '@/design-system/components';
import { EightPointStar } from '@/design-system/GeometricBackdrop';
import { PressableScale } from '@/design-system/PressableScale';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, radius, space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { MiniPlayer } from '@/features/quran/MiniPlayer';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useSettings, useTheme } from '@/runtime/AppProvider';
import { useAudio, usePlayerState } from '@/services/audio/AudioProvider';
import { NEW_REVIEW_STATE } from '@/services/memorization/scheduler';
import { getSurah, sajdaAt, SURAHS } from '@/services/quran/navigation';
import { QURAN_FONT_RANGE } from '@/state/settings';
import { toISODate } from '@/utils/date';

const AyahRow = memo(function AyahRow({
  ayah,
  size,
  translation,
  bookmarked,
  playing,
  onPress,
}: {
  ayah: Ayah;
  size: number;
  translation?: string;
  bookmarked: boolean;
  playing: boolean;
  onPress: (a: Ayah) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const fmt = useFormat();
  const sajda = sajdaAt(ayah);
  return (
    <PressableScale
      onPress={() => onPress(ayah)}
      scaleTo={0.995}
      testID={`ayah-${ayah.surah}-${ayah.ayah}`}
      accessibilityLabel={t('quran.ayahActions', { surah: ayah.surah, ayah: ayah.ayah })}
      style={{
        paddingVertical: space.lg,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: playing ? colors.accentSoft : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: space.sm,
      }}
    >
      {bookmarked || sajda ? (
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {bookmarked ? <Badge label={t('quran.bookmarked')} tone="primary" /> : null}
          {sajda ? <Badge label={t('quran.sajda')} tone="accent" /> : null}
        </View>
      ) : null}
      <AyahText text={ayah.text} ayah={ayah.ayah} size={size} align="right" />
      {translation ? (
        <Text variant="subhead" color="textMuted" script={/[\u0600-\u06FF]/.test(translation) ? 'arabic' : 'latin'}>
          {fmt.digits(ayah.ayah)}. {translation}
        </Text>
      ) : null}
    </PressableScale>
  );
});

export default function Reader() {
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const surahNo = Math.min(114, Math.max(1, Number(params.surah) || 1));
  const targetAyah = Number(params.ayah) || 0;
  const surah = getSurah(surahNo);
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const { quranStatus, retryQuran } = useRuntime();
  const dbs = useDbs();
  const fmt = useFormat();
  const audio = useAudio();
  const player = usePlayerState();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Ayah>>(null);
  const [selected, setSelected] = useState<Ayah | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const seen = useRef(new Set<number>());
  const pendingSeen = useRef(0);
  const scrolled = useRef(false);

  const data = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const [ayahs, basmala, bookmarks, editions] = await Promise.all([
      quranRepo.surahAyahs(dbs.content, surahNo),
      quranRepo.bismillah(dbs.content, surahNo),
      bookmarksRepo.forSurah(dbs.user, surahNo),
      translationRepo.editions(dbs.content),
    ]);
    const edition =
      settings.quran.translationEdition && editions.some((e) => e.id === settings.quran.translationEdition) ? settings.quran.translationEdition : null;
    const translations = edition && ayahs.length ? await translationRepo.forRange(dbs.content, edition, ayahs[0]!.id, ayahs[ayahs.length - 1]!.id) : {};
    return { ayahs, basmala, bookmarks: new Set(bookmarks), editions, translations };
  }, [quranStatus, surahNo, settings.quran.translationEdition]);

  // Jump to the requested ayah once data is ready.
  useEffect(() => {
    if (!data.data || scrolled.current || targetAyah <= 1) return;
    scrolled.current = true;
    const index = Math.min(data.data.ayahs.length - 1, targetAyah - 1);
    setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.1 }), 60);
  }, [data.data, targetAyah]);

  // Flush reading progress periodically and when leaving.
  useEffect(() => {
    const flush = () => {
      const n = pendingSeen.current;
      pendingSeen.current = 0;
      if (n > 0) readingRepo.addAyahsRead(dbs.user, n).catch(() => undefined);
    };
    const id = setInterval(flush, 5000);
    return () => {
      clearInterval(id);
      flush();
      bumpDataVersion();
    };
  }, [dbs]);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item)?.item as Ayah | undefined;
      if (first) readingRepo.setPosition(dbs.user, first.surah, first.ayah).catch(() => undefined);
      for (const v of viewableItems) {
        const item = v.item as Ayah | undefined;
        if (item && !seen.current.has(item.id)) {
          seen.current.add(item.id);
          pendingSeen.current += 1;
        }
      }
    },
    [dbs],
  );

  const playingAyah = player.queue?.surah === surahNo ? player.queue.current : null;

  const sel = useLoader(async () => {
    if (!selected) return null;
    const [mem, trans] = await Promise.all([memorizationRepo.get(dbs.user, selected.surah, selected.ayah), translationRepo.forAyah(dbs.content, selected.id)]);
    return { mem, trans };
  }, [selected?.id]);

  const listHeader = (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <View
        style={{
          width: '100%',
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.accent,
          padding: space.xl,
          alignItems: 'center',
          gap: space.xs,
          backgroundColor: colors.accentSoft,
        }}
      >
        <EightPointStar size={28} color={colors.accent} />
        <Text variant="title1" script="arabic" align="center" style={{ fontFamily: 'Amiri_700Bold', color: colors.primary }}>
          سورة {surah.nameArabic}
        </Text>
        {lang !== 'ar' ? (
          <Text variant="callout" align="center" color="textMuted">
            {surah.nameTransliterated} · {surah.nameEnglish}
          </Text>
        ) : null}
        <Text variant="footnote" color="textMuted" align="center">
          {surah.revelation === 'meccan' ? t('quran.meccan') : t('quran.medinan')} · {t('common.ayahs', { count: surah.ayahCount })}
        </Text>
      </View>
      {data.data?.basmala ? (
        <View style={{ paddingTop: space.md }} testID="basmala">
          <AyahText text={data.data.basmala} size={settings.quran.fontSize} align="center" />
        </View>
      ) : null}
    </View>
  );

  const next = surahNo < 114 ? SURAHS[surahNo] : null;
  const footer = (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center', gap: space.md }}>
      <EightPointStar size={36} color={colors.accent} />
      <Text variant="footnote" color="textMuted">
        {t('quran.endOfSurah')}
      </Text>
      {next ? (
        <Button
          label={t('quran.nextSurah', { name: fmt.surahShort(next) })}
          variant="secondary"
          onPress={() => router.replace(`/quran/${next.number}`)}
          testID="next-surah"
        />
      ) : null}
      <Text variant="caption" color="textFaint" align="center">
        {t('quran.textSource')}
      </Text>
    </View>
  );

  let content;
  if (quranStatus === 'integrity_error') content = <ErrorState body={t('quran.integrityError')} />;
  else if (quranStatus === 'error' || data.error) content = <ErrorState onRetry={() => (data.error ? data.reload() : retryQuran())} />;
  else if (!data.data)
    content = (
      <View style={{ padding: space.gutter, gap: space.lg }}>
        <Text variant="footnote" color="textMuted" align="center">
          {t('quran.preparing')}
        </Text>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={28} width={i % 2 ? '80%' : '100%'} />
        ))}
      </View>
    );
  else
    content = (
      <FlatList
        ref={listRef}
        data={data.data.ayahs}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <AyahRow
            ayah={item}
            size={settings.quran.fontSize}
            translation={data.data?.translations[item.id]}
            bookmarked={!!data.data?.bookmarks.has(item.ayah)}
            playing={playingAyah === item.ayah}
            onPress={setSelected}
          />
        )}
        extraData={playingAyah}
        ListHeaderComponent={listHeader}
        ListFooterComponent={footer}
        initialNumToRender={Math.max(12, targetAyah + 4)}
        maxToRenderPerBatch={10}
        windowSize={11}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 900 }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.1 }), 120);
        }}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + 180,
          width: '100%',
          maxWidth: MAX_READING_WIDTH + space.gutter * 2,
          alignSelf: 'center',
        }}
        testID="ayah-list"
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }} testID="reader">
      <View style={{ paddingTop: insets.top, backgroundColor: colors.page, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Header
          back
          title={fmt.surahName(surah)}
          actions={
            <>
              <IconButton icon={Headphones} label={t('audio.play')} onPress={() => audio.play(surahNo, 1)} testID="reader-play" />
              <IconButton icon={Settings2} label={t('quran.readingSettings')} onPress={() => setSettingsOpen(true)} testID="reader-settings" />
            </>
          }
        />
      </View>
      {content}
      <View
        style={{ position: 'absolute', left: space.md, right: space.md, bottom: insets.bottom + space.md, maxWidth: 640, alignSelf: 'center' }}
        pointerEvents="box-none"
      >
        <MiniPlayer />
      </View>

      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? t('quran.ayahActions', { surah: fmt.digits(selected.surah), ayah: fmt.digits(selected.ayah) }) : ''}
        testID="ayah-sheet"
      >
        {selected ? (
          <View style={{ gap: space.xs }}>
            <ListRow
              icon={data.data?.bookmarks.has(selected.ayah) ? BookmarkCheck : Bookmark}
              title={data.data?.bookmarks.has(selected.ayah) ? t('quran.removeBookmark') : t('quran.bookmark')}
              testID="action-bookmark"
              chevron={false}
              onPress={async () => {
                await bookmarksRepo.toggle(dbs.user, selected.surah, selected.ayah);
                bumpDataVersion();
                setSelected(null);
              }}
            />
            <ListRow
              icon={Play}
              title={t('quran.playFromHere')}
              chevron={false}
              testID="action-play"
              onPress={() => {
                audio.play(selected.surah, selected.ayah);
                setSelected(null);
              }}
            />
            <ListRow
              icon={BookOpenCheck}
              iconTone="accent"
              title={sel.data?.mem ? t('quran.inMemorization') : t('quran.memorize')}
              chevron={false}
              testID="action-memorize"
              onPress={async () => {
                if (!sel.data?.mem) {
                  await memorizationRepo.upsert(dbs.user, {
                    surah: selected.surah,
                    ayah: selected.ayah,
                    status: 'learning',
                    ...NEW_REVIEW_STATE,
                    dueDate: toISODate(new Date()),
                  });
                  bumpDataVersion();
                }
                setSelected(null);
              }}
            />
            <ListRow
              icon={Copy}
              iconTone="muted"
              title={t('common.copy')}
              chevron={false}
              onPress={async () => {
                await Clipboard.setStringAsync(`${selected.text}\n— ${fmt.surahName(surah)} ${selected.surah}:${selected.ayah} (Tanzil)`);
                setSelected(null);
              }}
              last
            />
            <Divider style={{ marginVertical: space.sm }} />
            <Text variant="overline" color="textMuted">
              {t('quran.translationAndTafsir')}
            </Text>
            {sel.data && sel.data.trans.length === 0 ? (
              <View style={{ gap: space.sm }}>
                <Text variant="subhead" color="textMuted">
                  {t('quran.noTranslations')}
                </Text>
                <Button
                  label={t('quran.goToLibrary')}
                  icon={Languages}
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setSelected(null);
                    router.push('/library');
                  }}
                />
              </View>
            ) : (
              sel.data?.trans.map(({ edition, text }) => (
                <View key={edition.id} style={{ gap: 4, paddingVertical: space.sm }}>
                  <Text variant="caption" color="accent">
                    {edition.name} · {edition.kind === 'tafsir' ? t('library.tafsir') : t('library.translations')}
                  </Text>
                  <Text variant="subhead" script={edition.language === 'ar' ? 'arabic' : 'latin'} selectable>
                    {text}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('quran.readingSettings')} testID="reader-settings-sheet">
        <View style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="callout">{t('quran.fontSize')}</Text>
            <Stepper
              label={t('quran.fontSize')}
              value={settings.quran.fontSize}
              min={QURAN_FONT_RANGE[0]}
              max={QURAN_FONT_RANGE[1]}
              step={2}
              onChange={(v) => update({ quran: { fontSize: v } })}
              format={(v) => fmt.digits(v)}
              testID="quran-font-stepper"
            />
          </View>
          {data.data?.basmala ? <AyahText text={data.data.basmala} size={settings.quran.fontSize} align="center" /> : null}
          <Text variant="callout">{t('quran.showTranslation')}</Text>
          {data.data && data.data.editions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Chip
                label={t('quran.translationNone')}
                selected={!settings.quran.translationEdition}
                onPress={() => update({ quran: { translationEdition: null } })}
              />
              {data.data.editions.map((e) => (
                <Chip
                  key={e.id}
                  label={e.name}
                  selected={settings.quran.translationEdition === e.id}
                  onPress={() => update({ quran: { translationEdition: e.id } })}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title={t('quran.noTranslations')}
              action={t('quran.goToLibrary')}
              onAction={() => {
                setSettingsOpen(false);
                router.push('/library');
              }}
            />
          )}
        </View>
      </Sheet>
    </View>
  );
}
