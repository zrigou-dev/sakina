import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Volume2 from 'lucide-react-native/icons/volume-2';

import { Button, Card, Chip, ListGroup, ListRow, Notice, SectionHeader, Stepper, Switch } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings, type TKey } from '@/runtime/AppProvider';
import { getPermission, requestPermission, type NotificationPermission } from '@/services/notifications/scheduler';
import { FARD_PRAYERS } from '@/services/prayer/times';
import type { ReminderSetting, Settings } from '@/state/settings';
import { parseHHMM } from '@/utils/date';

const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export default function NotificationSettings() {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  const fmt = useFormat();
  const [perm, setPerm] = useState<NotificationPermission>('undetermined');
  const n = settings.notifications;

  useEffect(() => {
    getPermission()
      .then(setPerm)
      .catch(() => setPerm('unsupported'));
  }, []);

  const reminder = (key: 'morning' | 'evening' | 'sleep' | 'quran', label: TKey) => {
    const r: ReminderSetting = n[key];
    return (
      <View key={key} style={{ gap: space.sm, paddingVertical: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="callout">{t(label)}</Text>
          <Switch
            value={r.enabled}
            onValueChange={(v) => update({ notifications: { [key]: { ...r, enabled: v } } as Partial<Settings['notifications']> })}
            label={t(label)}
            testID={`reminder-${key}`}
          />
        </View>
        {r.enabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="footnote" color="textMuted">
              {t('settings.reminderTime')}
            </Text>
            <Stepper
              label={t('settings.reminderTime')}
              value={parseHHMM(r.time)}
              min={0}
              max={23 * 60 + 45}
              step={15}
              format={(v) => fmt.digits(toHHMM(v))}
              onChange={(v) => update({ notifications: { [key]: { ...r, time: toHHMM(v) } } as Partial<Settings['notifications']> })}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen back title={t('settings.notifications')} large testID="notifications-screen">
      {perm === 'unsupported' ? <Notice text={t('onboarding.notificationsWeb')} /> : null}
      {perm === 'denied' ? (
        <View style={{ gap: space.sm }}>
          <Notice tone="warning" text={t('onboarding.notificationsDenied')} />
          <Button label={t('settings.openSystemSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
      {perm === 'undetermined' ? (
        <View style={{ gap: space.sm }}>
          <Notice text={t('settings.permissionNeeded')} />
          <Button label={t('onboarding.enableNotifications')} onPress={async () => setPerm(await requestPermission())} />
        </View>
      ) : null}

      <SectionHeader title={t('settings.prayerReminders')} />
      <Card>
        {FARD_PRAYERS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
            <Text variant="callout">{t(`prayers.${p}` as TKey)}</Text>
            <Switch
              value={n.prayers[p]}
              onValueChange={(v) => update({ notifications: { prayers: { ...n.prayers, [p]: v } } })}
              label={t(`prayers.${p}` as TKey)}
              testID={`notify-${p}`}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title={t('settings.preReminder')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {([0, 5, 10, 15, 30] as const).map((m) => (
          <Chip
            key={m}
            label={m === 0 ? t('settings.preReminderOff') : t('common.minutesShort', { count: m })}
            selected={n.preReminderMinutes === m}
            onPress={() => update({ notifications: { preReminderMinutes: m } })}
          />
        ))}
      </View>

      <SectionHeader title={t('notify.channelReminders')} />
      <Card>
        {reminder('morning', 'settings.morningReminder')}
        {reminder('evening', 'settings.eveningReminder')}
        {reminder('sleep', 'settings.sleepReminder')}
        {reminder('quran', 'settings.quranReminder')}
      </Card>
      <View style={{ marginTop: space.md }}>
        <ListGroup>
          <ListRow icon={Volume2} iconTone="accent" title={t('adhan.title')} subtitle={t('adhan.soundTitle')} onPress={() => router.push('/adhan')} />
          <ListRow icon={Bell} title={t('reminders.title')} subtitle={t('reminders.intro')} onPress={() => router.push('/reminders')} last />
        </ListGroup>
      </View>
      <View style={{ marginTop: space.md }}>
        <Notice text={t('settings.notificationsHelp')} />
      </View>
    </Screen>
  );
}
