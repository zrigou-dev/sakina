import { HISN } from '@/content/adhkar/groups';
import type { TKey } from '@/runtime/AppProvider';

/**
 * Learning paths built ONLY from verified content already in SAKINA:
 * bundled hadith collections, the Quran text, the Beautiful Names and Ḥiṣn al-Muslim.
 */
export type PathId = 'nawawi' | 'qudsi' | 'juzamma' | 'names' | 'essentials';

export interface PathDef {
  readonly id: PathId;
  readonly title: TKey;
  readonly body: TKey;
  readonly total: number;
}

export const ESSENTIAL_CHAPTERS = [
  HISN.waking,
  HISN.toiletEnter,
  HISN.toiletLeave,
  8,
  9,
  HISN.leavingHome,
  HISN.enteringHome,
  HISN.beforeEating,
  HISN.afterEating,
  HISN.riding,
  HISN.travel,
  77,
  HISN.anger,
  HISN.sleep,
] as const;

export const JUZ_AMMA = Array.from({ length: 114 - 78 + 1 }, (_, i) => 78 + i);

export const PATHS: readonly PathDef[] = [
  { id: 'nawawi', title: 'academy.nawawi', body: 'academy.nawawiBody', total: 42 },
  { id: 'qudsi', title: 'academy.qudsi', body: 'academy.qudsiBody', total: 40 },
  { id: 'juzamma', title: 'academy.juzAmma', body: 'academy.juzAmmaBody', total: JUZ_AMMA.length },
  { id: 'names', title: 'academy.names', body: 'academy.namesBody', total: 99 },
  { id: 'essentials', title: 'academy.essentials', body: 'academy.essentialsBody', total: ESSENTIAL_CHAPTERS.length },
];

export const pathPackageId = (id: PathId) => `path:${id}`;

/** Life-situation guides mapped to the corresponding chapters of Ḥiṣn al-Muslim. */
export const GUIDES: readonly { id: string; title: TKey; chapters: readonly number[] }[] = [
  { id: 'travel', title: 'guides.travel', chapters: [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105] },
  { id: 'illness', title: 'guides.illness', chapters: [124, 49, 50, 51, 125] },
  { id: 'grief', title: 'guides.grief', chapters: [53, 52, 54, 55, 56, 57, 58, 59, 60] },
  { id: 'newborn', title: 'guides.newborn', chapters: [47, 48] },
  { id: 'anxiety', title: 'guides.anxiety', chapters: [34, 35, 43, 46, 126, 45] },
  { id: 'marriage', title: 'guides.marriage', chapters: [79, 80, 81] },
  { id: 'debt', title: 'guides.debt', chapters: [41, 91, 43] },
  { id: 'weather', title: 'guides.weather', chapters: [61, 62, 63, 64, 65, 66, 67] },
  { id: 'meals', title: 'guides.meals', chapters: [69, 70, 71, 72, 73, 68] },
  { id: 'home', title: 'guides.home', chapters: [10, 11, 2, 3, 5] },
  { id: 'repentance', title: 'guides.repentance', chapters: [129, 44, 130] },
  { id: 'mosque', title: 'guides.mosque', chapters: [12, 13, 14, 15, 25, 26] },
];

export const KIDS_DUAS = [
  HISN.waking,
  HISN.beforeEating,
  HISN.afterEating,
  HISN.toiletEnter,
  HISN.toiletLeave,
  HISN.leavingHome,
  HISN.enteringHome,
  77,
  HISN.sleep,
] as const;
