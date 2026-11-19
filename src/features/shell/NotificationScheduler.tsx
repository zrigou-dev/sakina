import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { adhkarRepo } from '@/database/repositories/content';
import { prayerConfigFrom } from '@/hooks/usePrayer';
import { useDbs, useI18n, useRuntime, useSettings } from '@/runtime/AppProvider';
import { planAdhanAlarms } from '@/services/adhan/alarmPlan';
import { useAdhan } from '@/services/adhan/AdhanProvider';
import { engineStatus, hasNativeEngine, nativeAdhan, scheduleNativeAdhan } from '@/services/adhan/nativeEngine';
import { fullSource } from '@/services/adhan/sources';
import { allVoices, isLocalVoice, resolveVoice, voiceById, voicePackageId, type Prayer, type VoiceSettings } from '@/services/adhan/voices';
import { usePackageStates } from '@/services/downloads/DownloadProvider';
import { planNotifications } from '@/services/notifications/plan';
import { applyPlan, notificationsSupported, type DhikrText } from '@/services/notifications/scheduler';

/** How long after prayer time a tap on the adhan notification still starts the full adhan. */
const TAP_WINDOW_MS = 20 * 60_000;

/**
 * Re-plans prayer alarms and the rolling notification window on launch, on foreground, and whenever settings or the
 * set of downloaded voices change. Android: native alarms play the adhan; everything else: notification sounds.
 */
export function NotificationScheduler() {
  const [settings] = useSettings();
  const i18n = useI18n();
  const dbs = useDbs();
  const adhan = useAdhan();
  const { quranStatus } = useRuntime();
  const states = usePackageStates();
  const installedKey = allVoices()
    .filter((v) => v.delivery === 'download' && states[voicePackageId(v.id)]?.status === 'installed')
    .map((v) => v.id)
    .join(',');
  const latest = useRef({ settings, i18n, states });
  useEffect(() => {
    latest.current = { settings, i18n, states };
  });

  useEffect(() => {
    if (!settings.onboardingComplete || (!notificationsSupported && !hasNativeEngine)) return;
    let cancelled = false;
    const run = async () => {
      const { settings: s, i18n: i, states: st } = latest.current;
      const config = prayerConfigFrom(s);
      const now = new Date();
      const voiceSettings: VoiceSettings = { defaultVoice: s.adhan.voice, byPrayer: s.adhan.byPrayer };
      const isAvailable = (id: string) => {
        const v = voiceById(id);
        return !!v && (isLocalVoice(v) || (st[voicePackageId(id)]?.status === 'installed' && fullSource(v) !== null));
      };

      let nativeActive = false;
      if (hasNativeEngine) {
        try {
          await scheduleNativeAdhan(planAdhanAlarms(s, config, now), { voiceSettings, isAvailable, i18n: i });
          nativeActive = true;
        } catch {
          nativeActive = false; // fall back to notification sounds below
        }
      }
      engineStatus.nativeScheduled = nativeActive;

      if (!notificationsSupported) return;
      let dhikr: DhikrText[] = [];
      if (s.dhikrReminders.enabled) {
        dhikr = (await adhkarRepo.shortDhikr(dbs.content).catch(() => [])).map((d) => ({ ar: d.textAr, en: d.translationEn }));
      }
      const plan = planNotifications(s, config, now, dhikr.length, {
        nativeAdhan: nativeActive,
        voiceFor: (p) => resolveVoice(p, voiceSettings, isAvailable).id,
      });
      await applyPlan(plan, i, dhikr);
    };
    const safeRun = () => void run().catch(() => undefined);
    const timer = setTimeout(() => !cancelled && safeRun(), 800);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && safeRun());
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [
    settings.onboardingComplete,
    settings.notifications,
    settings.prayer,
    settings.location,
    settings.language,
    settings.adhan,
    settings.dhikrReminders,
    settings.hijriOffset,
    installedKey,
    quranStatus,
    dbs,
  ]);

  // Tapping the adhan notification (iOS: the 30 s clip is all a notification can play) starts the full adhan.
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!notificationsSupported) return;
    const handle = (r: Notifications.NotificationResponse | null | undefined) => {
      if (!r || handled.current.has(r.notification.request.identifier)) return;
      const d = r.notification.request.content.data as { kind?: string; prayer?: Prayer; adhan?: boolean; at?: number } | undefined;
      if (d?.kind !== 'prayer' || !d.adhan || !d.prayer) return;
      handled.current.add(r.notification.request.identifier);
      if (Date.now() - (d.at ?? 0) <= TAP_WINDOW_MS && !nativeAdhan) adhan.playForPrayer(d.prayer);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => undefined);
    return () => sub.remove();
  }, [adhan]);

  return null;
}
