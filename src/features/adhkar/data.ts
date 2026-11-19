import type { Ayah } from '@/content/quran/types';
import { adhkarRepo, quranicDuas, quranRepo, type AdhkarItemRow } from '@/database/repositories/content';
import type { SqlDatabase } from '@/database/types';
import type { Language } from '@/localization/languages';
import { getSurah } from '@/services/quran/navigation';

/**
 * One view model for every kind of adhkar collection:
 *   'morning' | 'evening'   — morning & evening adhkar (with sources and gradings)
 *   'hisn:<chapter>'        — a chapter of Ḥiṣn al-Muslim
 *   'quran-duas'            — every “Rabbanā” verse from the verified Quran text
 *   'favorites'             — the user's saved adhkar
 */
export interface DhikrView {
  readonly id: string;
  readonly text: string;
  readonly isQuran: boolean;
  readonly ayah?: number;
  readonly translation: string | null;
  /** The translation is English shown in a French UI. */
  readonly translationIsEnglishFallback: boolean;
  readonly target: number;
  readonly countLabel: string | null;
  readonly virtue: string | null;
  readonly reference: string | null;
  readonly audioUrl: string | null;
}

export interface CollectionView {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly items: readonly DhikrView[];
}

export const ME_CATEGORY = 'me:morning-evening';

function quranView(a: Ayah, lang: Language): DhikrView {
  const s = getSurah(a.surah);
  return {
    id: `q:${a.id}`,
    text: a.text,
    isQuran: true,
    ayah: a.ayah,
    translation: null,
    translationIsEnglishFallback: false,
    target: 1,
    countLabel: null,
    virtue: null,
    reference: `${lang === 'ar' ? `سورة ${s.nameArabic}` : s.nameTransliterated} ${a.surah}:${a.ayah}`,
    audioUrl: null,
  };
}

function fromRow(r: AdhkarItemRow, lang: Language): DhikrView {
  const tr = lang === 'ar' ? null : r.translationEn;
  return {
    id: r.id,
    text: r.textAr,
    isQuran: false,
    translation: tr,
    translationIsEnglishFallback: lang === 'fr' && !!tr,
    target: r.repeat && r.repeat > 0 ? r.repeat : 1,
    countLabel: r.countLabel,
    virtue: lang === 'ar' ? r.virtue : (r.virtueEn ?? r.virtue),
    reference: lang === 'ar' ? r.reference : (r.referenceEn ?? r.reference),
    audioUrl: r.audioUrl,
  };
}

export async function loadCollection(
  db: SqlDatabase,
  id: string,
  lang: Language,
  titles: { morning: string; evening: string; quranDuas: string; favorites: string },
  favorites: readonly string[] = [],
): Promise<CollectionView> {
  if (id === 'morning' || id === 'evening') {
    const rows = await adhkarRepo.items(db, ME_CATEGORY, id === 'morning' ? 'am' : 'pm');
    return { id, title: id === 'morning' ? titles.morning : titles.evening, subtitle: null, items: rows.map((r) => fromRow(r, lang)) };
  }
  if (id === 'quran-duas') {
    const ayahs = await quranicDuas(db);
    return {
      id,
      title: titles.quranDuas,
      subtitle: null,
      items: ayahs.map((a) => quranView(a, lang)),
    };
  }
  if (id === 'favorites') {
    const rows = await adhkarRepo.itemsByIds(db, favorites);
    const quran = await Promise.all(
      favorites
        .filter((f) => /^q:\d+$/.test(f))
        .map(async (f) => {
          const a = await quranRepo.byId(db, Number(f.slice(2)));
          return a ? quranView(a, lang) : null;
        }),
    );
    const views = [...rows.map((r) => fromRow(r, lang)), ...quran.filter((q): q is DhikrView => !!q)];
    const order = new Map(favorites.map((f, i) => [f, i]));
    return { id, title: titles.favorites, subtitle: null, items: views.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) };
  }
  const cat = await adhkarRepo.category(db, id);
  if (!cat) return { id, title: '', subtitle: null, items: [] };
  const rows = await adhkarRepo.items(db, id);
  return {
    id,
    title: lang === 'ar' ? cat.titleAr : (cat.titleEn ?? cat.titleAr),
    subtitle: lang === 'ar' ? null : cat.titleAr,
    items: rows.map((r) => fromRow(r, lang)),
  };
}

/** Per-day progress key. */
export function progressKey(collectionId: string, itemId: string): string {
  return `${collectionId}|${itemId}`;
}

export function completion(items: readonly DhikrView[], collectionId: string, counts: Readonly<Record<string, number>>): { done: number; total: number } {
  const done = items.filter((i) => (counts[progressKey(collectionId, i.id)] ?? 0) >= i.target).length;
  return { done, total: items.length };
}

/** Which daily collection fits the time of day. */
export function sessionCollection(date: Date): 'morning' | 'evening' {
  const h = date.getHours();
  return h >= 3 && h < 14 ? 'morning' : 'evening';
}
