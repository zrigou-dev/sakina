import { router } from 'expo-router';
import BookMarked from 'lucide-react-native/icons/book-bookmark';
import BookOpen from 'lucide-react-native/icons/book-open';
import Library from 'lucide-react-native/icons/library';
import { useState } from 'react';
import { View } from 'react-native';

import { hadithRepo } from '@/database/repositories/content';
import { hadithBookmarksRepo } from '@/database/repositories/user';
import { Badge, Card, Chip, FadeIn, SectionHeader, TextField } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { HadithCard, hadithBookName } from '@/features/hadith/HadithCard';
import { PackageActions } from '@/features/library/PackageActions';
import { useDebounced } from '@/hooks/useDebounced';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';
import { BUNDLED_HADITH_BOOKS, hadithPackage, HADITH_BOOKS, type HadithVariant } from '@/services/downloads/catalogue';
import { usePackageStates } from '@/services/downloads/DownloadProvider';

function DownloadableBook({ book }: { book: string }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const states = usePackageStates();
  const variants: HadithVariant[] = ['ar', 'en', 'fr'].filter((v) => hadithPackage(book, v as HadithVariant)) as HadithVariant[];
  const preferred: HadithVariant = lang === 'fr' && variants.includes('fr') ? 'fr' : lang === 'ar' ? 'ar' : variants.includes('en') ? 'en' : 'ar';
  const installed = variants.find((v) => states[`hadith.${book}.${v}`]?.status === 'installed');
  const busy = variants.find((v) => {
    const s = states[`hadith.${book}.${v}`]?.status;
    return s && s !== 'not_installed' && s !== 'installed';
  });
  const [variant, setVariant] = useState<HadithVariant>(installed ?? busy ?? preferred);
  const pkg = hadithPackage(book, variant)!;
  const label = (v: HadithVariant) =>
    v === 'ar' ? t('hadith.downloadArabic') : t('hadith.withTranslation', { language: v === 'en' ? t('hadith.english') : t('hadith.french') });
  return (
    <Card style={{ gap: space.md }} testID={`hadith-book-${book}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={Library} color="accent" />
        </View>
        <Text variant="headline" style={{ flex: 1 }}>
          {hadithBookName(t, book)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {variants.map((v) => (
          <Chip key={v} label={label(v)} selected={variant === v} onPress={() => setVariant(v)} />
        ))}
      </View>
      <PackageActions manifest={pkg} />
    </Card>
  );
}

export default function HadithIndex() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());

  const data = useLoader(async () => {
    if (quranStatus !== 'ready') return null;
    const [books, marks] = await Promise.all([hadithRepo.books(dbs.content), hadithBookmarksRepo.list(dbs.user)]);
    const saved = await hadithRepo.byKeys(dbs.content, marks.slice(0, 20));
    return { books, saved, markKeys: new Set(marks.map((m) => `${m.book}:${m.number}`)) };
  }, [quranStatus]);
  const results = useLoader(async () => (query.length >= 2 ? hadithRepo.search(dbs.content, query, 40) : []), [query]);
  const installedIds = new Set((data.data?.books ?? []).map((b) => b.id));
  const downloadable = HADITH_BOOKS.filter((b) => !(BUNDLED_HADITH_BOOKS as readonly string[]).includes(b.book));

  const toggle = async (book: string, number: number) => {
    await hadithBookmarksRepo.toggle(dbs.user, book, number);
    bumpDataVersion();
  };

  return (
    <Screen back title={t('hadith.title')} subtitle={t('hadith.intro')} large testID="hadith-index">
      <TextField value={q} onChangeText={setQ} placeholder={t('hadith.searchPlaceholder')} testID="hadith-search" autoCorrect={false} />
      {query.length >= 2 ? (
        <View style={{ gap: space.md, marginTop: space.md }}>
          <Text variant="caption" color="textMuted" testID="hadith-search-count">
            {t('quran.resultsCount', { count: results.data?.length ?? 0 })}
          </Text>
          {(results.data ?? []).map((h) => (
            <HadithCard
              key={`${h.book}-${h.number}`}
              h={h}
              bookmarked={data.data?.markKeys.has(`${h.book}:${h.number}`)}
              onBookmark={() => toggle(h.book, h.number)}
            />
          ))}
        </View>
      ) : (
        <>
          <SectionHeader title={t('hadith.onDevice')} />
          <View style={{ gap: space.sm }}>
            {(data.data?.books ?? []).map((b, i) => (
              <FadeIn key={b.id} index={i}>
                <Card onPress={() => router.push(`/hadith/${b.id}`)} testID={`hadith-open-${b.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        backgroundColor: colors.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon icon={BookOpen} color="primary" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="headline">{hadithBookName(t, b.id)}</Text>
                      <Text variant="caption" color="textMuted">
                        {t('hadith.count', { count: b.hadithCount })} ·{' '}
                        {b.languages
                          .split(',')
                          .map((l) => (l === 'ar' ? t('hadith.arabic') : l === 'en' ? t('hadith.english') : t('hadith.french')))
                          .join(' · ')}
                      </Text>
                    </View>
                    {b.bundled ? <Badge label={t('adhan.bundled')} tone="success" /> : null}
                  </View>
                </Card>
              </FadeIn>
            ))}
          </View>

          <SectionHeader title={t('hadith.bookmarks')} />
          {data.data?.saved.length ? (
            <View style={{ gap: space.md }}>
              {data.data.saved.map((h) => (
                <HadithCard key={`${h.book}-${h.number}`} h={h} compact bookmarked onBookmark={() => toggle(h.book, h.number)} />
              ))}
            </View>
          ) : (
            <Card tone="muted">
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <Icon icon={BookMarked} color="textMuted" />
                <Text variant="footnote" color="textMuted" style={{ flex: 1 }}>
                  {t('hadith.noBookmarks')}
                </Text>
              </View>
            </Card>
          )}

          <SectionHeader title={t('hadith.available')} />
          <View style={{ gap: space.md }}>
            {downloadable.map((b) => (
              <DownloadableBook key={b.book} book={b.book} />
            ))}
          </View>
          <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
            {t('hadith.translationNote')} · {fmt.digits(installedIds.size)}/{fmt.digits(HADITH_BOOKS.length)}
          </Text>
        </>
      )}
    </Screen>
  );
}
