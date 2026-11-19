import { SURAHS, TOTAL_AYAHS } from '@/content/quran/metadata.generated';

export interface ParsedVerse {
  readonly surah: number;
  readonly ayah: number;
  readonly text: string;
  /** Tanzil's separate Basmala on the first ayah of every surah except 1 and 9 (XML export only). */
  readonly bismillah?: string | null;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]!);

/** Parses Tanzil's XML export (`<sura index><aya index text [bismillah]/>`). */
export function parseTanzilXml(xml: string): ParsedVerse[] {
  const out: ParsedVerse[] = [];
  for (const sura of xml.matchAll(/<sura\s+index="(\d+)"[^>]*>([\s\S]*?)<\/sura>/g)) {
    for (const aya of sura[2]!.matchAll(/<aya\s+([^>]*?)\/>/g)) {
      const attrs: Record<string, string> = {};
      for (const m of aya[1]!.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]!] = decodeXml(m[2]!);
      if (attrs.index === undefined || attrs.text === undefined) throw new Error('Malformed Tanzil aya element');
      out.push({ surah: Number(sura[1]), ayah: Number(attrs.index), text: attrs.text, bismillah: attrs.bismillah ?? null });
    }
  }
  return out;
}

/**
 * Verifies completeness and ordering against Tanzil metadata.
 * Returns a list of problems (empty = valid).
 */
export function validateQuranVerses(verses: readonly ParsedVerse[]): string[] {
  const errors: string[] = [];
  if (verses.length !== TOTAL_AYAHS) errors.push(`expected ${TOTAL_AYAHS} ayahs, found ${verses.length}`);
  let i = 0;
  for (const s of SURAHS) {
    for (let a = 1; a <= s.ayahCount; a++, i++) {
      const v = verses[i];
      if (!v || v.surah !== s.number || v.ayah !== a) {
        errors.push(`ordering break at #${i + 1}: expected ${s.number}:${a}, found ${v ? `${v.surah}:${v.ayah}` : 'nothing'}`);
        return errors;
      }
      if (!v.text.trim()) errors.push(`empty text at ${s.number}:${a}`);
      if (v.bismillah !== undefined) {
        const expectBismillah = a === 1 && s.number !== 1 && s.number !== 9;
        if (expectBismillah !== !!v.bismillah) errors.push(`unexpected Basmala structure at ${s.number}:${a}`);
      }
    }
  }
  return errors;
}
