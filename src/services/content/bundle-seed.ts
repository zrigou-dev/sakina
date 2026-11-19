import { groupOfChapter } from '@/content/adhkar/groups';
import type { SqlDatabase, SqlValue } from '@/database/types';
import { normalizeArabic, normalizeLatin } from '@/services/search/normalize';

/**
 * Seeds bundled, verified non-Quran content into the content database:
 *  - morning & evening adhkar (Seen-Arabic dataset, MIT) with sources and gradings
 *  - complete Hisn al-Muslim (YousefAsalya dataset, MIT), 132 chapters
 *  - Forty Hadith of an-Nawawi and Forty Hadith Qudsi (hadith-api, The Unlicense)
 * Data arrives as generated JSON (see scripts/content-import/import-extended.mjs).
 */
export interface MorningEveningItem {
  readonly order: number;
  readonly text: string;
  readonly count: number;
  readonly countLabel: string | null;
  readonly virtue: string | null;
  readonly source: string | null;
  readonly session: 'am' | 'pm' | 'both';
  readonly en: { readonly text: string | null; readonly virtue: string | null; readonly source: string | null };
}

export interface HisnChapter {
  readonly id: number;
  readonly titleAr: string;
  readonly titleEn: string;
  readonly audio: string | null;
  readonly items: readonly { n: number; text: string; count: number; en: string | null; audio: string | null }[];
}

export interface FortyHadith {
  readonly n: number;
  readonly ar: string;
  readonly en: string | null;
  readonly fr: string | null;
  readonly grades: readonly { name: string; grade: string }[];
}

export interface BundleData {
  readonly morningEvening: readonly MorningEveningItem[];
  readonly hisn: readonly HisnChapter[];
  readonly forty: { readonly nawawi: readonly FortyHadith[]; readonly qudsi: readonly FortyHadith[] };
}

export const SOURCE_ME = 'me';
export const SOURCE_HISN = 'hisn';
/** Audio for Hisn al-Muslim items is streamed from the dataset's public repository (MIT). */
export const HISN_AUDIO_BASE = 'https://cdn.jsdelivr.net/gh/YousefAsalya/Islamic-Pro-azkar-API@main/audio/';

export class BundleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BundleValidationError';
  }
}

export function validateBundle(b: BundleData): void {
  if (b.morningEvening.length < 20) throw new BundleValidationError('morning/evening incomplete');
  if (b.hisn.length !== 132) throw new BundleValidationError('Hisn al-Muslim must have 132 chapters');
  const ids = new Set(b.hisn.map((c) => c.id));
  if (ids.size !== 132) throw new BundleValidationError('duplicate Hisn chapter ids');
  for (const c of b.hisn) if (!c.items.length || c.items.some((i) => !i.text.trim() || i.count < 1)) throw new BundleValidationError(`Hisn chapter ${c.id}`);
  if (b.forty.nawawi.length < 40 || b.forty.qudsi.length < 40) throw new BundleValidationError('forty hadith incomplete');
  for (const h of [...b.forty.nawawi, ...b.forty.qudsi]) if (!h.ar.trim()) throw new BundleValidationError(`hadith ${h.n} empty`);
}

export function bundleMarker(b: BundleData): string {
  const hisnItems = b.hisn.reduce((s, c) => s + c.items.length, 0);
  return `v3:${b.morningEvening.length}:${b.hisn.length}:${hisnItems}:${b.forty.nawawi.length}:${b.forty.qudsi.length}`;
}

