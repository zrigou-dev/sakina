import { diffDays } from '@/utils/date';

/** Rotates through the bundled Forty Hadith of an-Nawawi (42) and Forty Hadith Qudsi (40). */
export function dailyHadithKey(date: Date, nawawi = 42, qudsi = 40): { book: 'nawawi' | 'qudsi'; number: number } {
  const total = nawawi + qudsi;
  const i = ((diffDays(date, new Date(2024, 0, 1)) % total) + total) % total;
  return i < nawawi ? { book: 'nawawi', number: i + 1 } : { book: 'qudsi', number: i - nawawi + 1 };
}
