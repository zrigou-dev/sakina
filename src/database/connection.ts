import * as SQLite from 'expo-sqlite';

import { ensureContentSchema } from './content/schema';
import { migrate } from './migrate';
import type { SqlDatabase, SqlParams } from './types';
import { USER_MIGRATIONS } from './user/migrations';

export const USER_DB_NAME = 'sakina-user.db';
export const CONTENT_DB_NAME = 'sakina-content.db';

export interface Databases {
  readonly user: SqlDatabase;
  readonly content: SqlDatabase;
}

async function configure(db: SQLite.SQLiteDatabase): Promise<void> {
  if (process.env.EXPO_OS !== 'web') {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

const bind = (p?: SqlParams) => (p ?? []) as SQLite.SQLiteBindValue[];

/**
 * One queue for every transaction in the app, across both databases.
 * SQLite cannot BEGIN inside an open transaction, and concurrent UI actions (two quick
 * settings changes) would otherwise collide. On web, expo-sqlite's worker was observed to
 * reject a user-DB BEGIN while the content-DB seeding transaction was open
 * ("cannot start a transaction within a transaction"), so the queue is shared, not per
 * connection. Repository transactions never nest (by convention), so this cannot deadlock.
 */
let tail: Promise<unknown> = Promise.resolve();

/** Adapts expo-sqlite's overloaded API to SAKINA's minimal SqlDatabase interface. */
export function adapt(db: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, bind(params)),
    getAllAsync: <T>(source: string, params?: SqlParams) => db.getAllAsync<T>(source, bind(params)),
    getFirstAsync: <T>(source: string, params?: SqlParams) => db.getFirstAsync<T>(source, bind(params)),
    withTransactionAsync: (task) => {
      const run = tail.then(() => db.withTransactionAsync(task));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

let opening: Promise<Databases> | null = null;

/**
 * Opens both databases once per JS runtime (shared by every caller, including React's
 * development double-invoked effects), applies user migrations and ensures the content schema.
 */
export function openDatabases(): Promise<Databases> {
  if (!opening) {
    opening = openDatabasesOnce().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

async function openDatabasesOnce(): Promise<Databases> {
  const [userDb, contentDb] = await Promise.all([SQLite.openDatabaseAsync(USER_DB_NAME), SQLite.openDatabaseAsync(CONTENT_DB_NAME)]);
  await Promise.all([configure(userDb), configure(contentDb)]);
  const user = adapt(userDb);
  const content = adapt(contentDb);
  await migrate(user, USER_MIGRATIONS);
  await ensureContentSchema(content);
  return { user, content };
}
