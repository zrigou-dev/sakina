import type { SqlDatabase } from '../types';

/**
 * Content database: immutable bundled text + installed packages.
 * Rebuildable at any time; bump CONTENT_SCHEMA_VERSION to force a rebuild.
 */
export const CONTENT_SCHEMA_VERSION = 3;

export const CONTENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ayah (
    id INTEGER PRIMARY KEY,               -- global index 1..6236
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    page INTEGER NOT NULL,
    juz INTEGER NOT NULL,
    hizb_quarter INTEGER NOT NULL,
    text_uthmani TEXT NOT NULL,           -- displayed (verbatim Tanzil Uthmani)
    text_search TEXT NOT NULL,            -- normalised Tanzil Simple-Clean (never displayed)
    bismillah TEXT,                       -- Tanzil's per-surah Basmala (first ayah of surahs other than 1 and 9)
    UNIQUE (surah, ayah)
  );
  CREATE INDEX IF NOT EXISTS idx_ayah_page ON ayah (page);
  CREATE INDEX IF NOT EXISTS idx_ayah_juz ON ayah (juz);

  CREATE TABLE IF NOT EXISTS translation_edition (
    id TEXT PRIMARY KEY NOT NULL,         -- e.g. en.sahih
    kind TEXT NOT NULL CHECK (kind IN ('translation', 'tafsir')),
    language TEXT NOT NULL,
    name TEXT NOT NULL,
    author TEXT NOT NULL,
    source TEXT NOT NULL,
    license TEXT NOT NULL,
    installed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS translation (
    edition TEXT NOT NULL REFERENCES translation_edition (id) ON DELETE CASCADE,
    ayah_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    text_search TEXT NOT NULL,
    PRIMARY KEY (edition, ayah_id)
  );

  CREATE TABLE IF NOT EXISTS adhkar_source (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    author TEXT NOT NULL,
    url TEXT NOT NULL,
    license TEXT NOT NULL,
    installed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS adhkar_category (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL REFERENCES adhkar_source (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    group_id TEXT NOT NULL DEFAULT 'other',
    title_ar TEXT NOT NULL,
    title_en TEXT,
    title_fr TEXT,
    audio_file TEXT
  );

  CREATE TABLE IF NOT EXISTS adhkar_item (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL REFERENCES adhkar_category (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text_ar TEXT NOT NULL,
    text_search TEXT NOT NULL,
    translation_en TEXT,
    translation_fr TEXT,
    repeat INTEGER,
    count_label TEXT,
    session TEXT,
    virtue TEXT,
    virtue_en TEXT,
    reference TEXT,
    reference_en TEXT,
    grading TEXT,
    audio_url TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_adhkar_item_category ON adhkar_item (category_id, position);

  CREATE TABLE IF NOT EXISTS hadith_book (
    id TEXT PRIMARY KEY NOT NULL,          -- bukhari, muslim, nawawi …
    name TEXT NOT NULL,
    languages TEXT NOT NULL DEFAULT 'ar',  -- comma list of installed text languages, e.g. 'ar,en'
    bundled INTEGER NOT NULL DEFAULT 0,
    hadith_count INTEGER NOT NULL DEFAULT 0,
    installed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hadith_section (
    book TEXT NOT NULL REFERENCES hadith_book (id) ON DELETE CASCADE,
    n INTEGER NOT NULL,
    name TEXT NOT NULL,
    first_number REAL,
    last_number REAL,
    PRIMARY KEY (book, n)
  );

  CREATE TABLE IF NOT EXISTS hadith (
    book TEXT NOT NULL REFERENCES hadith_book (id) ON DELETE CASCADE,
    number REAL NOT NULL,
    section INTEGER,
    text_ar TEXT NOT NULL,
    text_en TEXT,
    text_fr TEXT,
    grades TEXT,                           -- JSON [{name, grade}] as published by the source
    search_ar TEXT NOT NULL,
    search_tr TEXT,
    PRIMARY KEY (book, number)
  );
  CREATE INDEX IF NOT EXISTS idx_hadith_section ON hadith (book, section, number);

  CREATE TABLE IF NOT EXISTS content_package (
    id TEXT PRIMARY KEY NOT NULL,
    section TEXT NOT NULL CHECK (section IN ('library', 'academy', 'guides', 'family')),
    language TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    license TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_on TEXT,
    installed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS library_item (
    id TEXT PRIMARY KEY NOT NULL,
    package_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('article', 'lesson', 'guide', 'chapter')),
    parent_id TEXT,
    position INTEGER NOT NULL,
    language TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    body_search TEXT NOT NULL,
    source TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('source_text', 'scholarly_opinion', 'educational_summary'))
  );
  CREATE INDEX IF NOT EXISTS idx_library_item_package ON library_item (package_id, position);
`;

export const FTS_SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS ayah_fts USING fts5(text_search, content='ayah', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
`;

/**
 * Creates the content schema. When CONTENT_SCHEMA_VERSION changes, only the rebuildable
 * Quran tables are dropped (they are re-seeded from the bundled verified text);
 * installed translations, adhkar and library packages are kept.
 */
export async function ensureContentSchema(db: SqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS content_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM content_meta WHERE key = 'schema_version'");
  if (row && row.value !== String(CONTENT_SCHEMA_VERSION)) {
    await db.execAsync(
      'DROP TABLE IF EXISTS ayah_fts; DROP TABLE IF EXISTS ayah; DROP TABLE IF EXISTS adhkar_item; DROP TABLE IF EXISTS adhkar_category; DROP TABLE IF EXISTS adhkar_source;',
    );
    await db.runAsync("DELETE FROM content_meta WHERE key IN ('quran_seed', 'fts', 'bundle_seed')");
  }
  await db.execAsync(CONTENT_SCHEMA);
  await db.runAsync("INSERT OR REPLACE INTO content_meta (key, value) VALUES ('schema_version', ?)", [String(CONTENT_SCHEMA_VERSION)]);
}

/** Returns true if FTS5 is compiled into this SQLite build (native: yes; web wasm: no). */
export async function supportsFts5(db: SqlDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ ok: number }>("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS ok");
    if (row?.ok === 1) return true;
    await db.execAsync('CREATE VIRTUAL TABLE IF NOT EXISTS __fts_probe USING fts5(x); DROP TABLE __fts_probe;');
    return true;
  } catch {
    return false;
  }
}
