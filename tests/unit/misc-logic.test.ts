import { createQueue, onTrackFinished, skip } from '@/services/audio/queue';
import { counterProgress, decrement, increment, isComplete, resetCounter } from '@/services/counter/counter';
import { dueDateAfter, isMemorized, NEW_REVIEW_STATE, review } from '@/services/memorization/scheduler';
import { distanceToKaabaKm, headingQuality, normalizeDegrees, qiblaBearing, relativeAngle } from '@/services/qibla/qibla';
import { dailyVerseKey } from '@/services/quran/daily';
import { RUKU_STARTS } from '@/content/quran/metadata.generated';
import { completion, progressKey, sessionCollection, type DhikrView } from '@/features/adhkar/data';
import { ADHKAR_GROUPS, groupOfChapter, HISN } from '@/content/adhkar/groups';
import HISN_DATA from '@/content/adhkar/hisn.generated.json';
import { khatmaDay, khatmaPortion, khatmaProgress, KHATMA_PRESETS } from '@/services/quran/khatma';
import { nightTimes } from '@/services/prayer/night';
import { NO_ADJUSTMENTS } from '@/services/prayer/times';
import { ESSENTIAL_CHAPTERS, GUIDES, KIDS_DUAS } from '@/features/learn/paths';
import { dailyHadithKey } from '@/features/hadith/daily';
import { isValidVerse } from '@/services/quran/navigation';

describe('Qibla', () => {
  // Reference great-circle initial bearings to the Kaaba (21.4225 N, 39.8262 E).
  it.each([
    ['London', 51.5074, -0.1278, 118.99],
    ['New York', 40.7128, -74.006, 58.48],
    ['Jakarta', -6.2088, 106.8456, 295.15],
    ['Cairo', 30.0444, 31.2357, 136.14],
  ])('%s ≈ %s°', (_n, lat, lng, expected) => {
    expect(qiblaBearing(lat, lng)).toBeCloseTo(expected, 0);
  });

  it('distance London → Kaaba ≈ 4,790 km', () => {
    expect(distanceToKaabaKm(51.5074, -0.1278)).toBeGreaterThan(4700);
    expect(distanceToKaabaKm(51.5074, -0.1278)).toBeLessThan(4850);
  });

  it('relative angle picks the shortest turn', () => {
    expect(relativeAngle(350, 10)).toBe(20);
    expect(relativeAngle(10, 350)).toBe(-20);
    expect(relativeAngle(0, 180)).toBe(180);
    expect(normalizeDegrees(-30)).toBe(330);
  });

  it('maps platform heading accuracy to one scale', () => {
    expect(headingQuality(3, 'android')).toBe('good');
    expect(headingQuality(1, 'android')).toBe('poor');
    expect(headingQuality(10, 'ios')).toBe('good');
    expect(headingQuality(-1, 'ios')).toBe('unavailable');
    expect(headingQuality(5, 'web')).toBe('unavailable');
  });
});

describe('counter', () => {
  it('stops at target, or cycles rounds', () => {
    let s = { count: 32, target: 33, rounds: 0 };
    const r = increment(s);
    expect(r).toEqual({ state: { count: 33, target: 33, rounds: 0 }, completed: true });
    expect(increment(r.state).completed).toBe(false);
    s = { count: 32, target: 33, rounds: 1 };
    expect(increment(s, true)).toEqual({ state: { count: 0, target: 33, rounds: 2 }, completed: true });
  });

  it('free counting, decrement floor, reset', () => {
    const free = { count: 5, target: null, rounds: 0 };
    expect(increment(free).state.count).toBe(6);
    expect(counterProgress(free)).toBe(0);
    expect(decrement({ ...free, count: 0 }).count).toBe(0);
    expect(resetCounter({ count: 9, target: 33, rounds: 2 })).toEqual({ count: 0, target: 33, rounds: 0 });
    expect(isComplete({ count: 33, target: 33, rounds: 0 })).toBe(true);
  });
});

