import { quranRepo, translationRepo } from '@/database/repositories/content';
import { ContentIntegrityError, isQuranSeeded, seedQuran } from '@/services/quran/seed';
import { validateAlQuranCloudEdition } from '@/services/downloads/validators';
import { SURAHS } from '@/services/quran/navigation';
import { parseTanzilXml } from '@/services/quran/parse';

import { nodeSeedDeps, openTestDb } from '../helpers/sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Expected text is read from the verbatim source file — never typed by hand.
const SOURCE = parseTanzilXml(readFileSync(join(__dirname, '..', '..', 'assets', 'content', 'quran-uthmani.xml'), 'utf8'));
const sourceVerse = (surah: number, ayah: number) => {
  const v = SOURCE.find((x) => x.surah === surah && x.ayah === ayah);
  if (!v) throw new Error(`missing ${surah}:${ayah}`);
  return v.text;
};
const sourceBismillah = (surah: number) => SOURCE.find((x) => x.surah === surah && x.ayah === 1)?.bismillah ?? null;

describe('Quran content database (real Tanzil files, real SQLite)', () => {
  const db = openTestDb();
  let ftsEnabled = false;

  beforeAll(async () => {
    const r = await seedQuran(db, nodeSeedDeps);
    ftsEnabled = r.fts;
    expect(r.seeded).toBe(true);
  }, 60_000);

  afterAll(() => db.close());

  it('seeds exactly 6236 ayahs and marks the DB as seeded', async () => {
    expect(await quranRepo.count(db)).toBe(6236);
    expect(await isQuranSeeded(db)).toBe(true);
  });

  it('is idempotent: a second seed is a no-op', async () => {
    const r = await seedQuran(db, nodeSeedDeps);
    expect(r.seeded).toBe(false);
    expect(await quranRepo.count(db)).toBe(6236);
  });

  it('stores verbatim Uthmani text with page/juz/hizb metadata', async () => {
    const fatiha1 = await quranRepo.ayah(db, 1, 1);
    expect(fatiha1?.text).toBe(sourceVerse(1, 1));
    expect((await quranRepo.ayah(db, 2, 255))?.text).toBe(sourceVerse(2, 255));
    expect((await quranRepo.ayah(db, 114, 6))?.text).toBe(sourceVerse(114, 6));
    expect(fatiha1).toMatchObject({ id: 1, page: 1, juz: 1, hizbQuarter: 1 });
    const baqarah = await quranRepo.surahAyahs(db, 2);
    expect(baqarah).toHaveLength(286);
    expect(baqarah[0]).toMatchObject({ page: 2, juz: 1 });
    // Juz 30 starts at An-Naba 78:1, last page is 604.
    const naba = await quranRepo.ayah(db, 78, 1);
    expect(naba?.juz).toBe(30);
    const nas = await quranRepo.ayah(db, 114, 6);
    expect(nas).toMatchObject({ id: 6236, page: 604, juz: 30, hizbQuarter: 240 });
  });

  it('keeps the Basmala separate from ayah 1 (Tanzil XML), absent for Al-Fatiha and At-Tawbah', async () => {
    expect(await quranRepo.bismillah(db, 1)).toBeNull();
    expect(await quranRepo.bismillah(db, 9)).toBeNull();
    expect(await quranRepo.bismillah(db, 36)).toBe(sourceBismillah(36));
    expect(await quranRepo.bismillah(db, 95)).toBe(sourceBismillah(95));
    const yaSin1 = await quranRepo.ayah(db, 36, 1);
    expect(yaSin1?.text).toBe(sourceVerse(36, 1));
    expect(yaSin1?.text.startsWith(sourceBismillah(36)!)).toBe(false);
    const rows = await db.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ayah WHERE bismillah IS NOT NULL');
    expect(rows[0]!.n).toBe(112);
  });

  it('has every surah with the right ayah count', async () => {
    const rows = await db.getAllAsync<{ surah: number; n: number }>('SELECT surah, COUNT(*) AS n FROM ayah GROUP BY surah ORDER BY surah');
    expect(rows.map((r) => r.n)).toEqual(SURAHS.map((s) => s.ayahCount));
  });

  it('finds ayahs by everyday Arabic spelling (with and without diacritics, alef variants)', async () => {
    const hits = await quranRepo.search(db, 'رب العالمين');
    expect(hits.length).toBeGreaterThan(20);
    expect(hits[0]).toMatchObject({ surah: 1, ayah: 2, source: 'quran' });
    // Uthmani spelling is returned for display even though the index is Simple-Clean.
    expect(hits[0]!.text).toBe(sourceVerse(1, 2));

    const withHarakat = await quranRepo.search(db, 'الْحَمْدُ لِلَّهِ');
    expect(withHarakat.some((h) => h.surah === 1 && h.ayah === 2)).toBe(true);

    const kursi = await quranRepo.search(db, 'الله لا إله إلا هو الحي القيوم');
    expect(kursi.map((h) => `${h.surah}:${h.ayah}`)).toEqual(expect.arrayContaining(['2:255', '3:2']));
  });

  it('returns nothing for empty or too-short queries and does not throw on FTS operators', async () => {
    expect(await quranRepo.search(db, '')).toEqual([]);
    expect(await quranRepo.search(db, 'ا')).toEqual([]);
    await expect(quranRepo.search(db, 'الله" OR "*')).resolves.toBeDefined();
  });

  it(`reports FTS5 availability (${process.platform})`, () => {
    expect(typeof ftsEnabled).toBe('boolean');
  });

  it('refuses to seed when the bundled text has been altered', async () => {
    const tampered = openTestDb();
    await expect(
      seedQuran(tampered, {
        ...nodeSeedDeps,
        // Drop a single character from one verse.
        readText: async (f) => (await nodeSeedDeps.readText(f)).replace('text="الٓمٓ"', 'text="الٓم"'),
      }),
    ).rejects.toBeInstanceOf(ContentIntegrityError);
    expect(await quranRepo.count(tampered)).toBe(0);
    tampered.close();
  });

  it('installs a validated translation package and searches it', async () => {
    const payload = {
      code: 200,
      data: {
        edition: { identifier: 'en.test' },
        surahs: SURAHS.map((s) => ({
          number: s.number,
          ayahs: Array.from({ length: s.ayahCount }, (_, i) => ({ number: s.startIndex + i + 1, text: `Test rendering of ${s.number}:${i + 1} mercy` })),
        })),
      },
    };
    const ayahs = validateAlQuranCloudEdition(payload, 'en.test');
    await translationRepo.install(
      db,
      { id: 'en.test', kind: 'translation', language: 'en', name: 'Test', author: 'Test', source: 'fixture', license: 'test' },
      ayahs,
    );
    const map = await translationRepo.forRange(db, 'en.test', 1, 7);
    expect(Object.keys(map)).toHaveLength(7);
    expect(map[1]).toBe('Test rendering of 1:1 mercy');
    const hits = await quranRepo.search(db, 'rendering 2:255');
    expect(hits.some((h) => h.surah === 2 && h.ayah === 255 && h.source === 'translation')).toBe(true);
    await translationRepo.remove(db, 'en.test');
    expect(await translationRepo.editions(db)).toEqual([]);
  });
});
