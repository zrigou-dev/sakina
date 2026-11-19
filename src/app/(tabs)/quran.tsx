import { router } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookOpen from 'lucide-react-native/icons/book-open';
import BookOpenCheck from 'lucide-react-native/icons/book-open-check';
import Hash from 'lucide-react-native/icons/hash';
import Search from 'lucide-react-native/icons/search';
import { memo, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SurahMeta } from '@/content/quran/types';
import { readingRepo } from '@/database/repositories/user';
import { Card, ErrorState, IconButton, SegmentedControl } from '@/design-system/components';
import { EightPointStar, GeometricBackdrop } from '@/design-system/GeometricBackdrop';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Header } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { MAX_READING_WIDTH, radius, space } from '@/design-system/tokens';
import { JumpSheet } from '@/features/quran/JumpSheet';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { getSurah, juzStart, SURAHS } from '@/services/quran/navigation';

const SurahRow = memo(function SurahRow({ s }: { s: SurahMeta }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  return (
    <PressableScale
      onPress={() => router.push(`/quran/${s.number}`)}
      testID={`surah-${s.number}`}
      scaleTo={0.99}
      accessibilityLabel={`${fmt.surahName(s)}, ${t('common.ayahs', { count: s.ayahCount })}, ${s.revelation === 'meccan' ? t('quran.meccan') : t('quran.medinan')}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <EightPointStar size={44} color={colors.accent} />
        <View style={{ position: 'absolute' }}>
          <Text variant="caption" weight="semibold" align="center" fixedSize>
            {fmt.digits(s.number)}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" style={lang === 'ar' ? { fontFamily: 'Amiri_700Bold', fontSize: 20 } : undefined}>
          {fmt.surahShort(s)}
        </Text>
        <Text variant="footnote" color="textMuted">
          {s.revelation === 'meccan' ? t('quran.meccan') : t('quran.medinan')} · {t('common.ayahs', { count: s.ayahCount })}
        </Text>
      </View>
      {lang !== 'ar' ? (
        <Text script="arabic" variant="title3" color="primary" style={{ fontFamily: 'Amiri_700Bold' }}>
          {s.nameArabic}
        </Text>
      ) : null}
    </PressableScale>
  );
});

export default function QuranTab() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { quranStatus, retryQuran } = useRuntime();
  const dbs = useDbs();
  const fmt = useFormat();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'surah' | 'juz'>('surah');
  const [jumpOpen, setJumpOpen] = useState(false);
  const pos = useLoader(() => readingRepo.getPosition(dbs.user), [dbs]);
  const juzList = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ n: i + 1, start: juzStart(i + 1) })), []);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      {quranStatus === 'integrity_error' ? <ErrorState title={t('common.errorTitle')} body={t('quran.integrityError')} /> : null}
      {quranStatus === 'error' ? <ErrorState onRetry={retryQuran} /> : null}
      <Card
        tone="primary"
        testID="quran-continue"
        onPress={() => router.push(pos.data ? `/quran/${pos.data.surah}?ayah=${pos.data.ayah}` : '/quran/1')}
        accessibilityLabel={pos.data ? t('home.continueReading') : t('home.startReading')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={BookOpen} color="primaryInk" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="overline" color="primary">
              {pos.data ? t('quran.lastRead') : t('home.startReading')}
            </Text>
            <Text variant="headline">
              {pos.data
                ? t('quran.continueAt', { surah: fmt.surahShort(getSurah(pos.data.surah)), ayah: fmt.digits(pos.data.ayah) })
                : t('home.startReadingBody')}
            </Text>
          </View>
        </View>
      </Card>
      <Card onPress={() => router.push('/quran/memorization')} testID="quran-memorization">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon icon={BookOpenCheck} color="accent" />
          <Text variant="headline" style={{ flex: 1 }}>
            {t('memorization.title')}
          </Text>
        </View>
      </Card>
      <SegmentedControl
        testID="quran-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'surah', label: t('quran.surahs') },
          { value: 'juz', label: t('quran.juz') },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="quran-tab">
      <GeometricBackdrop />
      <View style={{ paddingTop: insets.top }}>
        <Header
          title={t('quran.title')}
          large
          actions={
            <>
              <IconButton icon={Hash} label={t('quran.jumpTo')} onPress={() => setJumpOpen(true)} tone="filled" testID="quran-jump" />
              <IconButton icon={Search} label={t('quran.searchPlaceholder')} onPress={() => router.push('/quran/search')} tone="filled" testID="quran-search" />
              <IconButton icon={Bookmark} label={t('quran.bookmarks')} onPress={() => router.push('/quran/bookmarks')} tone="filled" testID="quran-bookmarks" />
            </>
          }
        />
      </View>
      {mode === 'surah' ? (
        <FlatList
          data={SURAHS as SurahMeta[]}
          keyExtractor={(s) => String(s.number)}
          renderItem={({ item }) => <SurahRow s={item} />}
          ListHeaderComponent={header}
          initialNumToRender={14}
          windowSize={8}
          contentContainerStyle={{
            paddingHorizontal: space.gutter,
            paddingBottom: insets.bottom + 110,
            width: '100%',
            maxWidth: MAX_READING_WIDTH + space.gutter * 2,
            alignSelf: 'center',
          }}
        />
      ) : (
        <FlatList
          data={juzList}
          keyExtractor={(j) => String(j.n)}
          ListHeaderComponent={header}
          contentContainerStyle={{
            paddingHorizontal: space.gutter,
            paddingBottom: insets.bottom + 110,
            width: '100%',
            maxWidth: MAX_READING_WIDTH + space.gutter * 2,
            alignSelf: 'center',
          }}
          renderItem={({ item }) => {
            const s = getSurah(item.start.surah);
            return (
              <PressableScale
                onPress={() => router.push(`/quran/${item.start.surah}?ayah=${item.start.ayah}`)}
                testID={`juz-${item.n}`}
                scaleTo={0.99}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingVertical: space.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text variant="callout" weight="semibold" color="accent" fixedSize>
                    {fmt.digits(item.n)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{t('quran.juzN', { n: item.n })}</Text>
                  <Text variant="footnote" color="textMuted">
                    {fmt.surahShort(s)} · {fmt.digits(item.start.ayah)}
                  </Text>
                </View>
              </PressableScale>
            );
          }}
        />
      )}
      <JumpSheet visible={jumpOpen} onClose={() => setJumpOpen(false)} />
    </View>
  );
}
