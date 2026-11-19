/**
 * Content catalogue — the ONLY place in the app that knows remote content URLs.
 *
 * SAKINA ships a bundled snapshot of the catalogue so My Library works offline and when
 * no remote catalogue is reachable. A remote static catalogue (same JSON shape) can be
 * enabled by setting CATALOGUE_URL to a static host the project controls (e.g. GitHub Pages).
 */
import { adhanLibraryBaseUrl } from '@/services/adhan/config';
import { allVoices, downloadSize, voiceById, voiceIdOfPackage, type AdhanVoice } from '@/services/adhan/voices';
import HADITH_CATALOGUE from '@/content/hadith/catalogue.generated.json';
import { SURAHS } from '@/content/quran/metadata.generated';

export const CATALOGUE_URL: string | null = null;
export const CATALOGUE_SCHEMA_VERSION = 1;

export type PackageKind = 'translation' | 'tafsir' | 'recitation' | 'adhkar' | 'adhan' | 'book' | 'course' | 'guide';

export interface AdhanFileSource {
  readonly kind: 'mirror' | 'commons';
  readonly url: string;
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly format: 'mp3' | 'm4a';
}

export type LicenceStatus = 'verified' | 'attribution' | 'pending';

export interface PackageManifest {
  readonly id: string;
  readonly kind: PackageKind;
  readonly version: string;
  readonly language: string;
  readonly name: Readonly<Record<'ar' | 'en' | 'fr', string>>;
  readonly description: Readonly<Record<'ar' | 'en' | 'fr', string>>;
  readonly author: string;
  readonly source: { readonly name: string; readonly url: string };
  readonly licence: { readonly status: LicenceStatus; readonly text: string };
  /** Approximate download size in bytes (used for free-space checks and UI). */
  readonly approxBytes: number;
  readonly payload: PackagePayload;
}

export type PackagePayload =
  | { readonly type: 'alquran-cloud-edition'; readonly edition: string; readonly url: string; readonly sha256?: string }
  | { readonly type: 'ayah-audio'; readonly reciter: string; readonly surah: number; readonly urlTemplate: string; readonly ayahCount: number }
  | {
      readonly type: 'adhan-audio';
      readonly voiceId: string;
      /** Tried in order; the first one that downloads AND verifies (size + SHA-256 + container) wins. */
      readonly sources: readonly AdhanFileSource[];
    }
  | {
      readonly type: 'hadith-edition';
      readonly book: string;
      readonly arabicUrl: string;
      readonly translationUrl: string | null;
      readonly translationLang: 'en' | 'fr' | null;
    };

export interface Reciter {
  readonly id: string;
  readonly nameAr: string;
  readonly nameLatin: string;
  /** `{n}` = global ayah number 1..6236 */
  readonly ayahUrlTemplate: string;
  readonly bitrate: number;
  readonly approxBytesPerAyah: number;
}

/** Islamic Network CDN, per-ayah MP3s (also used by api.alquran.cloud). */
export const RECITERS: readonly Reciter[] = [
  {
    id: 'ar.alafasy',
    nameAr: 'مشاري راشد العفاسي',
    nameLatin: 'Mishary Rashid Alafasy',
    ayahUrlTemplate: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/{n}.mp3',
    bitrate: 128,
    approxBytesPerAyah: 230_000,
  },
  {
    id: 'ar.husary',
    nameAr: 'محمود خليل الحصري',
    nameLatin: 'Mahmoud Khalil Al-Husary',
    ayahUrlTemplate: 'https://cdn.islamic.network/quran/audio/128/ar.husary/{n}.mp3',
    bitrate: 128,
    approxBytesPerAyah: 300_000,
  },
  {
    id: 'ar.minshawi',
    nameAr: 'محمد صديق المنشاوي',
    nameLatin: 'Mohamed Siddiq El-Minshawi',
    ayahUrlTemplate: 'https://cdn.islamic.network/quran/audio/128/ar.minshawi/{n}.mp3',
    bitrate: 128,
    approxBytesPerAyah: 300_000,
  },
];

export function reciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]!;
}

export function ayahAudioUrl(reciter: Reciter, globalAyah: number): string {
  return reciter.ayahUrlTemplate.replace('{n}', String(globalAyah));
}

const ALQURAN_CLOUD = 'https://api.alquran.cloud/v1/quran/';

function edition(
  id: string,
  kind: 'translation' | 'tafsir',
  language: string,
  author: string,
  name: PackageManifest['name'],
  description: PackageManifest['description'],
  approxBytes: number,
): PackageManifest {
  return {
    id: `${kind}.${id}`,
    kind,
    version: '1',
    language,
    name,
    description,
    author,
    source: { name: 'AlQuran Cloud (Islamic Network) — editions distributed via Tanzil', url: `${ALQURAN_CLOUD}${id}` },
    licence: {
      status: 'attribution',
      text: 'Distributed by the publisher for non-commercial use with attribution. Check the edition terms before redistribution.',
    },
    approxBytes,
    payload: { type: 'alquran-cloud-edition', edition: id, url: `${ALQURAN_CLOUD}${id}` },
  };
}

