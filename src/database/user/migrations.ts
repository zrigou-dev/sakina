import type { Migration } from '../migrate';

/**
 * User database: everything the person creates. Exported in backups.
 * Never edit a shipped migration — append a new one.
 */
export const USER_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        surah INTEGER NOT NULL CHECK (surah BETWEEN 1 AND 114),
        ayah INTEGER NOT NULL CHECK (ayah >= 1),
        note TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (surah, ayah)
      );

      CREATE TABLE reading_position (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        surah INTEGER NOT NULL,
        ayah INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE reading_log (
        date TEXT PRIMARY KEY NOT NULL,
        ayahs_read INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE memorization (
        surah INTEGER NOT NULL,
        ayah INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('learning', 'memorized')),
        ease REAL NOT NULL DEFAULT 2.5,
        interval_days INTEGER NOT NULL DEFAULT 0,
        repetitions INTEGER NOT NULL DEFAULT 0,
        due_date TEXT NOT NULL,
        reviewed_at TEXT,
        PRIMARY KEY (surah, ayah)
      );
      CREATE INDEX idx_memorization_due ON memorization (due_date);

      CREATE TABLE memorization_plan (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        start_surah INTEGER NOT NULL,
        start_ayah INTEGER NOT NULL,
        end_surah INTEGER NOT NULL,
        end_ayah INTEGER NOT NULL,
        daily_new INTEGER NOT NULL CHECK (daily_new BETWEEN 1 AND 50),
        created_at TEXT NOT NULL
      );

      CREATE TABLE prayer_log (
        date TEXT NOT NULL,
        prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
        status TEXT NOT NULL CHECK (status IN ('on_time', 'late', 'missed')),
        PRIMARY KEY (date, prayer)
      );

      CREATE TABLE fasting_log (
        date TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('ramadan', 'voluntary', 'makeup', 'missed')),
        note TEXT
      );

      CREATE TABLE goals (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        target INTEGER NOT NULL CHECK (target > 0),
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE goal_progress (
        goal_id TEXT NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (goal_id, date)
      );

      CREATE TABLE dhikr_progress (
        date TEXT NOT NULL,
        item_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, item_id)
      );

      CREATE TABLE dhikr_favorites (
        item_id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE tasbih (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        target INTEGER,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE packages (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        bytes_total INTEGER NOT NULL DEFAULT 0,
        bytes_done INTEGER NOT NULL DEFAULT 0,
        sha256 TEXT,
        error TEXT,
        resume_state TEXT,
        installed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_packages_status ON packages (status);

      CREATE TABLE package_files (
        package_id TEXT NOT NULL REFERENCES packages (id) ON DELETE CASCADE,
        rel_path TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        PRIMARY KEY (package_id, rel_path)
      );

      CREATE TABLE hajj_progress (
        journey TEXT NOT NULL CHECK (journey IN ('hajj', 'umrah')),
        step_id TEXT NOT NULL,
        done_at TEXT NOT NULL,
        PRIMARY KEY (journey, step_id)
      );

      CREATE TABLE learning_progress (
        package_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
        position REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (package_id, item_id)
      );
    `,
  },
  {
    version: 2,
    name: 'hadith-bookmarks-qada-khatma',
    up: `
      CREATE TABLE hadith_bookmarks (
        book TEXT NOT NULL,
        number REAL NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (book, number)
      );

      CREATE TABLE qada (
        kind TEXT PRIMARY KEY NOT NULL CHECK (kind IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'fast')),
        remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE khatma_log (
        day INTEGER PRIMARY KEY NOT NULL,
        done_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'custom-adhan',
    up: `
      -- Adhan audio files the user picked from their own device (the files live in app storage, not in this table).
      CREATE TABLE custom_adhan (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        file TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
];
