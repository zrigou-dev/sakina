import { router } from 'expo-router';
import { View } from 'react-native';

import { hadithRepo } from '@/database/repositories/content';
import { Skeleton } from '@/design-system/components';
import { PressableScale } from '@/design-system/PressableScale';
import { space } from '@/design-system/tokens';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useRuntime } from '@/runtime/AppProvider';

import { dailyHadithKey } from './daily';
import { HadithCard } from './HadithCard';

export function DailyHadith({ date }: { date: Date }) {
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const key = dailyHadithKey(date);
  const h = useLoader(async () => (quranStatus === 'ready' ? hadithRepo.get(dbs.content, key.book, key.number) : null), [quranStatus, key.book, key.number]);
  if (!h.data) return <Skeleton height={140} />;
  return (
    <PressableScale onPress={() => router.push(`/hadith/${key.book}?n=${key.number}`)} scaleTo={0.99} testID="daily-hadith">
      <View pointerEvents="none" style={{ gap: space.sm }}>
        <HadithCard h={h.data} compact actions={false} />
      </View>
    </PressableScale>
  );
}
