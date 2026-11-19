/**
 * Arabic search normalisation.
 *
 * Applied ONLY to search indexes and queries — displayed text is never altered.
 * Folding rules:
 *  - remove tashkeel (harakat, tanween, shadda, sukun), Quranic annotation marks,
 *    small high/low letters, the superscript (dagger) alef and tatweel
 *  - alef variants  أ إ آ ٱ ٲ ٳ ٵ  → ا
 *  - alef maqsura   ى → ي
 *  - ta marbuta     ة → ه
 *  - hamza carriers ؤ → و, ئ → ي ; standalone hamza ء removed
 *  - Persian/Urdu yeh/kaf forms → Arabic
 *  - Arabic-Indic and Eastern Arabic-Indic digits → ASCII
 *  - whitespace collapsed; Latin lower-cased and accent-folded (for EN/FR translations)
 */

// U+0610–U+061A Quranic signs · U+064B–U+065F harakat · U+0670 dagger alef ·
// U+06D6–U+06ED Quranic annotation · U+08D3–U+08FF extended marks · U+0640 tatweel
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g;
const ALEF_FORMS = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;

const CHAR_MAP: Record<string, string> = {
  ى: 'ي', // ى → ي
  ة: 'ه', // ة → ه
  ؤ: 'و', // ؤ → و
  ئ: 'ي', // ئ → ي
  ی: 'ي', // Farsi yeh → ي
  ک: 'ك', // keheh → ك
  ہ: 'ه', // heh goal → ه
};

const DIGITS: Record<string, string> = {};
for (let i = 0; i < 10; i++) {
  DIGITS[String.fromCharCode(0x0660 + i)] = String(i);
  DIGITS[String.fromCharCode(0x06f0 + i)] = String(i);
}

export function normalizeArabic(input: string): string {
  return input
    .replace(ARABIC_MARKS, '')
    .replace(ALEF_FORMS, 'ا')
    .replace(/[\u0649\u0629\u0624\u0626\u06CC\u06A9\u06C1]/g, (c) => CHAR_MAP[c] ?? c)
    .replace(/ء/g, '')
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => DIGITS[d] ?? d)
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLatin(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function containsArabic(s: string): boolean {
  return HAS_ARABIC.test(s);
}

/** Normalises any query: Arabic folding if it contains Arabic script, Latin folding otherwise. */
export function normalizeQuery(input: string): string {
  return containsArabic(input) ? normalizeArabic(input) : normalizeLatin(input);
}

/** Splits a normalised query into distinct terms of at least `minLength` characters. */
export function queryTerms(normalized: string, minLength = 2): string[] {
  return [...new Set(normalized.split(' ').filter((t) => t.length >= minLength))];
}

/**
 * Builds a safe FTS5 MATCH expression: every term quoted (no operator injection),
 * prefix-matched, AND-ed together.
 */
export function buildFtsQuery(normalized: string): string | null {
  const terms = queryTerms(normalized);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
}

/** Escapes LIKE wildcards; use with `ESCAPE '\\'`. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
