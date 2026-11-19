import type { FardPrayer } from '@/services/prayer/times';
import type { ReviewState } from '@/services/memorization/scheduler';
import type { PackageStatus } from '@/services/downloads/state';
import { toISODate } from '@/utils/date';

import type { SqlDatabase } from '../types';

const nowIso = () => new Date().toISOString();

// ─── Settings (key → JSON) ────────────────────────────────────────────────────
export const settingsRepo = {
  async getAll(db: SqlDatabase): Promise<Record<string, unknown>> {
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        // Corrupt value: ignore and fall back to defaults rather than crash.
      }
    }
    return out;
  },
  async set(db: SqlDatabase, key: string, value: unknown): Promise<void> {
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
  },
  async setMany(db: SqlDatabase, entries: Record<string, unknown>): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const [k, v] of Object.entries(entries)) await settingsRepo.set(db, k, v);
    });
  },
};

// ─── Bookmarks ────────────────────────────────────────────────────────────────
export interface Bookmark {
  readonly id: number;
  readonly surah: number;
  readonly ayah: number;
  readonly note: string | null;
  readonly createdAt: string;
}

export const bookmarksRepo = {
  async list(db: SqlDatabase): Promise<Bookmark[]> {
    return db.getAllAsync<Bookmark>('SELECT id, surah, ayah, note, created_at AS createdAt FROM bookmarks ORDER BY created_at DESC, id DESC');
  },
  async forSurah(db: SqlDatabase, surah: number): Promise<number[]> {
    const rows = await db.getAllAsync<{ ayah: number }>('SELECT ayah FROM bookmarks WHERE surah = ?', [surah]);
    return rows.map((r) => r.ayah);
  },
  async toggle(db: SqlDatabase, surah: number, ayah: number): Promise<boolean> {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM bookmarks WHERE surah = ? AND ayah = ?', [surah, ayah]);
    if (existing) {
      await db.runAsync('DELETE FROM bookmarks WHERE id = ?', [existing.id]);
      return false;
    }
    await db.runAsync('INSERT INTO bookmarks (surah, ayah, created_at) VALUES (?, ?, ?)', [surah, ayah, nowIso()]);
    return true;
  },
  async setNote(db: SqlDatabase, id: number, note: string | null): Promise<void> {
    await db.runAsync('UPDATE bookmarks SET note = ? WHERE id = ?', [note?.trim() || null, id]);
  },
  async remove(db: SqlDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM bookmarks WHERE id = ?', [id]);
  },
};

// ─── Reading position & log ───────────────────────────────────────────────────
export const readingRepo = {
  async getPosition(db: SqlDatabase): Promise<{ surah: number; ayah: number; updatedAt: string } | null> {
    return db.getFirstAsync('SELECT surah, ayah, updated_at AS updatedAt FROM reading_position WHERE id = 1');
  },
  async setPosition(db: SqlDatabase, surah: number, ayah: number): Promise<void> {
    await db.runAsync(
      'INSERT INTO reading_position (id, surah, ayah, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET surah = excluded.surah, ayah = excluded.ayah, updated_at = excluded.updated_at',
      [surah, ayah, nowIso()],
    );
  },
  async addAyahsRead(db: SqlDatabase, count: number, date = new Date()): Promise<void> {
    if (count <= 0) return;
    await db.runAsync(
      'INSERT INTO reading_log (date, ayahs_read) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET ayahs_read = ayahs_read + excluded.ayahs_read',
      [toISODate(date), Math.trunc(count)],
    );
  },
  async ayahsReadOn(db: SqlDatabase, date: Date): Promise<number> {
    const r = await db.getFirstAsync<{ n: number }>('SELECT ayahs_read AS n FROM reading_log WHERE date = ?', [toISODate(date)]);
    return r?.n ?? 0;
  },
  async history(db: SqlDatabase, days: number, today = new Date()): Promise<{ date: string; ayahs: number }[]> {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
    return db.getAllAsync('SELECT date, ayahs_read AS ayahs FROM reading_log WHERE date >= ? ORDER BY date', [toISODate(from)]);
  },
};

