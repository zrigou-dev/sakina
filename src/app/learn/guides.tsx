import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { adhkarRepo } from '@/database/repositories/content';
import { Card, FadeIn, ListGroup, ListRow } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { GROUP_ICONS } from '@/features/adhkar/groupIcons';
import { GUIDES } from '@/features/learn/paths';
import { groupOfChapter } from '@/content/adhkar/groups';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useRuntime, useTheme } from '@/runtime/AppProvider';

/** Life-situation guides: the relevant chapters of Ḥiṣn al-Muslim for each moment. */
export default function Guides() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const { quranStatus } = useRuntime();
  const [open, setOpen] = useState<string | null>(GUIDES[0]!.id);
  const cats = useLoader(async () => {
    if (quranStatus !== 'ready') return [];
    return adhkarRepo.categoriesByIds(
      dbs.content,
      [...new Set(GUIDES.flatMap((g) => g.chapters))].map((c) => `hisn:${c}`),
    );
  }, [quranStatus]);
  const byId = new Map((cats.data ?? []).map((c) => [c.id, c]));

  return (
    <Screen back title={t('learn.guides')} subtitle={t('guides.intro')} large testID="learn-guides">
      <View style={{ gap: space.sm }}>
        {GUIDES.map((g, i) => {
          const expanded = open === g.id;
          const icon = GROUP_ICONS[groupOfChapter(g.chapters[0]!)];
          return (
            <FadeIn key={g.id} index={i}>
              <Card padded={false} testID={`guide-${g.id}`}>
                <PressableScale
                  onPress={() => setOpen(expanded ? null : g.id)}
                  scaleTo={0.99}
                  aria-expanded={expanded}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: i % 2 ? colors.accentSoft : colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={icon} color={i % 2 ? 'accent' : 'primary'} />
                  </View>
                  <Text variant="headline" style={{ flex: 1 }}>
                    {t(g.title)}
                  </Text>
                </PressableScale>
                {expanded ? (
                  <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
                    <ListGroup>
                      {g.chapters.map((c, j) => {
                        const cat = byId.get(`hisn:${c}`);
                        if (!cat) return null;
                        return (
                          <ListRow
                            key={c}
                            title={lang === 'ar' ? cat.titleAr : (cat.titleEn ?? cat.titleAr)}
                            subtitle={lang === 'ar' ? undefined : cat.titleAr}
                            onPress={() => router.push(`/adhkar/${encodeURIComponent(cat.id)}`)}
                            last={j === g.chapters.length - 1}
                          />
                        );
                      })}
                    </ListGroup>
                  </View>
                ) : null}
              </Card>
            </FadeIn>
          );
        })}
      </View>
      <Text variant="caption" color="textFaint" align="center" style={{ marginTop: space.lg }}>
        {t('adhkarMore.sourceHisn')}
      </Text>
    </Screen>
  );
}
