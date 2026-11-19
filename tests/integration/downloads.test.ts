import { createHash } from 'node:crypto';

import { ensureContentSchema } from '@/database/content/schema';
import { hadithRepo, translationRepo } from '@/database/repositories/content';
import { packagesRepo } from '@/database/repositories/user';
import { migrate } from '@/database/migrate';
import { USER_MIGRATIONS } from '@/database/user/migrations';
import { contentPackagesRepo, parseContentPackage } from '@/services/content/packages';
import { FIXTURE_PACKAGE, fixtureMp3, fixtureVoice, registerFixtureVoice } from '../helpers/adhan-fixtures';
import { DownloadManager, type DownloadDeps, type DownloadFs } from '@/services/downloads/manager';
import { globalIndex, SURAHS } from '@/services/quran/navigation';

import { openTestDb } from '../helpers/sqlite';

const edition = (id: string) =>
  JSON.stringify({
    code: 200,
    data: {
      edition: { identifier: id },
      surahs: SURAHS.map((s) => ({
        number: s.number,
        ayahs: Array.from({ length: s.ayahCount }, (_, i) => ({ number: s.startIndex + i + 1, text: `ayah ${s.number}:${i + 1}` })),
      })),
    },
  });

interface Fake {
  deps: DownloadDeps;
  net: { connected: boolean; wifi: boolean };
  requests: string[];
  files: Map<string, number>;
  responses: Map<string, string | Uint8Array | Error>;
}

async function setup(): Promise<Fake> {
  const user = openTestDb();
  const content = openTestDb();
  await migrate(user, USER_MIGRATIONS);
  await ensureContentSchema(content);
  const fake = {
    net: { connected: true, wifi: true } as { connected: boolean; wifi: boolean },
    requests: [] as string[],
    files: new Map<string, number>(),
    responses: new Map<string, string | Uint8Array | Error>(),
  };
  const fs: DownloadFs = {
    supportsFileDownloads: true,
    async downloadPartial(pkg, rel, url) {
      fake.requests.push(url);
      const r = fake.responses.get(url) ?? 'ID3' + 'x'.repeat(2000);
      if (r instanceof Error) throw r;
      const bytes = r instanceof Uint8Array ? r : new TextEncoder().encode(r);
      return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), head: bytes.slice(0, 12) };
    },
    commitFile(pkg, rel) {
      fake.files.set(`${pkg}/${rel}`, 1);
    },
    clearInstalled(pkg) {
      for (const k of [...fake.files.keys()]) if (k.startsWith(`${pkg}/`)) fake.files.delete(k);
    },
    discardPartial() {},
    deletePackageFiles(pkg) {
      for (const k of [...fake.files.keys()]) if (k.startsWith(`${pkg}/`)) fake.files.delete(k);
    },
    fileExists: (pkg, rel) => fake.files.has(`${pkg}/${rel}`),
    availableSpace: () => 10_000_000_000,
  };
  const deps: DownloadDeps = {
    dbs: { user, content },
    fs,
    async fetchText(url) {
      fake.requests.push(url);
      const r = fake.responses.get(url);
      if (r instanceof Error) throw r;
      if (r === undefined) throw new TypeError('network request failed');
      return typeof r === 'string' ? r : new TextDecoder().decode(r);
    },
    network: async () => fake.net,
    sha256Text: async (t) => createHash('sha256').update(Buffer.from(t, 'utf8')).digest('hex'),
    wifiOnly: () => true,
  };
  return { ...fake, deps };
}

async function settle(m: DownloadManager, id: string, ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const s = m.state(id).status;
    if (s === 'installed' || s === 'failed' || s === 'paused' || s === 'not_installed') return m.state(id);
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`timeout: ${m.state(id).status}`);
}

