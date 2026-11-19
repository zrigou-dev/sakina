import { router, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import Baby from 'lucide-react-native/icons/baby';
import BookMarked from 'lucide-react-native/icons/book-bookmark';
import BookOpenText from 'lucide-react-native/icons/book-open-text';
import Compass from 'lucide-react-native/icons/compass';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import Library from 'lucide-react-native/icons/library';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { View } from 'react-native';

import { Card, FadeIn } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useI18n, useTheme, type TKey } from '@/runtime/AppProvider';

interface Section {
  readonly id: string;
  readonly title: TKey;
  readonly body: TKey;
  readonly icon: LucideIcon;
  readonly href: Href;
  readonly tone: 'primary' | 'accent';
}

const SECTIONS: readonly Section[] = [
  { id: 'academy', title: 'learn.academy', body: 'learn.academyBody', icon: GraduationCap, href: '/learn/academy', tone: 'primary' },
  { id: 'library', title: 'learn.library', body: 'libraryMore.hadithBody', icon: Library, href: '/learn/library', tone: 'accent' },
  { id: 'guides', title: 'learn.guides', body: 'learn.guidesBody', icon: Compass, href: '/learn/guides', tone: 'primary' },
  { id: 'hadith', title: 'hadith.title', body: 'hadith.intro', icon: BookOpenText, href: '/hadith', tone: 'accent' },
  { id: 'hajj', title: 'learn.hajj', body: 'hajj.intro', icon: BookMarked, href: '/hajj', tone: 'accent' },
  { id: 'asma', title: 'learn.asma', body: 'learn.asmaBody', icon: Sparkles, href: '/asma', tone: 'primary' },
  { id: 'family', title: 'kids.title', body: 'kids.intro', icon: Baby, href: '/learn/family', tone: 'accent' },
];

export default function LearnTab() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Screen title={t('learn.title')} subtitle={t('learn.intro')} large tabBarInset testID="learn-tab">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {SECTIONS.map((s, i) => (
          <FadeIn key={s.id} index={i} style={{ width: '47%', flexGrow: 1 }}>
            <Card onPress={() => router.push(s.href)} testID={`learn-${s.id}`} style={{ minHeight: 168, gap: space.sm }} accessibilityLabel={t(s.title)}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: s.tone === 'primary' ? colors.primarySoft : colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon icon={s.icon} color={s.tone} />
              </View>
              <Text variant="headline">{t(s.title)}</Text>
              <Text variant="footnote" color="textMuted" numberOfLines={3}>
                {t(s.body)}
              </Text>
            </Card>
          </FadeIn>
        ))}
      </View>
    </Screen>
  );
}
