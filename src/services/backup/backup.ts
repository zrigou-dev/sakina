import type { SqlDatabase, SqlValue } from '@/database/types';
import { sanitizeSettings } from '@/state/settings';

/**
 * Manual, user-controlled backup of the USER database only (content is re-downloadable).
 * Import is validated column-by-column and applied in one transaction: a bad file can
 * never leave the database half-restored.
 */
export const BACKUP_FORMAT = 1;
export const BACKUP_APP = 'sakina';

type ColumnType = 'text' | 'int' | 'real' | 'text?' | 'int?';

/** Exported tables and their columns. `packages` is excluded: files are not in the backup. */
export const BACKUP_TABLES: Record<string, Record<string, ColumnType>> = {
  settings: { key: 'text', value: 'text' },
  bookmarks: { surah: 'int', ayah: 'int', note: 'text?', created_at: 'text' },
  reading_position: { id: 'int', surah: 'int', ayah: 'int', updated_at: 'text' },
  reading_log: { date: 'text', ayahs_read: 'int' },
  memorization: { surah: 'int', ayah: 'int', status: 'text', ease: 'real', interval_days: 'int', repetitions: 'int', due_date: 'text', reviewed_at: 'text?' },
  prayer_log: { date: 'text', prayer: 'text', status: 'text' },
  fasting_log: { date: 'text', kind: 'text', note: 'text?' },
  goals: { id: 'text', kind: 'text', target: 'int', active: 'int' },
  goal_progress: { goal_id: 'text', date: 'text', value: 'int' },
  dhikr_progress: { date: 'text', item_id: 'text', count: 'int' },
  dhikr_favorites: { item_id: 'text', created_at: 'text' },
  tasbih: { label: 'text', count: 'int', target: 'int?', updated_at: 'text' },
  notes: { title: 'text', body: 'text', ref: 'text?', created_at: 'text', updated_at: 'text' },
  hajj_progress: { journey: 'text', step_id: 'text', done_at: 'text' },
  learning_progress: { package_id: 'text', item_id: 'text', status: 'text', position: 'real', updated_at: 'text' },
  hadith_bookmarks: { book: 'text', number: 'real', created_at: 'text' },
  qada: { kind: 'text', remaining: 'int', updated_at: 'text' },
  khatma_log: { day: 'int', done_at: 'text' },
};

/** Tables cleared by "delete all my data" (user DB). */
export const USER_TABLES = [...Object.keys(BACKUP_TABLES), 'package_files', 'packages', 'memorization_plan', 'custom_adhan'] as const;

export interface Backup {
  readonly app: typeof BACKUP_APP;
  readonly format: number;
  readonly exportedAt: string;
  readonly tables: Record<string, Record<string, SqlValue>[]>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export async function exportUserData(db: SqlDatabase, now = new Date()): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const [table, cols] of Object.entries(BACKUP_TABLES)) {
    tables[table] = await db.getAllAsync<Record<string, SqlValue>>(`SELECT ${Object.keys(cols).join(', ')} FROM ${table}`);
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), tables };
}

const MAX_ROWS = 200_000;
const MAX_TEXT = 20_000;

function checkValue(v: unknown, type: ColumnType): SqlValue {
  const optional = type.endsWith('?');
  if (v === null || v === undefined) {
    if (optional) return null;
    throw new BackupError('missing value');
  }
  const base = type.replace('?', '');
  if (base === 'text') {
    if (typeof v !== 'string' || v.length > MAX_TEXT) throw new BackupError('bad text');
    return v;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new BackupError('bad number');
  if (base === 'int' && !Number.isInteger(v)) throw new BackupError('bad integer');
  return v;
}

/** Parses and validates untrusted backup JSON. Throws BackupError on any problem. */
export function parseBackup(raw: string): Backup {
  if (raw.length > 50 * 1024 * 1024) throw new BackupError('file too large');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new BackupError('not JSON');
  }
  const b = json as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP || b.format !== BACKUP_FORMAT || typeof b.tables !== 'object' || b.tables === null)
    throw new BackupError('not a SAKINA backup');
  const tables: Backup['tables'] = {};
  let total = 0;
  for (const [table, rows] of Object.entries(b.tables)) {
    const cols = BACKUP_TABLES[table];
    if (!cols) throw new BackupError(`unknown table ${table}`);
    if (!Array.isArray(rows)) throw new BackupError(`bad rows in ${table}`);
    total += rows.length;
    if (total > MAX_ROWS) throw new BackupError('too many rows');
    tables[table] = rows.map((row: unknown) => {
      if (!row || typeof row !== 'object') throw new BackupError('bad row');
      const out: Record<string, SqlValue> = {};
      for (const [col, type] of Object.entries(cols)) out[col] = checkValue((row as Record<string, unknown>)[col], type);
      return out;
    });
  }
  // Settings values must be valid JSON; their content is re-sanitised on load.
  for (const r of tables.settings ?? []) {
    try {
      JSON.parse(String(r.value));
    } catch {
      throw new BackupError('bad settings value');
    }
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '', tables };
}

/** Replaces user data with the backup atomically. */
export async function importUserData(db: SqlDatabase, backup: Backup): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of Object.keys(BACKUP_TABLES)) await db.runAsync(`DELETE FROM ${table}`);
    for (const [table, rows] of Object.entries(backup.tables)) {
      const cols = Object.keys(BACKUP_TABLES[table]!);
      for (const row of rows) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] ?? null),
        );
      }
    }
  });
}

/** Erases all user data rows. */
export async function deleteAllUserData(db: SqlDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of USER_TABLES) await db.runAsync(`DELETE FROM ${table}`);
  });
}

/** Settings as stored, sanitised (used after import to refresh the in-memory store). */
export function settingsFromBackup(backup: Backup) {
  const raw: Record<string, unknown> = {};
  for (const r of backup.tables.settings ?? []) raw[String(r.key)] = JSON.parse(String(r.value));
  return sanitizeSettings(raw);
}
