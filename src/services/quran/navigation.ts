import { HIZB_QUARTER_STARTS, JUZ_STARTS, PAGE_STARTS, SAJDAS, SURAHS, TOTAL_AYAHS } from '@/content/quran/metadata.generated';
import type { SurahMeta, VerseKey, VerseKeyTuple } from '@/content/quran/types';

export { SURAHS, TOTAL_AYAHS };

export function getSurah(n: number): SurahMeta {
  const s = SURAHS[n - 1];
  if (!s) throw new RangeError(`Surah ${n} out of range 1..114`);
  return s;
}

export function isValidVerse(key: VerseKey): boolean {
  const s = SURAHS[key.surah - 1];
  return !!s && Number.isInteger(key.ayah) && key.ayah >= 1 && key.ayah <= s.ayahCount;
}

/** 1-based global index (1..6236) of a verse. */
export function globalIndex(key: VerseKey): number {
  if (!isValidVerse(key)) throw new RangeError(`Invalid verse ${key.surah}:${key.ayah}`);
  return getSurah(key.surah).startIndex + key.ayah;
}

export function verseFromGlobalIndex(index: number): VerseKey {
  if (!Number.isInteger(index) || index < 1 || index > TOTAL_AYAHS) throw new RangeError(`Index ${index} out of range`);
  // Binary search on surah start indices.
  let lo = 0;
  let hi = SURAHS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SURAHS[mid]!.startIndex < index) lo = mid;
    else hi = mid - 1;
  }
  const s = SURAHS[lo]!;
  return { surah: s.number, ayah: index - s.startIndex };
}

const toIndex = ([s, a]: VerseKeyTuple) => SURAHS[s - 1]!.startIndex + a;
const JUZ_IDX = JUZ_STARTS.map(toIndex);
const HIZB_IDX = HIZB_QUARTER_STARTS.map(toIndex);
const PAGE_IDX = PAGE_STARTS.map(toIndex);

/** Largest i such that starts[i] <= index, returned 1-based. */
function bucket(starts: readonly number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export const juzOfIndex = (index: number) => bucket(JUZ_IDX, index);
export const hizbQuarterOfIndex = (index: number) => bucket(HIZB_IDX, index);
export const pageOfIndex = (index: number) => bucket(PAGE_IDX, index);

export function juzOf(key: VerseKey): number {
  return juzOfIndex(globalIndex(key));
}
export function pageOf(key: VerseKey): number {
  return pageOfIndex(globalIndex(key));
}
/** Hizb number 1..60 (each hizb = 4 quarters). */
export function hizbOf(key: VerseKey): number {
  return Math.ceil(hizbQuarterOfIndex(globalIndex(key)) / 4);
}

export function juzStart(juz: number): VerseKey {
  const t = JUZ_STARTS[juz - 1];
  if (!t) throw new RangeError(`Juz ${juz} out of range`);
  return { surah: t[0], ayah: t[1] };
}
export function pageStart(page: number): VerseKey {
  const t = PAGE_STARTS[page - 1];
  if (!t) throw new RangeError(`Page ${page} out of range`);
  return { surah: t[0], ayah: t[1] };
}
export function hizbStart(hizb: number): VerseKey {
  const t = HIZB_QUARTER_STARTS[(hizb - 1) * 4];
  if (!t) throw new RangeError(`Hizb ${hizb} out of range`);
  return { surah: t[0], ayah: t[1] };
}

export function nextVerse(key: VerseKey): VerseKey | null {
  const i = globalIndex(key);
  return i >= TOTAL_AYAHS ? null : verseFromGlobalIndex(i + 1);
}
export function previousVerse(key: VerseKey): VerseKey | null {
  const i = globalIndex(key);
  return i <= 1 ? null : verseFromGlobalIndex(i - 1);
}

export function sajdaAt(key: VerseKey) {
  return SAJDAS.find((s) => s.surah === key.surah && s.ayah === key.ayah) ?? null;
}

/** Whether a surah's reading should be preceded by a displayed Basmala (all except 1 and 9). */
export function hasSeparateBasmala(surah: number): boolean {
  return surah !== 1 && surah !== 9;
}

/** Fraction of the Quran up to and including this verse, 0..1. */
export function quranProgress(key: VerseKey): number {
  return globalIndex(key) / TOTAL_AYAHS;
}

/** Number of ayahs in an inclusive range (may span surahs). */
export function rangeLength(from: VerseKey, to: VerseKey): number {
  return Math.max(0, globalIndex(to) - globalIndex(from) + 1);
}
