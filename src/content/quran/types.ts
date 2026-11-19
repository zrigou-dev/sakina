export type VerseKeyTuple = readonly [surah: number, ayah: number];

export interface SurahMeta {
  readonly number: number;
  readonly ayahCount: number;
  /** 0-based global index of the surah's first ayah. */
  readonly startIndex: number;
  readonly nameArabic: string;
  readonly nameTransliterated: string;
  readonly nameEnglish: string;
  readonly revelation: 'meccan' | 'medinan';
  readonly revelationOrder: number;
}

export interface SajdaMeta {
  readonly surah: number;
  readonly ayah: number;
  readonly type: 'obligatory' | 'recommended';
}

export interface VerseKey {
  readonly surah: number;
  readonly ayah: number;
}

export interface Ayah extends VerseKey {
  /** Global 1-based index (1..6236). */
  readonly id: number;
  readonly page: number;
  readonly juz: number;
  readonly hizbQuarter: number;
  readonly text: string;
}