describe('memorisation scheduling', () => {
  it('grows intervals with successful reviews and resets gently on "again"', () => {
    const a = review(NEW_REVIEW_STATE, 'good');
    expect(a).toMatchObject({ intervalDays: 1, repetitions: 1 });
    const b = review(a, 'good');
    expect(b.intervalDays).toBe(6);
    const c = review(b, 'good');
    expect(c.intervalDays).toBeGreaterThan(6);
    expect(isMemorized(c)).toBe(true);
    const lapse = review(c, 'again');
    expect(lapse).toMatchObject({ intervalDays: 1, repetitions: 0 });
    expect(lapse.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('caps the interval and computes due dates', () => {
    let s = NEW_REVIEW_STATE;
    for (let i = 0; i < 30; i++) s = review(s, 'easy');
    expect(s.intervalDays).toBeLessThanOrEqual(180);
    expect(dueDateAfter(new Date(2026, 0, 1), { ease: 2.5, intervalDays: 6, repetitions: 2 })).toBe('2026-01-07');
  });
});

describe('recitation queue', () => {
  it('repeats each ayah N times then advances, then stops', () => {
    let q = createQueue(112, 1, 2, 2);
    const steps: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = onTrackFinished(q);
      steps.push(`${s.action}:${s.state.current}`);
      q = s.state;
      if (s.action === 'stop') break;
    }
    expect(steps).toEqual(['replay:1', 'advance:2', 'replay:2', 'stop:2']);
  });

  it('range repeat loops back to the start', () => {
    const q = createQueue(1, 6, 7, 1, true);
    const a = onTrackFinished(q);
    expect(a.state.current).toBe(7);
    expect(onTrackFinished(a.state)).toMatchObject({ action: 'advance', state: { current: 6 } });
  });

  it('skip stays within the range', () => {
    const q = createQueue(2, 1, 3);
    expect(skip(q, -1)).toBeNull();
    expect(skip(q, 1)?.current).toBe(2);
    expect(() => createQueue(2, 5, 3)).toThrow(RangeError);
  });
});

describe('daily verse', () => {
  it('always lands on a rukuʿ start and changes daily', () => {
    const a = dailyVerseKey(new Date(2026, 10, 18));
    const b = dailyVerseKey(new Date(2026, 10, 19));
    expect(a).not.toEqual(b);
    expect(RUKU_STARTS.some(([s, v]) => s === a.surah && v === a.ayah)).toBe(true);
    expect(isValidVerse(a)).toBe(true);
  });
});

describe('adhkar organisation', () => {
  const ids = new Set((HISN_DATA as { id: number }[]).map((c) => c.id));

  it('groups every one of the 132 Hisn al-Muslim chapters exactly once', () => {
    const all = ADHKAR_GROUPS.flatMap((g) => g.chapters as readonly number[]);
    expect(new Set(all).size).toBe(all.length);
    expect([...ids].filter((id) => !all.includes(id))).toEqual([]);
    expect(all.filter((id) => !ids.has(id))).toEqual([]);
    expect(groupOfChapter(96)).toBe('travel');
  });

  it('every chapter referenced by guides, paths and shortcuts exists in the dataset', () => {
    const refs = [...Object.values(HISN), ...ESSENTIAL_CHAPTERS, ...KIDS_DUAS, ...GUIDES.flatMap((g) => g.chapters)];
    expect(refs.filter((r) => !ids.has(r))).toEqual([]);
  });

  it('computes completion per collection and picks the session by time', () => {
    const items = [
      { id: 'a', target: 3 },
      { id: 'b', target: 1 },
    ] as DhikrView[];
    const counts = { [progressKey('morning', 'a')]: 3, [progressKey('evening', 'b')]: 1 };
    expect(completion(items, 'morning', counts)).toEqual({ done: 1, total: 2 });
    expect(completion(items, 'evening', counts)).toEqual({ done: 1, total: 2 });
    expect(sessionCollection(new Date(2026, 0, 1, 7))).toBe('morning');
    expect(sessionCollection(new Date(2026, 0, 1, 18))).toBe('evening');
  });
});

describe('khatma plan', () => {
  it.each(KHATMA_PRESETS)('%s days covers all 6236 ayahs contiguously on page boundaries', (days) => {
    let total = 0;
    let prevEnd: { surah: number; ayah: number } | null = null;
    for (let d = 1; d <= days; d++) {
      const p = khatmaPortion(days, d);
      total += p.ayahs;
      if (prevEnd) expect(p.fromPage).toBeGreaterThan(0);
      prevEnd = p.to;
    }
    expect(total).toBe(6236);
    expect(khatmaPortion(days, 1).from).toEqual({ surah: 1, ayah: 1 });
    expect(khatmaPortion(days, days).to).toEqual({ surah: 114, ayah: 6 });
  });

  it('30 days gives 20–21 pages a day; progress and current day', () => {
    const p = khatmaPortion(30, 1);
    expect(p.toPage - p.fromPage + 1).toBeGreaterThanOrEqual(20);
    expect(khatmaDay('2026-11-01', 30, new Date(2026, 10, 10))).toBe(10);
    expect(khatmaDay('2026-11-01', 30, new Date(2027, 0, 1))).toBe(30);
    expect(khatmaProgress(30, new Set(Array.from({ length: 30 }, (_, i) => i + 1)))).toBe(1);
    expect(() => khatmaPortion(30, 31)).toThrow(RangeError);
  });
});

describe('night times', () => {
  it('middle of the night and last third lie between Maghrib and Fajr', () => {
    const n = nightTimes(
      { latitude: 21.4225, longitude: 39.8262, method: 'umm_al_qura', madhab: 'shafi', highLatitudeRule: 'auto', adjustments: NO_ADJUSTMENTS },
      new Date(2026, 10, 18),
    );
    expect(n.maghrib < n.middle && n.middle < n.lastThird && n.lastThird < n.fajr).toBe(true);
    expect(n.middle.getTime() - n.maghrib.getTime()).toBe(n.fajr.getTime() - n.middle.getTime());
  });
});

describe('daily hadith', () => {
  it('cycles through all 82 bundled hadith', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 82; d++) {
      const k = dailyHadithKey(new Date(2026, 0, 1 + d));
      seen.add(`${k.book}:${k.number}`);
      expect(k.number).toBeGreaterThanOrEqual(1);
    }
    expect(seen.size).toBe(82);
  });
});
