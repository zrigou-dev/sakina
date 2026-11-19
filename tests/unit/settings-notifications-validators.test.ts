import { DAYS_AHEAD, MAX_PENDING, planNotifications } from '@/services/notifications/plan';
import { NO_ADJUSTMENTS, type PrayerConfig } from '@/services/prayer/times';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '@/state/settings';
import {
  looksLikeMp3,
  parseHadithEdition,
  PayloadValidationError,
  validateAlQuranCloudEdition,
  validateAudioFile,
  verifyChecksum,
} from '@/services/downloads/validators';
import { allVoices } from '@/services/adhan/voices';
import { findPackage, parseCatalogue, bundledCatalogue, recitationPackages } from '@/services/downloads/catalogue';
import { ContentPackageError, parseContentPackage } from '@/services/content/packages';
import { nearestCity, searchCities } from '@/services/location/cities';
import {
  getSurah,
  globalIndex,
  hizbOf,
  juzOf,
  juzStart,
  nextVerse,
  pageOf,
  pageStart,
  previousVerse,
  quranProgress,
  SURAHS,
  verseFromGlobalIndex,
} from '@/services/quran/navigation';
import { parseTanzilXml, validateQuranVerses } from '@/services/quran/parse';

describe('settings sanitisation (untrusted storage/import)', () => {
  it('returns defaults for garbage and never throws', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ language: 'xx', theme: 5, fontScale: 'big', prayer: 'nope', location: { latitude: 999, longitude: 0 } })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('clamps and keeps valid values', () => {
    const s = sanitizeSettings({
      language: 'fr',
      fontScale: 9,
      hijriOffset: 7,
      prayer: { method: 'morocco', madhab: 'hanafi', adjustments: { fajr: 99, isha: -3.7 } },
      notifications: { morning: { enabled: true, time: '25:00' }, preReminderMinutes: 15 },
      location: {
        source: 'city',
        latitude: 33.57,
        longitude: -7.59,
        name: 'Casablanca',
        nameAr: 'الدار البيضاء',
        country: 'MA',
        timezone: 'Africa/Casablanca',
      },
    });
    expect(s.language).toBe('fr');
    expect(s.fontScale).toBe(1.4);
    expect(s.hijriOffset).toBe(2);
    expect(s.prayer).toMatchObject({ method: 'morocco', madhab: 'hanafi' });
    expect(s.prayer.adjustments).toMatchObject({ fajr: 30, isha: -3, dhuhr: 0 });
    expect(s.notifications.morning).toEqual({ enabled: true, time: '07:00' });
    expect(s.notifications.preReminderMinutes).toBe(15);
    expect(s.location?.name).toBe('Casablanca');
  });
});

describe('notification planning', () => {
  const config: PrayerConfig = {
    latitude: 21.4225,
    longitude: 39.8262,
    method: 'umm_al_qura',
    madhab: 'shafi',
    highLatitudeRule: 'auto',
    adjustments: NO_ADJUSTMENTS,
  };
  const now = new Date(2026, 10, 18, 10, 0);

  it('plans future prayer reminders only, sorted, within the iOS cap', () => {
    const plan = planNotifications(DEFAULT_SETTINGS, config, now);
    expect(plan.length).toBeLessThanOrEqual(MAX_PENDING);
    expect(plan.every((p) => p.date.getTime() > now.getTime())).toBe(true);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.date.getTime()).toBeGreaterThanOrEqual(plan[i - 1]!.date.getTime());
    expect(plan.filter((p) => p.kind === 'prayer').length).toBeLessThanOrEqual(5 * DAYS_AHEAD);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it('respects per-prayer switches, pre-reminders and daily reminders', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        prayers: { fajr: true, dhuhr: false, asr: false, maghrib: false, isha: false },
        preReminderMinutes: 10,
        morning: { enabled: true, time: '07:30' },
      },
    };
    const plan = planNotifications(s, config, now);
    expect(plan.filter((p) => p.kind === 'prayer').every((p) => p.prayer === 'fajr')).toBe(true);
    const pre = plan.find((p) => p.kind === 'pre_prayer')!;
    const main = plan.find((p) => p.kind === 'prayer' && p.id.replace('prayer-', '') === pre.id.replace('pre-', ''))!;
    expect(main.date.getTime() - pre.date.getTime()).toBe(10 * 60_000);
    const morning = plan.filter((p) => p.kind === 'morning');
    expect(morning.length).toBe(DAYS_AHEAD - 1); // today's 07:30 already passed at 10:00
    expect(morning[0]!.date.getHours()).toBe(7);
    expect(morning[0]!.date.getMinutes()).toBe(30);
  });

  it('plans only daily reminders when no location is set', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, friday: { enabled: false, time: '10:00' }, quran: { enabled: true, time: '20:00' } },
    };
    const plan = planNotifications(s, null, now);
    expect(plan.every((p) => p.kind === 'quran')).toBe(true);
    expect(plan.length).toBe(DAYS_AHEAD);
  });
});

