import { addDays } from '@/utils/date';

import { calculateDay, type PrayerConfig } from './times';

export interface NightTimes {
  readonly maghrib: Date;
  readonly fajr: Date;
  /** Midpoint between Maghrib and the following Fajr. */
  readonly middle: Date;
  /** Start of the last third of the night (Maghrib → Fajr). */
  readonly lastThird: Date;
}

/** The night that begins at Maghrib of the given calendar day. */
export function nightTimes(config: PrayerConfig, date: Date): NightTimes {
  const today = calculateDay(config, date).times;
  const tomorrow = calculateDay(config, addDays(date, 1)).times;
  const maghrib = today.find((t) => t.name === 'maghrib')!.time;
  const fajr = tomorrow.find((t) => t.name === 'fajr')!.time;
  const span = fajr.getTime() - maghrib.getTime();
  return { maghrib, fajr, middle: new Date(maghrib.getTime() + span / 2), lastThird: new Date(maghrib.getTime() + (span * 2) / 3) };
}
