import type { Language } from './languages';

/**
 * Numbers are shown with standard Western digits (0–9) in every language — clearer and easier to read for everyone.
 * (Arabic text is still right-to-left; only the digit shapes are Western. Input in Arabic-Indic digits is still
 * understood by the parsers.) The function is kept so call sites stay language-aware if this ever becomes a setting.
 */
export function localizeDigits(input: string | number, _lang: Language): string {
  return String(input);
}

export function formatNumber(n: number, lang: Language, maxFractionDigits = 2): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(maxFractionDigits).replace(/\.?0+$/, '');
  const [int, frac] = fixed.split('.');
  const sep = lang === 'fr' ? '\u202f' : ',';
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const decimal = lang === 'fr' ? ',' : '.';
  return frac ? `${grouped}${decimal}${frac}` : grouped;
}

export type TimeFormat = '24h' | '12h';

const PERIOD: Record<Language, [string, string]> = { ar: ['ص', 'م'], en: ['AM', 'PM'], fr: ['AM', 'PM'] };

/** Formats a time in the device time zone. Implemented without Intl for consistent output on Hermes. */
export function formatTime(d: Date, lang: Language, format: TimeFormat): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  if (format === '24h') return localizeDigits(`${String(h).padStart(2, '0')}:${m}`, lang);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const [am, pm] = PERIOD[lang];
  return `${localizeDigits(`${h12}:${m}`, lang)} ${h < 12 ? am : pm}`;
}

export function formatDuration(hours: number, minutes: number, seconds: number, lang: Language, withSeconds = true): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const s = withSeconds ? `${hours > 0 ? `${hours}:` : ''}${p(minutes)}:${p(seconds)}` : `${hours}:${p(minutes)}`;
  return localizeDigits(s, lang);
}

export function formatBytes(bytes: number, lang: Language): string {
  const units = lang === 'ar' ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : lang === 'fr' ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB'];
  let v = Math.max(0, bytes);
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${formatNumber(u === 0 ? Math.round(v) : Math.round(v * 10) / 10, lang, 1)} ${units[u]}`;
}

export function formatCurrency(n: number, lang: Language): string {
  return formatNumber(Math.round(n * 100) / 100, lang, 2);
}
