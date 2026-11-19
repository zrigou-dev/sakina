import umalqura from '@umalqura/core';

import { addDays, startOfDay } from '@/utils/date';

export interface HijriDate {
  readonly year: number;
  /** 1..12 */
  readonly month: number;
  readonly day: number;
}

export const HIJRI_OFFSET_RANGE = [-2, 2] as const;

const U = umalqura.$;

/**
 * Converts a Gregorian date to Hijri using the Umm al-Qura calendar tables,
 * then applies the user's day offset (local moon-sighting may differ by 1–2 days).
 */
export function toHijri(date: Date, offsetDays = 0): HijriDate {
  const d = addDays(startOfDay(date), Math.trunc(offsetDays));
  const { hy, hm, hd } = U.gregorianToHijri(d);
  return { year: hy, month: hm, day: hd };
}

/** Converts a Hijri date to the Gregorian date on which it begins, honouring the user's offset. */
export function fromHijri(h: HijriDate, offsetDays = 0): Date {
  const { gy, gm, gd } = U.hijriToGregorian(h.year, h.month, h.day);
  return addDays(new Date(gy, gm, gd), -Math.trunc(offsetDays));
}

export function daysInHijriMonth(year: number, month: number): 29 | 30 {
  return U.getDaysInMonth(year, month);
}

export function addHijriMonths(h: { year: number; month: number }, n: number): { year: number; month: number } {
  const total = h.year * 12 + (h.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export interface HijriMonthGrid {
  readonly year: number;
  readonly month: number;
  readonly days: readonly { hijriDay: number; gregorian: Date }[];
  /** 0 = Sunday … 6 = Saturday, weekday of the first day. */
  readonly firstWeekday: number;
}

export function hijriMonthGrid(year: number, month: number, offsetDays = 0): HijriMonthGrid {
  const first = fromHijri({ year, month, day: 1 }, offsetDays);
  const length = daysInHijriMonth(year, month);
  const days = Array.from({ length }, (_, i) => ({ hijriDay: i + 1, gregorian: addDays(first, i) }));
  return { year, month, days, firstWeekday: first.getDay() };
}

export function isSupportedHijriYear(year: number): boolean {
  return year >= U.minCalendarYear && year <= U.maxCalendarYear;
}
