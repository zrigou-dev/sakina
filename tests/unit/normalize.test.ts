import { buildFtsQuery, containsArabic, escapeLike, normalizeArabic, normalizeLatin, normalizeQuery, queryTerms } from '@/services/search/normalize';

describe('Arabic normalisation (search only)', () => {
  it.each([
    ['أحمد', 'احمد'],
    ['إسلام', 'اسلام'],
    ['آمن', 'امن'],
    ['ٱلرَّحْمَٰنِ', 'الرحمن'],
    ['مُوسَىٰ', 'موسي'],
    ['رحمة', 'رحمه'],
    ['مُؤْمِن', 'مومن'],
    ['سَائِل', 'سايل'],
    ['السَّمَاءِ', 'السما'],
    ['كتـــاب', 'كتاب'],
    ['٣ سور', '3 سور'],
    ['  بسم   الله  ', 'بسم الله'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeArabic(input)).toBe(expected);
  });

  it('removes Quranic annotation marks and small high letters', () => {
    // The dagger alef is dropped, so Uthmani "ٱلْكِتَٰبُ" folds to "الكتب", not the everyday "الكتاب".
    // This is exactly why the search index is built from Tanzil's Simple-Clean (imlaʾi) edition.
    expect(normalizeArabic('ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ')).toBe('ذلك الكتب لا ريب فيه');
  });

  it('is idempotent', () => {
    const once = normalizeArabic('إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ');
    expect(normalizeArabic(once)).toBe(once);
  });

  it('does not mutate its input (display text is never altered)', () => {
    const original = 'ٱلْحَمْدُ لِلَّهِ';
    const copy = `${original}`;
    normalizeArabic(original);
    expect(original).toBe(copy);
  });
});

describe('Latin normalisation', () => {
  it('folds accents and case, strips punctuation', () => {
    expect(normalizeLatin('Miséricordieux, LE Très-Miséricordieux!')).toBe('misericordieux le tres misericordieux');
  });
});

describe('query helpers', () => {
  it('detects script', () => {
    expect(containsArabic('rahma')).toBe(false);
    expect(containsArabic('رحمة')).toBe(true);
    expect(normalizeQuery('Rahma')).toBe('rahma');
    expect(normalizeQuery('رَحْمَة')).toBe('رحمه');
  });

  it('drops short and duplicate terms', () => {
    expect(queryTerms('ا رب رب العالمين')).toEqual(['رب', 'العالمين']);
  });

  it('builds a safe FTS5 expression (quoted terms, no operator injection)', () => {
    expect(buildFtsQuery('رب العالمين')).toBe('"رب"* "العالمين"*');
    expect(buildFtsQuery('a"b OR')).toBe('"a""b"* "OR"*');
    expect(buildFtsQuery('')).toBeNull();
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_\\')).toBe('50\\%\\_\\\\');
  });
});
