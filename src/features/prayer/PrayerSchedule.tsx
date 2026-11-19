import Check from 'lucide-react-native/icons/check';
import Clock from 'lucide-react-native/icons/clock';
import X from 'lucide-react-native/icons/x';
import { View } from 'react-native';

import { logsRepo, type PrayerLogStatus } from '@/database/repositories/user';
import { Badge, Card } from '@/design-system/components';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/PressableScale';
import { Text } from '@/design-system/Text';
import { radius, space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { bumpDataVersion, useDbs, useI18n, useTheme, type TKey } from '@/runtime/AppProvider';
import type { FardPrayer, NextPrayer, PrayerTime } from '@/services/prayer/times';

const NEXT_STATUS: Record<'none' | PrayerLogStatus, PrayerLogStatus | null> = { none: 'on_time', on_time: 'late', late: 'missed', missed: null };

function LogButton({ prayer, status, date }: { prayer: FardPrayer; status: PrayerLogStatus | undefined; date: Date }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dbs = useDbs();
  const label =
    status === 'on_time' ? t('prayer.onTime') : status === 'late' ? t('prayer.late') : status === 'missed' ? t('prayer.missed') : t('prayer.notLogged');
  const bg = status === 'on_time' ? colors.successSoft : status === 'late' ? colors.warningSoft : status === 'missed' ? colors.surfaceMuted : 'transparent';
  const fg = status === 'on_time' ? 'success' : status === 'late' ? 'warning' : 'textFaint';
  const icon = status === 'on_time' ? Check : status === 'late' ? Clock : status === 'missed' ? X : Check;
  return (
    <PressableScale
      haptic="selection"
      testID={`log-${prayer}`}
      accessibilityLabel={`${t('prayer.log')} — ${t(`prayers.${prayer}` as TKey)}: ${label}`}
      accessibilityHint={t('prayer.logHint')}
      onPress={async () => {
        await logsRepo.setPrayer(dbs.user, date, prayer, NEXT_STATUS[status ?? 'none']);
        bumpDataVersion();
      }}
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: bg,
        borderWidth: status ? 0 : 1.5,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon icon={icon} size={16} color={fg} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** Today's six times with the next one highlighted, adjustment badges and the private log. */
export function PrayerSchedule({
  times,
  next,
  now,
  log,
}: {
  times: readonly PrayerTime[];
  next: NextPrayer | null;
  now: Date;
  log: Partial<Record<FardPrayer, PrayerLogStatus>>;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const fmt = useFormat();
  return (
    <Card padded={false} testID="prayer-schedule">
      {times.map((p, i) => {
        const isNext = next?.next.name === p.name && next.next.time.getTime() === p.time.getTime();
        const isCurrent = next?.current?.name === p.name && next.current.time.getTime() === p.time.getTime();
        const passed = p.time.getTime() <= now.getTime();
        const fard = p.name !== 'sunrise';
        return (
          <View
            key={p.name}
            testID={`time-${p.name}`}
            accessibilityLabel={`${t(`prayers.${p.name}` as TKey)} ${fmt.time(p.time)}${p.adjustedBy ? `, ${t('prayer.adjusted', { value: p.adjustedBy })}` : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.lg,
              minHeight: 60,
              backgroundColor: isNext ? colors.primarySoft : 'transparent',
              borderBottomWidth: i < times.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ width: 6, height: 28, borderRadius: 3, backgroundColor: isNext ? colors.primary : isCurrent ? colors.accent : 'transparent' }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" color={passed && !isNext ? 'textMuted' : 'text'}>
                {t(`prayers.${p.name}` as TKey)}
              </Text>
              {isNext ? (
                <Text variant="caption" color="primary">
                  {t('home.nextPrayer')}
                </Text>
              ) : isCurrent ? (
                <Text variant="caption" color="accent">
                  {t('prayer.now')}
                </Text>
              ) : null}
            </View>
            {p.adjustedBy !== 0 ? <Badge label={t('prayer.adjusted', { value: `${p.adjustedBy > 0 ? '+' : ''}${p.adjustedBy}` })} tone="accent" /> : null}
            <Text variant="numeric" color={passed && !isNext ? 'textMuted' : 'text'}>
              {fmt.time(p.time)}
            </Text>
            {fard ? <LogButton prayer={p.name as FardPrayer} status={log[p.name as FardPrayer]} date={now} /> : <View style={{ width: 36 }} />}
          </View>
        );
      })}
    </Card>
  );
}
