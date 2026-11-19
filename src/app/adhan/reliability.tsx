import { useFocusEffect } from 'expo-router';
import AlertTriangle from 'lucide-react-native/icons/triangle-exclamation-point';
import BatteryCharging from 'lucide-react-native/icons/battery-charging';
import Info from 'lucide-react-native/icons/info';
import Bell from 'lucide-react-native/icons/bell';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Cpu from 'lucide-react-native/icons/cpu';
import Volume2 from 'lucide-react-native/icons/volume-2';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';

import { Button, Card, ListGroup, ListRow, Notice, SectionHeader } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n } from '@/runtime/AppProvider';
import { useAdhan } from '@/services/adhan/AdhanProvider';
import { hasNativeEngine, nativeAdhan, type NativeStatus } from '@/services/adhan/nativeEngine';
import { getPermission, requestPermission, type NotificationPermission } from '@/services/notifications/scheduler';

/** Everything that decides whether the adhan sounds on time — visible, testable, and fixable in one place. */
export default function AdhanReliability() {
  const { t } = useI18n();
  const fmt = useFormat();
  const adhan = useAdhan();
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');

  const refresh = useCallback(() => {
    setStatus(nativeAdhan ? nativeAdhan.getStatus() : null);
    getPermission()
      .then(setPermission)
      .catch(() => undefined);
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const notificationsOk = status ? status.notificationsEnabled : permission === 'granted';
  const row = (ok: boolean) => (ok ? CheckCircle2 : AlertTriangle);
  const next = status?.nextAlarmAtMs ? new Date(status.nextAlarmAtMs) : null;

  return (
    <Screen back title={t('adhan.reliability')} subtitle={t('adhan.reliabilityIntro')} large testID="adhan-reliability">
      <Card tone="primary" style={{ gap: space.md }}>
        <Text variant="callout">{t('adhan.testHelp')}</Text>
        <Button label={t('adhan.testNow')} icon={Volume2} onPress={() => adhan.playForPrayer('dhuhr')} testID="adhan-test-now" />
      </Card>

      <SectionHeader title={t('adhan.engine')} />
      <ListGroup>
        <ListRow
          icon={Cpu}
          iconTone={hasNativeEngine ? 'primary' : 'muted'}
          title={t('adhan.engine')}
          subtitle={hasNativeEngine ? t('adhan.engineNative') : t('adhan.engineNotifications')}
          chevron={false}
          testID="adhan-engine"
          last
        />
      </ListGroup>

      <SectionHeader title={t('adhan.reliability')} />
      <ListGroup>
        <ListRow
          icon={row(notificationsOk)}
          iconTone={notificationsOk ? 'primary' : 'danger'}
          title={notificationsOk ? t('adhan.notificationsOn') : t('adhan.notificationsOff')}
          chevron={false}
          trailing={
            notificationsOk ? undefined : (
              <Button
                label={t('adhan.openSettings')}
                size="sm"
                variant="secondary"
                onPress={async () => {
                  if (nativeAdhan) nativeAdhan.openSettings('notifications');
                  else if ((await requestPermission()) !== 'granted') await Linking.openSettings();
                  refresh();
                }}
              />
            )
          }
          testID="adhan-check-notifications"
        />
        {status ? (
          <>
            <ListRow
              icon={row(status.ignoringBatteryOptimizations)}
              iconTone={status.ignoringBatteryOptimizations ? 'primary' : 'accent'}
              title={status.ignoringBatteryOptimizations ? t('adhan.batteryOk') : t('adhan.batteryLimited')}
              chevron={false}
              trailing={
                status.ignoringBatteryOptimizations ? undefined : (
                  <Button
                    label={t('adhan.openSettings')}
                    size="sm"
                    variant="secondary"
                    icon={BatteryCharging}
                    onPress={() => nativeAdhan?.openSettings('battery')}
                  />
                )
              }
              testID="adhan-check-battery"
            />
            <ListRow
              icon={row(status.alarmVolume > 0)}
              iconTone={status.alarmVolume > 0 ? 'primary' : 'accent'}
              title={t('adhan.alarmVolume')}
              subtitle={status.alarmVolume > 0 ? `${fmt.digits(status.alarmVolume)} / ${fmt.digits(status.alarmVolumeMax)}` : t('adhan.alarmVolumeLow')}
              chevron={false}
              testID="adhan-check-volume"
            />
            <ListRow
              icon={CalendarClock}
              iconTone={next ? 'primary' : 'accent'}
              title={t('adhan.nextAdhan')}
              subtitle={next ? `${fmt.gregorian(next)} · ${fmt.time(next)}` : t('adhan.noneScheduled')}
              chevron={false}
              testID="adhan-check-next"
            />
            <ListRow icon={Bell} iconTone="muted" title={t('adhan.scheduledCount', { count: fmt.digits(status.armedCount) })} chevron={false} last />
          </>
        ) : null}
      </ListGroup>

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        {status ? <Notice tone="accent" icon={Info} text={t('adhan.oemTip')} /> : <Notice tone="accent" icon={Info} text={t('adhan.iosNote')} />}
      </View>
    </Screen>
  );
}
