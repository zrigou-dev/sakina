export const LANGUAGES = ['ar', 'en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Direction = 'rtl' | 'ltr';

export const LANGUAGE_INFO: Record<Language, { nativeName: string; direction: Direction }> = {
  ar: { nativeName: 'العربية', direction: 'rtl' },
  en: { nativeName: 'English', direction: 'ltr' },
  fr: { nativeName: 'Français', direction: 'ltr' },
};

export function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);
}

export function directionOf(lang: Language): Direction {
  return LANGUAGE_INFO[lang].direction;
}

/** Arabic is the default; a device in English or French starts in that language instead. */
export function initialLanguage(deviceLanguageCodes: readonly (string | null | undefined)[]): Language {
  for (const code of deviceLanguageCodes) {
    const base = code?.split('-')[0]?.toLowerCase();
    if (isLanguage(base)) return base;
  }
  return 'ar';
}
