import type { VerseKey } from '@/content/quran/types';
import { diffDays, fromISODate } from '@/utils/date';

import { globalIndex, pageStart, previousVerse, rangeLength, TOTAL_AYAHS, verseFromGlobalIndex } from './navigation';

export const TOTAL_PAGES = 604;
export const KHATMA_PRESETS = [7, 10, 15, 30, 60] as const;

export interface KhatmaPortion {
  /** 1-based day number in the plan. */
  readonly day: number;
  readonly from: VerseKey;
  readonly to: VerseKey;
  readonly fromPage: number;
  readonly toPage: number;
  readonly ayahs: number;
}

/**
 * Splits the mushaf into `days` portions on page boundaries (604 Madani pages),
 * so every daily portion starts and ends where a page does.
 */
export function khatmaPortion(days: number, day: number): KhatmaPortion {
  if (!Number.isInteger(days) || days < 1 || days > TOTAL_PAGES) throw new RangeError('days must be 1..604');
  if (!Number.isInteger(day) || day < 1 || day > days) throw new RangeError('day out of range');
  const fromPage = Math.floor(((day - 1) * TOTAL_PAGES) / days) + 1;
  const toPage = Math.floor((day * TOTAL_PAGES) / days);
  const from = pageStart(fromPage);
  const to = toPage >= TOTAL_PAGES ? verseFromGlobalIndex(TOTAL_AYAHS) : previousVerse(pageStart(toPage + 1))!;
  return { day, from, to, fromPage, toPage, ayahs: rangeLength(from, to) };
}

/** Day of the plan for a date (1-based, clamped to the plan length). */
export function khatmaDay(startedOn: string, days: number, today: Date): number {
  const d = diffDays(today, fromISODate(startedOn)) + 1;
  return Math.min(days, Math.max(1, d));
}

/** Fraction of the Quran covered by completed days. */
export function khatmaProgress(days: number, doneDays: ReadonlySet<number>): number {
  let ayahs = 0;
  for (const d of doneDays) if (d >= 1 && d <= days) ayahs += khatmaPortion(days, d).ayahs;
  return ayahs / TOTAL_AYAHS;
}

/** Global index helper for UI deep links. */
export function portionStartIndex(p: KhatmaPortion): number {
  return globalIndex(p.from);
}
