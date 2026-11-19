import { router } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Trash2 from 'lucide-react-native/icons/trash';
import { View } from 'react-native';

import { quranRepo } from '@/database/repositories/content';
import { bookmarksRepo } from '@/database/repositories/user';
import { Card, EmptyState, FadeIn, IconButton, Skeleton } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { AyahText } from '@/features/quran/AyahText';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, useRuntime } from '@/runtime/AppProvider';
import { getSurah } from '@/services/quran/navigation';

export default function Bookmarks() {
  const { t } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const list = useLoader(async () => {
    const rows = await bookmarksRepo.list(dbs.user);
    if (quranStatus !== 'ready') return rows.map((b) => ({ ...b, text: null as string | null }));
    return Promise.all(rows.map(async (b) => ({ ...b, text: (await quranRepo.ayah(dbs.content, b.surah, b.ayah))?.text ?? null })));
  }, [dbs, quranStatus]);

  return (
    <Screen back title={t('quran.bookmarks')} testID="bookmarks-screen">
      {list.loading && !list.data ? (
        <Skeleton height={120} />
      ) : !list.data?.length ? (
        <EmptyState icon={Bookmark} title={t('quran.bookmarks')} body={t('quran.noBookmarks')} />
      ) : (
        <View style={{ gap: space.md }}>
          {list.data.map((b, i) => (
            <FadeIn key={b.id} index={i}>
              <Card onPress={() => router.push(`/quran/${b.surah}?ayah=${b.ayah}`)} testID={`bookmark-${b.surah}-${b.ayah}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="callout" color="accent" style={{ flex: 1 }}>
                    {fmt.surahName(getSurah(b.surah))} · {fmt.digits(b.surah)}:{fmt.digits(b.ayah)}
                  </Text>
                  <IconButton
                    icon={Trash2}
                    label={t('quran.removeBookmark')}
                    color="textMuted"
                    size={18}
                    onPress={async () => {
                      await bookmarksRepo.remove(dbs.user, b.id);
                      bumpDataVersion();
                    }}
                  />
                </View>
                {b.text ? <AyahText text={b.text} ayah={b.ayah} size={22} numberOfLines={4} /> : null}
              </Card>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
}
