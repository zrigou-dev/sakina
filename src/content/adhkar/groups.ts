import type { TKey } from '@/runtime/AppProvider';

/**
 * Organisational grouping of Hisn al-Muslim chapters (by the book's own chapter numbers)
 * into life areas, so the 132 chapters are easy to browse. This is navigation only —
 * no religious text is involved.
 */
export const ADHKAR_GROUPS = [
  { id: 'day', title: 'adhkarGroups.day', chapters: [27, 28, 1, 29, 30, 31] },
  { id: 'prayer', title: 'adhkarGroups.prayer', chapters: [8, 9, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 32, 33] },
  { id: 'home', title: 'adhkarGroups.home', chapters: [2, 3, 4, 5, 6, 7, 10, 11] },
  { id: 'hardship', title: 'adhkarGroups.hardship', chapters: [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 45, 46, 88, 92, 94, 125, 126, 128] },
  { id: 'repentance', title: 'adhkarGroups.repentance', chapters: [129, 44, 130, 131, 107] },
  { id: 'illness', title: 'adhkarGroups.illness', chapters: [124, 49, 50, 51, 83, 52, 53, 54, 55, 56, 57, 58, 59, 60] },
  { id: 'family', title: 'adhkarGroups.family', chapters: [47, 48, 79, 80, 81] },
  { id: 'food', title: 'adhkarGroups.food', chapters: [69, 70, 71, 72, 68, 73, 74, 75, 76] },
  { id: 'travel', title: 'adhkarGroups.travel', chapters: [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105] },
  { id: 'nature', title: 'adhkarGroups.nature', chapters: [61, 62, 63, 64, 65, 66, 67] },
  { id: 'social', title: 'adhkarGroups.social', chapters: [77, 78, 82, 84, 85, 86, 87, 89, 90, 91, 93, 106, 108, 109, 110, 111, 112, 113, 114, 122, 123, 132] },
  { id: 'hajj', title: 'adhkarGroups.hajj', chapters: [115, 116, 117, 118, 119, 120, 121, 127] },
] as const satisfies readonly { id: string; title: TKey; chapters: readonly number[] }[];

export type AdhkarGroupId = (typeof ADHKAR_GROUPS)[number]['id'];

const BY_CHAPTER = new Map<number, AdhkarGroupId>();
for (const g of ADHKAR_GROUPS) for (const c of g.chapters) BY_CHAPTER.set(c, g.id);

export function groupOfChapter(chapter: number): AdhkarGroupId {
  return BY_CHAPTER.get(chapter) ?? 'social';
}

/** Chapter ids used across the app (verified against the dataset by tests). */
export const HISN = {
  morningEvening: 27,
  sleep: 28,
  waking: 1,
  afterPrayer: 25,
  adhan: 15,
  istikhara: 26,
  anxiety: 34,
  distress: 35,
  debt: 41,
  travel: 96,
  riding: 95,
  visitingSick: 49,
  calamity: 53,
  repentance: 129,
  dhikrVirtues: 130,
  salawat: 107,
  beforeEating: 69,
  afterEating: 70,
  breakingFast: 68,
  enteringHome: 11,
  leavingHome: 10,
  toiletEnter: 6,
  toiletLeave: 7,
  rain: 64,
  anger: 82,
  newborn: 47,
  children: 48,
  condolence: 57,
  funeral: 55,
} as const;
