import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import BookHeart from 'lucide-react-native/icons/book-heart';
import BookOpen from 'lucide-react-native/icons/book-open';
import Library from 'lucide-react-native/icons/library';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Sun from 'lucide-react-native/icons/sun';
import { View } from 'react-native';

import { learningRepo } from '@/database/repositories/user';
import { Card, FadeIn, ProgressBar } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { PATHS, pathPackageId, type PathId } from '@/features/learn/paths';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useTheme } from '@/runtime/AppProvider';

const ICONS: Record<PathId, LucideIcon> = { nawawi: Library, qudsi: Sparkles, juzamma: BookOpen, names: BookHeart, essentials: Sun };

export default function Academy() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const fmt = useFormat();
  const progress = useLoader(async () => {
    const out: Record<string, number> = {};
    for (const p of PATHS) out[p.id] = Object.values(await learningRepo.forPackage(dbs.user, pathPackageId(p.id))).filter((s) => s === 'completed').length;
    return out;
  }, [dbs]);

  return (
    <Screen back title={t('academy.pathsTitle')} subtitle={t('learn.academyBody')} large testID="learn-academy">
      <View style={{ gap: space.md }}>
        {PATHS.map((p, i) => {
          const done = progress.data?.[p.id] ?? 0;
          return (
            <FadeIn key={p.id} index={i}>
              <Card onPress={() => router.push(`/learn/path/${p.id}`)} testID={`path-${p.id}`} style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: radius.lg,
                      backgroundColor: i % 2 ? colors.accentSoft : colors.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={ICONS[p.id]} color={i % 2 ? 'accent' : 'primary'} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="headline">{t(p.title)}</Text>
                    <Text variant="footnote" color="textMuted">
                      {t(p.body)}
                    </Text>
                  </View>
                </View>
                <ProgressBar progress={done / p.total} color={done === p.total ? 'accent' : 'primary'} />
                <Text variant="caption" color="textMuted">
                  {t('academy.progress', { done: fmt.digits(done), total: fmt.digits(p.total) })}
                </Text>
              </Card>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}
