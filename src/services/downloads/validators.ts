import { TOTAL_AYAHS } from '@/content/quran/metadata.generated';

/**
 * Payload validators. A download is NEVER activated because a URL returned 200:
 * every payload must pass a structural check, and a checksum check when the catalogue pins one.
 */
export class PayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

export interface EditionAyah {
  readonly ayahId: number;
  readonly text: string;
}

/** AlQuran Cloud `/v1/quran/{edition}` response → validated, ordered ayah list. */
export function validateAlQuranCloudEdition(json: unknown, expectedEdition: string): EditionAyah[] {
  const body = json as { code?: number; data?: { edition?: { identifier?: string }; surahs?: unknown[] } };
  if (body?.code !== 200 || !body.data || !Array.isArray(body.data.surahs)) throw new PayloadValidationError('Unexpected response shape');
  if (body.data.edition?.identifier !== expectedEdition) throw new PayloadValidationError(`Edition mismatch: ${body.data.edition?.identifier}`);
  if (body.data.surahs.length !== 114) throw new PayloadValidationError(`Expected 114 surahs, got ${body.data.surahs.length}`);
  const out: EditionAyah[] = [];
  for (const s of body.data.surahs as { number?: number; ayahs?: { number?: number; text?: string }[] }[]) {
    if (!Array.isArray(s.ayahs)) throw new PayloadValidationError(`Surah ${s.number} has no ayahs`);
    for (const a of s.ayahs) {
      if (typeof a.number !== 'number' || typeof a.text !== 'string' || !a.text.trim()) throw new PayloadValidationError(`Bad ayah in surah ${s.number}`);
      out.push({ ayahId: a.number, text: a.text.trim() });
    }
  }
  if (out.length !== TOTAL_AYAHS) throw new PayloadValidationError(`Expected ${TOTAL_AYAHS} ayahs, got ${out.length}`);
  out.forEach((a, i) => {
    if (a.ayahId !== i + 1) throw new PayloadValidationError(`Ordering break at ${i + 1}`);
  });
  return out;
}

/** Checks the first bytes of an MP3: ID3 tag or an MPEG audio frame sync. */
export function looksLikeMp3(head: Uint8Array): boolean {
  if (head.length < 3) return false;
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true; // "ID3"
  return head[0] === 0xff && (head[1]! & 0xe0) === 0xe0;
}

export function validateAudioFile(bytes: number, head: Uint8Array): void {
  if (bytes < 1024) throw new PayloadValidationError(`Audio file too small (${bytes} bytes)`);
  if (!looksLikeMp3(head)) throw new PayloadValidationError('Not an MP3 file');
}

/** Container sniffing for adhan files. MP3: ID3 tag or MPEG frame sync; M4A: `ftyp` box at offset 4. */
export function sniffAudioContainer(head: Uint8Array): 'mp3' | 'm4a' | null {
  if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return 'mp3';
  if (head.length >= 2 && head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) return 'mp3';
  if (head.length >= 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return 'm4a';
  return null;
}

/**
 * An adhan download is accepted only when it is exactly the file the catalogue pinned:
 * same size, same SHA-256 and the container the catalogue promised (never an HTML error page or a truncated file).
 */
export function validateAdhanFile(
  got: { bytes: number; sha256: string; head: Uint8Array },
  expected: { bytes: number; sha256: string; format: 'mp3' | 'm4a' },
): void {
  if (got.bytes !== expected.bytes) throw new PayloadValidationError(`Size mismatch (${got.bytes} ≠ ${expected.bytes})`);
  if (sniffAudioContainer(got.head) !== expected.format) throw new PayloadValidationError('Unexpected audio container');
  if (got.sha256.toLowerCase() !== expected.sha256.toLowerCase()) throw new PayloadValidationError('Checksum mismatch');
}

export function verifyChecksum(actual: string, expected: string | undefined): void {
  if (!expected) return;
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new PayloadValidationError('Checksum mismatch');
}

export interface ParsedHadithEdition {
  readonly name: string;
  readonly sections: { n: number; name: string; first: number | null; last: number | null }[];
  readonly hadiths: { number: number; section: number | null; text: string; grades: { name: string; grade: string }[] }[];
  readonly skippedEmpty: number;
}

/** Validates one hadith-api edition (`{ metadata, hadiths }`). Empty entries are skipped, never invented. */
export function parseHadithEdition(json: unknown): ParsedHadithEdition {
  const d = json as {
    metadata?: {
      name?: string;
      sections?: Record<string, string>;
      section_details?: Record<string, { hadithnumber_first?: number; hadithnumber_last?: number }>;
    };
    hadiths?: { hadithnumber?: number; text?: string; grades?: { name?: string; grade?: string }[]; reference?: { book?: number } }[];
  };
  if (!d?.metadata?.name || !Array.isArray(d.hadiths) || d.hadiths.length < 40) throw new PayloadValidationError('Unexpected hadith edition shape');
  const sections = Object.entries(d.metadata.sections ?? {})
    .map(([k, name]) => ({
      n: Number(k),
      name: String(name ?? '').trim(),
      first: d.metadata?.section_details?.[k]?.hadithnumber_first ?? null,
      last: d.metadata?.section_details?.[k]?.hadithnumber_last ?? null,
    }))
    .filter((s) => Number.isFinite(s.n) && s.n > 0 && s.name);
  let skippedEmpty = 0;
  const hadiths: ParsedHadithEdition['hadiths'] = [];
  for (const h of d.hadiths) {
    if (typeof h.hadithnumber !== 'number') throw new PayloadValidationError('Hadith without number');
    const text = (h.text ?? '').trim();
    if (!text) {
      skippedEmpty++;
      continue;
    }
    hadiths.push({
      number: h.hadithnumber,
      section: typeof h.reference?.book === 'number' ? h.reference.book : null,
      text,
      grades: (h.grades ?? []).filter((g) => g?.name && g?.grade).map((g) => ({ name: String(g.name), grade: String(g.grade) })),
    });
  }
  if (hadiths.length < 40 || skippedEmpty > hadiths.length * 0.2) throw new PayloadValidationError('Too many empty hadith entries');
  return { name: d.metadata.name, sections, hadiths, skippedEmpty };
}
