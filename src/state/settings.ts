import { isLanguage, type Language } from '@/localization/languages';
import { METHOD_IDS, type MethodId } from '@/services/prayer/methods';
import { NO_ADJUSTMENTS, PRAYERS, type HighLatitudeSetting, type PrayerName } from '@/services/prayer/times';
import type { TimeFormat } from '@/localization/format';
import { clamp } from '@/utils/date';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface SavedLocation {
  readonly source: 'gps' | 'city' | 'manual';
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string;
  readonly nameAr: string | null;
  readonly country: string | null;
  readonly timezone: string | null;
}

export interface ReminderSetting {
  readonly enabled: boolean;
  /** "HH:MM" local time */
  readonly time: string;
}

export type AdhanSound = 'adhan' | 'default' | 'silent';

export interface AdhanSettings {
  /** Default muezzin (catalogue voice id) for every prayer without its own choice. */
  readonly voice: string;
  /** Per-prayer choice; null = use the default (Fajr then uses the built-in Fajr adhan). */
  readonly byPrayer: Readonly<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string | null>>;
  /** Notification sound per prayer. */
  readonly sound: Readonly<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', AdhanSound>>;
  /** Play the full adhan inside the app when it is open at prayer time. */
  readonly playInApp: boolean;
  /** Show the post-adhan supplication after playback. */
  readonly showDua: boolean;
}

export interface DhikrReminderSettings {
  /** Periodic remembrance notifications during the day. */
  readonly enabled: boolean;
  readonly intervalMinutes: 30 | 60 | 120 | 180 | 240;
  readonly startHour: number;
  readonly endHour: number;
  /** Gentle on-screen remembrance while the app is open. */
  readonly inApp: boolean;
  readonly inAppMinutes: 5 | 10 | 15 | 30 | 60;
}

export interface Settings {
  readonly onboardingComplete: boolean;
  readonly language: Language;
  readonly theme: ThemePreference;
  readonly fontScale: number;
  readonly displayName: string;
  readonly location: SavedLocation | null;
  readonly prayer: {
    readonly method: MethodId;
    readonly madhab: 'shafi' | 'hanafi';
    readonly highLatitudeRule: HighLatitudeSetting;
    readonly adjustments: Readonly<Record<PrayerName, number>>;
    readonly timeFormat: TimeFormat;
  };
  readonly hijriOffset: number;
  readonly notifications: {
    readonly prayers: Readonly<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', boolean>>;
    readonly preReminderMinutes: 0 | 5 | 10 | 15 | 30;
    readonly morning: ReminderSetting;
    readonly evening: ReminderSetting;
    readonly sleep: ReminderSetting;
    readonly quran: ReminderSetting;
    /** Reminder for the post-prayer adhkar, N minutes after each prayer time. */
    readonly afterPrayer: { readonly enabled: boolean; readonly minutes: 5 | 10 | 15 | 20 | 30 };
    /** Friday reminder (Surah al-Kahf & salawat). */
    readonly friday: ReminderSetting;
    /** Evening-before reminder for Monday/Thursday and the white days. */
    readonly fastingDays: ReminderSetting;
  };
  readonly adhan: AdhanSettings;
  readonly dhikrReminders: DhikrReminderSettings;
  readonly khatma: { readonly days: number; readonly startedOn: string } | null;
  readonly quran: {
    readonly fontSize: number;
    readonly translationEdition: string | null;
    readonly reciter: string;
    readonly playbackRate: number;
  };
  readonly downloads: { readonly wifiOnly: boolean };
  readonly tasbihHaptics: boolean;
  readonly goals: Readonly<{
    quranAyahs: number;
    morning: boolean;
    evening: boolean;
    prayers: boolean;
  }>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingComplete: false,
  language: 'ar',
  theme: 'system',
  fontScale: 1,
  displayName: '',
  location: null,
  prayer: {
    method: 'muslim_world_league',
    madhab: 'shafi',
    highLatitudeRule: 'auto',
    adjustments: NO_ADJUSTMENTS,
    timeFormat: '24h',
  },
  hijriOffset: 0,
  notifications: {
    prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    preReminderMinutes: 0,
    morning: { enabled: false, time: '07:00' },
    evening: { enabled: false, time: '17:30' },
    sleep: { enabled: false, time: '22:30' },
    quran: { enabled: false, time: '20:00' },
    afterPrayer: { enabled: false, minutes: 10 },
    friday: { enabled: true, time: '10:00' },
    fastingDays: { enabled: false, time: '20:30' },
  },
  adhan: {
    voice: 'aaqib-azeez',
    byPrayer: { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null },
    sound: { fajr: 'adhan', dhuhr: 'adhan', asr: 'adhan', maghrib: 'adhan', isha: 'adhan' },
    playInApp: true,
    showDua: true,
  },
  dhikrReminders: { enabled: false, intervalMinutes: 120, startHour: 9, endHour: 21, inApp: true, inAppMinutes: 30 },
  khatma: null,
  quran: { fontSize: 30, translationEdition: null, reciter: 'ar.alafasy', playbackRate: 1 },
  downloads: { wifiOnly: true },
  tasbihHaptics: true,
  goals: { quranAyahs: 10, morning: true, evening: true, prayers: false },
};