describe('notification planning — adhan, reminders and budget', () => {
  const config: PrayerConfig = {
    latitude: 21.4225,
    longitude: 39.8262,
    method: 'umm_al_qura',
    madhab: 'shafi',
    highLatitudeRule: 'auto',
    adjustments: NO_ADJUSTMENTS,
  };
  const now = new Date(2026, 10, 18, 10, 0); // a Wednesday

  it('uses the adhan channel/sound per prayer setting', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      adhan: { ...DEFAULT_SETTINGS.adhan, sound: { ...DEFAULT_SETTINGS.adhan.sound, isha: 'silent', asr: 'default' } },
    };
    const plan = planNotifications(s, config, now);
    const byPrayer = (p: string) => plan.find((x) => x.kind === 'prayer' && x.prayer === p)!;
    expect(byPrayer('maghrib')).toMatchObject({ channel: 'prayer-adhan', sound: 'adhan' });
    expect(byPrayer('asr')).toMatchObject({ channel: 'prayer', sound: 'default' });
    expect(byPrayer('isha')).toMatchObject({ channel: 'prayer-silent', sound: null });
  });

  it('plans after-prayer, Friday, fasting-day and periodic dhikr reminders', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, afterPrayer: { enabled: true, minutes: 10 }, fastingDays: { enabled: true, time: '20:30' } },
      dhikrReminders: { ...DEFAULT_SETTINGS.dhikrReminders, enabled: true, intervalMinutes: 120, startHour: 9, endHour: 21 },
    };
    const plan = planNotifications(s, config, now, 12);
    const after = plan.find((x) => x.kind === 'after_prayer' && x.prayer === 'dhuhr')!;
    const dhuhr = plan.find((x) => x.kind === 'prayer' && x.prayer === 'dhuhr')!;
    expect(after.date.getTime() - dhuhr.date.getTime()).toBe(10 * 60_000);
    expect(plan.some((x) => x.kind === 'friday' && x.date.getDay() === 5)).toBe(true);
    // Wednesday evening → reminder for Thursday's fast.
    expect(plan.find((x) => x.kind === 'fasting' && x.date.getDate() === 18)?.fastingReason).toBe('thursday');
    expect(plan.filter((x) => x.kind === 'dhikr').every((x) => x.date.getHours() >= 9 && x.date.getHours() < 21)).toBe(true);
    expect(plan.filter((x) => x.kind === 'dhikr').every((x) => x.dhikrIndex! >= 0 && x.dhikrIndex! < 12)).toBe(true);
  });

  it('never exceeds the cap and always keeps prayer times first', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        preReminderMinutes: 10,
        afterPrayer: { enabled: true, minutes: 10 },
        morning: { enabled: true, time: '07:00' },
        evening: { enabled: true, time: '17:00' },
        sleep: { enabled: true, time: '22:00' },
        quran: { enabled: true, time: '20:00' },
      },
      dhikrReminders: { ...DEFAULT_SETTINGS.dhikrReminders, enabled: true, intervalMinutes: 30 },
    };
    const plan = planNotifications(s, config, now, 20);
    expect(plan.length).toBe(MAX_PENDING);
    const allPrayers = planNotifications({ ...DEFAULT_SETTINGS }, config, now).filter((x) => x.kind === 'prayer').length;
    expect(plan.filter((x) => x.kind === 'prayer').length).toBe(allPrayers);
  });
});

