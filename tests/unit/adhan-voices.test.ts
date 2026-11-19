import { levelAt } from '@/services/adhan/playback';
import {
  allVoices,
  BUNDLED_CATALOGUE,
  CatalogueError,
  dbToVolume,
  DEFAULT_FAJR_VOICE_ID,
  DEFAULT_VOICE_ID,
  parseCatalogue,
  PRAYERS,
  playbackProfile,
  resolveVoice,
  validateVoice,
  voiceById,
  voiceFitsPrayer,
  type AdhanVoice,
  type VoiceSettings,
} from '@/services/adhan/voices';
import { adhanSources } from '@/services/downloads/catalogue';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/state/settings';

import { fixtureVoice, registerFixtureVoice } from '../helpers/adhan-fixtures';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const bundled = BUNDLED_CATALOGUE.voices.find((v) => v.delivery === 'bundled' && v.kind === 'adhan')!;
const fajrVoice = BUNDLED_CATALOGUE.voices.find((v) => v.kind === 'fajr')!;
// The shipped library has no downloadable voice; tests use a real-bytes fixture (see helpers/adhan-fixtures.ts).
const downloadable = fixtureVoice;
beforeAll(() => registerFixtureVoice());

describe('adhan catalogue', () => {
  it('ships voices that all pass strict validation (licence, clip < 30 s, hashes, trusted hosts)', () => {
    expect(BUNDLED_CATALOGUE.voices.length).toBeGreaterThanOrEqual(2);
    for (const v of BUNDLED_CATALOGUE.voices) expect(() => validateVoice(v)).not.toThrow();
  });

  it('has unique ids, a bundled default, and a bundled Fajr adhan (so the first adhan works offline)', () => {
    const ids = BUNDLED_CATALOGUE.voices.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(voiceById(DEFAULT_VOICE_ID)?.delivery).toBe('bundled');
    expect(voiceById(DEFAULT_FAJR_VOICE_ID)).toMatchObject({ delivery: 'bundled', kind: 'fajr' });
  });

  it('every voice has full attribution in all three languages and a verified free licence', () => {
    for (const v of allVoices()) {
      for (const l of ['ar', 'en', 'fr'] as const) expect(v.name[l].length).toBeGreaterThan(2);
      expect(v.credit.licence).toMatch(/^(CC0|CC BY(-SA)? [2-4]\.\d)$/);
      expect(v.credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(v.credit.recordist.length).toBeGreaterThan(1);
      expect(v.credit.modified.length).toBeGreaterThan(10);
      expect(v.credit.shareAlike).toBe(/-SA/.test(v.credit.licence));
    }
  });

  it('is levelled to the library target with safe true peaks', () => {
    for (const v of allVoices()) {
      expect(Math.abs(v.audio.lufs + 16)).toBeLessThan(1);
      expect(v.audio.truePeak).toBeLessThanOrEqual(-1);
      expect(v.audio.noiseFloorDb).toBeLessThanOrEqual(-34);
      expect(v.audio.voiceToBackgroundDb).toBeGreaterThanOrEqual(20);
      expect(v.audio.sampleRateHz).toBe(44100);
    }
  });

  describe('rejects voices that could be unsafe or unlicensed', () => {
    const cases: [string, (v: Record<string, unknown>) => void][] = [
      ['non-commercial licence', (v) => ((v.credit as Record<string, unknown>).licence = 'CC BY-NC 4.0')],
      ['no-derivatives licence', (v) => ((v.credit as Record<string, unknown>).licence = 'CC BY-ND 4.0')],
      ['"public domain" claim', (v) => ((v.credit as Record<string, unknown>).licence = 'Public domain')],
      ['missing credit', (v) => delete v.credit],
      ['clip of 30 s (iOS refuses ≥ 30 s)', (v) => ((v.clip as Record<string, unknown>).durationSec = 30)],
      ['clip too short', (v) => ((v.clip as Record<string, unknown>).durationSec = 3)],
      ['hot true peak', (v) => ((v.audio as Record<string, unknown>).truePeak = 0.2)],
      ['bad checksum format', (v) => (v.sha256 = 'abc')],
      ['id with path characters', (v) => (v.id = '../evil')],
    ];
    it.each(cases)('%s', (_name, mutate) => {
      const v = clone(bundled) as unknown as Record<string, unknown>;
      mutate(v);
      expect(() => validateVoice(v)).toThrow(CatalogueError);
    });

    const directCases: [string, (d: Record<string, unknown>) => void][] = [
      ['http download URL', (d) => (d.url = 'http://upload.wikimedia.org/x.mp3')],
      ['untrusted host', (d) => (d.url = 'https://evil.example/x.mp3')],
      ['Ogg download (iOS cannot play it)', (d) => (d.format = 'ogg')],
      ['gain that would boost', (d) => (d.gainDb = 3)],
      ['inverted trim', (d) => (d.trim = { startSec: 10, endSec: 5 })],
      ['missing checksum', (d) => delete d.sha256],
    ];
    it.each(directCases)('direct source: %s', (_name, mutate) => {
      const v = clone(downloadable) as unknown as { direct: Record<string, unknown> };
      mutate(v.direct);
      expect(() => validateVoice(v)).toThrow(CatalogueError);
    });

    it('a bundled voice must not carry a download source, a download voice must have one', () => {
      expect(() => validateVoice({ ...clone(bundled), direct: clone(downloadable).direct })).toThrow(CatalogueError);
      expect(() => validateVoice({ ...clone(downloadable), direct: null })).toThrow(CatalogueError);
    });
  });

  it('a remote catalogue drops invalid and duplicate voices instead of crashing', () => {
    const good = clone(bundled);
    const bad = { ...clone(bundled), id: 'bad-one', credit: { ...clone(bundled).credit, licence: 'CC BY-NC 3.0' } };
    const { catalogue, rejected } = parseCatalogue({ schemaVersion: 2, generatedAt: 'x', voices: [good, bad, good, 7] });
    expect(catalogue.voices.map((v) => v.id)).toEqual([good.id]);
    expect(rejected).toHaveLength(3);
    expect(() => parseCatalogue({ schemaVersion: 1, voices: [] })).toThrow(CatalogueError);
    expect(() => parseCatalogue(null)).toThrow(CatalogueError);
  });

  it('accepts a mirror host only when the caller allows it', () => {
    const v = clone(downloadable) as AdhanVoice & { direct: { url: string } };
    const mirrored = { ...v, direct: { ...v.direct, url: 'https://cdn.example.org/a.mp3' } };
    expect(() => validateVoice(mirrored)).toThrow(CatalogueError);
    expect(() => validateVoice(mirrored, ['cdn.example.org'])).not.toThrow();
  });
});

describe('voice selection', () => {
  const vs = (over: Partial<VoiceSettings> = {}): VoiceSettings => ({
    defaultVoice: DEFAULT_VOICE_ID,
    byPrayer: { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null },
    ...over,
  });
  const all = () => true;

  it('uses the default voice, and the built-in Fajr adhan for Fajr', () => {
    expect(resolveVoice('dhuhr', vs(), all).id).toBe(DEFAULT_VOICE_ID);
    expect(resolveVoice('fajr', vs(), all).id).toBe(DEFAULT_FAJR_VOICE_ID);
  });

  it('honours a per-prayer choice (including a separate Fajr voice)', () => {
    const settings = vs({ byPrayer: { fajr: downloadable.id, dhuhr: null, asr: null, maghrib: downloadable.id, isha: null } });
    expect(resolveVoice('fajr', settings, all).id).toBe(downloadable.id);
    expect(resolveVoice('maghrib', settings, all).id).toBe(downloadable.id);
    expect(resolveVoice('asr', settings, all).id).toBe(DEFAULT_VOICE_ID);
  });

  it('never leaves a prayer without a voice: a deleted download falls back along the chain to a bundled voice', () => {
    const settings = vs({ defaultVoice: downloadable.id, byPrayer: { fajr: downloadable.id, dhuhr: downloadable.id, asr: null, maghrib: null, isha: null } });
    const onlyBundled = (id: string) => voiceById(id)?.delivery === 'bundled';
    for (const p of PRAYERS) expect(voiceById(resolveVoice(p, settings, onlyBundled).id)?.delivery).toBe('bundled');
    expect(resolveVoice('fajr', settings, onlyBundled).id).toBe(DEFAULT_FAJR_VOICE_ID);
    expect(resolveVoice('asr', settings, () => false).delivery).toBe('bundled');
  });

  it('a Fajr-only adhan (extra Fajr phrase) never sounds for another prayer, even if chosen or set as default', () => {
    const wrong = vs({ defaultVoice: fajrVoice.id, byPrayer: { fajr: null, dhuhr: fajrVoice.id, asr: null, maghrib: fajrVoice.id, isha: null } });
    for (const p of ['dhuhr', 'asr', 'maghrib', 'isha'] as const) expect(resolveVoice(p, wrong, all).kind).toBe('adhan');
    expect(resolveVoice('fajr', wrong, all).id).toBe(fajrVoice.id);
    expect(voiceFitsPrayer(fajrVoice, 'asr')).toBe(false);
    expect(voiceFitsPrayer(bundled, 'fajr')).toBe(true);
  });

  it('an unknown voice id (removed from the library) is skipped', () => {
    expect(resolveVoice('dhuhr', vs({ defaultVoice: 'gone-voice' }), all).id).toBe(DEFAULT_VOICE_ID);
  });
});

describe('playback levelling', () => {
  it('mastered files need no gain/trim; raw downloads carry attenuation, trim and a fade-out', () => {
    expect(playbackProfile(downloadable, 'adhan.m4a')).toEqual({ gainDb: 0, startSec: 0, endSec: null, fadeOutSec: 0 });
    const p = playbackProfile(downloadable, `adhan.${downloadable.direct!.format}`);
    expect(p.gainDb).toBeLessThanOrEqual(0);
    expect(p.endSec).toBeGreaterThan(p.startSec);
    expect(p.fadeOutSec).toBeGreaterThan(0);
  });

  it('dbToVolume attenuates, never boosts, and is clamped', () => {
    expect(dbToVolume(0)).toBe(1);
    expect(dbToVolume(-6)).toBeCloseTo(0.501, 2);
    expect(dbToVolume(-20)).toBeCloseTo(0.1, 2);
    expect(dbToVolume(6)).toBe(1);
    expect(dbToVolume(-200)).toBeGreaterThanOrEqual(0);
  });

  it('levelAt: fades in from the start point, plays at gain, fades out before the trim end', () => {
    const prof = { gainDb: -6, startSec: 2, endSec: 100, fadeOutSec: 1.4 };
    expect(levelAt(2, prof, 120)).toBe(0);
    expect(levelAt(2.125, prof, 120)).toBeCloseTo(0.25, 1);
    expect(levelAt(50, prof, 120)).toBeCloseTo(dbToVolume(-6), 5);
    expect(levelAt(99.3, prof, 120)).toBeCloseTo(dbToVolume(-6) * 0.5, 1);
    expect(levelAt(100, prof, 120)).toBe(0);
    for (let t = 0; t < 130; t += 0.37) {
      const l = levelAt(t, prof, 120);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

describe('download sources', () => {
  it('orders the optional mirror first, then the pinned Commons file; both fully pinned', () => {
    const none = adhanSources(downloadable, null);
    expect(none).toHaveLength(1);
    expect(none[0]).toMatchObject({
      kind: 'commons',
      format: downloadable.direct!.format,
      sha256: downloadable.direct!.sha256,
      bytes: downloadable.direct!.bytes,
    });
    const withMirror = adhanSources(downloadable, 'https://cdn.example.org/adhan');
    expect(withMirror.map((s) => s.kind)).toEqual(['mirror', 'commons']);
    expect(withMirror[0]).toMatchObject({
      url: `https://cdn.example.org/adhan/${downloadable.file}`,
      format: 'm4a',
      sha256: downloadable.sha256,
      file: 'adhan.m4a',
    });
  });
});

describe('adhan settings', () => {
  it('defaults: Makkah for all prayers, no per-prayer overrides', () => {
    expect(DEFAULT_SETTINGS.adhan.voice).toBe(DEFAULT_VOICE_ID);
    expect(voiceById(DEFAULT_VOICE_ID)?.kind).toBe('adhan');
    expect(Object.values(DEFAULT_SETTINGS.adhan.byPrayer).every((v) => v === null)).toBe(true);
  });

  it('migrates the first library’s settings (old ids, single Fajr voice) without losing the user’s intent', () => {
    const migrated = sanitizeSettings({ adhan: { voice: 'makkah-2013', fajrVoice: 'beautiful', sound: { isha: 'silent' } } });
    // Voices removed after the rights/quality review map to the default; the user's other settings survive.
    expect(migrated.adhan.voice).toBe(DEFAULT_VOICE_ID);
    expect(migrated.adhan.byPrayer.fajr).toBe(DEFAULT_VOICE_ID);
    expect(migrated.adhan.sound.isha).toBe('silent');
    // A Fajr voice equal to the old default was never a deliberate choice.
    expect(sanitizeSettings({ adhan: { voice: 'makkah-2013', fajrVoice: 'makkah-2013' } }).adhan.byPrayer.fajr).toBeNull();
    // Removed recordings map to the default instead of dangling.
    expect(sanitizeSettings({ adhan: { voice: 'sabah-fakhri' } }).adhan.voice).toBe(DEFAULT_VOICE_ID);
  });

  it('sanitises hostile values', () => {
    const s = sanitizeSettings({
      adhan: { voice: '../../etc/passwd', byPrayer: { fajr: 5, dhuhr: { a: 1 }, asr: 'ok-voice', maghrib: '', isha: 'X'.repeat(80) } },
    });
    expect(s.adhan.voice).toBe(DEFAULT_VOICE_ID);
    expect(s.adhan.byPrayer).toEqual({ fajr: null, dhuhr: null, asr: 'ok-voice', maghrib: null, isha: null });
  });
});
