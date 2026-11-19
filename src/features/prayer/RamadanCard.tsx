import Moon from 'lucide-react-native/icons/moon';
import Sunrise from 'lucide-react-native/icons/sunrise';
import { View } from 'react-native';

import { Card, FadeIn } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { usePrayerTimes } from '@/hooks/usePrayer';
import { useI18n, useSettings } from '@/runtime/AppProvider';
import { isRamadan } from '@/services/hijri/occasions';

/** During Ramadan (by the user's adjusted Hijri date): when suhoor ends and when iftar begins. */
export function RamadanCard({ now }: { now: Date }) {
  const [settings] = useSettings();
  const { t } = useI18n();
  const fmt = useFormat();
  const { schedule } = usePrayerTimes(now);
  if (!schedule || !isRamadan(now, settings.hijriOffset)) return null;
  const fajr = schedule.times.find((x) => x.name === 'fajr')!.time;
  const maghrib = schedule.times.find((x) => x.name === 'maghrib')!.time;
  return (
    <FadeIn index={2}>
      <Card tone="accent" style={{ marginTop: space.md }} testID="ramadan-card">
        <Text variant="overline" color="accent">
          {t('prayerExtra.ramadanTitle')} · {fmt.hijri(now)}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: space.md, gap: space.md }}>
          {(
            [
              [Sunrise, t('prayerExtra.suhoorEnds'), fajr],
              [Moon, t('prayerExtra.iftar'), maghrib],
            ] as const
          ).map(([icon, label, time]) => (
            <View key={label} style={{ flex: 1, gap: space.xs }}>
              <Icon icon={icon} color="accent" />
              <Text variant="footnote" color="textMuted">
                {label}
              </Text>
              <Text variant="title2">{fmt.time(time)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </FadeIn>
  );
}
