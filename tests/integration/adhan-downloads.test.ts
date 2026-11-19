import { createHash } from 'node:crypto';

import { migrate } from '@/database/migrate';
import { ensureContentSchema } from '@/database/content/schema';
import { packagesRepo } from '@/database/repositories/user';
import { USER_MIGRATIONS } from '@/database/user/migrations';
import { FIXTURE_PACKAGE, FIXTURE_URL, fixtureMaster, fixtureMp3, fixtureVoice, registerFixtureVoice } from '../helpers/adhan-fixtures';
import { DownloadManager, type DownloadDeps, type DownloadFs } from '@/services/downloads/manager';

import { openTestDb } from '../helpers/sqlite';

// A mirror is configured for this whole file.
jest.mock('@/services/adhan/config', () => ({
  adhanLibraryBaseUrl: () => 'https://mirror.test/adhan',
  mirrorHost: () => ['mirror.test'],
  personalAdhanEnabled: () => false,
}));

const voice = fixtureVoice;
const MIRROR_URL = `https://mirror.test/adhan/${voice.file}`;
const COMMONS_URL = FIXTURE_URL;
const mastered = fixtureMaster;
const pinned = fixtureMp3;
beforeAll(() => registerFixtureVoice());

async function setup() {
  const user = openTestDb();
  const content = openTestDb();
  await migrate(user, USER_MIGRATIONS);
  await ensureContentSchema(content);
  const requests: string[] = [];
  const files = new Set<string>();
  const responses = new Map<string, Uint8Array | Error>();
  const fs: DownloadFs = {
    supportsFileDownloads: true,
    async downloadPartial(_pkg, _rel, url) {
      requests.push(url);
      const r = responses.get(url);
      if (!r) throw new TypeError('network request failed');
      if (r instanceof Error) throw r;
      return { bytes: r.length, sha256: createHash('sha256').update(r).digest('hex'), head: r.slice(0, 12) };
    },
    commitFile: (pkg, rel) => void files.add(`${pkg}/${rel}`),
    clearInstalled: (pkg) => [...files].filter((f) => f.startsWith(`${pkg}/`)).forEach((f) => files.delete(f)),
    discardPartial: () => undefined,
    deletePackageFiles: (pkg) => [...files].filter((f) => f.startsWith(`${pkg}/`)).forEach((f) => files.delete(f)),
    fileExists: (pkg, rel) => files.has(`${pkg}/${rel}`),
    availableSpace: () => 10_000_000_000,
  };
  const deps: DownloadDeps = {
    dbs: { user, content },
    fs,
    fetchText: async () => '',
    network: async () => ({ connected: true, wifi: true }),
    sha256Text: async (t) => createHash('sha256').update(t).digest('hex'),
    wifiOnly: () => true,
  };
  return { deps, requests, files, responses };
}

async function settle(m: DownloadManager, id: string) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const s = m.state(id).status;
    if (s === 'installed' || s === 'failed') return m.state(id);
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('timeout');
}

describe('adhan download sources with a mirror configured', () => {
  it('uses the mastered mirror file first and installs it as AAC', async () => {
    const f = await setup();
    f.responses.set(MIRROR_URL, mastered);
    f.responses.set(COMMONS_URL, pinned);
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    expect((await settle(m, FIXTURE_PACKAGE)).status).toBe('installed');
    expect(f.requests).toEqual([MIRROR_URL]);
    expect(f.files.has('adhan.fixture-download-voice/adhan.m4a')).toBe(true);
    expect(f.files.has('adhan.fixture-download-voice/adhan.mp3')).toBe(false);
    expect((await packagesRepo.get(f.deps.dbs.user, FIXTURE_PACKAGE))?.sha256).toBe(voice.sha256);
  });

  it.each([
    ['is unreachable', new TypeError('network request failed')],
    ['serves a corrupted file', Uint8Array.from(mastered, (v, i) => (i === 700 ? v ^ 1 : v))],
    ['serves an HTML error page', new TextEncoder().encode('<html>'.padEnd(voice.bytes, 'x'))],
  ])('falls back to the pinned Commons file when the mirror %s', async (_name, mirror) => {
    const f = await setup();
    f.responses.set(MIRROR_URL, mirror);
    f.responses.set(COMMONS_URL, pinned);
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    expect((await settle(m, FIXTURE_PACKAGE)).status).toBe('installed');
    expect(f.requests).toEqual([MIRROR_URL, COMMONS_URL]);
    expect(f.files.has('adhan.fixture-download-voice/adhan.mp3')).toBe(true);
    expect(f.files.has('adhan.fixture-download-voice/adhan.m4a')).toBe(false);
  });

  it('fails cleanly (and installs nothing) when every source is bad', async () => {
    const f = await setup();
    f.responses.set(MIRROR_URL, new TypeError('network request failed'));
    f.responses.set(
      COMMONS_URL,
      Uint8Array.from(pinned, (v, i) => (i === 9000 ? v ^ 0xff : v)),
    );
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    const s = await settle(m, FIXTURE_PACKAGE);
    expect(s.status).toBe('failed');
    expect((s as { errorCode?: string }).errorCode).toBe('integrity');
    expect(f.files.size).toBe(0);
    // …and the user can simply retry once the network is healthy.
    f.responses.set(COMMONS_URL, pinned);
    await m.download(FIXTURE_PACKAGE);
    expect((await settle(m, FIXTURE_PACKAGE)).status).toBe('installed');
  });

  it('re-downloading replaces a previously installed variant instead of keeping two files', async () => {
    const f = await setup();
    f.responses.set(MIRROR_URL, new TypeError('offline'));
    f.responses.set(COMMONS_URL, pinned);
    const m = new DownloadManager(f.deps);
    await m.download(FIXTURE_PACKAGE);
    await settle(m, FIXTURE_PACKAGE);
    expect(f.files.has('adhan.fixture-download-voice/adhan.mp3')).toBe(true);
    f.responses.set(MIRROR_URL, mastered);
    await m.download(FIXTURE_PACKAGE); // update
    await settle(m, FIXTURE_PACKAGE);
    expect([...f.files]).toEqual(['adhan.fixture-download-voice/adhan.m4a']);
  });

  it('removes the files and row of an installed adhan that has left the catalogue (no orphaned storage)', async () => {
    const f = await setup();
    await packagesRepo.upsert(f.deps.dbs.user, {
      id: 'adhan.old-removed-voice',
      kind: 'adhan',
      version: '1',
      status: 'installed',
      bytesTotal: 1000,
      bytesDone: 1000,
      sha256: 'x',
      error: null,
      resumeState: null,
      installedAt: 'now',
    });
    f.files.add('adhan.old-removed-voice/adhan.mp3');
    const m = new DownloadManager(f.deps);
    await m.init();
    expect(f.files.has('adhan.old-removed-voice/adhan.mp3')).toBe(false);
    expect(await packagesRepo.get(f.deps.dbs.user, 'adhan.old-removed-voice')).toBeNull();
    expect(m.state('adhan.old-removed-voice').status).toBe('not_installed');
  });

  it('does not offer a bundled voice for download', async () => {
    const f = await setup();
    const m = new DownloadManager(f.deps);
    await m.download('adhan.makkah-masjid-al-haram');
    expect((await settle(m, 'adhan.makkah-masjid-al-haram')).status).toBe('failed');
    expect(f.requests).toHaveLength(0);
  });
});