const TEXT_PACKAGES: readonly PackageManifest[] = [
  edition(
    'en.sahih',
    'translation',
    'en',
    'Saheeh International',
    { ar: 'الترجمة الإنجليزية — صحيح إنترناشونال', en: 'English — Saheeh International', fr: 'Anglais — Saheeh International' },
    {
      ar: 'ترجمة معاني القرآن الكريم إلى الإنجليزية.',
      en: 'Translation of the meanings of the Quran into English.',
      fr: 'Traduction des sens du Coran en anglais.',
    },
    1_900_000,
  ),
  edition(
    'fr.hamidullah',
    'translation',
    'fr',
    'Muhammad Hamidullah',
    { ar: 'الترجمة الفرنسية — حميد الله', en: 'French — Muhammad Hamidullah', fr: 'Français — Muhammad Hamidullah' },
    {
      ar: 'ترجمة معاني القرآن الكريم إلى الفرنسية.',
      en: 'Translation of the meanings of the Quran into French.',
      fr: 'Traduction des sens du Coran en français.',
    },
    2_100_000,
  ),
  edition(
    'ar.muyassar',
    'tafsir',
    'ar',
    'King Fahd Quran Complex',
    { ar: 'التفسير الميسر', en: 'Tafsir al-Muyassar (Arabic)', fr: 'Tafsir al-Muyassar (arabe)' },
    {
      ar: 'تفسير مختصر صادر عن مجمع الملك فهد لطباعة المصحف الشريف.',
      en: 'A concise Arabic tafsir published by the King Fahd Quran Complex.',
      fr: 'Un tafsir arabe concis publié par le Complexe du Roi Fahd.',
    },
    3_800_000,
  ),
  edition(
    'ar.jalalayn',
    'tafsir',
    'ar',
    'Jalal ad-Din al-Mahalli & Jalal ad-Din as-Suyuti',
    { ar: 'تفسير الجلالين', en: 'Tafsir al-Jalalayn (Arabic)', fr: 'Tafsir al-Jalalayn (arabe)' },
    { ar: 'تفسير الجلالين للمحلي والسيوطي.', en: 'The classical tafsir of al-Mahalli and as-Suyuti.', fr: 'Le tafsir classique d’al-Mahalli et as-Suyuti.' },
    3_200_000,
  ),
];

// ─── Adhan recordings ─────────────────────────────────────────────────────────────
/** Download sources for a voice: the optional mastered mirror first, then the pinned Commons file. */
export function adhanSources(v: AdhanVoice, mirrorBase: string | null = adhanLibraryBaseUrl()): AdhanFileSource[] {
  const out: AdhanFileSource[] = [];
  // Only the licensed library is mirrored; personal-use recordings come straight from their pinned source.
  if (mirrorBase && (v.tier ?? 'licensed') === 'licensed')
    out.push({ kind: 'mirror', url: `${mirrorBase}/${v.file}`, file: 'adhan.m4a', bytes: v.bytes, sha256: v.sha256, format: 'm4a' });
  if (v.direct)
    out.push({ kind: 'commons', url: v.direct.url, file: `adhan.${v.direct.format}`, bytes: v.direct.bytes, sha256: v.direct.sha256, format: v.direct.format });
  return out;
}

export function adhanPackage(v: AdhanVoice, mirrorBase: string | null = adhanLibraryBaseUrl()): PackageManifest {
  const c = v.credit;
  return {
    id: `adhan.${v.id}`,
    kind: 'adhan',
    version: '2',
    language: 'ar',
    name: v.name,
    description: {
      ar: `تسجيل: ${c.recordist}`,
      en: `Recorded by ${c.recordist}`,
      fr: `Enregistré par ${c.recordist}`,
    },
    author: c.recordist,
    source: { name: 'Wikimedia Commons', url: c.sourceUrl },
    licence: {
      status: (v.tier ?? 'licensed') === 'licensed' ? 'verified' : 'pending',
      text: `${c.licence} — ${c.recordist}${c.licenceUrl ? ` (${c.licenceUrl})` : ''}. ${c.modified}`,
    },
    approxBytes: downloadSize(v),
    payload: { type: 'adhan-audio', voiceId: v.id, sources: adhanSources(v, mirrorBase) },
  };
}

// ─── Hadith collections (fawazahmed0/hadith-api, The Unlicense) ──────────────────
const HADITH_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';

export interface HadithCatalogueEntry {
  readonly book: string;
  readonly name: string;
  readonly ara: string | null;
  readonly eng: string | null;
  readonly fra: string | null;
  readonly araBytes?: number | null;
  readonly engBytes?: number | null;
  readonly fraBytes?: number | null;
}

export const HADITH_BOOKS: readonly HadithCatalogueEntry[] = HADITH_CATALOGUE as HadithCatalogueEntry[];
/** Collections bundled with the app (Arabic + English + French). */
export const BUNDLED_HADITH_BOOKS = ['nawawi', 'qudsi'] as const;

