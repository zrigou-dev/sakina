/**
 * The minimal async SQL surface SAKINA relies on.
 *
 * `expo-sqlite`'s `SQLiteDatabase` satisfies this structurally, and tests supply a
 * `better-sqlite3` adapter, so migrations and repositories run against real SQLite
 * in Node as well as on device.
 */
export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = readonly SqlValue[];

export interface SqlRunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SqlParams): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
