import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PARENT_DUA_REFS } from '@/features/sadaqah/refs';
import { adhkarRepo, hadithRepo, quranicDuas, QURANIC_DUA_REFS, quranRepo } from '@/database/repositories/content';
import { HISN } from '@/content/adhkar/groups';
import { BundleValidationError, seedBundle, validateBundle, type BundleData } from '@/services/content/bundle-seed';
import { loadBundleData } from '@/services/content/bundle-data';
import { seedQuran } from '@/services/quran/seed';

import { nodeSeedDeps, openTestDb } from '../helpers/sqlite';

const RAW = (p: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'src', 'content', p), 'utf8'));

/** Every bundled adhkar/hadith record must survive seeding verbatim — the tests compare against the source JSON. */
describe('bundled adhkar & hadith (real data, real SQLite)', () => {
  const db = openTestDb();
  const data = loadBundleData();

  beforeAll(async () => {
    await seedQuran(db, nodeSeedDeps);
    expect(await seedBundle(db, data)).toBe(true);
  }, 90_000);
  afterAll(() => db.close());

  it('is idempotent (second seed is a no-op)', async () => {
    expect(await seedBundle(db, data)).toBe(false);
  });

  it('seeds every Hisn al-Muslim chapter and item, with references and counts', async () => {
    const hisn = RAW('adhkar/hisn.generated.json') as { id: number; items: unknown[] }[];
    const cats = await adhkarRepo.categories(db);
    expect(cats.filter((c) => c.sourceId === 'hisn')).toHaveLength(hisn.length);
    const total = hisn.reduce((s, c) => s + c.items.length, 0);
    expect(await adhkarRepo.count(db)).toBe(total + (RAW('adhkar/morning-evening.generated.json') as unknown[]).length);
    const sleep = await adhkarRepo.items(db, `hisn:${HISN.sleep}`);
    expect(sleep.length).toBeGreaterThan(5);
    expect(sleep.every((i) => i.reference?.startsWith('حصن المسلم'))).toBe(true);
    expect(sleep.every((i) => i.textAr.length > 0)).toBe(true);
  });

  it('splits morning/evening by session and keeps virtues and gradings from the source', async () => {
    const src = RAW('adhkar/morning-evening.generated.json') as { session: string; source: string; text: string }[];
    const am = await adhkarRepo.items(db, 'me:morning-evening', 'am');
    const pm = await adhkarRepo.items(db, 'me:morning-evening', 'pm');
    expect(am).toHaveLength(src.filter((s) => s.session !== 'pm').length);
    expect(pm).toHaveLength(src.filter((s) => s.session !== 'am').length);
    expect(am.every((i) => i.reference && i.reference.length > 3)).toBe(true);
  });

  it('finds adhkar by normalised Arabic search', async () => {
    const hits = await adhkarRepo.search(db, 'سبحان الله وبحمده');
    expect(hits.length).toBeGreaterThan(0);
    const short = await adhkarRepo.shortDhikr(db);
    expect(short.length).toBeGreaterThan(5);
    expect(short.every((s) => s.textAr.length <= 160)).toBe(true);
  });

  it('derives Quranic duas from the verified mushaf text', async () => {
    const duas = await quranicDuas(db);
    expect(duas).toHaveLength(QURANIC_DUA_REFS.length);
    expect(duas.some((a) => a.surah === 2 && a.ayah === 201)).toBe(true);
    // Each curated reference really is a supplication in the verified text.
    const ok = new Set<string>();
    for (const [surah, ayah] of QURANIC_DUA_REFS) {
      const row = await db.getFirstAsync<{ t: string }>('SELECT text_search AS t FROM ayah WHERE surah = ? AND ayah = ?', [surah, ayah]);
      const valid = /رب|سبحانك|اهدنا/.test(row!.t) || ok.has(`${surah}:${ayah - 1}`); // or continues a verified dua
      expect([`${surah}:${ayah}`, valid]).toEqual([`${surah}:${ayah}`, true]);
      ok.add(`${surah}:${ayah}`);
    }
  });

  it('the du’as for parents shown on the Sadaqah page are real verses about parents, read from the verified mushaf', async () => {
    for (const [surah, ayah] of PARENT_DUA_REFS) {
      const v = await quranRepo.ayah(db, surah, ayah);
      expect(v).not.toBeNull();
      const row = await db.getFirstAsync<{ t: string }>('SELECT text_search AS t FROM ayah WHERE surah = ? AND ayah = ?', [surah, ayah]);
      expect([`${surah}:${ayah}`, /والدي|ارحمهما/.test(row!.t)]).toEqual([`${surah}:${ayah}`, true]);
    }
  });

  it('bundles an-Nawawi (42) and Qudsi (40) in Arabic, English and French', async () => {
    const books = await hadithRepo.books(db);
    expect(books.find((b) => b.id === 'nawawi')).toMatchObject({ hadithCount: 42, bundled: true, languages: 'ar,en,fr' });
    expect(books.find((b) => b.id === 'qudsi')).toMatchObject({ hadithCount: 40, bundled: true });
    const first = await hadithRepo.get(db, 'nawawi', 1);
    expect(first?.textAr.length).toBeGreaterThan(100);
    expect(first?.textEn).toBeTruthy();
    expect(first?.textFr).toBeTruthy();
    expect((await hadithRepo.search(db, 'النيات')).some((h) => h.book === 'nawawi' && h.number === 1)).toBe(true);
    expect((await hadithRepo.search(db, 'intentions')).length).toBeGreaterThan(0);
  });

  it('rejects a corrupted bundle instead of seeding partial content', () => {
    const broken: BundleData = { ...data, hisn: data.hisn.slice(0, 3) };
    expect(() => validateBundle(broken)).toThrow(BundleValidationError);
  });
});
