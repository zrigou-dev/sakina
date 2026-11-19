import { RUKU_STARTS } from '@/content/quran/metadata.generated';
import type { VerseKey } from '@/content/quran/types';
import { diffDays } from '@/utils/date';

/**
 * Verse of the day: the opening ayah of a rukuʿ (a thematic section boundary from Tanzil
 * metadata), cycling through all 556 sections — no editorial selection, never mid-passage.
 */
export function dailyVerseKey(date: Date): VerseKey {
  const days = diffDays(date, new Date(2024, 0, 1));
  const idx = ((days % RUKU_STARTS.length) + RUKU_STARTS.length) % RUKU_STARTS.length;
  const [surah, ayah] = RUKU_STARTS[idx]!;
  return { surah, ayah };
}
