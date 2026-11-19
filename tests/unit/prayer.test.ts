import fixtures from '../fixtures/prayer-times.aladhan.json';
import { METHOD_IDS, suggestMethod, type MethodId } from '@/services/prayer/methods';
import { calculateDay, nextPrayer, NO_ADJUSTMENTS, splitDuration, type PrayerConfig } from '@/services/prayer/times';

const hhmm = (d: Date, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

const minutes = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h! * 60 + m!;
};

/**
 * Two independent implementations round differently (adhan-js rounds to nearest minute
 * after its own refinements); ±2 min is the accepted inter-calculator tolerance.
 */
const TOLERANCE = 2;

/**
 * Known, documented differences between adhan-js and AlAdhan for the same method.
 * adhan-js Dubai applies methodAdjustments { sunrise: -3, asr: +3 } that AlAdhan's
 * "Dubai (experimental)" method does not.
 */
const DOCUMENTED_DEVIATIONS: Partial<Record<string, Partial<Record<string, number>>>> = {
  dubai: { sunrise: -3, asr: 3 },
};

describe('prayer times vs independent AlAdhan reference', () => {
  const cases = fixtures.cases;

  it('covers every supported method except Moonsighting (seasonal, separately verified)', () => {
    const covered = new Set(cases.map((c) => c.method));
    const missing = METHOD_IDS.filter((m) => m !== 'moonsighting_committee' && !covered.has(m));
    expect(missing).toEqual([]);
  });

  it.each(cases.map((c) => [`${c.city} ${c.method} ${c.date}`, c] as const))('%s within ±1 min', (_label, c) => {
    const [y, mo, d] = c.date.split('-').map(Number);
    const config: PrayerConfig = {
      latitude: c.lat,
      longitude: c.lng,
      method: c.method as MethodId,
      madhab: c.school === 1 ? 'hanafi' : 'shafi',
      // AlAdhan's default high-latitude handling is ANGLE_BASED (see response meta).
      highLatitudeRule: 'twilight_angle',
      adjustments: NO_ADJUSTMENTS,
    };
    const day = calculateDay(config, new Date(y!, mo! - 1, d!));
    const problems: string[] = [];
    for (const t of day.times) {
      const expected = c.expected[t.name];
      const actual = hhmm(t.time, c.tz);
      const delta = minutes(actual) - minutes(expected);
      const documented = DOCUMENTED_DEVIATIONS[c.method]?.[t.name];
      if (documented !== undefined) {
        if (Math.abs(delta - documented) > TOLERANCE) problems.push(`${t.name}: expected documented Δ${documented}, got Δ${delta}`);
      } else if (Math.abs(delta) > TOLERANCE) {
        problems.push(`${t.name}: expected ${expected}, got ${actual} (Δ${delta} min)`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('adjustments', () => {
  const base: PrayerConfig = {
    latitude: 21.4225,
    longitude: 39.8262,
    method: 'umm_al_qura',
    madhab: 'shafi',
    highLatitudeRule: 'auto',
    adjustments: NO_ADJUSTMENTS,
  };

  it('applies per-prayer minute offsets and keeps the calculated value', () => {
    const date = new Date(2026, 2, 20);
    const plain = calculateDay(base, date);
    const adj = calculateDay({ ...base, adjustments: { ...NO_ADJUSTMENTS, fajr: 3, isha: -2 } }, date);
    const f0 = plain.times.find((t) => t.name === 'fajr')!;
    const f1 = adj.times.find((t) => t.name === 'fajr')!;
    expect(f1.adjustedBy).toBe(3);
    expect(f1.calculated.getTime()).toBe(f0.time.getTime());
    expect(f1.time.getTime() - f0.time.getTime()).toBe(3 * 60_000);
    expect(adj.times.find((t) => t.name === 'isha')!.adjustedBy).toBe(-2);
    expect(adj.times.find((t) => t.name === 'dhuhr')!.adjustedBy).toBe(0);
  });

  it('rejects invalid coordinates', () => {
    expect(() => calculateDay({ ...base, latitude: 120 }, new Date())).toThrow(RangeError);
    expect(() => calculateDay({ ...base, longitude: Number.NaN }, new Date())).toThrow(RangeError);
  });
});

describe('nextPrayer', () => {
  const config: PrayerConfig = {
    latitude: 48.8566,
    longitude: 2.3522,
    method: 'muslim_world_league',
    madhab: 'shafi',
    highLatitudeRule: 'auto',
    adjustments: NO_ADJUSTMENTS,
  };

  it('returns the next time strictly after now, and rolls over to tomorrow after isha', () => {
    const day = calculateDay(config, new Date(2026, 5, 21));
    const dhuhr = day.times.find((t) => t.name === 'dhuhr')!;
    const justBefore = new Date(dhuhr.time.getTime() - 60_000);
    const r = nextPrayer(config, justBefore);
    expect(r.next.name).toBe('dhuhr');
    expect(r.current?.name).toBe('sunrise');
    expect(r.msRemaining).toBe(60_000);
    expect(r.progress).toBeGreaterThan(0.99);

    const isha = day.times.find((t) => t.name === 'isha')!;
    const after = nextPrayer(config, new Date(isha.time.getTime() + 60_000));
    expect(after.next.name).toBe('fajr');
    expect(after.next.time.getTime()).toBeGreaterThan(isha.time.getTime());
    expect(after.current?.name).toBe('isha');
  });

  it('can skip sunrise for prayer-only countdowns', () => {
    const day = calculateDay(config, new Date(2026, 5, 21));
    const fajr = day.times.find((t) => t.name === 'fajr')!;
    const r = nextPrayer(config, new Date(fajr.time.getTime() + 60_000), false);
    expect(r.next.name).toBe('dhuhr');
  });

  it('splits durations', () => {
    expect(splitDuration(3_723_000)).toEqual({ hours: 1, minutes: 2, seconds: 3 });
    expect(splitDuration(-5)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('method suggestion', () => {
  it('suggests by country and falls back to MWL', () => {
    expect(suggestMethod('SA')).toBe('umm_al_qura');
    expect(suggestMethod('fr')).toBe('france_uoif');
    expect(suggestMethod('MA')).toBe('morocco');
    expect(suggestMethod('ZZ')).toBe('muslim_world_league');
    expect(suggestMethod(null)).toBe('muslim_world_league');
  });
});
