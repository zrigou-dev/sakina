/**
 * SAKINA design tokens — "Courtyard at dusk".
 * Components consume semantic colour tokens only (never raw hex).
 */
export interface ColorTokens {
  readonly bg: string;
  readonly bgElevated: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textFaint: string;
  readonly primary: string;
  readonly primaryPressed: string;
  readonly primaryInk: string;
  readonly primarySoft: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly accentSoft: string;
  readonly danger: string;
  readonly dangerSoft: string;
  readonly warning: string;
  readonly warningSoft: string;
  readonly success: string;
  readonly successSoft: string;
  readonly overlay: string;
  readonly shadow: string;
  /** Pattern stroke for the geometric backdrop. */
  readonly pattern: string;
  /** Hero gradient stops (top → bottom). */
  readonly heroFrom: string;
  readonly heroTo: string;
  readonly heroInk: string;
  readonly heroInkMuted: string;
  /** Quran page tone. */
  readonly page: string;
  readonly pageInk: string;
  readonly ayahMarker: string;
}

export const LIGHT: ColorTokens = {
  bg: '#F6F2EA',
  bgElevated: '#FBF8F2',
  surface: '#FFFFFF',
  surfaceMuted: '#EFE8DA',
  border: '#E3DACA',
  borderStrong: '#CFC3AD',
  text: '#1C2420',
  textMuted: '#55605A',
  textFaint: '#7A8079',
  primary: '#0E5A45',
  primaryPressed: '#0A4535',
  primaryInk: '#FFFFFF',
  primarySoft: '#DCEDE5',
  accent: '#8C6A34',
  accentInk: '#FFFFFF',
  accentSoft: '#F2E7D3',
  danger: '#A83A30',
  dangerSoft: '#F8E3E0',
  warning: '#8F5F12',
  warningSoft: '#F7EBD3',
  success: '#2A7052',
  successSoft: '#DDEFE5',
  overlay: 'rgba(16, 22, 20, 0.45)',
  shadow: '#4A3B1F',
  pattern: '#0E5A45',
  heroFrom: '#0E5A45',
  heroTo: '#093D30',
  heroInk: '#FFFFFF',
  heroInkMuted: 'rgba(255, 255, 255, 0.78)',
  page: '#FBF7EE',
  pageInk: '#1A1F1C',
  ayahMarker: '#8C6A34',
};

export const DARK: ColorTokens = {
  bg: '#0A1020',
  bgElevated: '#0F1729',
  surface: '#141D31',
  surfaceMuted: '#1A2439',
  border: '#243049',
  borderStrong: '#33425F',
  text: '#EEE9DE',
  textMuted: '#AEB4C0',
  textFaint: '#848CA0',
  primary: '#4FB894',
  primaryPressed: '#3FA07F',
  primaryInk: '#06140F',
  primarySoft: '#15322C',
  accent: '#D2B278',
  accentInk: '#1B1508',
  accentSoft: '#2E2817',
  danger: '#E4867C',
  dangerSoft: '#3A1D1B',
  warning: '#E0B25F',
  warningSoft: '#3A2C12',
  success: '#6CCB9F',
  successSoft: '#123227',
  overlay: 'rgba(2, 5, 12, 0.6)',
  shadow: '#000000',
  pattern: '#D2B278',
  heroFrom: '#14243D',
  heroTo: '#0B1426',
  heroInk: '#F3EEE2',
  heroInkMuted: 'rgba(243, 238, 226, 0.74)',
  page: '#0E1526',
  pageInk: '#ECE6D8',
  ayahMarker: '#D2B278',
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const MIN_TOUCH = 44;
export const MAX_READING_WIDTH = 680;

export const fontFamilies = {
  quran: 'AmiriQuran_400Regular',
  arabicDisplay: 'Amiri_700Bold',
  arabicDisplayRegular: 'Amiri_400Regular',
  arabicBody: 'IBMPlexSansArabic_400Regular',
  arabicMedium: 'IBMPlexSansArabic_500Medium',
  arabicSemiBold: 'IBMPlexSansArabic_600SemiBold',
  arabicBold: 'IBMPlexSansArabic_700Bold',
  latinDisplay: 'Fraunces_600SemiBold',
  latinDisplayRegular: 'Fraunces_400Regular',
  latinBody: 'IBMPlexSans_400Regular',
  latinMedium: 'IBMPlexSans_500Medium',
  latinSemiBold: 'IBMPlexSans_600SemiBold',
  latinBold: 'IBMPlexSans_700Bold',
  latinItalic: 'IBMPlexSans_400Regular_Italic',
} as const;

export type TextRole =
  'display' | 'title1' | 'title2' | 'title3' | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption' | 'overline' | 'numeric' | 'numericLarge';

export interface RoleSpec {
  readonly size: number;
  readonly lineHeight: number;
  readonly weight: 'regular' | 'medium' | 'semibold' | 'bold';
  readonly display?: boolean;
  readonly letterSpacing?: number;
  readonly tabular?: boolean;
  readonly uppercase?: boolean;
}

export const typeScale: Record<TextRole, RoleSpec> = {
  display: { size: 40, lineHeight: 46, weight: 'semibold', display: true, letterSpacing: -0.6 },
  title1: { size: 30, lineHeight: 36, weight: 'semibold', display: true, letterSpacing: -0.4 },
  title2: { size: 24, lineHeight: 30, weight: 'semibold', display: true, letterSpacing: -0.2 },
  title3: { size: 20, lineHeight: 26, weight: 'semibold' },
  headline: { size: 17, lineHeight: 23, weight: 'semibold' },
  body: { size: 16, lineHeight: 24, weight: 'regular' },
  callout: { size: 15, lineHeight: 21, weight: 'medium' },
  subhead: { size: 14, lineHeight: 20, weight: 'regular' },
  footnote: { size: 13, lineHeight: 18, weight: 'regular' },
  caption: { size: 12, lineHeight: 16, weight: 'medium' },
  overline: { size: 12, lineHeight: 16, weight: 'semibold', letterSpacing: 1.1, uppercase: true },
  numeric: { size: 17, lineHeight: 22, weight: 'medium', tabular: true },
  numericLarge: { size: 44, lineHeight: 50, weight: 'semibold', tabular: true, letterSpacing: -1 },
};

/** Arabic glyphs need more vertical room: +1–2 pt and ~25 % more leading. */
export function arabicAdjust(spec: RoleSpec): RoleSpec {
  const bump = spec.size >= 24 ? 2 : 1;
  return { ...spec, size: spec.size + bump, lineHeight: Math.round((spec.lineHeight + bump) * 1.25), letterSpacing: 0, uppercase: false };
}