// ─── Memorisation ─────────────────────────────────────────────────────────────
export interface MemorizationRow extends ReviewState {
  readonly surah: number;
  readonly ayah: number;
  readonly status: 'learning' | 'memorized';
  readonly dueDate: string;
  readonly reviewedAt: string | null;
}

const MEM_COLS = 'surah, ayah, status, ease, interval_days AS intervalDays, repetitions, due_date AS dueDate, reviewed_at AS reviewedAt';

export const memorizationRepo = {
  async upsert(db: SqlDatabase, row: Omit<MemorizationRow, 'reviewedAt'> & { reviewedAt?: string | null }): Promise<void> {
    await db.runAsync(
      `INSERT INTO memorization (surah, ayah, status, ease, interval_days, repetitions, due_date, reviewed_at) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(surah, ayah) DO UPDATE SET status = excluded.status, ease = excluded.ease, interval_days = excluded.interval_days,
       repetitions = excluded.repetitions, due_date = excluded.due_date, reviewed_at = excluded.reviewed_at`,
      [row.surah, row.ayah, row.status, row.ease, row.intervalDays, row.repetitions, row.dueDate, row.reviewedAt ?? null],
    );
  },
  async get(db: SqlDatabase, surah: number, ayah: number): Promise<MemorizationRow | null> {
    return db.getFirstAsync(`SELECT ${MEM_COLS} FROM memorization WHERE surah = ? AND ayah = ?`, [surah, ayah]);
  },
  async forSurah(db: SqlDatabase, surah: number): Promise<MemorizationRow[]> {
    return db.getAllAsync(`SELECT ${MEM_COLS} FROM memorization WHERE surah = ? ORDER BY ayah`, [surah]);
  },
  async due(db: SqlDatabase, today: Date, limit = 50): Promise<MemorizationRow[]> {
    return db.getAllAsync(`SELECT ${MEM_COLS} FROM memorization WHERE due_date <= ? ORDER BY due_date, surah, ayah LIMIT ?`, [toISODate(today), limit]);
  },
  async remove(db: SqlDatabase, surah: number, ayah: number): Promise<void> {
    await db.runAsync('DELETE FROM memorization WHERE surah = ? AND ayah = ?', [surah, ayah]);
  },
  async stats(db: SqlDatabase, today: Date): Promise<{ memorized: number; learning: number; due: number }> {
    const r = await db.getFirstAsync<{ memorized: number; learning: number; due: number }>(
      `SELECT
         COALESCE(SUM(status = 'memorized'), 0) AS memorized,
         COALESCE(SUM(status = 'learning'), 0) AS learning,
         COALESCE(SUM(due_date <= ?), 0) AS due
       FROM memorization`,
      [toISODate(today)],
    );
    return r ?? { memorized: 0, learning: 0, due: 0 };
  },
  async lastTouched(db: SqlDatabase): Promise<{ surah: number; ayah: number } | null> {
    return db.getFirstAsync('SELECT surah, ayah FROM memorization ORDER BY COALESCE(reviewed_at, due_date) DESC LIMIT 1');
  },
};

// ─── Prayer & fasting logs ────────────────────────────────────────────────────
export type PrayerLogStatus = 'on_time' | 'late' | 'missed';
export type FastingKind = 'ramadan' | 'voluntary' | 'makeup' | 'missed';

