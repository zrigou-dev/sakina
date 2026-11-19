import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { migrate } from '@/database/migrate';
import { ensureContentSchema } from '@/database/content/schema';
import { USER_MIGRATIONS } from '@/database/user/migrations';
import { loadCachedRemoteCatalogue, refreshRemoteCatalogue } from '@/services/adhan/remote';
import { allVoices, BUNDLED_CATALOGUE, setRemoteVoices, voiceById, type AdhanVoice } from '@/services/adhan/voices';
import { DownloadManager, type DownloadDeps, type DownloadFs } from '@/services/downloads/manager';
import { previewSource } from '@/services/adhan/sources';

import { openTestDb } from '../helpers/sqlite';

let mockBase: string | null = 'https://mirror.test/adhan';
jest.mock('@/services/adhan/config', () => ({
  adhanLibraryBaseUrl: () => mockBase,
  personalAdhanEnabled: () => false,
  mirrorHost: () => (mockBase ? [new URL(mockBase).hostname] : []),
}));

const ROOT = join(__dirname, '..', '..');
const hosted = JSON.parse(readFileSync(join(ROOT, 'library', 'adhan', 'catalogue.json'), 'utf8')) as {
  schemaVersion: 2;
  generatedAt: string;
  voices: AdhanVoice[];
};
const aaqib = hosted.voices.find((v) => v.id === 'aaqib-azeez')!;
const masteredBytes = new Uint8Array(readFileSync(join(ROOT, 'library', 'adhan', aaqib.file)));

/** A voice that exists only on the mirror (no Commons copy), reusing real mastered bytes so the hash is genuine. */
const mirrorOnly: AdhanVoice = {
  ...aaqib,
  id: 'mirror-only-voice',
  delivery: 'download',
  file: 'mirror-only-voice.m4a',
  direct: null,
  clip: { ...aaqib.clip!, file: 'clips/mirror-only-voice.mp3' },
};
const catalogueWith = (voices: unknown[]) => JSON.stringify({ ...hosted, voices });

async function db() {
  const content = openTestDb();
  await ensureContentSchema(content);
  return content;
}
const respond = (body: string, ok = true) => (async () => ({ ok, text: async () => body })) as unknown as typeof fetch;

beforeEach(() => {
  mockBase = 'https://mirror.test/adhan';
  setRemoteVoices([]);
});

describe('online adhan catalogue', () => {
  it('adds validated voices, keeps the bundled ones untouched, and reports what was rejected', async () => {
    const content = await db();
    const hostile = { ...aaqib, id: 'nc-voice', credit: { ...aaqib.credit, licence: 'CC BY-NC 4.0' } };
    const impostor = { ...hosted.voices[0]!, name: { ar: 'x', en: 'HACKED', fr: 'x' } }; // same id as a bundled voice
    // A well-formed voice that reuses a bundled id is ignored (bundled voices are immutable); the NC licence is rejected.
    const res = await refreshRemoteCatalogue(content, respond(catalogueWith([mirrorOnly, hostile, impostor])));
    expect(res).toEqual({ status: 'ok', added: 1, rejected: 1 });
    // The same id twice in one catalogue is rejected outright.
    expect(await refreshRemoteCatalogue(content, respond(catalogueWith([mirrorOnly, mirrorOnly])))).toEqual({ status: 'ok', added: 1, rejected: 1 });
    expect(voiceById('mirror-only-voice')).toBeTruthy();
    expect(voiceById('nc-voice')).toBeNull();
    expect(voiceById(BUNDLED_CATALOGUE.voices[0]!.id)!.name.en).not.toBe('HACKED');
  });

  it('caches the catalogue so new voices are known offline after a restart', async () => {
    const content = await db();
    await refreshRemoteCatalogue(content, respond(catalogueWith([...hosted.voices, mirrorOnly])));
    setRemoteVoices([]); // simulate a fresh process
    expect(voiceById('mirror-only-voice')).toBeNull();
    await loadCachedRemoteCatalogue(content);
    expect(voiceById('mirror-only-voice')).toBeTruthy();
  });

  it.each([
    ['an HTTP error', respond('', false)],
    ['invalid JSON', respond('<html>nope')],
    ['an unsupported schema', respond(JSON.stringify({ schemaVersion: 9, voices: [] }))],
    ['an oversized body', respond('x'.repeat(1_100_000))],
    ['a network failure', (async () => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch],
  ])('survives %s without changing the library', async (_name, fetchImpl) => {
    const content = await db();
    const before = allVoices().length;
    expect(await refreshRemoteCatalogue(content, fetchImpl)).toEqual({ status: 'error' });
    expect(allVoices().length).toBe(before);
  });

  it('does nothing when no mirror is configured', async () => {
    mockBase = null;
    const content = await db();
    expect(await refreshRemoteCatalogue(content, respond(catalogueWith(hosted.voices)))).toEqual({ status: 'unconfigured' });
  });

  it('a mirror-only voice previews by streaming its clip and downloads (mirror only) with full verification', async () => {
    const content = await db();
    await refreshRemoteCatalogue(content, respond(catalogueWith([...hosted.voices, mirrorOnly])));
    const v = voiceById('mirror-only-voice')!;
    expect(previewSource(v)).toMatchObject({ kind: 'file', uri: 'https://mirror.test/adhan/clips/mirror-only-voice.mp3' });

    const user = openTestDb();
    await migrate(user, USER_MIGRATIONS);
    const requests: string[] = [];
    const files = new Set<string>();
    const served = new Map<string, Uint8Array>([['https://mirror.test/adhan/mirror-only-voice.m4a', masteredBytes]]);
    const fs: DownloadFs = {
      supportsFileDownloads: true,
      async downloadPartial(_p, _r, url) {
        requests.push(url);
        const b = served.get(url);
        if (!b) throw new TypeError('404');
        return { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex'), head: b.slice(0, 12) };
      },
      commitFile: (p, r) => void files.add(`${p}/${r}`),
      clearInstalled: () => files.clear(),
      discardPartial: () => undefined,
      deletePackageFiles: () => files.clear(),
      fileExists: (p, r) => files.has(`${p}/${r}`),
      availableSpace: () => 1e12,
    };
    const deps: DownloadDeps = {
      dbs: { user, content },
      fs,
      fetchText: async () => '',
      network: async () => ({ connected: true, wifi: true }),
      sha256Text: async () => '',
      wifiOnly: () => true,
    };
    const m = new DownloadManager(deps);
    await m.download('adhan.mirror-only-voice');
    for (let i = 0; i < 500 && m.state('adhan.mirror-only-voice').status !== 'installed'; i++) await new Promise((r) => setTimeout(r, 5));
    expect(m.state('adhan.mirror-only-voice').status).toBe('installed');
    expect(requests).toEqual(['https://mirror.test/adhan/mirror-only-voice.m4a']);
    expect(files.has('adhan.mirror-only-voice/adhan.m4a')).toBe(true);
  });
});
