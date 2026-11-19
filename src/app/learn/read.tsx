import { useLocalSearchParams } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { useEffect } from 'react';
import { View } from 'react-native';

import { learningRepo } from '@/database/repositories/user';
import { Badge, Button, EmptyState, Skeleton } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useLoader } from '@/hooks/useLoader';
import { bumpDataVersion, useDbs, useI18n, type TKey } from '@/runtime/AppProvider';
import { contentPackagesRepo } from '@/services/content/packages';

export default function LearnRead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const dbs = useDbs();
  const item = useLoader(() => contentPackagesRepo.item(dbs.content, decodeURIComponent(id ?? '')), [id]);
  const progress = useLoader(
    async () => (item.data ? (await learningRepo.forPackage(dbs.user, item.data.packageId))[item.data.id] : undefined),
    [item.data?.id],
  );

  useEffect(() => {
    if (item.data && !progress.data && !progress.loading) learningRepo.set(dbs.user, item.data.packageId, item.data.id, 'started').catch(() => undefined);
  }, [item.data, progress.data, progress.loading, dbs]);

  if (item.loading && !item.data)
    return (
      <Screen back>
        <Skeleton height={200} />
      </Screen>
    );
  if (!item.data)
    return (
      <Screen back>
        <EmptyState title={t('errors.notFound')} />
      </Screen>
    );
  const it = item.data;
  const script = /[\u0600-\u06FF]/.test(it.body.slice(0, 200)) ? 'arabic' : 'latin';

  return (
    <Screen back title={it.title} large testID="learn-read">
      <View style={{ gap: space.md }}>
        <Badge
          label={t(`learn.contentTypes.${it.contentType}` as TKey)}
          tone={it.contentType === 'source_text' ? 'primary' : it.contentType === 'scholarly_opinion' ? 'accent' : 'warning'}
        />
        <Text variant="body" script={script} selectable style={{ lineHeight: script === 'arabic' ? 34 : 26 }}>
          {it.body}
        </Text>
        <Text variant="caption" color="textFaint">
          {t('common.source')}: {it.source}
        </Text>
        <Button
          label={progress.data === 'completed' ? t('learn.completed') : t('learn.markComplete')}
          icon={Check}
          variant={progress.data === 'completed' ? 'secondary' : 'primary'}
          onPress={async () => {
            await learningRepo.set(dbs.user, it.packageId, it.id, 'completed');
            bumpDataVersion();
          }}
        />
      </View>
    </Screen>
  );
}
