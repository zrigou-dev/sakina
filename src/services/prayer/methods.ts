import { CalculationMethod, CalculationParameters } from 'adhan';

/**
 * Supported calculation methods.
 * Built-in adhan-js methods are used directly. Regional methods not built into adhan-js are
 * configured from the parameters published by the AlAdhan API (/v1/methods), each of which
 * cites the issuing authority. Verified against AlAdhan reference times in tests.
 */
export const METHOD_IDS = [
  'muslim_world_league',
  'umm_al_qura',
  'egyptian',
  'karachi',
  'north_america',
  'dubai',
  'gulf',
  'kuwait',
  'qatar',
  'singapore',
  'turkey',
  'tehran',
  'moonsighting_committee',
  'france_uoif',
  'algeria',
  'morocco',
  'tunisia',
  'jakim',
  'kemenag',
  'jordan',
  'russia',
] as const;

export type MethodId = (typeof METHOD_IDS)[number];

export type MethodParam =
  { readonly kind: 'angle'; readonly value: number } | { readonly kind: 'minutes'; readonly value: number } | { readonly kind: 'seasonal' };

export interface MethodInfo {
  readonly id: MethodId;
  /** Issuing authority, shown in UI exactly as published. */
  readonly authority: string;
  readonly fajr: MethodParam;
  readonly isha: MethodParam;
  /** ISO country codes where this method is the common default (used only to *suggest*). */
  readonly regions: readonly string[];
}

const custom =
  (fajr: number, isha: number, ishaInterval = 0) =>
  () => {
    const p = new CalculationParameters('Other', fajr, isha, ishaInterval);
    return p;
  };

const FACTORIES: Record<MethodId, () => CalculationParameters> = {
  muslim_world_league: CalculationMethod.MuslimWorldLeague,
  umm_al_qura: CalculationMethod.UmmAlQura,
  egyptian: CalculationMethod.Egyptian,
  karachi: CalculationMethod.Karachi,
  north_america: CalculationMethod.NorthAmerica,
  dubai: CalculationMethod.Dubai,
  kuwait: CalculationMethod.Kuwait,
  qatar: CalculationMethod.Qatar,
  singapore: CalculationMethod.Singapore,
  turkey: CalculationMethod.Turkey,
  tehran: CalculationMethod.Tehran,
  moonsighting_committee: CalculationMethod.MoonsightingCommittee,
  gulf: custom(19.5, 0, 90),
  france_uoif: custom(12, 12),
  algeria: custom(18, 17),
  // AlAdhan publishes +5 min Dhuhr and Maghrib offsets for the Moroccan method.
  morocco: () => {
    const p = new CalculationParameters('Other', 19, 17);
    p.methodAdjustments = { ...p.methodAdjustments, dhuhr: 5, maghrib: 5 };
    return p;
  },
  tunisia: custom(18, 18),
  jakim: custom(20, 18),
  kemenag: custom(20, 18),
  jordan: () => {
    const p = new CalculationParameters('Other', 18, 18);
    p.methodAdjustments = { ...p.methodAdjustments, maghrib: 5 };
    return p;
  },
  russia: custom(16, 15),
};