describe('payload validators', () => {
  const edition = (n = 6236, id = 'en.x') => ({
    code: 200,
    data: {
      edition: { identifier: id },
      surahs: SURAHS.map((s) => ({ number: s.number, ayahs: Array.from({ length: s.ayahCount }, (_, i) => ({ number: s.startIndex + i + 1, text: 't' })) })),
    },
    n,
  });

  it('accepts a complete, ordered edition', () => {
    expect(validateAlQuranCloudEdition(edition(), 'en.x')).toHaveLength(6236);
  });

  it('rejects wrong edition, missing ayahs, empty text and HTTP-200 error bodies', () => {
    expect(() => validateAlQuranCloudEdition(edition(), 'fr.y')).toThrow(PayloadValidationError);
    const broken = edition();
    broken.data.surahs[1]!.ayahs.pop();
    expect(() => validateAlQuranCloudEdition(broken, 'en.x')).toThrow(PayloadValidationError);
    const empty = edition();
    empty.data.surahs[0]!.ayahs[0]!.text = '  ';
    expect(() => validateAlQuranCloudEdition(empty, 'en.x')).toThrow(PayloadValidationError);
    expect(() => validateAlQuranCloudEdition({ code: 404, data: 'Not found' }, 'en.x')).toThrow(PayloadValidationError);
  });

  it('detects MP3 headers and rejects HTML error pages served as audio', () => {
    expect(looksLikeMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toBe(true);
    expect(looksLikeMp3(new TextEncoder().encode('<!DOCTYPE html>'))).toBe(false);
    expect(() => validateAudioFile(50_000, new TextEncoder().encode('<htm'))).toThrow(PayloadValidationError);
    expect(() => validateAudioFile(10, new Uint8Array([0x49, 0x44, 0x33, 0]))).toThrow(PayloadValidationError);
  });

  it('verifies pinned checksums (case-insensitive) and skips when none is pinned', () => {
    expect(() => verifyChecksum('abc', 'ABC')).not.toThrow();
    expect(() => verifyChecksum('abc', 'abd')).toThrow(PayloadValidationError);
    expect(() => verifyChecksum('abc', undefined)).not.toThrow();
  });

  it('parses hadith-api editions: sections, grades, references; skips empty entries without inventing', () => {
    const hadiths = Array.from({ length: 50 }, (_, i) => ({
      hadithnumber: i + 1,
      text: i === 3 ? '' : `نص ${i + 1}`,
      grades:
        i === 0
          ? [
              { name: 'Al-Albani', grade: 'Sahih' },
              { name: '', grade: 'x' },
            ]
          : [],
      reference: { book: i < 25 ? 1 : 2, hadith: i + 1 },
    }));
    const ed = parseHadithEdition({
      metadata: {
        name: 'Test',
        sections: { '0': '', '1': 'Faith', '2': 'Prayer' },
        section_details: { '1': { hadithnumber_first: 1, hadithnumber_last: 25 } },
      },
      hadiths,
    });
    expect(ed.hadiths).toHaveLength(49);
    expect(ed.skippedEmpty).toBe(1);
    expect(ed.sections.map((s) => s.name)).toEqual(['Faith', 'Prayer']);
    expect(ed.hadiths[0]!.grades).toEqual([{ name: 'Al-Albani', grade: 'Sahih' }]);
    expect(ed.hadiths[30]!.section).toBe(2);
    expect(() => parseHadithEdition({ metadata: { name: 'x' }, hadiths: [] })).toThrow(PayloadValidationError);
    expect(() => parseHadithEdition({ metadata: { name: 'x' }, hadiths: hadiths.map((h) => ({ ...h, text: '' })) })).toThrow(PayloadValidationError);
  });
});

describe('catalogue', () => {
  it('bundled catalogue is valid and every package has provenance + licence', () => {
    const c = bundledCatalogue();
    expect(parseCatalogue(JSON.parse(JSON.stringify(c)))).not.toBeNull();
    for (const p of c.packages) {
      expect(p.source.url).toMatch(/^https:\/\//);
      expect(p.licence.text.length).toBeGreaterThan(10);
      expect(p.name.ar && p.name.en && p.name.fr).toBeTruthy();
    }
    expect(parseCatalogue({ schemaVersion: 99, packages: [] })).toBeNull();
    // Every download-delivered adhan has a catalogue package with a pinned source; bundled ones have none.
    const adhans = c.packages.filter((p) => p.kind === 'adhan');
    expect(adhans.length).toBe(allVoices().filter((v) => v.delivery === 'download').length);
    for (const p of adhans) expect(p.payload).toMatchObject({ type: 'adhan-audio' });
  });

  it('hadith packages exist for all nine collections in the right languages', () => {
    for (const b of ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik']) {
      expect(findPackage(`hadith.${b}.ar`)?.payload).toMatchObject({ type: 'hadith-edition', book: b, translationUrl: null });
      expect(findPackage(`hadith.${b}.en`)?.payload).toMatchObject({ translationLang: 'en' });
    }
    expect(findPackage('hadith.tirmidhi.fr')).toBeNull(); // no French Tirmidhi in the source
    expect(findPackage('hadith.unknown.ar')).toBeNull();
  });

  it('recitation packages cover all 114 surahs with per-ayah URLs', () => {
    const r = recitationPackages('ar.alafasy');
    expect(r).toHaveLength(114);
    expect(findPackage('recitation.ar.alafasy.36')?.payload).toMatchObject({ type: 'ayah-audio', surah: 36, ayahCount: 83 });
    expect(findPackage('recitation.ar.alafasy.115')).toBeNull();
    expect(findPackage('nope')).toBeNull();
  });
});

describe('content packages', () => {
  const pkg = {
    format: 'sakina-content',
    version: 1,
    id: 'test.wudu',
    section: 'academy',
    language: 'en',
    title: 'Test',
    description: 'd',
    source: { name: 'Publisher', url: 'https://example.org' },
    license: 'CC BY 4.0',
    reviewed: null,
    items: [{ id: 'l1', title: 'Lesson', body: 'Body', contentType: 'educational_summary', source: 'Book p.1' }],
  };
  it('accepts a well-formed package', () => {
    expect(parseContentPackage(JSON.stringify(pkg)).items).toHaveLength(1);
  });
  it.each([
    ['wrong format', { ...pkg, format: 'x' }],
    ['http source', { ...pkg, source: { name: 'p', url: 'http://example.org' } }],
    ['missing content type', { ...pkg, items: [{ ...pkg.items[0], contentType: 'fatwa' }] }],
    ['duplicate items', { ...pkg, items: [pkg.items[0], pkg.items[0]] }],
    ['bad id', { ...pkg, id: '../etc' }],
  ])('rejects %s', (_n, bad) => {
    expect(() => parseContentPackage(JSON.stringify(bad))).toThrow(ContentPackageError);
  });
});

describe('cities (offline location)', () => {
  it('finds cities by Latin and Arabic names, with accents and hamza variants', () => {
    expect(searchCities('makkah')[0]?.name).toBe('Makkah');
    expect(searchCities('مكة')[0]?.name).toBe('Makkah');
    expect(searchCities('casabl')[0]?.name).toBe('Casablanca');
    expect(searchCities('الدار البيضاء')[0]?.name).toBe('Casablanca');
    expect(searchCities('a')).toEqual([]);
  });
  it('names a GPS position from the nearest bundled city, offline', () => {
    expect(nearestCity(48.86, 2.35)?.name).toBe('Paris');
    expect(nearestCity(0, -140)).toBeNull();
  });
});

describe('Quran navigation', () => {
  it('maps verse ↔ global index for all 6236 ayahs', () => {
    expect(globalIndex({ surah: 1, ayah: 1 })).toBe(1);
    expect(globalIndex({ surah: 2, ayah: 255 })).toBe(262);
    expect(globalIndex({ surah: 114, ayah: 6 })).toBe(6236);
    for (let i = 1; i <= 6236; i += 37) expect(globalIndex(verseFromGlobalIndex(i))).toBe(i);
    expect(() => globalIndex({ surah: 1, ayah: 8 })).toThrow(RangeError);
    expect(() => getSurah(115)).toThrow(RangeError);
  });

  it('page / juz / hizb lookups match Tanzil boundaries', () => {
    expect(pageOf({ surah: 1, ayah: 7 })).toBe(1);
    expect(pageOf({ surah: 2, ayah: 1 })).toBe(2);
    expect(pageOf({ surah: 114, ayah: 1 })).toBe(604);
    expect(juzOf({ surah: 2, ayah: 141 })).toBe(1);
    expect(juzOf({ surah: 2, ayah: 142 })).toBe(2);
    expect(juzOf({ surah: 78, ayah: 1 })).toBe(30);
    expect(juzStart(30)).toEqual({ surah: 78, ayah: 1 });
    expect(pageStart(604).surah).toBe(112);
    expect(hizbOf({ surah: 1, ayah: 1 })).toBe(1);
    expect(hizbOf({ surah: 114, ayah: 6 })).toBe(60);
  });

  it('steps across surah boundaries', () => {
    expect(nextVerse({ surah: 1, ayah: 7 })).toEqual({ surah: 2, ayah: 1 });
    expect(previousVerse({ surah: 2, ayah: 1 })).toEqual({ surah: 1, ayah: 7 });
    expect(nextVerse({ surah: 114, ayah: 6 })).toBeNull();
    expect(previousVerse({ surah: 1, ayah: 1 })).toBeNull();
    expect(quranProgress({ surah: 114, ayah: 6 })).toBe(1);
  });

  it('Tanzil XML parser reads text, Basmala and entities; the validator catches gaps', () => {
    const xml =
      '<?xml version="1.0"?><!-- licence --><quran><sura index="1" name="x"><aya index="1" text="a &amp; b" /></sura><sura index="2" name="y"><aya index="1" text="c" bismillah="d" /></sura></quran>';
    expect(parseTanzilXml(xml)).toEqual([
      { surah: 1, ayah: 1, text: 'a & b', bismillah: null },
      { surah: 2, ayah: 1, text: 'c', bismillah: 'd' },
    ]);
    expect(validateQuranVerses(parseTanzilXml(xml)).length).toBeGreaterThan(0);
  });
});
