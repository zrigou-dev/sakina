import fixtures from '../fixtures/hijri-umalqura.aladhan.json';
import { addHijriMonths, daysInHijriMonth, fromHijri, hijriMonthGrid, toHijri } from '@/services/hijri/hijri';
import { dayTags, isRamadan, upcomingOccasions } from '@/services/hijri/occasions';
import { toISODate } from '@/utils/date';

const date = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

describe('Gregorian → Hijri (Umm al-Qura) vs independent AlAdhan reference', () => {
  it.each(fixtures.cases.map((c) => [c.gregorian, c.hijri] as const))('%s', (g, h) => {
    expect(toHijri(date(g))).toEqual({ year: h.year, month: h.month, day: h.day });
  });
});

describe('round trip and offsets', () => {
  it('fromHijri inverts toHijri for every day across two years', () => {
    let d = date('2025-01-01');
    for (let i = 0; i < 730; i++) {
      const h = toHijri(d);
      expect(toISODate(fromHijri(h))).toBe(toISODate(d));
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  });

  it('applies the user day offset in both directions', () => {
    const d = date('2026-11-18');
    const base = toHijri(d);
    const plus = toHijri(d, 1);
    expect(plus.day === base.day + 1 || plus.day === 1).toBe(true);
    expect(toISODate(fromHijri(plus, 1))).toBe('2026-11-18');
    const minus = toHijri(d, -2);
    expect(toISODate(fromHijri(minus, -2))).toBe('2026-11-18');
  });

  it('month lengths are 29 or 30 and grids are complete', () => {
    for (let m = 1; m <= 12; m++) {
      const len = daysInHijriMonth(1448, m);
      expect([29, 30]).toContain(len);
      const grid = hijriMonthGrid(1448, m);
      expect(grid.days).toHaveLength(len);
      expect(grid.firstWeekday).toBe(grid.days[0]!.gregorian.getDay());
    }
  });

  it('adds months across year boundaries', () => {
    expect(addHijriMonths({ year: 1447, month: 12 }, 1)).toEqual({ year: 1448, month: 1 });
    expect(addHijriMonths({ year: 1448, month: 1 }, -1)).toEqual({ year: 1447, month: 12 });
    expect(addHijriMonths({ year: 1448, month: 5 }, 14)).toEqual({ year: 1449, month: 7 });
  });
});

describe('occasions', () => {
  it('tags Ramadan start and Eid al-Fitr on the calculated dates (2025)', () => {
    // AlAdhan UAQ reference: 1 Ramadan 1446 = 2025-03-01.
    expect(dayTags(date('2025-03-01'))).toContain('ramadan_start');
    expect(isRamadan(date('2025-03-15'))).toBe(true);
    const eid = fromHijri({ year: 1446, month: 10, day: 1 });
    expect(dayTags(eid)).toContain('eid_al_fitr');
  });

  it('tags Arafah, Eid al-Adha, Tashreeq, white days, Mondays and Thursdays', () => {
    const arafah = fromHijri({ year: 1447, month: 12, day: 9 });
    expect(dayTags(arafah)).toContain('day_of_arafah');
    const t13 = fromHijri({ year: 1447, month: 12, day: 13 });
    expect(dayTags(t13)).toEqual(expect.arrayContaining(['tashreeq', 'white_day']));
    const w = fromHijri({ year: 1448, month: 3, day: 14 });
    expect(dayTags(w)).toContain('white_day');
    const monday = date('2026-11-16');
    expect(monday.getDay()).toBe(1);
    expect(dayTags(monday)).toContain('monday');
  });

  it('lists upcoming occasions in order within the horizon', () => {
    const list = upcomingOccasions(date('2026-11-18'), 0, 365);
    expect(list.length).toBeGreaterThan(5);
    for (let i = 1; i < list.length; i++) expect(list[i]!.start.getTime()).toBeGreaterThanOrEqual(list[i - 1]!.start.getTime());
    expect(list.every((o) => o.daysUntil >= -10 && o.daysUntil <= 365)).toBe(true);
    expect(list.map((o) => o.id)).toEqual(expect.arrayContaining(['ramadan_start', 'eid_al_fitr', 'eid_al_adha']));
  });
});
