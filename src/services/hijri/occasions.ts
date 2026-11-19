import { addDays, diffDays, startOfDay } from '@/utils/date';

import { fromHijri, toHijri, type HijriDate } from './hijri';

/**
 * Islamic occasions by Hijri date. These are calendar facts (month/day), not rulings;
 * the UI notes that actual dates depend on local moon sighting.
 */
export type OccasionId =
  'islamic_new_year' | 'ashura' | 'ramadan_start' | 'last_ten_nights' | 'eid_al_fitr' | 'dhul_hijjah_start' | 'day_of_arafah' | 'eid_al_adha' | 'tashreeq';

export interface OccasionRule {
  readonly id: OccasionId;
  readonly month: number;
  readonly day: number;
  /** Number of days the occasion spans (default 1). */
  readonly span?: number;
  readonly major: boolean;
}

export const OCCASIONS: readonly OccasionRule[] = [
  { id: 'islamic_new_year', month: 1, day: 1, major: false },
  { id: 'ashura', month: 1, day: 10, major: false },
  { id: 'ramadan_start', month: 9, day: 1, span: 1, major: true },
  { id: 'last_ten_nights', month: 9, day: 21, span: 10, major: true },
  { id: 'eid_al_fitr', month: 10, day: 1, major: true },
  { id: 'dhul_hijjah_start', month: 12, day: 1, span: 1, major: false },
  { id: 'day_of_arafah', month: 12, day: 9, major: true },
  { id: 'eid_al_adha', month: 12, day: 10, major: true },
  { id: 'tashreeq', month: 12, day: 11, span: 3, major: false },
];

export interface OccasionInstance {
  readonly id: OccasionId;
  readonly start: Date;
  readonly hijri: HijriDate;
  readonly daysUntil: number;
  readonly major: boolean;
}

/** Upcoming occasions starting within `horizonDays` of `today` (today included). */
export function upcomingOccasions(today: Date, offsetDays = 0, horizonDays = 120): OccasionInstance[] {
  const t0 = startOfDay(today);
  const h = toHijri(t0, offsetDays);
  const out: OccasionInstance[] = [];
  for (const year of [h.year, h.year + 1]) {
    for (const rule of OCCASIONS) {
      const start = fromHijri({ year, month: rule.month, day: rule.day }, offsetDays);
      const end = addDays(start, (rule.span ?? 1) - 1);
      const daysUntil = diffDays(start, t0);
      if (diffDays(end, t0) < 0 || daysUntil > horizonDays) continue;
      out.push({ id: rule.id, start, hijri: { year, month: rule.month, day: rule.day }, daysUntil, major: rule.major });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type DayTag = 'white_day' | 'monday' | 'thursday' | OccasionId;

/** Tags for a single day: white days (13–15), Mondays/Thursdays and occasions. */
export function dayTags(date: Date, offsetDays = 0): DayTag[] {
  const h = toHijri(date, offsetDays);
  const tags: DayTag[] = [];
  for (const rule of OCCASIONS) {
    const span = rule.span ?? 1;
    if (h.month === rule.month && h.day >= rule.day && h.day < rule.day + span) tags.push(rule.id);
  }
  // Factual tag only (13th–15th of the lunar month). SAKINA does not encode fasting rulings;
  // 13 Dhul-Hijjah additionally carries the 'tashreeq' tag above.
  if (h.day >= 13 && h.day <= 15) tags.push('white_day');
  const wd = date.getDay();
  if (wd === 1) tags.push('monday');
  if (wd === 4) tags.push('thursday');
  return tags;
}

export function isRamadan(date: Date, offsetDays = 0): boolean {
  return toHijri(date, offsetDays).month === 9;
}