export const FONT_SCALE_RANGE = [0.85, 1.4] as const;
export const QURAN_FONT_RANGE = [22, 48] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const time = (v: unknown, fallback: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);

function reminder(v: unknown, d: ReminderSetting): ReminderSetting {
  if (!isObj(v)) return d;
  return { enabled: bool(v.enabled, d.enabled), time: time(v.time, d.time) };
}

function location(v: unknown): SavedLocation | null {
  if (!isObj(v)) return null;
  const lat = v.latitude;
  const lng = v.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    source: oneOf(v.source, ['gps', 'city', 'manual'] as const, 'manual'),
    latitude: lat,
    longitude: lng,
    name: typeof v.name === 'string' ? v.name.slice(0, 120) : '',
    nameAr: typeof v.nameAr === 'string' ? v.nameAr.slice(0, 120) : null,
    country: typeof v.country === 'string' ? v.country.slice(0, 3) : null,
    timezone: typeof v.timezone === 'string' ? v.timezone.slice(0, 64) : null,
  };
}

/**
 * Builds a valid Settings object from untrusted stored or imported key/value data.
 * Unknown keys are ignored; invalid values fall back to defaults. Never throws.
 */
export function sanitizeSettings(raw: Record<string, unknown>): Settings {
  const d = DEFAULT_SETTINGS;
  const p = isObj(raw.prayer) ? raw.prayer : {};
  const adj = isObj(p.adjustments) ? p.adjustments : {};
  const n = isObj(raw.notifications) ? raw.notifications : {};
  const np = isObj(n.prayers) ? n.prayers : {};
  const q = isObj(raw.quran) ? raw.quran : {};
  const dl = isObj(raw.downloads) ? raw.downloads : {};
  const g = isObj(raw.goals) ? raw.goals : {};
  const ad = isObj(raw.adhan) ? raw.adhan : {};
  const ads = isObj(ad.sound) ? ad.sound : {};
  const dr = isObj(raw.dhikrReminders) ? raw.dhikrReminders : {};
  const ap = isObj(n.afterPrayer) ? n.afterPrayer : {};
  const kh = isObj(raw.khatma) ? raw.khatma : null;
  // Ids of the first adhan library (removed) map to their replacement; unknown ids fall back at playback time.
  const LEGACY_VOICES: Record<string, string> = {
    // Voices removed from the library (rights or quality review) fall back to the default.
    'makkah-2013': 'aaqib-azeez',
    'makkah-maghrib-2012': 'aaqib-azeez',
    'makkah-masjid-al-haram': 'aaqib-azeez',
    'shalkar-kazakhstan': 'aaqib-azeez',
    'beautiful-adhan': 'aaqib-azeez',
    'sabah-fakhri': 'aaqib-azeez',
    'hassan-ii': 'aaqib-azeez',
    'azan-andrewler': 'aaqib-azeez',
    'call-to-worship': 'aaqib-azeez',
    beautiful: 'aaqib-azeez',
  };
  const voice = (v: unknown, fallback: string) => (typeof v === 'string' && /^[a-z0-9-]{2,49}$/.test(v) ? (LEGACY_VOICES[v] ?? v) : fallback);
  const optVoice = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9-]{2,49}$/.test(v) ? (LEGACY_VOICES[v] ?? v) : null);
  const adByPrayer = isObj(ad.byPrayer) ? ad.byPrayer : {};
  // Migrate the old single `fajrVoice` into the per-prayer map when it was a deliberate, different choice.
  const legacyFajr = typeof ad.fajrVoice === 'string' && ad.fajrVoice !== ad.voice ? optVoice(ad.fajrVoice) : null;
  const sound = (v: unknown): AdhanSound => oneOf(v, ['adhan', 'default', 'silent'] as const, 'adhan');
  return {
    onboardingComplete: bool(raw.onboardingComplete, d.onboardingComplete),
    language: isLanguage(raw.language) ? raw.language : d.language,
    theme: oneOf(raw.theme, ['system', 'light', 'dark'] as const, d.theme),
    fontScale: num(raw.fontScale, d.fontScale, ...FONT_SCALE_RANGE),
    displayName: typeof raw.displayName === 'string' ? raw.displayName.slice(0, 40) : d.displayName,
    location: location(raw.location),
    prayer: {
      method: oneOf(p.method, METHOD_IDS, d.prayer.method),
      madhab: oneOf(p.madhab, ['shafi', 'hanafi'] as const, d.prayer.madhab),
      highLatitudeRule: oneOf(
        p.highLatitudeRule,
        ['auto', 'middle_of_the_night', 'seventh_of_the_night', 'twilight_angle'] as const,
        d.prayer.highLatitudeRule,
      ),
      adjustments: Object.fromEntries(PRAYERS.map((k) => [k, Math.trunc(num(adj[k], 0, -30, 30))])) as Record<PrayerName, number>,
      timeFormat: oneOf(p.timeFormat, ['24h', '12h'] as const, d.prayer.timeFormat),
    },
    hijriOffset: Math.trunc(num(raw.hijriOffset, d.hijriOffset, -2, 2)),
    notifications: {
      prayers: {
        fajr: bool(np.fajr, d.notifications.prayers.fajr),
        dhuhr: bool(np.dhuhr, d.notifications.prayers.dhuhr),
        asr: bool(np.asr, d.notifications.prayers.asr),
        maghrib: bool(np.maghrib, d.notifications.prayers.maghrib),
        isha: bool(np.isha, d.notifications.prayers.isha),
      },
      preReminderMinutes: oneOf(n.preReminderMinutes, [0, 5, 10, 15, 30] as const, d.notifications.preReminderMinutes),
      morning: reminder(n.morning, d.notifications.morning),
      evening: reminder(n.evening, d.notifications.evening),
      sleep: reminder(n.sleep, d.notifications.sleep),
      quran: reminder(n.quran, d.notifications.quran),
      afterPrayer: { enabled: bool(ap.enabled, false), minutes: oneOf(ap.minutes, [5, 10, 15, 20, 30] as const, 10) },
      friday: reminder(n.friday, d.notifications.friday),
      fastingDays: reminder(n.fastingDays, d.notifications.fastingDays),
    },
    adhan: {
      voice: voice(ad.voice, d.adhan.voice),
      byPrayer: {
        fajr: optVoice(adByPrayer.fajr) ?? legacyFajr,
        dhuhr: optVoice(adByPrayer.dhuhr),
        asr: optVoice(adByPrayer.asr),
        maghrib: optVoice(adByPrayer.maghrib),
        isha: optVoice(adByPrayer.isha),
      },
      sound: { fajr: sound(ads.fajr), dhuhr: sound(ads.dhuhr), asr: sound(ads.asr), maghrib: sound(ads.maghrib), isha: sound(ads.isha) },
      playInApp: bool(ad.playInApp, d.adhan.playInApp),
      showDua: bool(ad.showDua, d.adhan.showDua),
    },
    dhikrReminders: {
      enabled: bool(dr.enabled, d.dhikrReminders.enabled),
      intervalMinutes: oneOf(dr.intervalMinutes, [30, 60, 120, 180, 240] as const, d.dhikrReminders.intervalMinutes),
      startHour: Math.trunc(num(dr.startHour, d.dhikrReminders.startHour, 0, 23)),
      endHour: Math.trunc(num(dr.endHour, d.dhikrReminders.endHour, 1, 24)),
      inApp: bool(dr.inApp, d.dhikrReminders.inApp),
      inAppMinutes: oneOf(dr.inAppMinutes, [5, 10, 15, 30, 60] as const, d.dhikrReminders.inAppMinutes),
    },
    khatma:
      kh && typeof kh.days === 'number' && kh.days >= 3 && kh.days <= 365 && typeof kh.startedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(kh.startedOn)
        ? { days: Math.trunc(kh.days), startedOn: kh.startedOn }
        : null,
    quran: {
      fontSize: Math.round(num(q.fontSize, d.quran.fontSize, ...QURAN_FONT_RANGE)),
      translationEdition: typeof q.translationEdition === 'string' && /^[a-z]{2}\.[a-z0-9-]+$/.test(q.translationEdition) ? q.translationEdition : null,
      reciter: typeof q.reciter === 'string' && /^ar\.[a-z0-9]+$/.test(q.reciter) ? q.reciter : d.quran.reciter,
      playbackRate: oneOf(q.playbackRate, [0.75, 1, 1.25, 1.5] as const, 1),
    },
    downloads: { wifiOnly: bool(dl.wifiOnly, d.downloads.wifiOnly) },
    tasbihHaptics: bool(raw.tasbihHaptics, d.tasbihHaptics),
    goals: {
      quranAyahs: Math.trunc(num(g.quranAyahs, d.goals.quranAyahs, 0, 300)),
      morning: bool(g.morning, d.goals.morning),
      evening: bool(g.evening, d.goals.evening),
      prayers: bool(g.prayers, d.goals.prayers),
    },
  };
}

/** Flattens settings into the top-level key/value rows stored in SQLite. */
export function settingsToRows(s: Settings): Record<string, unknown> {
  return { ...s };
}
