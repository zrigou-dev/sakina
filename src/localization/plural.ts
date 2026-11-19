/** CLDR plural categories. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralForms = { readonly other: string } & Partial<Record<Exclude<PluralCategory, 'other'>, string>>;

/** CLDR plural rules for SAKINA's languages (integers). */
export function pluralCategory(lang: string, n: number): PluralCategory {
  const i = Math.abs(Math.trunc(n));
  switch (lang) {
    case 'ar': {
      if (i === 0) return 'zero';
      if (i === 1) return 'one';
      if (i === 2) return 'two';
      const mod100 = i % 100;
      if (mod100 >= 3 && mod100 <= 10) return 'few';
      if (mod100 >= 11 && mod100 <= 99) return 'many';
      return 'other';
    }
    case 'fr':
      return i === 0 || i === 1 ? 'one' : 'other';
    default:
      return i === 1 ? 'one' : 'other';
  }
}

export function selectPlural(forms: PluralForms, lang: string, n: number): string {
  const cat = pluralCategory(lang, n);
  return forms[cat] ?? forms.other;
}

export function isPluralForms(v: unknown): v is PluralForms {
  return typeof v === 'object' && v !== null && typeof (v as { other?: unknown }).other === 'string';
}
