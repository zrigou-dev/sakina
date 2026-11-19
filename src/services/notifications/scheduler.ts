import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { ANDROID_NOTIFICATION_SOUNDS, IOS_NOTIFICATION_SOUNDS } from '@/content/adhan/assets.generated';
import { getSettingsSnapshot, type I18n, type TKey } from '@/runtime/AppProvider';
import { DEFAULT_VOICE_ID, voiceById } from '@/services/adhan/voices';

import type { PlannedNotification } from './plan';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const notificationsSupported = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

if (notificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      // In the foreground the full adhan is played by the app itself (AdhanOverlay), so the
      // notification stays silent to avoid two adhans at once.
      const kind = (n.request.content.data as { kind?: string } | undefined)?.kind;
      // Only adhan-sound prayers are replaced by the in-app adhan; a short-tone prayer keeps its notification sound.
      const data = n.request.content.data as { adhan?: boolean } | undefined;
      const inAppAdhan = kind === 'prayer' && data?.adhan === true && getSettingsSnapshot().adhan.playInApp;
      return { shouldPlaySound: !inAppAdhan, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true };
    },
  });
}

export async function getPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported) return 'unsupported';
  const p = await Notifications.requestPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

/** Android channel that carries one voice's notification clip (a channel's sound cannot be changed after creation). */
export const adhanChannelId = (voiceId: string): string => `prayer-adhan-${voiceId}`;

async function ensureAdhanChannel(voiceId: string, i18n: I18n): Promise<void> {
  const voice = voiceById(voiceId);
  const sound = ANDROID_NOTIFICATION_SOUNDS[voiceId];
  if (!voice || !sound) return;
  await Notifications.setNotificationChannelAsync(adhanChannelId(voiceId), {
    name: `${i18n.t('notify.channelPrayer')} — ${voice.name[i18n.lang]}`,
    importance: AndroidImportance.HIGH,
    sound,
    vibrationPattern: [0, 200, 120, 200],
  });
}

async function ensureChannels(i18n: I18n, voiceIds: readonly string[]): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return;
  // The first adhan library used one fixed channel; remove it so only per-voice channels remain.
  await Notifications.deleteNotificationChannelAsync('prayer-adhan').catch(() => undefined);
  for (const id of new Set(voiceIds)) await ensureAdhanChannel(id, i18n);
  await Notifications.setNotificationChannelAsync('prayer', {
    name: i18n.t('notify.channelPrayer'),
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 200, 120, 200],
  });
  await Notifications.setNotificationChannelAsync('prayer-silent', {
    name: `${i18n.t('notify.channelPrayer')} — ${i18n.t('adhan.soundSilent')}`,
    importance: AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: i18n.t('notify.channelReminders'),
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('dhikr', {
    name: i18n.t('reminders.periodic'),
    importance: AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
}

export interface DhikrText {
  readonly ar: string;
  readonly en: string | null;
}

function content(n: PlannedNotification, i18n: I18n, dhikr: readonly DhikrText[]): { title: string; body: string } {
  const { t, lang } = i18n;
  const prayer = n.prayer ? t(`prayers.${n.prayer}` as TKey) : '';
  switch (n.kind) {
    case 'prayer':
      return { title: t('notify.prayerTitle', { prayer }), body: t('notify.prayerBody', { prayer }) };
    case 'pre_prayer':
      return { title: t('notify.preTitle', { prayer, minutes: n.minutesBefore ?? 0 }), body: t('notify.preBody', { prayer }) };
    case 'after_prayer':
      return { title: t('reminders.notifyAfterPrayerTitle', { prayer }), body: t('reminders.notifyAfterPrayerBody') };
    case 'morning':
      return { title: t('notify.morningTitle'), body: t('notify.morningBody') };
    case 'evening':
      return { title: t('notify.eveningTitle'), body: t('notify.eveningBody') };
    case 'sleep':
      return { title: t('notify.sleepTitle'), body: t('notify.sleepBody') };
    case 'quran':
      return { title: t('notify.quranTitle'), body: t('notify.quranBody') };
    case 'friday':
      return { title: t('reminders.notifyFridayTitle'), body: t('reminders.notifyFridayBody') };
    case 'fasting': {
      const day = n.fastingReason === 'white_day' ? t('reminders.whiteDay') : n.fastingReason === 'monday' ? t('weekdays.d1') : t('weekdays.d4');
      return { title: t('reminders.notifyFastingTitle', { day }), body: t('reminders.notifyFastingBody') };
    }
    case 'dhikr': {
      const d = dhikr[n.dhikrIndex ?? 0] ?? dhikr[0];
      const body = d ? (lang !== 'ar' && d.en ? `${d.ar}\n${d.en}` : d.ar) : t('reminders.notifyDhikrTitle');
      return { title: t('reminders.notifyDhikrTitle'), body };
    }
  }
}

/** Replaces all pending SAKINA notifications with the given plan. Returns the number scheduled. */
export async function applyPlan(plan: readonly PlannedNotification[], i18n: I18n, dhikr: readonly DhikrText[] = []): Promise<number> {
  if (!notificationsSupported) return 0;
  if ((await getPermission()) !== 'granted') return 0;
  await ensureChannels(
    i18n,
    plan.filter((n) => n.sound === 'adhan').map((n) => n.voiceId ?? DEFAULT_VOICE_ID),
  );
  await Notifications.cancelAllScheduledNotificationsAsync();
  let count = 0;
  for (const n of plan) {
    const c = content(n, i18n, dhikr);
    const voiceId = n.voiceId ?? DEFAULT_VOICE_ID;
    const adhanSound = (process.env.EXPO_OS === 'ios' ? IOS_NOTIFICATION_SOUNDS[voiceId] : ANDROID_NOTIFICATION_SOUNDS[voiceId]) ?? 'default';
    const sound = n.sound === 'adhan' ? adhanSound : n.sound === 'default' ? 'default' : false;
    // A voice without a bundled clip (personal/custom) cannot be a notification sound: the standard channel and sound are used.
    const hasClip = ANDROID_NOTIFICATION_SOUNDS[voiceId] !== undefined;
    const channelId = n.sound === 'adhan' ? (hasClip ? adhanChannelId(voiceId) : 'prayer') : n.channel;
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: c.title,
        body: c.body,
        sound,
        // Prayer times must break through Focus modes on iOS (needs the time-sensitive entitlement, see app.json).
        ...(n.kind === 'prayer' ? { interruptionLevel: 'timeSensitive' as const } : {}),
        data: { kind: n.kind, prayer: n.prayer ?? null, adhan: n.sound === 'adhan', voice: n.sound === 'adhan' ? voiceId : null, at: n.date.getTime() },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date, channelId },
    });
    count++;
  }
  return count;
}
