import type { Ayah } from '@/content/quran/types';
import { buildFtsQuery, escapeLike, normalizeArabic, normalizeLatin, queryTerms } from '@/services/search/normalize';
import type { EditionAyah } from '@/services/downloads/validators';

import type { SqlDatabase, SqlValue } from '../types';

interface AyahRow {
  id: number;
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  hizbQuarter: number;
  text: string;
}

const AYAH_COLS = 'id, surah, ayah, page, juz, hizb_quarter AS hizbQuarter, text_uthmani AS text';
const AYAH_COLS_A = 'a.id, a.surah, a.ayah, a.page, a.juz, a.hizb_quarter AS hizbQuarter, a.text_uthmani AS text';

export interface QuranSearchHit {
  readonly id: number;
  readonly surah: number;
  readonly ayah: number;
  readonly text: string;
  readonly source: 'quran' | 'translation';
  readonly edition?: string;
  readonly snippet?: string;
}

export const quranRepo = {
  async surahAyahs(db: SqlDatabase, surah: number): Promise<Ayah[]> {
    return db.getAllAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE surah = ? ORDER BY ayah`, [surah]);
  },
  async ayah(db: SqlDatabase, surah: number, ayah: number): Promise<Ayah | null> {
    return db.getFirstAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE surah = ? AND ayah = ?`, [surah, ayah]);
  },
  async byId(db: SqlDatabase, id: number): Promise<Ayah | null> {
    return db.getFirstAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE id = ?`, [id]);
  },
  async range(db: SqlDatabase, fromId: number, toId: number): Promise<Ayah[]> {
    return db.getAllAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE id BETWEEN ? AND ? ORDER BY id`, [fromId, toId]);
  },
  /** Tanzil's Basmala for a surah (null for Al-Fatiha, whose first ayah is the Basmala, and At-Tawbah). */
  async bismillah(db: SqlDatabase, surah: number): Promise<string | null> {
    const r = await db.getFirstAsync<{ b: string | null }>('SELECT bismillah AS b FROM ayah WHERE surah = ? AND ayah = 1', [surah]);
    return r?.b ?? null;
  },
  async count(db: SqlDatabase): Promise<number> {
    const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ayah');
    return r?.n ?? 0;
  },
  async hasFts(db: SqlDatabase): Promise<boolean> {
    const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM content_meta WHERE key = 'fts'");
    return r?.value === '1';
  },

  /**
   * Searches the Arabic text (normalised Simple-Clean index) and, for Latin queries,
   * installed translations. FTS5 when available, LIKE otherwise. Results display Uthmani text.
   */
  async search(db: SqlDatabase, query: string, limit = 50): Promise<QuranSearchHit[]> {
    const arabic = /[\u0600-\u06FF]/.test(query);
    if (arabic) {
      const normalized = normalizeArabic(query);
      const terms = queryTerms(normalized);
      if (!terms.length) return [];
      const fts = await quranRepo.hasFts(db);
      const match = buildFtsQuery(normalized);
      let rows: AyahRow[];
      if (fts && match) {
        rows = await db.getAllAsync<AyahRow>(
          `SELECT ${AYAH_COLS_A} FROM ayah_fts f JOIN ayah a ON a.id = f.rowid WHERE ayah_fts MATCH ? ORDER BY a.id LIMIT ?`,
          [match, limit],
        );
      } else {
        const where = terms.map(() => "text_search LIKE ? ESCAPE '\\'").join(' AND ');
        rows = await db.getAllAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE ${where} ORDER BY id LIMIT ?`, [
          ...terms.map((t) => `%${escapeLike(t)}%`),
          limit,
        ]);
      }
      return rows.map((r) => ({ id: r.id, surah: r.surah, ayah: r.ayah, text: r.text, source: 'quran' as const }));
    }
    const normalized = normalizeLatin(query);
    const terms = queryTerms(normalized, 3);
    if (!terms.length) return [];
    const where = terms.map(() => "t.text_search LIKE ? ESCAPE '\\'").join(' AND ');
    const rows = await db.getAllAsync<AyahRow & { edition: string; snippet: string }>(
      `SELECT ${AYAH_COLS_A}, t.edition, t.text AS snippet
       FROM translation t JOIN ayah a ON a.id = t.ayah_id WHERE ${where} ORDER BY a.id LIMIT ?`,
      [...terms.map((t) => `%${escapeLike(t)}%`), limit],
    );
    return rows.map((r) => ({ id: r.id, surah: r.surah, ayah: r.ayah, text: r.text, source: 'translation' as const, edition: r.edition, snippet: r.snippet }));
  },
};

// ─── Translations & tafsir ────────────────────────────────────────────────────
export interface EditionInfo {
  readonly id: string;
  readonly kind: 'translation' | 'tafsir';
  readonly language: string;
  readonly name: string;
  readonly author: string;
  readonly source: string;
  readonly license: string;
}

export const translationRepo = {
  async editions(db: SqlDatabase): Promise<EditionInfo[]> {
    return db.getAllAsync('SELECT id, kind, language, name, author, source, license FROM translation_edition ORDER BY kind, language, name');
  },
  async forRange(db: SqlDatabase, edition: string, fromId: number, toId: number): Promise<Record<number, string>> {
    const rows = await db.getAllAsync<{ ayah_id: number; text: string }>(
      'SELECT ayah_id, text FROM translation WHERE edition = ? AND ayah_id BETWEEN ? AND ?',
      [edition, fromId, toId],
    );
    return Object.fromEntries(rows.map((r) => [r.ayah_id, r.text]));
  },
  async forAyah(db: SqlDatabase, ayahId: number): Promise<{ edition: EditionInfo; text: string }[]> {
    const rows = await db.getAllAsync<EditionInfo & { text: string }>(
      `SELECT e.id, e.kind, e.language, e.name, e.author, e.source, e.license, t.text FROM translation t
       JOIN translation_edition e ON e.id = t.edition WHERE t.ayah_id = ? ORDER BY e.kind, e.name`,
      [ayahId],
    );
    return rows.map(({ text, ...edition }) => ({ edition, text }));
  },
  /** Atomically replaces an edition. Called only after the payload passed validation. */
  async install(db: SqlDatabase, info: EditionInfo, ayahs: readonly EditionAyah[]): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM translation WHERE edition = ?', [info.id]);
      await db.runAsync('DELETE FROM translation_edition WHERE id = ?', [info.id]);
      await db.runAsync('INSERT INTO translation_edition (id, kind, language, name, author, source, license, installed_at) VALUES (?,?,?,?,?,?,?,?)', [
        info.id,
        info.kind,
        info.language,
        info.name,
        info.author,
        info.source,
        info.license,
        new Date().toISOString(),
      ]);
      const BATCH = 200;
      for (let i = 0; i < ayahs.length; i += BATCH) {
        const chunk = ayahs.slice(i, i + BATCH);
        const params: SqlValue[] = [];
        for (const a of chunk) {
          const search = info.language === 'ar' ? normalizeArabic(a.text) : normalizeLatin(a.text);
          params.push(info.id, a.ayahId, a.text, search);
        }
        await db.runAsync(`INSERT INTO translation (edition, ayah_id, text, text_search) VALUES ${chunk.map(() => '(?,?,?,?)').join(',')}`, params);
      }
    });
  },
  async remove(db: SqlDatabase, edition: string): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM translation WHERE edition = ?', [edition]);
      await db.runAsync('DELETE FROM translation_edition WHERE id = ?', [edition]);
    });
  },
};

// ─── Adhkar (bundled: morning/evening + Hisn al-Muslim) ─────────────────────────
export interface AdhkarCategoryRow {
  readonly id: string;
  readonly sourceId: string;
  readonly position: number;
  readonly groupId: string;
  readonly titleAr: string;
  readonly titleEn: string | null;
  readonly audioFile: string | null;
  readonly itemCount: number;
}

export interface AdhkarItemRow {
  readonly id: string;
  readonly categoryId: string;
  readonly position: number;
  readonly textAr: string;
  readonly translationEn: string | null;
  readonly repeat: number | null;
  readonly countLabel: string | null;
  readonly session: 'am' | 'pm' | 'both' | null;
  readonly virtue: string | null;
  readonly virtueEn: string | null;
  readonly reference: string | null;
  readonly referenceEn: string | null;
  readonly audioUrl: string | null;
}

const CAT_COLS = `c.id, c.source_id AS sourceId, c.position, c.group_id AS groupId, c.title_ar AS titleAr, c.title_en AS titleEn, c.audio_file AS audioFile,
  (SELECT COUNT(*) FROM adhkar_item i WHERE i.category_id = c.id) AS itemCount`;
const ITEM_COLS = `id, category_id AS categoryId, position, text_ar AS textAr, translation_en AS translationEn, repeat, count_label AS countLabel,
  session, virtue, virtue_en AS virtueEn, reference, reference_en AS referenceEn, audio_url AS audioUrl`;

export const adhkarRepo = {
  async categories(db: SqlDatabase, groupId?: string): Promise<AdhkarCategoryRow[]> {
    return groupId
      ? db.getAllAsync(`SELECT ${CAT_COLS} FROM adhkar_category c WHERE c.group_id = ? ORDER BY c.position`, [groupId])
      : db.getAllAsync(`SELECT ${CAT_COLS} FROM adhkar_category c ORDER BY c.source_id, c.position`);
  },
  async category(db: SqlDatabase, id: string): Promise<AdhkarCategoryRow | null> {
    return db.getFirstAsync(`SELECT ${CAT_COLS} FROM adhkar_category c WHERE c.id = ?`, [id]);
  },
  async categoriesByIds(db: SqlDatabase, ids: readonly string[]): Promise<AdhkarCategoryRow[]> {
    if (!ids.length) return [];
    const rows = await db.getAllAsync<AdhkarCategoryRow>(`SELECT ${CAT_COLS} FROM adhkar_category c WHERE c.id IN (${ids.map(() => '?').join(',')})`, [...ids]);
    return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is AdhkarCategoryRow => !!r);
  },
  async groupCounts(db: SqlDatabase): Promise<Record<string, number>> {
    const rows = await db.getAllAsync<{ g: string; n: number }>(
      "SELECT group_id AS g, COUNT(*) AS n FROM adhkar_category WHERE source_id = 'hisn' GROUP BY group_id",
    );
    return Object.fromEntries(rows.map((r) => [r.g, r.n]));
  },
  async items(db: SqlDatabase, categoryId: string, session?: 'am' | 'pm'): Promise<AdhkarItemRow[]> {
    if (session) {
      return db.getAllAsync(`SELECT ${ITEM_COLS} FROM adhkar_item WHERE category_id = ? AND (session = ? OR session = 'both') ORDER BY position`, [
        categoryId,
        session,
      ]);
    }
    return db.getAllAsync(`SELECT ${ITEM_COLS} FROM adhkar_item WHERE category_id = ? ORDER BY position`, [categoryId]);
  },
  async itemsByIds(db: SqlDatabase, ids: readonly string[]): Promise<AdhkarItemRow[]> {
    if (!ids.length) return [];
    return db.getAllAsync(`SELECT ${ITEM_COLS} FROM adhkar_item WHERE id IN (${ids.map(() => '?').join(',')})`, [...ids]);
  },
  async item(db: SqlDatabase, id: string): Promise<AdhkarItemRow | null> {
    return db.getFirstAsync(`SELECT ${ITEM_COLS} FROM adhkar_item WHERE id = ?`, [id]);
  },
  async search(db: SqlDatabase, query: string, limit = 30): Promise<AdhkarItemRow[]> {
    const terms = queryTerms(normalizeArabic(query));
    if (!terms.length) return [];
    const where = terms.map(() => "text_search LIKE ? ESCAPE '\\'").join(' AND ');
    return db.getAllAsync(`SELECT ${ITEM_COLS} FROM adhkar_item WHERE ${where} LIMIT ?`, [...terms.map((t) => `%${escapeLike(t)}%`), limit]);
  },
  /** Short adhkar suitable for gentle reminders (from the chapter on the virtue of dhikr). */
  async shortDhikr(db: SqlDatabase, maxLength = 160): Promise<AdhkarItemRow[]> {
    return db.getAllAsync(
      `SELECT ${ITEM_COLS} FROM adhkar_item WHERE category_id IN ('hisn:130', 'hisn:129', 'hisn:107') AND length(text_ar) <= ? ORDER BY id`,
      [maxLength],
    );
  },
  async count(db: SqlDatabase): Promise<number> {
    const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM adhkar_item');
    return r?.n ?? 0;
  },
};

/** Quranic supplications: every ayah whose text (Simple-Clean index) begins with «ربنا». */
/**
 * Well-known supplications of the Quran (the "Rabbanā" and "Rabbi" duʿāʾ), by reference.
 * Only the selection is curated: the text always comes verbatim from the verified mushaf,
 * and a test checks that every referenced ayah is a supplication (contains رب / سبحانك) or
 * directly continues a listed one.
 */
export const QURANIC_DUA_REFS: readonly (readonly [surah: number, ayah: number])[] = [
  [1, 6],
  [2, 127],
  [2, 128],
  [2, 201],
  [2, 250],
  [2, 286],
  [3, 8],
  [3, 9],
  [3, 16],
  [3, 38],
  [3, 53],
  [3, 147],
  [3, 191],
  [3, 192],
  [3, 193],
  [3, 194],
  [4, 75],
  [5, 83],
  [5, 114],
  [7, 23],
  [7, 47],
  [7, 89],
  [7, 126],
  [7, 151],
  [7, 155],
  [10, 85],
  [10, 86],
  [11, 47],
  [12, 101],
  [14, 35],
  [14, 40],
  [14, 41],
  [17, 24],
  [17, 80],
  [18, 10],
  [20, 25],
  [20, 114],
  [21, 83],
  [21, 87],
  [21, 89],
  [23, 29],
  [23, 97],
  [23, 98],
  [23, 109],
  [23, 118],
  [25, 65],
  [25, 74],
  [26, 83],
  [26, 84],
  [26, 85],
  [27, 19],
  [28, 16],
  [28, 21],
  [28, 24],
  [29, 30],
  [40, 7],
  [40, 8],
  [40, 9],
  [46, 15],
  [59, 10],
  [60, 4],
  [60, 5],
  [66, 8],
  [66, 11],
  [71, 28],
];

export async function quranicDuas(db: SqlDatabase): Promise<Ayah[]> {
  const where = QURANIC_DUA_REFS.map(() => '(surah = ? AND ayah = ?)').join(' OR ');
  return db.getAllAsync<AyahRow>(`SELECT ${AYAH_COLS} FROM ayah WHERE ${where} ORDER BY id`, QURANIC_DUA_REFS.flat());
}

// ─── Hadith ──────────────────────────────────────────────────────────────────────
export interface HadithBookRow {
  readonly id: string;
  readonly name: string;
  readonly languages: string;
  readonly bundled: boolean;
  readonly hadithCount: number;
}

export interface HadithGrade {
  readonly name: string;
  readonly grade: string;
}

export interface HadithRow {
  readonly book: string;
  readonly number: number;
  readonly section: number | null;
  readonly textAr: string;
  readonly textEn: string | null;
  readonly textFr: string | null;
  readonly grades: readonly HadithGrade[];
}

interface RawHadith {
  book: string;
  number: number;
  section: number | null;
  textAr: string;
  textEn: string | null;
  textFr: string | null;
  grades: string | null;
}

const H_COLS = 'book, number, section, text_ar AS textAr, text_en AS textEn, text_fr AS textFr, grades';
const parseH = (r: RawHadith): HadithRow => {
  let grades: HadithGrade[] = [];
  try {
    grades = r.grades ? (JSON.parse(r.grades) as HadithGrade[]) : [];
  } catch {
    grades = [];
  }
  return { ...r, grades };
};

export interface HadithEditionInput {
  readonly book: string;
  readonly name: string;
  readonly sections: readonly { n: number; name: string; first: number | null; last: number | null }[];
  readonly hadiths: readonly { number: number; section: number | null; ar: string; en?: string | null; fr?: string | null; grades: readonly HadithGrade[] }[];
  readonly languages: readonly ('ar' | 'en' | 'fr')[];
}

export const hadithRepo = {
  async books(db: SqlDatabase): Promise<HadithBookRow[]> {
    const rows = await db.getAllAsync<{ id: string; name: string; languages: string; bundled: number; hadithCount: number }>(
      'SELECT id, name, languages, bundled, hadith_count AS hadithCount FROM hadith_book ORDER BY bundled DESC, id',
    );
    return rows.map((r) => ({ ...r, bundled: r.bundled === 1 }));
  },
  async book(db: SqlDatabase, id: string): Promise<HadithBookRow | null> {
    const r = await db.getFirstAsync<{ id: string; name: string; languages: string; bundled: number; hadithCount: number }>(
      'SELECT id, name, languages, bundled, hadith_count AS hadithCount FROM hadith_book WHERE id = ?',
      [id],
    );
    return r ? { ...r, bundled: r.bundled === 1 } : null;
  },
  async sections(db: SqlDatabase, book: string): Promise<{ n: number; name: string; count: number }[]> {
    return db.getAllAsync(
      `SELECT s.n, s.name, (SELECT COUNT(*) FROM hadith h WHERE h.book = s.book AND h.section = s.n) AS count
       FROM hadith_section s WHERE s.book = ? AND s.n > 0 ORDER BY s.n`,
      [book],
    );
  },
  async page(db: SqlDatabase, book: string, section: number | null, offset: number, limit: number): Promise<HadithRow[]> {
    const rows = await db.getAllAsync<RawHadith>(
      section === null
        ? `SELECT ${H_COLS} FROM hadith WHERE book = ? ORDER BY number LIMIT ? OFFSET ?`
        : `SELECT ${H_COLS} FROM hadith WHERE book = ? AND section = ? ORDER BY number LIMIT ? OFFSET ?`,
      section === null ? [book, limit, offset] : [book, section, limit, offset],
    );
    return rows.map(parseH);
  },
  async get(db: SqlDatabase, book: string, number: number): Promise<HadithRow | null> {
    const r = await db.getFirstAsync<RawHadith>(`SELECT ${H_COLS} FROM hadith WHERE book = ? AND number = ?`, [book, number]);
    return r ? parseH(r) : null;
  },
  async byKeys(db: SqlDatabase, keys: readonly { book: string; number: number }[]): Promise<HadithRow[]> {
    const out: HadithRow[] = [];
    for (const k of keys) {
      const h = await hadithRepo.get(db, k.book, k.number);
      if (h) out.push(h);
    }
    return out;
  },
  async search(db: SqlDatabase, query: string, limit = 40): Promise<HadithRow[]> {
    const arabic = /[\u0600-\u06FF]/.test(query);
    const terms = queryTerms(arabic ? normalizeArabic(query) : normalizeLatin(query), arabic ? 2 : 3);
    if (!terms.length) return [];
    const col = arabic ? 'search_ar' : 'search_tr';
    const where = terms.map(() => `${col} LIKE ? ESCAPE '\\'`).join(' AND ');
    const rows = await db.getAllAsync<RawHadith>(`SELECT ${H_COLS} FROM hadith WHERE ${where} ORDER BY book, number LIMIT ?`, [
      ...terms.map((t) => `%${escapeLike(t)}%`),
      limit,
    ]);
    return rows.map(parseH);
  },
  /** Replaces a whole downloaded collection atomically (after validation). */
  async install(db: SqlDatabase, ed: HadithEditionInput): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM hadith WHERE book = ?', [ed.book]);
      await db.runAsync('DELETE FROM hadith_section WHERE book = ?', [ed.book]);
      await db.runAsync('DELETE FROM hadith_book WHERE id = ?', [ed.book]);
      await db.runAsync('INSERT INTO hadith_book (id, name, languages, bundled, hadith_count, installed_at) VALUES (?,?,?,?,?,?)', [
        ed.book,
        ed.name,
        ed.languages.join(','),
        0,
        ed.hadiths.length,
        new Date().toISOString(),
      ]);
      for (const sec of ed.sections) {
        await db.runAsync('INSERT INTO hadith_section (book, n, name, first_number, last_number) VALUES (?,?,?,?,?)', [
          ed.book,
          sec.n,
          sec.name,
          sec.first,
          sec.last,
        ]);
      }
      const BATCH = 80;
      for (let i = 0; i < ed.hadiths.length; i += BATCH) {
        const chunk = ed.hadiths.slice(i, i + BATCH);
        const params: SqlValue[] = [];
        for (const h of chunk) {
          params.push(
            ed.book,
            h.number,
            h.section,
            h.ar,
            h.en ?? null,
            h.fr ?? null,
            h.grades.length ? JSON.stringify(h.grades) : null,
            normalizeArabic(h.ar),
            normalizeLatin(`${h.en ?? ''} ${h.fr ?? ''}`),
          );
        }
        await db.runAsync(
          `INSERT OR REPLACE INTO hadith (book, number, section, text_ar, text_en, text_fr, grades, search_ar, search_tr) VALUES ${chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`,
          params,
        );
      }
    });
  },
  async remove(db: SqlDatabase, book: string): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM hadith WHERE book = ?', [book]);
      await db.runAsync('DELETE FROM hadith_section WHERE book = ?', [book]);
      await db.runAsync('DELETE FROM hadith_book WHERE id = ? AND bundled = 0', [book]);
    });
  },
};
