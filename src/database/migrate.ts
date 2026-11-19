import { DatabaseError, type SqlDatabase } from './types';

export interface Migration {
  /** Monotonic, starting at 1. Stored in PRAGMA user_version. */
  readonly version: number;
  readonly name: string;
  readonly up: string;
}

/**
 * Applies pending migrations in order, each in its own transaction.
 * Idempotent: running twice is a no-op. Refuses to open a database whose
 * version is newer than the app understands (prevents silent data loss after a downgrade).
 */
export async function migrate(db: SqlDatabase, migrations: readonly Migration[]): Promise<number> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  sorted.forEach((m, i) => {
    if (m.version !== i + 1) throw new DatabaseError(`Migration versions must be contiguous from 1 (got ${m.version} at ${i})`);
  });

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const latest = sorted.length;
  if (current > latest) {
    throw new DatabaseError(`Database version ${current} is newer than this app supports (${latest}).`);
  }

  for (const m of sorted) {
    if (m.version <= current) continue;
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(m.up);
        // PRAGMA cannot be parameterised; version is a trusted integer.
        await db.execAsync(`PRAGMA user_version = ${Math.trunc(m.version)}`);
      });
    } catch (e) {
      throw new DatabaseError(`Migration ${m.version} (${m.name}) failed`, e);
    }
  }
  return latest;
}