export const logsRepo = {
  async setPrayer(db: SqlDatabase, date: Date, prayer: FardPrayer, status: PrayerLogStatus | null): Promise<void> {
    if (status === null) {
      await db.runAsync('DELETE FROM prayer_log WHERE date = ? AND prayer = ?', [toISODate(date), prayer]);
      return;
    }
    await db.runAsync('INSERT INTO prayer_log (date, prayer, status) VALUES (?,?,?) ON CONFLICT(date, prayer) DO UPDATE SET status = excluded.status', [
      toISODate(date),
      prayer,
      status,
    ]);
  },
  async prayersOn(db: SqlDatabase, date: Date): Promise<Partial<Record<FardPrayer, PrayerLogStatus>>> {
    const rows = await db.getAllAsync<{ prayer: FardPrayer; status: PrayerLogStatus }>('SELECT prayer, status FROM prayer_log WHERE date = ?', [
      toISODate(date),
    ]);
    return Object.fromEntries(rows.map((r) => [r.prayer, r.status]));
  },
  async prayerHistory(db: SqlDatabase, fromDate: Date): Promise<{ date: string; done: number }[]> {
    return db.getAllAsync("SELECT date, SUM(status != 'missed') AS done FROM prayer_log WHERE date >= ? GROUP BY date ORDER BY date", [toISODate(fromDate)]);
  },
  async setFast(db: SqlDatabase, date: Date, kind: FastingKind | null, note: string | null = null): Promise<void> {
    if (kind === null) {
      await db.runAsync('DELETE FROM fasting_log WHERE date = ?', [toISODate(date)]);
      return;
    }
    await db.runAsync('INSERT INTO fasting_log (date, kind, note) VALUES (?,?,?) ON CONFLICT(date) DO UPDATE SET kind = excluded.kind, note = excluded.note', [
      toISODate(date),
      kind,
      note,
    ]);
  },
  async fastsBetween(db: SqlDatabase, from: Date, to: Date): Promise<{ date: string; kind: FastingKind; note: string | null }[]> {
    return db.getAllAsync('SELECT date, kind, note FROM fasting_log WHERE date BETWEEN ? AND ? ORDER BY date', [toISODate(from), toISODate(to)]);
  },
  async fastingSummary(db: SqlDatabase): Promise<Record<FastingKind, number>> {
    const rows = await db.getAllAsync<{ kind: FastingKind; n: number }>('SELECT kind, COUNT(*) AS n FROM fasting_log GROUP BY kind');
    const out: Record<FastingKind, number> = { ramadan: 0, voluntary: 0, makeup: 0, missed: 0 };
    for (const r of rows) out[r.kind] = r.n;
    return out;
  },
};

// ─── Dhikr progress & favourites ──────────────────────────────────────────────
export const dhikrRepo = {
  async countsOn(db: SqlDatabase, date: Date): Promise<Record<string, number>> {
    const rows = await db.getAllAsync<{ item_id: string; count: number }>('SELECT item_id, count FROM dhikr_progress WHERE date = ?', [toISODate(date)]);
    return Object.fromEntries(rows.map((r) => [r.item_id, r.count]));
  },
  async setCount(db: SqlDatabase, date: Date, itemId: string, count: number): Promise<void> {
    await db.runAsync('INSERT INTO dhikr_progress (date, item_id, count) VALUES (?,?,?) ON CONFLICT(date, item_id) DO UPDATE SET count = excluded.count', [
      toISODate(date),
      itemId,
      Math.max(0, Math.trunc(count)),
    ]);
  },
  async favorites(db: SqlDatabase): Promise<string[]> {
    const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM dhikr_favorites ORDER BY created_at DESC');
    return rows.map((r) => r.item_id);
  },
  async toggleFavorite(db: SqlDatabase, itemId: string): Promise<boolean> {
    const r = await db.runAsync('DELETE FROM dhikr_favorites WHERE item_id = ?', [itemId]);
    if (r.changes > 0) return false;
    await db.runAsync('INSERT INTO dhikr_favorites (item_id, created_at) VALUES (?, ?)', [itemId, nowIso()]);
    return true;
  },
};

// ─── Tasbih ───────────────────────────────────────────────────────────────────
export interface TasbihRow {
  readonly id: number;
  readonly label: string;
  readonly count: number;
  readonly target: number | null;
}