export const METHODS: Record<MethodId, MethodInfo> = {
  muslim_world_league: {
    id: 'muslim_world_league',
    authority: 'Muslim World League',
    fajr: { kind: 'angle', value: 18 },
    isha: { kind: 'angle', value: 17 },
    regions: ['GB', 'DE', 'NL', 'BE', 'IT', 'ES'],
  },
  umm_al_qura: {
    id: 'umm_al_qura',
    authority: 'Umm Al-Qura University, Makkah',
    fajr: { kind: 'angle', value: 18.5 },
    isha: { kind: 'minutes', value: 90 },
    regions: ['SA', 'YE'],
  },
  egyptian: {
    id: 'egyptian',
    authority: 'Egyptian General Authority of Survey',
    fajr: { kind: 'angle', value: 19.5 },
    isha: { kind: 'angle', value: 17.5 },
    regions: ['EG', 'SD', 'LY', 'SY', 'LB', 'IQ', 'PS'],
  },
  karachi: {
    id: 'karachi',
    authority: 'University of Islamic Sciences, Karachi',
    fajr: { kind: 'angle', value: 18 },
    isha: { kind: 'angle', value: 18 },
    regions: ['PK', 'IN', 'BD', 'AF'],
  },
  north_america: {
    id: 'north_america',
    authority: 'Islamic Society of North America (ISNA)',
    fajr: { kind: 'angle', value: 15 },
    isha: { kind: 'angle', value: 15 },
    regions: ['US', 'CA'],
  },
  dubai: { id: 'dubai', authority: 'Dubai', fajr: { kind: 'angle', value: 18.2 }, isha: { kind: 'angle', value: 18.2 }, regions: ['AE'] },
  gulf: { id: 'gulf', authority: 'Gulf Region', fajr: { kind: 'angle', value: 19.5 }, isha: { kind: 'minutes', value: 90 }, regions: ['OM', 'BH'] },
  kuwait: { id: 'kuwait', authority: 'Kuwait', fajr: { kind: 'angle', value: 18 }, isha: { kind: 'angle', value: 17.5 }, regions: ['KW'] },
  qatar: { id: 'qatar', authority: 'Qatar', fajr: { kind: 'angle', value: 18 }, isha: { kind: 'minutes', value: 90 }, regions: ['QA'] },
  singapore: {
    id: 'singapore',
    authority: 'Majlis Ugama Islam Singapura',
    fajr: { kind: 'angle', value: 20 },
    isha: { kind: 'angle', value: 18 },
    regions: ['SG', 'BN'],
  },
  turkey: {
    id: 'turkey',
    authority: 'Diyanet İşleri Başkanlığı',
    fajr: { kind: 'angle', value: 18 },
    isha: { kind: 'angle', value: 17 },
    regions: ['TR', 'AZ'],
  },
  tehran: {
    id: 'tehran',
    authority: 'Institute of Geophysics, University of Tehran',
    fajr: { kind: 'angle', value: 17.7 },
    isha: { kind: 'angle', value: 14 },
    regions: ['IR'],
  },
  moonsighting_committee: {
    id: 'moonsighting_committee',
    authority: 'Moonsighting Committee Worldwide',
    fajr: { kind: 'seasonal' },
    isha: { kind: 'seasonal' },
    regions: [],
  },
  france_uoif: {
    id: 'france_uoif',
    authority: 'Union des Organisations Islamiques de France',
    fajr: { kind: 'angle', value: 12 },
    isha: { kind: 'angle', value: 12 },
    regions: ['FR'],
  },
  algeria: { id: 'algeria', authority: 'Algeria', fajr: { kind: 'angle', value: 18 }, isha: { kind: 'angle', value: 17 }, regions: ['DZ'] },
  morocco: { id: 'morocco', authority: 'Morocco', fajr: { kind: 'angle', value: 19 }, isha: { kind: 'angle', value: 17 }, regions: ['MA'] },
  tunisia: { id: 'tunisia', authority: 'Tunisia', fajr: { kind: 'angle', value: 18 }, isha: { kind: 'angle', value: 18 }, regions: ['TN'] },
  jakim: {
    id: 'jakim',
    authority: 'Jabatan Kemajuan Islam Malaysia (JAKIM)',
    fajr: { kind: 'angle', value: 20 },
    isha: { kind: 'angle', value: 18 },
    regions: ['MY'],
  },
  kemenag: {
    id: 'kemenag',
    authority: 'Kementerian Agama Republik Indonesia',
    fajr: { kind: 'angle', value: 20 },
    isha: { kind: 'angle', value: 18 },
    regions: ['ID'],
  },
  jordan: { id: 'jordan', authority: 'Ministry of Awqaf, Jordan', fajr: { kind: 'angle', value: 18 }, isha: { kind: 'angle', value: 18 }, regions: ['JO'] },
  russia: {
    id: 'russia',
    authority: 'Spiritual Administration of Muslims of Russia',
    fajr: { kind: 'angle', value: 16 },
    isha: { kind: 'angle', value: 15 },
    regions: ['RU'],
  },
};

export function methodParameters(id: MethodId): CalculationParameters {
  return FACTORIES[id]();
}

/** Suggests a method for a country code; falls back to Muslim World League. The user always confirms. */
export function suggestMethod(countryCode: string | null | undefined): MethodId {
  if (!countryCode) return 'muslim_world_league';
  const cc = countryCode.toUpperCase();
  const hit = METHOD_IDS.find((id) => METHODS[id].regions.includes(cc));
  return hit ?? 'muslim_world_league';
}

/** Hanafi Asr is the common default where the Hanafi school predominates (suggestion only). */
export function suggestMadhab(countryCode: string | null | undefined): 'shafi' | 'hanafi' {
  const hanafi = ['PK', 'IN', 'BD', 'AF', 'TR', 'AZ', 'UZ', 'TJ', 'KZ', 'KG', 'TM'];
  return countryCode && hanafi.includes(countryCode.toUpperCase()) ? 'hanafi' : 'shafi';
}
