import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ADHKAR_GROUPS } from '@/content/adhkar/groups';
import { adhkarRepo } from '@/database/repositories/content';
import { FadeIn, ListGroup, ListRow, Skeleton } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { GROUP_ICONS } from '@/features/adhkar/groupIcons';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime } from '@/runtime/AppProvider';

export default function AdhkarGroup() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const g = ADHKAR_GROUPS.find((x) => x.id === group) ?? ADHKAR_GROUPS[0];
  const { t, lang } = useI18n();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const fmt = useFormat();
  const cats = useLoader(
    async () =>
      quranStatus === 'ready'
        ? adhkarRepo.categoriesByIds(
            dbs.content,
            g.chapters.map((c) => `hisn:${c}`),
          )
        : [],
    [g.id, quranStatus],
  );

  return (
    <Screen back title={t(g.title)} large testID={`adhkar-group-${g.id}`}>
      {cats.loading && !cats.data?.length ? (
        <Skeleton height={240} />
      ) : (
        <FadeIn>
          <ListGroup>
            {(cats.data ?? []).map((c, i, all) => (
              <ListRow
                key={c.id}
                icon={GROUP_ICONS[g.id]}
                iconTone={i % 2 ? 'accent' : 'primary'}
                title={lang === 'ar' ? c.titleAr : (c.titleEn ?? c.titleAr)}
                subtitle={`${lang === 'ar' ? '' : `${c.titleAr} · `}${t('adhkarMore.dhikrCount', { count: c.itemCount })} · ${fmt.digits(c.position)}`}
                onPress={() => router.push(`/adhkar/${encodeURIComponent(c.id)}`)}
                testID={`chapter-${c.id}`}
                last={i === all.length - 1}
              />
            ))}
          </ListGroup>
        </FadeIn>
      )}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
