import { migrate } from '@/database/migrate';
import { DatabaseError } from '@/database/types';
import { USER_MIGRATIONS } from '@/database/user/migrations';
import {
  bookmarksRepo,
  dhikrRepo,
  goalsRepo,
  hadithBookmarksRepo,
  hajjRepo,
  khatmaRepo,
  learningRepo,
  logsRepo,
  memorizationRepo,
  notesRepo,
  packagesRepo,
  qadaRepo,
  readingRepo,
  settingsRepo,
  tasbihRepo,
} from '@/database/repositories/user';
import { BackupError, deleteAllUserData, exportUserData, importUserData, parseBackup, settingsFromBackup } from '@/services/backup/backup';
import { NEW_REVIEW_STATE } from '@/services/memorization/scheduler';
import { sanitizeSettings } from '@/state/settings';

import { openTestDb } from '../helpers/sqlite';

async function freshDb() {
  const db = openTestDb();
  await migrate(db, USER_MIGRATIONS);
  return db;
}

describe('migrations', () => {
  it('applies from scratch, is idempotent, and records the version', async () => {
    const db = openTestDb();
    expect(await migrate(db, USER_MIGRATIONS)).toBe(USER_MIGRATIONS.length);
    expect(await migrate(db, USER_MIGRATIONS)).toBe(USER_MIGRATIONS.length);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(USER_MIGRATIONS.length);
  });

  it('refuses a database from a newer app version', async () => {
    const db = openTestDb();
    await db.execAsync('PRAGMA user_version = 99');
    await expect(migrate(db, USER_MIGRATIONS)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('rolls back a failing migration completely', async () => {
    const db = openTestDb();
    await migrate(db, USER_MIGRATIONS);
    const broken = [...USER_MIGRATIONS, { version: USER_MIGRATIONS.length + 1, name: 'broken', up: 'CREATE TABLE ok_table (x INTEGER); THIS IS NOT SQL;' }];
    await expect(migrate(db, broken)).rejects.toBeInstanceOf(DatabaseError);
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'ok_table'")).toBeNull();
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(USER_MIGRATIONS.length);
  });

  it('enforces constraints (bad surah, bad status, duplicates)', async () => {
    const db = await freshDb();
    await expect(db.runAsync("INSERT INTO bookmarks (surah, ayah, created_at) VALUES (115, 1, 'x')")).rejects.toThrow();
    await expect(db.runAsync("INSERT INTO prayer_log (date, prayer, status) VALUES ('2026-01-01', 'fajr', 'whenever')")).rejects.toThrow();
    await db.runAsync("INSERT INTO bookmarks (surah, ayah, created_at) VALUES (2, 255, 'x')");
    await expect(db.runAsync("INSERT INTO bookmarks (surah, ayah, created_at) VALUES (2, 255, 'y')")).rejects.toThrow();
  });
});

describe('repositories', () => {
  it('settings persist JSON and tolerate corrupt rows', async () => {
    const db = await freshDb();
    await settingsRepo.setMany(db, { language: 'en', prayer: { method: 'egyptian' } });
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('broken', '{not json')");
    const raw = await settingsRepo.getAll(db);
    expect(raw).toMatchObject({ language: 'en', prayer: { method: 'egyptian' } });
    expect(raw.broken).toBeUndefined();
    expect(sanitizeSettings(raw).prayer.method).toBe('egyptian');
  });

  it('bookmarks toggle, note, list, remove', async () => {
    const db = await freshDb();
    expect(await bookmarksRepo.toggle(db, 2, 255)).toBe(true);
    expect(await bookmarksRepo.toggle(db, 36, 1)).toBe(true);
    expect(await bookmarksRepo.forSurah(db, 2)).toEqual([255]);
    const [first] = await bookmarksRepo.list(db);
    await bookmarksRepo.setNote(db, first!.id, '  note  ');
    expect((await bookmarksRepo.list(db)).find((b) => b.id === first!.id)?.note).toBe('note');
    expect(await bookmarksRepo.toggle(db, 2, 255)).toBe(false);
    expect(await bookmarksRepo.forSurah(db, 2)).toEqual([]);
  });

  it('reading position and daily log accumulate', async () => {
    const db = await freshDb();
    await readingRepo.setPosition(db, 18, 10);
    await readingRepo.setPosition(db, 18, 11);
    expect(await readingRepo.getPosition(db)).toMatchObject({ surah: 18, ayah: 11 });
    const day = new Date(2026, 10, 18);
    await readingRepo.addAyahsRead(db, 5, day);
    await readingRepo.addAyahsRead(db, 3, day);
    await readingRepo.addAyahsRead(db, 0, day);
    expect(await readingRepo.ayahsReadOn(db, day)).toBe(8);
    expect(await readingRepo.history(db, 7, day)).toEqual([{ date: '2026-11-18', ayahs: 8 }]);
  });

  it('memorisation upsert, due queue, stats', async () => {
    const db = await freshDb();
    await memorizationRepo.upsert(db, { surah: 112, ayah: 1, status: 'learning', ...NEW_REVIEW_STATE, dueDate: '2026-11-18' });
    await memorizationRepo.upsert(db, { surah: 112, ayah: 2, status: 'memorized', ...NEW_REVIEW_STATE, dueDate: '2026-12-30' });
    const due = await memorizationRepo.due(db, new Date(2026, 10, 18));
    expect(due.map((d) => d.ayah)).toEqual([1]);
    expect(await memorizationRepo.stats(db, new Date(2026, 10, 18))).toEqual({ memorized: 1, learning: 1, due: 1 });
    await memorizationRepo.remove(db, 112, 1);
    expect(await memorizationRepo.forSurah(db, 112)).toHaveLength(1);
  });

  it('prayer & fasting logs', async () => {
    const db = await freshDb();
    const d = new Date(2026, 10, 18);
    await logsRepo.setPrayer(db, d, 'fajr', 'on_time');
    await logsRepo.setPrayer(db, d, 'fajr', 'late');
    await logsRepo.setPrayer(db, d, 'isha', 'missed');
    expect(await logsRepo.prayersOn(db, d)).toEqual({ fajr: 'late', isha: 'missed' });
    expect(await logsRepo.prayerHistory(db, d)).toEqual([{ date: '2026-11-18', done: 1 }]);
    await logsRepo.setPrayer(db, d, 'isha', null);
    expect(await logsRepo.prayersOn(db, d)).toEqual({ fajr: 'late' });
    await logsRepo.setFast(db, d, 'voluntary', 'Monday');
    await logsRepo.setFast(db, new Date(2026, 10, 19), 'missed');
    expect(await logsRepo.fastingSummary(db)).toEqual({ ramadan: 0, voluntary: 1, makeup: 0, missed: 1 });
    await logsRepo.setFast(db, d, null);
    expect(await logsRepo.fastsBetween(db, d, new Date(2026, 10, 30))).toHaveLength(1);
  });

  it('dhikr counts, favourites, tasbih, notes, goals, hajj, learning, packages', async () => {
    const db = await freshDb();
    const d = new Date(2026, 10, 18);
    await dhikrRepo.setCount(db, d, 'k', 2);
    await dhikrRepo.setCount(db, d, 'k', -4);
    expect(await dhikrRepo.countsOn(db, d)).toEqual({ k: 0 });
    expect(await dhikrRepo.toggleFavorite(db, 'q:2:255-255')).toBe(true);
    expect(await dhikrRepo.favorites(db)).toEqual(['q:2:255-255']);
    expect(await dhikrRepo.toggleFavorite(db, 'q:2:255-255')).toBe(false);

    const tid = await tasbihRepo.create(db, ' default ', 33);
    await tasbihRepo.setCount(db, tid, 12);
    expect(await tasbihRepo.list(db)).toEqual([{ id: tid, label: 'default', count: 12, target: 33 }]);

    const nid = await notesRepo.save(db, { title: 'T', body: 'B' });
    await notesRepo.save(db, { id: nid, title: 'T2', body: 'B2' });
    expect((await notesRepo.list(db))[0]).toMatchObject({ id: nid, title: 'T2', body: 'B2' });

    await goalsRepo.upsert(db, { id: 'quran', kind: 'quran_ayahs', target: 10, active: true });
    expect(await goalsRepo.list(db)).toEqual([{ id: 'quran', kind: 'quran_ayahs', target: 10, active: true }]);

    expect(await hajjRepo.toggle(db, 'umrah', 'ihram')).toBe(true);
    expect(await hajjRepo.done(db, 'umrah')).toEqual(['ihram']);
    await hajjRepo.reset(db, 'umrah');
    expect(await hajjRepo.done(db, 'umrah')).toEqual([]);

    await learningRepo.set(db, 'p', 'i', 'started');
    await learningRepo.set(db, 'p', 'i', 'completed');
    expect(await learningRepo.forPackage(db, 'p')).toEqual({ i: 'completed' });

    await packagesRepo.upsert(db, {
      id: 'x',
      kind: 'translation',
      version: '1',
      status: 'installed',
      bytesTotal: 100,
      bytesDone: 100,
      sha256: 'abc',
      error: null,
      resumeState: null,
      installedAt: '2026-01-01',
    });
    await packagesRepo.setFiles(db, 'x', [{ relPath: '1.mp3', bytes: 100, sha256: 'h' }]);
    expect(await packagesRepo.totalInstalledBytes(db)).toBe(100);
    expect(await packagesRepo.files(db, 'x')).toHaveLength(1);
    await packagesRepo.remove(db, 'x');
    expect(await packagesRepo.files(db, 'x')).toHaveLength(0); // ON DELETE CASCADE
  });
});

describe('backup export → wipe → import', () => {
  it('round-trips all user data exactly', async () => {
    const db = await freshDb();
    await settingsRepo.setMany(db, { language: 'fr', displayName: 'Amina' });
    await bookmarksRepo.toggle(db, 2, 255);
    await readingRepo.setPosition(db, 2, 260);
    await logsRepo.setFast(db, new Date(2026, 2, 1), 'ramadan');
    await notesRepo.save(db, { title: 'شكر', body: 'الحمد لله' });
    await memorizationRepo.upsert(db, { surah: 1, ayah: 1, status: 'learning', ...NEW_REVIEW_STATE, dueDate: '2026-11-18' });

    const backup = await exportUserData(db, new Date('2026-11-18T10:00:00Z'));
    const json = JSON.stringify(backup);
    await deleteAllUserData(db);
    expect(await bookmarksRepo.list(db)).toEqual([]);
    expect(await readingRepo.getPosition(db)).toBeNull();

    const parsed = parseBackup(json);
    await importUserData(db, parsed);
    expect(await exportUserData(db, new Date('2026-11-18T10:00:00Z'))).toEqual(backup);
    expect(settingsFromBackup(parsed)).toMatchObject({ language: 'fr', displayName: 'Amina' });
  });

  it.each([
    ['not JSON', '{oops'],
    ['wrong app', JSON.stringify({ app: 'other', format: 1, tables: {} })],
    ['unknown table', JSON.stringify({ app: 'sakina', format: 1, tables: { secrets: [] } })],
    ['wrong column type', JSON.stringify({ app: 'sakina', format: 1, tables: { bookmarks: [{ surah: 'two', ayah: 1, note: null, created_at: 'x' }] } })],
    ['missing column', JSON.stringify({ app: 'sakina', format: 1, tables: { reading_log: [{ date: '2026-01-01' }] } })],
    ['bad settings json', JSON.stringify({ app: 'sakina', format: 1, tables: { settings: [{ key: 'language', value: '{bad' }] } })],
  ])('rejects %s without touching the database', async (_name, raw) => {
    const db = await freshDb();
    await bookmarksRepo.toggle(db, 1, 1);
    expect(() => parseBackup(raw)).toThrow(BackupError);
    expect(await bookmarksRepo.list(db)).toHaveLength(1);
  });

  it('a constraint violation during import rolls everything back', async () => {
    const db = await freshDb();
    await bookmarksRepo.toggle(db, 1, 1);
    const bad = parseBackup(JSON.stringify({ app: 'sakina', format: 1, tables: { bookmarks: [{ surah: 999, ayah: 1, note: null, created_at: 'x' }] } }));
    await expect(importUserData(db, bad)).rejects.toThrow();
    expect(await bookmarksRepo.forSurah(db, 1)).toEqual([1]);
  });
});

describe('hadith bookmarks, qada and khatma', () => {
  it('toggles hadith bookmarks, including fractional hadith numbers', async () => {
    const db = await freshDb();
    expect(await hadithBookmarksRepo.toggle(db, 'bukhari', 1)).toBe(true);
    expect(await hadithBookmarksRepo.toggle(db, 'muslim', 2.1)).toBe(true);
    expect(await hadithBookmarksRepo.keys(db)).toEqual(new Set(['bukhari:1', 'muslim:2.1']));
    expect(await hadithBookmarksRepo.toggle(db, 'bukhari', 1)).toBe(false);
    expect(await hadithBookmarksRepo.keys(db)).toEqual(new Set(['muslim:2.1']));
  });

  it('adjusts qada counters and never goes below zero', async () => {
    const db = await freshDb();
    expect(await qadaRepo.adjust(db, 'fajr', 10)).toBe(10);
    expect(await qadaRepo.adjust(db, 'fajr', -3)).toBe(7);
    expect(await qadaRepo.adjust(db, 'fajr', -50)).toBe(0);
    expect(await qadaRepo.adjust(db, 'fast', -5)).toBe(0);
    expect(await qadaRepo.adjust(db, 'isha', 2)).toBe(2);
    expect(await qadaRepo.all(db)).toEqual({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 2, fast: 0 });
  });

  it('logs khatma days, toggles and resets', async () => {
    const db = await freshDb();
    expect(await khatmaRepo.toggle(db, 1)).toBe(true);
    expect(await khatmaRepo.toggle(db, 2)).toBe(true);
    expect(await khatmaRepo.toggle(db, 1)).toBe(false);
    expect(await khatmaRepo.doneDays(db)).toEqual(new Set([2]));
    await khatmaRepo.reset(db);
    expect((await khatmaRepo.doneDays(db)).size).toBe(0);
  });

  it('includes the new tables in backup round-trips and full deletion', async () => {
    const db = await freshDb();
    await hadithBookmarksRepo.toggle(db, 'nawawi', 7);
    await qadaRepo.adjust(db, 'asr', 4);
    await khatmaRepo.toggle(db, 3);
    const backup = await exportUserData(db);
    const other = await freshDb();
    await importUserData(other, parseBackup(JSON.stringify(backup)));
    expect(await hadithBookmarksRepo.keys(other)).toEqual(new Set(['nawawi:7']));
    expect((await qadaRepo.all(other)).asr).toBe(4);
    expect(await khatmaRepo.doneDays(other)).toEqual(new Set([3]));
    await deleteAllUserData(other);
    expect((await hadithBookmarksRepo.keys(other)).size).toBe(0);
    expect((await qadaRepo.all(other)).asr).toBe(0);
  });
});