export const tasbihRepo = {
  async list(db: SqlDatabase): Promise<TasbihRow[]> {
    return db.getAllAsync('SELECT id, label, count, target FROM tasbih ORDER BY updated_at DESC');
  },
  async create(db: SqlDatabase, label: string, target: number | null): Promise<number> {
    const r = await db.runAsync('INSERT INTO tasbih (label, count, target, updated_at) VALUES (?, 0, ?, ?)', [label.trim(), target, nowIso()]);
    return r.lastInsertRowId;
  },
  async setCount(db: SqlDatabase, id: number, count: number): Promise<void> {
    await db.runAsync('UPDATE tasbih SET count = ?, updated_at = ? WHERE id = ?', [Math.max(0, Math.trunc(count)), nowIso(), id]);
  },
  async remove(db: SqlDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM tasbih WHERE id = ?', [id]);
  },
};

// ─── Notes / reflections ──────────────────────────────────────────────────────
export interface Note {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly ref: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const notesRepo = {
  async list(db: SqlDatabase): Promise<Note[]> {
    return db.getAllAsync('SELECT id, title, body, ref, created_at AS createdAt, updated_at AS updatedAt FROM notes ORDER BY updated_at DESC');
  },
  async save(db: SqlDatabase, note: { id?: number; title: string; body: string; ref?: string | null }): Promise<number> {
    const t = nowIso();
    if (note.id) {
      await db.runAsync('UPDATE notes SET title = ?, body = ?, ref = ?, updated_at = ? WHERE id = ?', [note.title, note.body, note.ref ?? null, t, note.id]);
      return note.id;
    }
    const r = await db.runAsync('INSERT INTO notes (title, body, ref, created_at, updated_at) VALUES (?,?,?,?,?)', [
      note.title,
      note.body,
      note.ref ?? null,
      t,
      t,
    ]);
    return r.lastInsertRowId;
  },
  async remove(db: SqlDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  },
};

// ─── Goals ────────────────────────────────────────────────────────────────────
export type GoalKind = 'quran_ayahs' | 'adhkar_morning' | 'adhkar_evening' | 'prayers_logged' | 'memorization_reviews';
export interface Goal {
  readonly id: string;
  readonly kind: GoalKind;
  readonly target: number;
  readonly active: boolean;
}

export const goalsRepo = {
  async list(db: SqlDatabase): Promise<Goal[]> {
    const rows = await db.getAllAsync<{ id: string; kind: GoalKind; target: number; active: number }>('SELECT id, kind, target, active FROM goals ORDER BY id');
    return rows.map((r) => ({ ...r, active: r.active === 1 }));
  },
  async upsert(db: SqlDatabase, goal: Goal): Promise<void> {
    await db.runAsync(
      'INSERT INTO goals (id, kind, target, active) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET target = excluded.target, active = excluded.active',
      [goal.id, goal.kind, goal.target, goal.active ? 1 : 0],
    );
  },
};

// ─── Hajj / Umrah progress ────────────────────────────────────────────────────
export const hajjRepo = {
  async done(db: SqlDatabase, journey: 'hajj' | 'umrah'): Promise<string[]> {
    const rows = await db.getAllAsync<{ step_id: string }>('SELECT step_id FROM hajj_progress WHERE journey = ?', [journey]);
    return rows.map((r) => r.step_id);
  },
  async toggle(db: SqlDatabase, journey: 'hajj' | 'umrah', stepId: string): Promise<boolean> {
    const r = await db.runAsync('DELETE FROM hajj_progress WHERE journey = ? AND step_id = ?', [journey, stepId]);
    if (r.changes > 0) return false;
    await db.runAsync('INSERT INTO hajj_progress (journey, step_id, done_at) VALUES (?,?,?)', [journey, stepId, nowIso()]);
    return true;
  },
  async reset(db: SqlDatabase, journey: 'hajj' | 'umrah'): Promise<void> {
    await db.runAsync('DELETE FROM hajj_progress WHERE journey = ?', [journey]);
  },
};

// ─── Packages (download metadata) ─────────────────────────────────────────────
export interface PackageRow {
  readonly id: string;
  readonly kind: string;
  readonly version: string;
  readonly status: PackageStatus;
  readonly bytesTotal: number;
  readonly bytesDone: number;
  readonly sha256: string | null;
  readonly error: string | null;
  readonly resumeState: string | null;
  readonly installedAt: string | null;
}

const PKG_COLS =
  'id, kind, version, status, bytes_total AS bytesTotal, bytes_done AS bytesDone, sha256, error, resume_state AS resumeState, installed_at AS installedAt';

export const packagesRepo = {
  async list(db: SqlDatabase): Promise<PackageRow[]> {
    return db.getAllAsync(`SELECT ${PKG_COLS} FROM packages ORDER BY updated_at DESC`);
  },
  async get(db: SqlDatabase, id: string): Promise<PackageRow | null> {
    return db.getFirstAsync(`SELECT ${PKG_COLS} FROM packages WHERE id = ?`, [id]);
  },
  async upsert(db: SqlDatabase, row: Omit<PackageRow, 'installedAt'> & { installedAt?: string | null }): Promise<void> {
    await db.runAsync(
      `INSERT INTO packages (id, kind, version, status, bytes_total, bytes_done, sha256, error, resume_state, installed_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, version = excluded.version, status = excluded.status,
         bytes_total = excluded.bytes_total, bytes_done = excluded.bytes_done, sha256 = excluded.sha256, error = excluded.error,
         resume_state = excluded.resume_state, installed_at = COALESCE(excluded.installed_at, packages.installed_at), updated_at = excluded.updated_at`,
      [row.id, row.kind, row.version, row.status, row.bytesTotal, row.bytesDone, row.sha256, row.error, row.resumeState, row.installedAt ?? null, nowIso()],
    );
  },
  async remove(db: SqlDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM packages WHERE id = ?', [id]);
  },
  async setFiles(db: SqlDatabase, packageId: string, files: readonly { relPath: string; bytes: number; sha256: string }[]): Promise<void> {
    await db.runAsync('DELETE FROM package_files WHERE package_id = ?', [packageId]);
    for (const f of files) {
      await db.runAsync('INSERT INTO package_files (package_id, rel_path, bytes, sha256) VALUES (?,?,?,?)', [packageId, f.relPath, f.bytes, f.sha256]);
    }
  },
  async files(db: SqlDatabase, packageId: string): Promise<{ relPath: string; bytes: number; sha256: string }[]> {
    return db.getAllAsync('SELECT rel_path AS relPath, bytes, sha256 FROM package_files WHERE package_id = ? ORDER BY rel_path', [packageId]);
  },
  async totalInstalledBytes(db: SqlDatabase): Promise<number> {
    const r = await db.getFirstAsync<{ n: number | null }>("SELECT SUM(bytes_total) AS n FROM packages WHERE status = 'installed'");
    return r?.n ?? 0;
  },
};

// ─── Learning progress ────────────────────────────────────────────────────────
export const learningRepo = {
  async set(db: SqlDatabase, packageId: string, itemId: string, status: 'started' | 'completed', position = 0): Promise<void> {
    await db.runAsync(
      `INSERT INTO learning_progress (package_id, item_id, status, position, updated_at) VALUES (?,?,?,?,?)
       ON CONFLICT(package_id, item_id) DO UPDATE SET status = excluded.status, position = excluded.position, updated_at = excluded.updated_at`,
      [packageId, itemId, status, position, nowIso()],
    );
  },
  async forPackage(db: SqlDatabase, packageId: string): Promise<Record<string, 'started' | 'completed'>> {
    const rows = await db.getAllAsync<{ item_id: string; status: 'started' | 'completed' }>(
      'SELECT item_id, status FROM learning_progress WHERE package_id = ?',
      [packageId],
    );
    return Object.fromEntries(rows.map((r) => [r.item_id, r.status]));
  },
};

// ─── Hadith bookmarks ─────────────────────────────────────────────────────────
export const hadithBookmarksRepo = {
  async list(db: SqlDatabase): Promise<{ book: string; number: number }[]> {
    return db.getAllAsync('SELECT book, number FROM hadith_bookmarks ORDER BY created_at DESC');
  },
  async keys(db: SqlDatabase): Promise<Set<string>> {
    const rows = await hadithBookmarksRepo.list(db);
    return new Set(rows.map((r) => `${r.book}:${r.number}`));
  },
  async toggle(db: SqlDatabase, book: string, number: number): Promise<boolean> {
    const r = await db.runAsync('DELETE FROM hadith_bookmarks WHERE book = ? AND number = ?', [book, number]);
    if (r.changes > 0) return false;
    await db.runAsync('INSERT INTO hadith_bookmarks (book, number, created_at) VALUES (?,?,?)', [book, number, nowIso()]);
    return true;
  },
};

// ─── Qada (make-up) counters ──────────────────────────────────────────────────
export type QadaKind = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'fast';
export const QADA_KINDS: readonly QadaKind[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'fast'];

export const qadaRepo = {
  async all(db: SqlDatabase): Promise<Record<QadaKind, number>> {
    const rows = await db.getAllAsync<{ kind: QadaKind; remaining: number }>('SELECT kind, remaining FROM qada');
    const out = Object.fromEntries(QADA_KINDS.map((k) => [k, 0])) as Record<QadaKind, number>;
    for (const r of rows) out[r.kind] = r.remaining;
    return out;
  },
  async adjust(db: SqlDatabase, kind: QadaKind, delta: number): Promise<number> {
    await db.runAsync(
      `INSERT INTO qada (kind, remaining, updated_at) VALUES (?, MAX(0, ?), ?)
       ON CONFLICT(kind) DO UPDATE SET remaining = MAX(0, remaining + ?), updated_at = excluded.updated_at`,
      [kind, delta, nowIso(), delta],
    );
    const r = await db.getFirstAsync<{ remaining: number }>('SELECT remaining FROM qada WHERE kind = ?', [kind]);
    return r?.remaining ?? 0;
  },
};

// ─── Khatma log ───────────────────────────────────────────────────────────────
export const khatmaRepo = {
  async doneDays(db: SqlDatabase): Promise<Set<number>> {
    const rows = await db.getAllAsync<{ day: number }>('SELECT day FROM khatma_log');
    return new Set(rows.map((r) => r.day));
  },
  async toggle(db: SqlDatabase, day: number): Promise<boolean> {
    const r = await db.runAsync('DELETE FROM khatma_log WHERE day = ?', [day]);
    if (r.changes > 0) return false;
    await db.runAsync('INSERT INTO khatma_log (day, done_at) VALUES (?, ?)', [day, nowIso()]);
    return true;
  },
  async reset(db: SqlDatabase): Promise<void> {
    await db.runAsync('DELETE FROM khatma_log');
  },
};

// ─── Custom adhan (the user's own audio files) ────────────────────────────────
export interface CustomAdhanRow {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly bytes: number;
  readonly createdAt: string;
}

export const customAdhanRepo = {
  async list(db: SqlDatabase): Promise<CustomAdhanRow[]> {
    return db.getAllAsync<CustomAdhanRow>('SELECT id, name, file, bytes, created_at AS createdAt FROM custom_adhan ORDER BY created_at DESC');
  },
  async add(db: SqlDatabase, row: Omit<CustomAdhanRow, 'createdAt'>): Promise<void> {
    await db.runAsync('INSERT OR REPLACE INTO custom_adhan (id, name, file, bytes, created_at) VALUES (?,?,?,?,?)', [
      row.id,
      row.name,
      row.file,
      row.bytes,
      nowIso(),
    ]);
  },
  async remove(db: SqlDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM custom_adhan WHERE id = ?', [id]);
  },
};
