import { BUNDLED_CONTENT_SHA256 } from '@/content/integrity.generated';
import { CONTENT_SCHEMA_VERSION, FTS_SCHEMA, ensureContentSchema, supportsFts5 } from '@/database/content/schema';
import type { SqlDatabase, SqlValue } from '@/database/types';
import { normalizeArabic } from '@/services/search/normalize';

import { hizbQuarterOfIndex, juzOfIndex, pageOfIndex } from './navigation';
import { parseTanzilXml, validateQuranVerses } from './parse';

export type BundledFile = keyof typeof BUNDLED_CONTENT_SHA256;

export interface SeedDeps {
  /** Reads a bundled content asset as UTF-8 text. */
  readText(file: BundledFile): Promise<string>;
  /** SHA-256 (lowercase hex) of the UTF-8 encoding of a string. */
  sha256(text: string): Promise<string>;
  now?: () => Date;
}

export class ContentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentIntegrityError';
  }
}

const SEED_KEY = 'quran_seed';
const seedMarker = () => `${CONTENT_SCHEMA_VERSION}:${BUNDLED_CONTENT_SHA256['quran-uthmani.xml']}:${BUNDLED_CONTENT_SHA256['quran-simple-clean.xml']}`;

export async function isQuranSeeded(db: SqlDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM content_meta WHERE key = ?', [SEED_KEY]);
    return row?.value === seedMarker();
  } catch {
    return false;
  }
}

export interface SeedResult {
  readonly seeded: boolean;
  readonly fts: boolean;
  readonly ms: number;
}

/**
 * Verifies and loads the bundled Tanzil Quran into the content database.
 * Integrity chain: SHA-256 of each file → parse (Tanzil XML) → 6236 ayahs in canonical order
 * and correct Basmala structure
 * → both editions aligned verse-by-verse → single transaction insert.
 * Throws ContentIntegrityError rather than ever seeding unverified text.
 */
export async function seedQuran(db: SqlDatabase, deps: SeedDeps): Promise<SeedResult> {
  const started = Date.now();
  await ensureContentSchema(db);
  const fts = await supportsFts5(db);
  if (await isQuranSeeded(db)) return { seeded: false, fts, ms: Date.now() - started };

  const [uthmaniText, searchText] = await Promise.all([deps.readText('quran-uthmani.xml'), deps.readText('quran-simple-clean.xml')]);
  const [h1, h2] = await Promise.all([deps.sha256(uthmaniText), deps.sha256(searchText)]);
  if (h1 !== BUNDLED_CONTENT_SHA256['quran-uthmani.xml']) throw new ContentIntegrityError('Uthmani Quran text failed SHA-256 verification');
  if (h2 !== BUNDLED_CONTENT_SHA256['quran-simple-clean.xml']) throw new ContentIntegrityError('Search Quran text failed SHA-256 verification');

  const uthmani = parseTanzilXml(uthmaniText);
  const search = parseTanzilXml(searchText);
  const problems = [...validateQuranVerses(uthmani), ...validateQuranVerses(search)];
  if (problems.length) throw new ContentIntegrityError(`Quran text failed validation: ${problems.slice(0, 3).join('; ')}`);

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM ayah;');
    const BATCH = 250;
    for (let start = 0; start < uthmani.length; start += BATCH) {
      const chunk = uthmani.slice(start, start + BATCH);
      const params: SqlValue[] = [];
      chunk.forEach((v, j) => {
        const id = start + j + 1;
        params.push(
          id,
          v.surah,
          v.ayah,
          pageOfIndex(id),
          juzOfIndex(id),
          hizbQuarterOfIndex(id),
          v.text,
          normalizeArabic(search[id - 1]!.text),
          v.bismillah ?? null,
        );
      });
      await db.runAsync(
        `INSERT INTO ayah (id, surah, ayah, page, juz, hizb_quarter, text_uthmani, text_search, bismillah) VALUES ${chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`,
        params,
      );
    }
    if (fts) {
      await db.execAsync(FTS_SCHEMA);
      await db.execAsync("INSERT INTO ayah_fts(ayah_fts) VALUES ('rebuild');");
    }
    await db.runAsync('INSERT OR REPLACE INTO content_meta (key, value) VALUES (?, ?)', [SEED_KEY, seedMarker()]);
    await db.runAsync('INSERT OR REPLACE INTO content_meta (key, value) VALUES (?, ?)', ['fts', fts ? '1' : '0']);
    await db.runAsync('INSERT OR REPLACE INTO content_meta (key, value) VALUES (?, ?)', ['seeded_at', (deps.now?.() ?? new Date()).toISOString()]);
  });

  return { seeded: true, fts, ms: Date.now() - started };
}