describe('download manager (real SQLite, injected network/filesystem)', () => {
  beforeAll(() => registerFixtureVoice());

  it('downloads, validates and installs a translation, then deletes it', async () => {
    const f = await setup();
    f.responses.set('https://api.alquran.cloud/v1/quran/en.sahih', edition('en.sahih'));
    const m = new DownloadManager(f.deps);
    await m.init();
    await m.download('translation.en.sahih');
    expect((await settle(m, 'translation.en.sahih')).status).toBe('installed');
    expect((await translationRepo.forRange(f.deps.dbs.content, 'en.sahih', 1, 2))[1]).toBe('ayah 1:1');
    const row = await packagesRepo.get(f.deps.dbs.user, 'translation.en.sahih');
    expect(row).toMatchObject({ status: 'installed' });
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    await m.remove('translation.en.sahih');
    expect(await translationRepo.editions(f.deps.dbs.content)).toEqual([]);
    expect(await packagesRepo.get(f.deps.dbs.user, 'translation.en.sahih')).toBeNull();
  });

  it('never installs a payload that fails validation, even with HTTP 200', async () => {
    const f = await setup();
    f.responses.set('https://api.alquran.cloud/v1/quran/en.sahih', JSON.stringify({ code: 200, data: { edition: { identifier: 'en.sahih' }, surahs: [] } }));
    const m = new DownloadManager(f.deps);
    await m.download('translation.en.sahih');
    const s = await settle(m, 'translation.en.sahih');
    expect(s).toMatchObject({ status: 'failed', errorCode: 'integrity' });
    expect(await translationRepo.editions(f.deps.dbs.content)).toEqual([]);
  });

  it('fails gracefully offline, on cellular with Wi-Fi-only, and on network errors; retry succeeds', async () => {
    const f = await setup();
    const m = new DownloadManager(f.deps);
    f.net.connected = false;
    await m.download('translation.fr.hamidullah');
    expect(await settle(m, 'translation.fr.hamidullah')).toMatchObject({ status: 'failed', errorCode: 'offline' });
    f.net.connected = true;
    f.net.wifi = false;
    await m.download('translation.fr.hamidullah');
    expect(await settle(m, 'translation.fr.hamidullah')).toMatchObject({ status: 'failed', errorCode: 'wifi' });
    f.net.wifi = true;
    await m.download('translation.fr.hamidullah');
    expect(await settle(m, 'translation.fr.hamidullah')).toMatchObject({ status: 'failed', errorCode: 'network' });
    expect(f.requests.length).toBe(1);
    f.responses.set('https://api.alquran.cloud/v1/quran/fr.hamidullah', edition('fr.hamidullah'));
    await m.download('translation.fr.hamidullah');
    expect((await settle(m, 'translation.fr.hamidullah')).status).toBe('installed');
  });

  it('installs a hadith collection with its translation, sections and gradings', async () => {
    const f = await setup();
    const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';
    const make = (prefix: string) =>
      JSON.stringify({
        metadata: { name: 'Sunan Abu Dawud', sections: { '0': '', '1': 'Purification', '2': 'Prayer' }, section_details: {} },
        hadiths: Array.from({ length: 60 }, (_, i) => ({
          hadithnumber: i + 1,
          text: `${prefix} ${i + 1}`,
          grades: prefix === 'en' && i === 0 ? [{ name: 'Al-Albani', grade: 'Sahih' }] : [],
          reference: { book: i < 30 ? 1 : 2, hadith: i + 1 },
        })),
      });
    f.responses.set(`${BASE}ara-abudawud.min.json`, make('عربي'));
    f.responses.set(`${BASE}eng-abudawud.min.json`, make('en'));
    const m = new DownloadManager(f.deps);
    await m.download('hadith.abudawud.en');
    expect((await settle(m, 'hadith.abudawud.en')).status).toBe('installed');
    const book = await hadithRepo.book(f.deps.dbs.content, 'abudawud');
    expect(book).toMatchObject({ hadithCount: 60, languages: 'ar,en', bundled: false });
    const h = await hadithRepo.get(f.deps.dbs.content, 'abudawud', 1);
    expect(h).toMatchObject({ textAr: 'عربي 1', textEn: 'en 1', section: 1, grades: [{ name: 'Al-Albani', grade: 'Sahih' }] });
    expect(await hadithRepo.sections(f.deps.dbs.content, 'abudawud')).toEqual([
      { n: 1, name: 'Purification', count: 30 },
      { n: 2, name: 'Prayer', count: 30 },
    ]);
    expect((await hadithRepo.search(f.deps.dbs.content, 'عربي 5')).length).toBeGreaterThan(0);
    await m.remove('hadith.abudawud.en');
    expect(await hadithRepo.book(f.deps.dbs.content, 'abudawud')).toBeNull();
  });

  it('installs an adhan only when it is exactly the pinned file (real audio, verified end to end)', async () => {
    const f = await setup();
    const voice = fixtureVoice;
    const pinned = fixtureMp3;
    f.responses.set(voice.direct!.url, pinned);
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    expect((await settle(m, FIXTURE_PACKAGE)).status).toBe('installed');
    expect(f.deps.fs.fileExists(FIXTURE_PACKAGE, 'adhan.mp3')).toBe(true);
    expect(f.requests[0]).toMatch(/^https:\/\/upload\.wikimedia\.org\/.*\.mp3$/);
    const row = await packagesRepo.get(f.deps.dbs.user, FIXTURE_PACKAGE);
    expect(row).toMatchObject({ status: 'installed', sha256: voice.direct!.sha256, bytesTotal: voice.direct!.bytes });
    await m.remove(FIXTURE_PACKAGE);
    expect(f.deps.fs.fileExists(FIXTURE_PACKAGE, 'adhan.mp3')).toBe(false);
    expect(await packagesRepo.get(f.deps.dbs.user, FIXTURE_PACKAGE)).toBeNull();
  });

  it.each([
    ['a corrupted byte (checksum)', (b: Uint8Array) => Uint8Array.from(b, (v, i) => (i === 5000 ? v ^ 0xff : v))],
    ['a truncated file (size)', (b: Uint8Array) => b.slice(0, b.length - 100)],
    ['an HTML error page (container)', () => new TextEncoder().encode('<html>' + 'x'.repeat(1_500_000) + '</html>')],
  ])('rejects %s and never installs or keeps the file', async (_name, mutate) => {
    const f = await setup();
    const voice = fixtureVoice;
    const pinned = fixtureMp3;
    f.responses.set(voice.direct!.url, mutate(pinned));
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    const s = await settle(m, FIXTURE_PACKAGE);
    expect(s.status).toBe('failed');
    expect((s as { errorCode?: string }).errorCode).toBe('integrity');
    expect(f.deps.fs.fileExists(FIXTURE_PACKAGE, 'adhan.mp3')).toBe(false);
  });

  it('downloads per-ayah audio, rejects non-MP3 responses, and survives a restart mid-download', async () => {
    const f = await setup();
    const m = new DownloadManager(f.deps);
    await m.download('recitation.ar.alafasy.112');
    expect((await settle(m, 'recitation.ar.alafasy.112')).status).toBe('installed');
    expect((await packagesRepo.files(f.deps.dbs.user, 'recitation.ar.alafasy.112')).map((x) => x.relPath)).toEqual(['1.mp3', '2.mp3', '3.mp3', '4.mp3']);

    // An HTML error page served with 200 is rejected.
    f.responses.set(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalIndex({ surah: 113, ayah: 1 })}.mp3`, '<!DOCTYPE html>' + ' '.repeat(3000));
    await m.download('recitation.ar.alafasy.113');
    expect(await settle(m, 'recitation.ar.alafasy.113')).toMatchObject({ status: 'failed', errorCode: 'integrity' });

    // Simulate the app being killed while downloading: persisted state recovers as paused.
    await packagesRepo.upsert(f.deps.dbs.user, {
      id: 'recitation.ar.alafasy.114',
      kind: 'recitation',
      version: '1',
      status: 'downloading',
      bytesTotal: 6,
      bytesDone: 3,
      sha256: null,
      error: null,
      resumeState: null,
    });
    const restarted = new DownloadManager(f.deps);
    await restarted.init();
    expect(restarted.state('recitation.ar.alafasy.114').status).toBe('paused');
    await restarted.download('recitation.ar.alafasy.114');
    expect((await settle(restarted, 'recitation.ar.alafasy.114')).status).toBe('installed');
  });

  it('pausing an active download stops it; resuming completes it', async () => {
    const f = await setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const original = f.deps.fs.downloadPartial;
    let calls = 0;
    f.deps.fs.downloadPartial = async (...args) => {
      calls++;
      if (calls === 2) {
        await gate;
        if (args[3].aborted) throw new Error('aborted');
      }
      return original(...args);
    };
    const m = new DownloadManager(f.deps);
    await m.download('recitation.ar.alafasy.112');
    while (calls < 2) await new Promise((r) => setTimeout(r, 2));
    await m.pause('recitation.ar.alafasy.112');
    release();
    expect((await settle(m, 'recitation.ar.alafasy.112')).status).toBe('paused');
    await m.download('recitation.ar.alafasy.112');
    expect((await settle(m, 'recitation.ar.alafasy.112')).status).toBe('installed');
  });
});

describe('content packages (import path)', () => {
  it('installs, lists and removes a validated package', async () => {
    const content = openTestDb();
    await ensureContentSchema(content);
    const pkg = parseContentPackage(
      JSON.stringify({
        format: 'sakina-content',
        version: 1,
        id: 'demo.academy',
        section: 'academy',
        language: 'en',
        title: 'Demo',
        description: 'Test package',
        source: { name: 'Publisher', url: 'https://example.org' },
        license: 'CC BY 4.0',
        reviewed: { by: 'Reviewer', on: '2026-11-01' },
        items: [
          { id: 'a', title: 'One', body: 'First', contentType: 'source_text', source: 'p1' },
          { id: 'b', title: 'Two', body: 'Second', contentType: 'educational_summary', source: 'p2' },
        ],
      }),
    );
    await contentPackagesRepo.install(content, pkg);
    const list = await contentPackagesRepo.list(content, 'academy');
    expect(list).toEqual([expect.objectContaining({ id: 'demo.academy', itemCount: 2, reviewedBy: 'Reviewer' })]);
    expect((await contentPackagesRepo.items(content, 'demo.academy')).map((i) => i.contentType)).toEqual(['source_text', 'educational_summary']);
    expect((await contentPackagesRepo.item(content, 'demo.academy/b'))?.body).toBe('Second');
    await contentPackagesRepo.remove(content, 'demo.academy');
    expect(await contentPackagesRepo.list(content, 'academy')).toEqual([]);
  });
});