async function insertMany(db: SqlDatabase, table: string, columns: readonly string[], rows: readonly SqlValue[][]): Promise<void> {
  const BATCH = Math.max(1, Math.floor(900 / columns.length));
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.runAsync(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',')}`,
      chunk.flat(),
    );
  }
}

export async function seedBundle(db: SqlDatabase, data: BundleData): Promise<boolean> {
  const marker = bundleMarker(data);
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM content_meta WHERE key = 'bundle_seed'");
  if (row?.value === marker) return false;
  validateBundle(data);
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM adhkar_item WHERE category_id IN (SELECT id FROM adhkar_category WHERE source_id IN (?, ?))', [SOURCE_ME, SOURCE_HISN]);
    await db.runAsync('DELETE FROM adhkar_category WHERE source_id IN (?, ?)', [SOURCE_ME, SOURCE_HISN]);
    await db.runAsync('DELETE FROM adhkar_source WHERE id IN (?, ?)', [SOURCE_ME, SOURCE_HISN]);
    await db.runAsync('INSERT INTO adhkar_source (id, name, author, url, license, installed_at) VALUES (?,?,?,?,?,?)', [
      SOURCE_ME,
      'Morning & Evening Adhkar',
      'Hisn al-Muslim & commentaries (compiled by Seen Arabic)',
      'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
      'MIT',
      now,
    ]);
    await db.runAsync('INSERT INTO adhkar_source (id, name, author, url, license, installed_at) VALUES (?,?,?,?,?,?)', [
      SOURCE_HISN,
      'حصن المسلم',
      'Saʿīd ibn ʿAlī ibn Wahf al-Qaḥṭānī',
      'https://github.com/YousefAsalya/Islamic-Pro-azkar-API',
      'MIT (dataset)',
      now,
    ]);

    // Morning & evening: one category; items carry their session (am / pm / both).
    await db.runAsync('INSERT INTO adhkar_category (id, source_id, position, group_id, title_ar, title_en) VALUES (?,?,?,?,?,?)', [
      'me:morning-evening',
      SOURCE_ME,
      0,
      'day',
      'أذكار الصباح والمساء',
      'Morning & evening remembrance',
    ]);
    await insertMany(
      db,
      'adhkar_item',
      [
        'id',
        'category_id',
        'position',
        'text_ar',
        'text_search',
        'translation_en',
        'repeat',
        'count_label',
        'session',
        'virtue',
        'virtue_en',
        'reference',
        'reference_en',
      ],
      data.morningEvening.map((m) => [
        `me:${m.order}`,
        'me:morning-evening',
        m.order,
        m.text,
        normalizeArabic(m.text),
        m.en.text,
        m.count,
        m.countLabel,
        m.session,
        m.virtue,
        m.en.virtue,
        m.source,
        m.en.source,
      ]),
    );

    // Hisn al-Muslim: book order by chapter number.
    const chapters = [...data.hisn].sort((a, b) => a.id - b.id);
    await insertMany(
      db,
      'adhkar_category',
      ['id', 'source_id', 'position', 'group_id', 'title_ar', 'title_en', 'audio_file'],
      chapters.map((c) => [`hisn:${c.id}`, SOURCE_HISN, c.id, groupOfChapter(c.id), c.titleAr, c.titleEn, c.audio]),
    );
    await insertMany(
      db,
      'adhkar_item',
      ['id', 'category_id', 'position', 'text_ar', 'text_search', 'translation_en', 'repeat', 'reference', 'audio_url'],
      chapters.flatMap((c) =>
        c.items.map((it, i) => [
          `hisn:${c.id}:${it.n}`,
          `hisn:${c.id}`,
          i,
          it.text,
          normalizeArabic(it.text),
          it.en,
          it.count,
          `حصن المسلم، الباب ${c.id}: ${c.titleAr}`,
          it.audio ? `${HISN_AUDIO_BASE}${it.audio}` : null,
        ]),
      ),
    );

    // Forty hadith collections.
    for (const [book, name] of [
      ['nawawi', 'الأربعون النووية'],
      ['qudsi', 'الأحاديث القدسية الأربعون'],
    ] as const) {
      await db.runAsync('DELETE FROM hadith WHERE book = ?', [book]);
      await db.runAsync('DELETE FROM hadith_section WHERE book = ?', [book]);
      await db.runAsync('INSERT OR REPLACE INTO hadith_book (id, name, languages, bundled, hadith_count, installed_at) VALUES (?,?,?,?,?,?)', [
        book,
        name,
        'ar,en,fr',
        1,
        data.forty[book].length,
        now,
      ]);
      await insertMany(
        db,
        'hadith',
        ['book', 'number', 'section', 'text_ar', 'text_en', 'text_fr', 'grades', 'search_ar', 'search_tr'],
        data.forty[book].map((h) => [
          book,
          h.n,
          1,
          h.ar,
          h.en,
          h.fr,
          h.grades.length ? JSON.stringify(h.grades) : null,
          normalizeArabic(h.ar),
          normalizeLatin(`${h.en ?? ''} ${h.fr ?? ''}`),
        ]),
      );
    }
    await db.runAsync("INSERT OR REPLACE INTO content_meta (key, value) VALUES ('bundle_seed', ?)", [marker]);
  });
  return true;
}
