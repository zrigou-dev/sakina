import { router } from 'expo-router';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import { View } from 'react-native';

import { quranRepo } from '@/database/repositories/content';
import { Card, Skeleton } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime } from '@/runtime/AppProvider';
import { getSurah } from '@/services/quran/navigation';
import { dailyVerseKey } from '@/services/quran/daily';

import { AyahText } from './AyahText';

export function DailyVerse({ date }: { date: Date }) {
  const { t } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const key = dailyVerseKey(date);
  const { data } = useLoader(
    async () => (quranStatus === 'ready' ? quranRepo.ayah(dbs.content, key.surah, key.ayah) : null),
    [quranStatus, key.surah, key.ayah],
  );
  const surah = getSurah(key.surah);

  return (
    <Card
      onPress={() => router.push(`/quran/${key.surah}?ayah=${key.ayah}`)}
      testID="daily-verse"
      accessibilityLabel={`${t('home.dailyAyah')}: ${fmt.surahName(surah)} ${key.ayah}`}
    >
      {data ? (
        <AyahText text={data.text} ayah={data.ayah} size={24} numberOfLines={6} />
      ) : (
        <View style={{ gap: space.sm }}>
          <Skeleton height={22} />
          <Skeleton height={22} width="70%" />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, gap: space.sm }}>
        <Text variant="footnote" color="accent" weight="semibold" style={{ flex: 1 }}>
          {fmt.surahName(surah)} · {fmt.digits(key.surah)}:{fmt.digits(key.ayah)}
        </Text>
        <Icon icon={ArrowRight} size={18} color="textMuted" directional />
      </View>
    </Card>
  );
}
