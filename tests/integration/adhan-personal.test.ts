import { migrate } from '@/database/migrate';
import { customAdhanRepo } from '@/database/repositories/user';
import { USER_MIGRATIONS } from '@/database/user/migrations';
import { customVoice, loadCustomVoices, removeCustomVoice } from '@/services/adhan/custom';
import {
  allVoices,
  CatalogueError,
  parsePersonalCatalogue,
  resolveVoice,
  setCustomVoices,
  setPersonalVoices,
  tierOf,
  validatePersonalVoice,
  voiceById,
  voiceFitsPrayer,
  type VoiceSettings,
} from '@/services/adhan/voices';
import { adhanPackage } from '@/services/downloads/catalogue';

import { openTestDb } from '../helpers/sqlite';
import personalCatalogue from '../../src/content/adhan/personal.generated.json';

jest.mock('@/services/adhan/customFiles', () => ({ deleteCustomFile: jest.fn() }));

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const real = personalCatalogue as unknown as { voices: Record<string, unknown>[] };
const sample = (): Record<string, unknown> => clone(real.voices.find((v) => v.kind === 'adhan')!);

afterEach(() => {
  setPersonalVoices([]);
  setCustomVoices([]);
});

describe('personal-use catalogue (generated from a pinned public collection)', () => {
  it('every generated voice passes validation and is pinned (size + SHA-256, https, allow-listed host)', () => {
    const { voices, rejected } = parsePersonalCatalogue(personalCatalogue);
    expect(rejected).toEqual([]);
    expect(voices.length).toBeGreaterThan(100);
    expect(new Set(voices.map((v) => v.id)).size).toBe(voices.length);
    for (const v of voices) {
      expect(tierOf(v)).toBe('personal');
      expect(v.credit.licence).toMatch(/^Personal use only/);
      expect(v.credit.commercialUse).toBe(false);
      expect(v.direct!.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/Kiwifu\/adhan-mp3\/[0-9a-f]{40}\//);
      expect(v.direct!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(v.direct!.gainDb).toBeLessThanOrEqual(0);
      expect(/[؀-ۿ]/.test(v.name.ar) || v.name.ar.length > 0).toBe(true);
    }
    expect(voices.some((v) => v.kind === 'fajr')).toBe(true);
  });

  it('rejects untrusted hosts, plain http, missing licence wording, commercial claims, boosts and bad pins', () => {
    const bad = (mut: (v: Record<string, any>) => void): void => {
      const v = sample() as Record<string, any>;
      mut(v);
      expect(() => validatePersonalVoice(v)).toThrow(CatalogueError);
    };
    bad((v) => (v.direct.url = 'https://evil.example/a.mp3'));
    bad((v) => (v.direct.url = v.direct.url.replace('https:', 'http:')));
    bad((v) => (v.credit.licence = 'CC BY 4.0'));
    bad((v) => (v.credit.commercialUse = true));
    bad((v) => (v.direct.gainDb = 3));
    bad((v) => (v.direct.sha256 = 'abc'));
    bad((v) => (v.tier = 'licensed'));
    bad((v) => (v.delivery = 'bundled'));
    bad((v) => (v.durationSec = 5));
    bad((v) => (v.direct.trim = { startSec: 10, endSec: 5 }));
    expect(() => validatePersonalVoice(sample())).not.toThrow();
  });

  it('drops invalid and duplicate entries without losing the good ones', () => {
    const good = sample();
    const dupe = clone(good);
    const broken = { ...clone(good), id: 'p-broken', direct: { ...(good.direct as object), url: 'https://evil.example/a.mp3' } };
    const r = parsePersonalCatalogue({ schemaVersion: 2, tier: 'personal', voices: [good, dupe, broken] });
    expect(r.voices).toHaveLength(1);
    expect(r.rejected).toHaveLength(2);
    expect(() => parsePersonalCatalogue({ schemaVersion: 1, tier: 'personal', voices: [] })).toThrow(CatalogueError);
  });

  it('personal voices are listed, downloadable, never claim a verified licence, and Fajr-only ones stay on Fajr', () => {
    const { voices } = parsePersonalCatalogue(personalCatalogue);
    setPersonalVoices(voices);
    const fajr = voices.find((v) => v.kind === 'fajr')!;
    const regular = voices.find((v) => v.kind === 'adhan')!;
    expect(allVoices()).toContain(fajr);
    expect(voiceById(regular.id)).toBe(regular);
    expect(voiceFitsPrayer(fajr, 'fajr')).toBe(true);
    expect(voiceFitsPrayer(fajr, 'dhuhr')).toBe(false);
    expect(voiceFitsPrayer(regular, 'dhuhr')).toBe(true);
    const pkg = adhanPackage(regular);
    expect(pkg.licence.status).toBe('pending');

    const s = (over: Partial<VoiceSettings>): VoiceSettings =>
      ({ defaultVoice: regular.id, byPrayer: { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null }, ...over }) as VoiceSettings;
    // A downloaded personal voice is used; a missing one falls back, so a prayer is never silent.
    expect(resolveVoice('dhuhr', s({}), () => true).id).toBe(regular.id);
    expect(resolveVoice('dhuhr', s({}), (id) => id !== regular.id).id).not.toBe(regular.id);
    // Choosing a Fajr-only voice for Dhuhr is ignored.
    const wrong = s({ byPrayer: { fajr: null, dhuhr: fajr.id, asr: null, maghrib: null, isha: null } });
    expect(resolveVoice('dhuhr', wrong, () => true).id).not.toBe(fajr.id);
  });
});

describe('own audio files ("More…")', () => {
  it('persist in the user database, load as local voices usable for any prayer, and can be removed', async () => {
    const db = openTestDb();
    await migrate(db, USER_MIGRATIONS);
    await customAdhanRepo.add(db, { id: 'custom-1', name: 'My imam', file: 'custom-1.mp3', bytes: 123_456 });
    await loadCustomVoices(db, (f) => `file:///adhan/${f}`);
    const v = voiceById('custom-1')!;
    expect(tierOf(v)).toBe('custom');
    expect(v.delivery).toBe('local');
    expect(v.localUri).toBe('file:///adhan/custom-1.mp3');
    expect(v.name.ar).toBe('My imam');
    expect(voiceFitsPrayer(v, 'fajr')).toBe(true);
    expect(voiceFitsPrayer(v, 'asr')).toBe(true);
    expect(customVoice({ id: 'x', name: 'n', file: 'x.mp3', bytes: 1, createdAt: '2026-01-02T00:00:00Z' }, 'file:///x').credit.verifiedOn).toBe('2026-01-02');

    // A file whose uri cannot be resolved (deleted from disk) is not offered.
    await loadCustomVoices(db, () => null);
    expect(voiceById('custom-1')).toBeNull();

    await loadCustomVoices(db, (f) => `file:///adhan/${f}`);
    await removeCustomVoice(db, { id: 'custom-1', file: 'custom-1.mp3' }, (f) => `file:///adhan/${f}`);
    expect(voiceById('custom-1')).toBeNull();
    expect(await customAdhanRepo.list(db)).toEqual([]);
  });
});
