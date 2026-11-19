import { Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Rounding } from 'adhan';

import { addDays } from '@/utils/date';

import { methodParameters, type MethodId } from './methods';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];
/** The five obligatory prayers (sunrise is a time marker, not a prayer). */
export const FARD_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type FardPrayer = (typeof FARD_PRAYERS)[number];

export type HighLatitudeSetting = 'auto' | 'middle_of_the_night' | 'seventh_of_the_night' | 'twilight_angle';

export interface PrayerConfig {
  readonly latitude: number;
  readonly longitude: number;
  readonly method: MethodId;
  readonly madhab: 'shafi' | 'hanafi';
  readonly highLatitudeRule: HighLatitudeSetting;
  /** User minute offsets per time. Non-zero values are flagged in the UI as "adjusted". */
  readonly adjustments: Readonly<Record<PrayerName, number>>;
}

export interface PrayerTime {
  readonly name: PrayerName;
  readonly time: Date;
  /** Purely calculated time, before user adjustment. */
  readonly calculated: Date;
  readonly adjustedBy: number;
}

export interface DaySchedule {
  readonly date: Date;
  readonly times: readonly PrayerTime[];
}

export const NO_ADJUSTMENTS: Readonly<Record<PrayerName, number>> = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

export function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function highLatRule(setting: HighLatitudeSetting, coords: Coordinates) {
  switch (setting) {
    case 'middle_of_the_night':
      return HighLatitudeRule.MiddleOfTheNight;
    case 'seventh_of_the_night':
      return HighLatitudeRule.SeventhOfTheNight;
    case 'twilight_angle':
      return HighLatitudeRule.TwilightAngle;
    case 'auto':
      return HighLatitudeRule.recommended(coords);
  }
}

/**
 * Calculates the six daily times for the local calendar day containing `date`.
 * Times are absolute instants; display them in the device time zone.
 */
export function calculateDay(config: PrayerConfig, date: Date): DaySchedule {
  if (!isValidCoordinate(config.latitude, config.longitude)) throw new RangeError('Invalid coordinates');
  const coords = new Coordinates(config.latitude, config.longitude);
  const params = methodParameters(config.method);
  params.madhab = config.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = highLatRule(config.highLatitudeRule, coords);
  params.rounding = Rounding.Nearest;
  // adhan-js reads the calendar date from the given Date's local Y/M/D.
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const pt = new PrayerTimes(coords, day, params);

  const times = PRAYERS.map((name) => {
    const calculated = pt[name];
    const adjustedBy = Math.trunc(config.adjustments[name] ?? 0);
    return { name, calculated, adjustedBy, time: new Date(calculated.getTime() + adjustedBy * 60_000) };
  });
  return { date: day, times };
}

export interface NextPrayer {
  readonly current: PrayerTime | null;
  readonly next: PrayerTime;
  /** 0..1 elapsed between `current` (or previous isha) and `next`. */
  readonly progress: number;
  readonly msRemaining: number;
}

/**
 * Finds the next time strictly after `now`, looking into tomorrow after Isha,
 * and the progress through the current interval (for the countdown arc).
 */
export function nextPrayer(config: PrayerConfig, now: Date, includeSunrise = true): NextPrayer {
  const filter = (t: PrayerTime) => includeSunrise || t.name !== 'sunrise';
  const yesterday = calculateDay(config, addDays(now, -1)).times.filter(filter);
  const today = calculateDay(config, now).times.filter(filter);
  const tomorrow = calculateDay(config, addDays(now, 1)).times.filter(filter);
  const timeline = [...yesterday, ...today, ...tomorrow];

  const idx = timeline.findIndex((t) => t.time.getTime() > now.getTime());
  const next = timeline[idx]!;
  const current = idx > 0 ? timeline[idx - 1]! : null;
  const start = current?.time.getTime() ?? now.getTime();
  const span = next.time.getTime() - start;
  const progress = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - start) / span)) : 0;
  return { current, next, progress, msRemaining: next.time.getTime() - now.getTime() };
}

/** Splits a millisecond duration into h/m/s for the countdown. */
export function splitDuration(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}
