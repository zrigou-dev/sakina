import { calculateDay, FARD_PRAYERS, type PrayerConfig } from '@/services/prayer/times';
import type { Settings } from '@/state/settings';
import { addDays, startOfDay } from '@/utils/date';

import type { Prayer } from './voices';

/**
 * Native alarms have no 64-notification cap (iOS) so they are planned further ahead: if the app is not opened for
 * two weeks the adhan keeps sounding. Every foreground re-plans and extends the window.
 */
export const ADHAN_ALARM_DAYS = 14;

export interface AdhanAlarmPlan {
  readonly id: string;
  readonly at: Date;
  readonly prayer: Prayer;
}

/** Prayers that should sound the adhan (enabled, and set to "adhan" rather than a short tone / silent). */
export function planAdhanAlarms(settings: Settings, config: PrayerConfig | null, now: Date, days: number = ADHAN_ALARM_DAYS): AdhanAlarmPlan[] {
  if (!config) return [];
  const out: AdhanAlarmPlan[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(startOfDay(now), d);
    const key = `${day.getFullYear()}${day.getMonth() + 1}${day.getDate()}`;
    const schedule = calculateDay(config, day);
    for (const prayer of FARD_PRAYERS) {
      if (!settings.notifications.prayers[prayer] || settings.adhan.sound[prayer] !== 'adhan') continue;
      const at = schedule.times.find((t) => t.name === prayer)!.time;
      if (at.getTime() > now.getTime() + 5_000) out.push({ id: `adhan-${prayer}-${key}`, at, prayer });
    }
  }
  return out;
}