export type HadithVariant = 'ar' | 'en' | 'fr';

export function hadithPackage(book: string, variant: HadithVariant): PackageManifest | null {
  const e = HADITH_BOOKS.find((b) => b.book === book);
  if (!e?.ara) return null;
  const tr = variant === 'en' ? e.eng : variant === 'fr' ? e.fra : null;
  if (variant !== 'ar' && !tr) return null;
  const bytes = (e.araBytes ?? 4_000_000) + (variant === 'en' ? (e.engBytes ?? 0) : variant === 'fr' ? (e.fraBytes ?? 0) : 0);
  return {
    id: `hadith.${book}.${variant}`,
    kind: 'book',
    version: '1',
    language: variant,
    name: { ar: e.name, en: e.name, fr: e.name },
    description: { ar: e.name, en: e.name, fr: e.name },
    author: e.name,
    source: { name: 'hadith-api (fawazahmed0)', url: `${HADITH_BASE}${e.ara}.min.json` },
    licence: { status: 'verified', text: 'The Unlicense (dataset); translations remain the work of their translators.' },
    approxBytes: bytes,
    payload: {
      type: 'hadith-edition',
      book,
      arabicUrl: `${HADITH_BASE}${e.ara}.min.json`,
      translationUrl: tr ? `${HADITH_BASE}${tr}.min.json` : null,
      translationLang: variant === 'ar' ? null : variant,
    },
  };
}

function recitationPackage(reciter: Reciter, surah: number): PackageManifest {
  const s = SURAHS[surah - 1]!;
  return {
    id: `recitation.${reciter.id}.${surah}`,
    kind: 'recitation',
    version: '1',
    language: 'ar',
    name: {
      ar: `سورة ${s.nameArabic} — ${reciter.nameAr}`,
      en: `${s.nameTransliterated} — ${reciter.nameLatin}`,
      fr: `${s.nameTransliterated} — ${reciter.nameLatin}`,
    },
    description: {
      ar: 'تلاوة آية بآية للاستماع دون اتصال.',
      en: 'Ayah-by-ayah recitation for offline listening.',
      fr: 'Récitation verset par verset pour une écoute hors ligne.',
    },
    author: reciter.nameLatin,
    source: { name: 'Islamic Network CDN', url: reciter.ayahUrlTemplate.replace('{n}.mp3', '') },
    licence: { status: 'attribution', text: 'Streamed and distributed freely by Islamic Network; recitation rights belong to the reciter.' },
    approxBytes: reciter.approxBytesPerAyah * s.ayahCount,
    payload: { type: 'ayah-audio', reciter: reciter.id, surah, urlTemplate: reciter.ayahUrlTemplate, ayahCount: s.ayahCount },
  };
}

export interface Catalogue {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly packages: readonly PackageManifest[];
}

/** Bundled snapshot. Recitations are generated per reciter × surah from metadata. */
export function bundledCatalogue(): Catalogue {
  return {
    schemaVersion: CATALOGUE_SCHEMA_VERSION,
    generatedAt: '2026-11-18',
    packages: [
      ...TEXT_PACKAGES,
      ...allVoices()
        .filter((v) => v.delivery === 'download')
        .map((v) => adhanPackage(v)),
    ],
  };
}

export function recitationPackages(reciterId: string): PackageManifest[] {
  const r = reciterById(reciterId);
  return SURAHS.map((s) => recitationPackage(r, s.number));
}

export function findPackage(id: string): PackageManifest | null {
  const fromStatic = bundledCatalogue().packages.find((p) => p.id === id);
  if (fromStatic) return fromStatic;
  const voiceId = voiceIdOfPackage(id);
  if (voiceId) {
    const v = voiceById(voiceId);
    return v && v.delivery === 'download' ? adhanPackage(v) : null;
  }
  const h = /^hadith\.([a-z]+)\.(ar|en|fr)$/.exec(id);
  if (h) return hadithPackage(h[1]!, h[2] as HadithVariant);
  const m = /^recitation\.(.+)\.(\d+)$/.exec(id);
  if (m) {
    const surah = Number(m[2]);
    if (surah >= 1 && surah <= 114) return recitationPackage(reciterById(m[1]!), surah);
  }
  return null;
}

/** Validates a remote catalogue's shape before it is trusted. */
export function parseCatalogue(json: unknown): Catalogue | null {
  if (!json || typeof json !== 'object') return null;
  const c = json as Partial<Catalogue>;
  if (c.schemaVersion !== CATALOGUE_SCHEMA_VERSION || !Array.isArray(c.packages)) return null;
  const ok = c.packages.every(
    (p) =>
      p &&
      typeof p.id === 'string' &&
      typeof p.kind === 'string' &&
      typeof p.version === 'string' &&
      p.name?.ar &&
      p.name?.en &&
      p.name?.fr &&
      p.source?.url?.startsWith('http') &&
      p.licence?.status &&
      p.payload?.type,
  );
  return ok ? (c as Catalogue) : null;
}
