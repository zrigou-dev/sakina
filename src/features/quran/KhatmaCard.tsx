import { router } from 'expo-router';
import Target from 'lucide-react-native/icons/target';
import { View } from 'react-native';

import { khatmaRepo } from '@/database/repositories/user';
import { Card, FadeIn, ProgressRing } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useLoader } from '@/hooks/useLoader';
import { useDbs, useI18n, useSettings } from '@/runtime/AppProvider';
import { khatmaDay, khatmaPortion, khatmaProgress } from '@/services/quran/khatma';
import { getSurah } from '@/services/quran/navigation';

/** Home card for an active khatma plan; renders nothing when no plan is set. */
export function KhatmaCard() {
  const [settings] = useSettings();
  const { t } = useI18n();
  const dbs = useDbs();
  const fmt = useFormat();
  const done = useLoader(() => khatmaRepo.doneDays(dbs.user), [dbs]);
  const plan = settings.khatma;
  if (!plan) return null;
  const day = khatmaDay(plan.startedOn, plan.days, new Date());
  const p = khatmaPortion(plan.days, day);
  const progress = khatmaProgress(plan.days, done.data ?? new Set());
  return (
    <FadeIn index={5}>
      <Card style={{ marginTop: space.md }} onPress={() => router.push('/khatma')} testID="home-khatma">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <ProgressRing progress={progress} size={52} stroke={4} color="accent">
            <Icon icon={Target} size={20} color="accent" />
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline">{t('khatma.today')}</Text>
            <Text variant="footnote" color="textMuted">
              {t('khatma.portion', {
                from: `${fmt.surahShort(getSurah(p.from.surah))} ${fmt.digits(p.from.ayah)}`,
                to: `${fmt.surahShort(getSurah(p.to.surah))} ${fmt.digits(p.to.ayah)}`,
              })}
            </Text>
            <Text variant="caption" color="accent">
              {t('khatma.dayOf', { day: fmt.digits(day), total: fmt.digits(plan.days) })}
            </Text>
          </View>
        </View>
      </Card>
    </FadeIn>
  );
}
