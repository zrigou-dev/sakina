import { View } from 'react-native';

import { Card, Chip, Notice, SectionHeader, Stepper, Switch } from '@/design-system/components';
import { Screen } from '@/design-system/Screen';
import { Text } from '@/design-system/Text';
import { space } from '@/design-system/tokens';
import { useFormat } from '@/hooks/useFormat';
import { useI18n, useSettings } from '@/runtime/AppProvider';
import { parseHHMM } from '@/utils/date';

const toHHMM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

function Row({ label, help, value, onChange, testID }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout">{label}</Text>
        {help ? (
          <Text variant="caption" color="textMuted">
            {help}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} label={label} testID={testID} />
    </View>
  );
}

/** Remembrance reminders: periodic dhikr, after-prayer, Friday and voluntary fasting days. */
export default function Reminders() {
  const { t } = useI18n();
  const [settings, update] = useSettings();
  const fmt = useFormat();
  const dr = settings.dhikrReminders;
  const n = settings.notifications;
  const minutes = (m: number) => (m >= 60 ? t('common.hoursShort', { count: m / 60 }) : t('common.minutesShort', { count: m }));

  return (
    <Screen back title={t('reminders.title')} subtitle={t('reminders.intro')} large testID="reminders-screen">
      <SectionHeader title={t('reminders.periodic')} style={{ marginTop: 0 }} />
      <Card style={{ gap: space.md }}>
        <Row
          label={t('reminders.periodic')}
          help={t('reminders.periodicHelp')}
          value={dr.enabled}
          onChange={(v) => update({ dhikrReminders: { enabled: v } })}
          testID="dhikr-periodic"
        />
        {dr.enabled ? (
          <>
            <Text variant="footnote" color="textMuted">
              {t('reminders.every')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {([30, 60, 120, 180, 240] as const).map((m) => (
                <Chip key={m} label={minutes(m)} selected={dr.intervalMinutes === m} onPress={() => update({ dhikrReminders: { intervalMinutes: m } })} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="callout">{t('reminders.from')}</Text>
              <Stepper
                label={t('reminders.from')}
                value={dr.startHour}
                min={0}
                max={Math.max(0, dr.endHour - 1)}
                format={(v) => fmt.digits(toHHMM(v * 60))}
                onChange={(v) => update({ dhikrReminders: { startHour: v } })}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="callout">{t('reminders.to')}</Text>
              <Stepper
                label={t('reminders.to')}
                value={dr.endHour}
                min={dr.startHour + 1}
                max={24}
                format={(v) => fmt.digits(toHHMM(v * 60))}
                onChange={(v) => update({ dhikrReminders: { endHour: v } })}
              />
            </View>
          </>
        ) : null}
        <Row label={t('reminders.inApp')} value={dr.inApp} onChange={(v) => update({ dhikrReminders: { inApp: v } })} testID="dhikr-inapp" />
        {dr.inApp ? (
          <>
            <Text variant="footnote" color="textMuted">
              {t('reminders.inAppEvery')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {([5, 10, 15, 30, 60] as const).map((m) => (
                <Chip key={m} label={minutes(m)} selected={dr.inAppMinutes === m} onPress={() => update({ dhikrReminders: { inAppMinutes: m } })} />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <SectionHeader title={t('reminders.afterPrayer')} />
      <Card style={{ gap: space.md }}>
        <Row
          label={t('reminders.afterPrayer')}
          help={t('reminders.afterPrayerHelp')}
          value={n.afterPrayer.enabled}
          onChange={(v) => update({ notifications: { afterPrayer: { ...n.afterPrayer, enabled: v } } })}
          testID="after-prayer"
        />
        {n.afterPrayer.enabled ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {([5, 10, 15, 20, 30] as const).map((m) => (
              <Chip
                key={m}
                label={t('common.minutesShort', { count: m })}
                selected={n.afterPrayer.minutes === m}
                onPress={() => update({ notifications: { afterPrayer: { ...n.afterPrayer, minutes: m } } })}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <SectionHeader title={t('notify.channelReminders')} />
      <Card style={{ gap: space.sm }}>
        {(
          [
            ['morning', t('settings.morningReminder'), undefined],
            ['evening', t('settings.eveningReminder'), undefined],
            ['sleep', t('settings.sleepReminder'), undefined],
            ['quran', t('settings.quranReminder'), undefined],
            ['friday', t('reminders.friday'), undefined],
            ['fastingDays', t('reminders.fastingDays'), t('reminders.fastingDaysHelp')],
          ] as const
        ).map(([key, label, help]) => {
          const r = n[key];
          return (
            <View key={key} style={{ gap: space.xs }}>
              <Row
                label={label}
                help={help}
                value={r.enabled}
                onChange={(v) => update({ notifications: { [key]: { ...r, enabled: v } } })}
                testID={`reminder-${key}`}
              />
              {r.enabled ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                    onChange={(v) => update({ notifications: { [key]: { ...r, time: toHHMM(v) } } })}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <View style={{ marginTop: space.md }}>
        <Notice text={t('reminders.budgetNote')} />
      </View>
    </Screen>
  );
}
