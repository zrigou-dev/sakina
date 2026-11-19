import ar from '@/localization/locales/ar';
import en from '@/localization/locales/en';
import fr from '@/localization/locales/fr';
import { formatBytes, formatNumber, formatTime, localizeDigits } from '@/localization/format';
import { directionOf, initialLanguage } from '@/localization/languages';
import { pluralCategory } from '@/localization/plural';
import { translate, type MessageTree } from '@/localization/translate';
import { DARK, LIGHT, type ColorTokens } from '@/design-system/tokens';

type Tree = Record<string, unknown>;
const leaves = (t: Tree, prefix = ''): Map<string, unknown> => {
  const out = new Map<string, unknown>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || (v && typeof v === 'object' && 'other' in (v as Tree))) out.set(key, v);
    else if (v && typeof v === 'object') for (const [kk, vv] of leaves(v as Tree, key)) out.set(kk, vv);
  }
  return out;
};
const params = (s: unknown): string[] => {
  const text = typeof s === 'string' ? s : Object.values(s as Tree).join(' ');
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
};

describe('locales', () => {
  const E = leaves(en as unknown as Tree);
  it.each([
    ['ar', ar],
    ['fr', fr],
  ])('%s has exactly the English keys, no empty strings, same placeholders', (_l, locale) => {
    const L = leaves(locale as unknown as Tree);
    expect([...L.keys()].sort()).toEqual([...E.keys()].sort());
    for (const [k, v] of L) {
      if (typeof v === 'string' && k !== 'tasbih.rounds') expect(v.trim().length).toBeGreaterThan(0);
      // A translation may drop {count} in a singular form (e.g. "دقيقة واحدة"), but must not invent params.
      for (const p of params(v)) expect(params(E.get(k))).toContain(p);
    }
  });

  it('Arabic UI strings are actually Arabic', () => {
    const L = leaves(ar as unknown as Tree);
    const latinOnly = [...L.entries()].filter(
      ([k, v]) =>
        typeof v === 'string' &&
        v.replace(/\{\w+\}/g, '').replace(/[\s/·:–—-]/g, '').length > 0 &&
        !/[\u0600-\u06FF]/.test(v) &&
        !k.startsWith('methods.') &&
        k !== 'city.attribution' &&
        k !== 'common.percent',
    );
    expect(latinOnly.map(([k]) => k)).toEqual([]);
  });

  it('translates with interpolation, plurals and localized digits', () => {
    const tAr = (k: string, p?: Record<string, number | string>) => translate(ar as unknown as MessageTree, en as unknown as MessageTree, 'ar', k, p);
    expect(tAr('common.ayahs', { count: 1 })).toBe('آية واحدة');
    expect(tAr('common.ayahs', { count: 2 })).toBe('آيتان');
    expect(tAr('common.ayahs', { count: 7 })).toBe('7 آيات');
    expect(tAr('common.ayahs', { count: 11 })).toBe('11 آية');
    expect(tAr('common.ayahs', { count: 100 })).toBe('100 آية');
    const tFr = (k: string, p?: Record<string, number | string>) => translate(fr as unknown as MessageTree, en as unknown as MessageTree, 'fr', k, p);
    expect(tFr('common.days', { count: 0 })).toBe('0 jour');
    expect(tFr('common.days', { count: 3 })).toBe('3 jours');
    expect(translate(en as unknown as MessageTree, en as unknown as MessageTree, 'en', 'missing.key')).toBe('missing.key');
  });

  it('CLDR plural categories', () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100, 101, 103].map((n) => pluralCategory('ar', n))).toEqual([
      'zero',
      'one',
      'two',
      'few',
      'few',
      'many',
      'many',
      'other',
      'other',
      'few',
    ]);
    expect([0, 1, 2].map((n) => pluralCategory('fr', n))).toEqual(['one', 'one', 'other']);
    expect([0, 1, 2].map((n) => pluralCategory('en', n))).toEqual(['other', 'one', 'other']);
  });

  it('direction and default language', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('fr')).toBe('ltr');
    expect(initialLanguage(['de-DE', 'fr-FR'])).toBe('fr');
    expect(initialLanguage(['de-DE'])).toBe('ar');
    expect(initialLanguage([])).toBe('ar');
  });
});

describe('formatting', () => {
  it('digits, numbers, times and sizes per language', () => {
    expect(localizeDigits('12:05', 'ar')).toBe('12:05');
    expect(localizeDigits('12:05', 'en')).toBe('12:05');
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
    expect(formatNumber(1234567.5, 'fr')).toBe('1 234 567,5');
    expect(formatNumber(1234.5, 'ar')).toBe('1,234.5');
    const d = new Date(2026, 0, 1, 17, 5);
    expect(formatTime(d, 'en', '24h')).toBe('17:05');
    expect(formatTime(d, 'en', '12h')).toBe('5:05 PM');
    expect(formatTime(d, 'ar', '12h')).toBe('5:05 م');
    expect(formatBytes(1_900_000, 'en')).toBe('1.8 MB');
  });
});

/** WCAG 2.x relative luminance contrast. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('colour contrast (WCAG AA)', () => {
  const pairs: [keyof ColorTokens, keyof ColorTokens, number][] = [
    ['text', 'bg', 4.5],
    ['text', 'surface', 4.5],
    ['textMuted', 'bg', 4.5],
    ['textMuted', 'surface', 4.5],
    ['textFaint', 'surface', 3],
    ['primary', 'bg', 4.5],
    ['primaryInk', 'primary', 4.5],
    ['accent', 'surface', 3],
    ['accent', 'accentSoft', 3],
    ['danger', 'surface', 4.5],
    ['success', 'successSoft', 4.5],
    ['warning', 'warningSoft', 4.5],
    ['pageInk', 'page', 7],
  ];
  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ])('%s theme', (_name, c) => {
    const failures = pairs
      .filter(([fg, bg, min]) => contrast(c[fg], c[bg]) < min)
      .map(([fg, bg, min]) => `${fg}/${bg} ${contrast(c[fg], c[bg]).toFixed(2)} < ${min}`);
    expect(failures).toEqual([]);
  });
});
