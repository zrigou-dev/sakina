import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SqlDatabase, SqlParams } from '@/database/types';
import type { SeedDeps } from '@/services/quran/seed';

/** Real SQLite (better-sqlite3) behind SAKINA's async SqlDatabase interface. */
export function openTestDb(path = ':memory:'): SqlDatabase & { raw: Database.Database; close(): void } {
  const raw = new Database(path);
  raw.pragma('foreign_keys = ON');
  const bind = (params?: SqlParams) => (params ?? []).map((p) => (p instanceof Uint8Array ? Buffer.from(p) : p));
  let depth = 0;
  const db = {
    raw,
    close: () => raw.close(),
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, params?: SqlParams) {
      const r = raw.prepare(source).run(...bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async getAllAsync<T>(source: string, params?: SqlParams) {
      return raw.prepare(source).all(...bind(params)) as T[];
    },
    async getFirstAsync<T>(source: string, params?: SqlParams) {
      const stmt = raw.prepare(source);
      const row = stmt.reader ? stmt.get(...bind(params)) : (stmt.run(...bind(params)), undefined);
      return (row as T | undefined) ?? null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      const sp = `sp_${depth++}`;
      raw.exec(depth === 1 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      try {
        await task();
        raw.exec(depth === 1 ? 'COMMIT' : `RELEASE ${sp}`);
      } catch (e) {
        raw.exec(depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${sp}`);
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return db;
}

const ROOT = join(__dirname, '..', '..');

/** Seed dependencies reading the real bundled Tanzil files from disk. */
export const nodeSeedDeps: SeedDeps = {
  async readText(file) {
    return readFileSync(join(ROOT, 'assets', 'content', file), 'utf8');
  },
  async sha256(text) {
    return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
  },
};
