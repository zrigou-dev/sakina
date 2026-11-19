/** Parsers and structural validators for Tanzil Quran text and metadata. */

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseMetadata(xml) {
  const section = (name) => {
    const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    if (!m) throw new Error(`metadata: missing <${name}>`);
    return m[1];
  };
  const rows = (body, tag) => [...body.matchAll(new RegExp(`<${tag}\\s[^>]*/>`, 'g'))].map((m) => attrs(m[0]));

  const surahs = rows(section('suras'), 'sura').map((a) => ({
    number: Number(a.index),
    ayahCount: Number(a.ayas),
    startIndex: Number(a.start),
    nameArabic: a.name,
    nameTransliterated: a.tname,
    nameEnglish: a.ename,
    revelation: a.type === 'Meccan' ? 'meccan' : 'medinan',
    revelationOrder: Number(a.order),
  }));
  const point = (a) => [Number(a.sura), Number(a.aya)];
  const juz = rows(section('juzs'), 'juz').map(point);
  const hizbQuarters = rows(section('hizbs'), 'quarter').map(point);
  const pages = rows(section('pages'), 'page').map(point);
  const rukus = rows(section('rukus'), 'ruku').map(point);
  const sajdas = rows(section('sajdas'), 'sajda').map((a) => ({
    surah: Number(a.sura),
    ayah: Number(a.aya),
    type: a.type === 'obligatory' ? 'obligatory' : 'recommended',
  }));
  return { surahs, juz, hizbQuarters, pages, rukus, sajdas };
}

export function parseTanzilText(text) {
  const verses = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [s, a, ...rest] = line.split('|');
    verses.push({ surah: Number(s), ayah: Number(a), text: rest.join('|') });
  }
  return verses;
}

export function validate(verses, meta, label) {
  const errors = [];
  if (verses.length !== 6236) errors.push(`${label}: expected 6236 ayahs, found ${verses.length}`);
  if (meta.surahs.length !== 114) errors.push(`${label}: expected 114 surahs`);
  let i = 0;
  for (const s of meta.surahs) {
    if (s.startIndex !== i) errors.push(`${label}: surah ${s.number} start ${s.startIndex} != ${i}`);
    for (let a = 1; a <= s.ayahCount; a++, i++) {
      const v = verses[i];
      if (!v || v.surah !== s.number || v.ayah !== a) {
        errors.push(`${label}: ordering break at index ${i} (expected ${s.number}:${a})`);
        return errors;
      }
      if (!v.text.trim()) errors.push(`${label}: empty text at ${s.number}:${a}`);
    }
  }
  if (meta.juz.length !== 30) errors.push('metadata: expected 30 juz');
  if (meta.hizbQuarters.length !== 240) errors.push('metadata: expected 240 hizb quarters');
  if (meta.pages.length !== 604) errors.push('metadata: expected 604 pages');
  return errors;
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENTITIES[e]);

/** Parses Tanzil XML export: <sura index> / <aya index text [bismillah]>. */
export function parseTanzilXml(xml) {
  const verses = [];
  for (const sura of xml.matchAll(/<sura\s+index="(\d+)"[^>]*>([\s\S]*?)<\/sura>/g)) {
    for (const aya of sura[2].matchAll(/<aya\s+([^>]*?)\/>/g)) {
      const a = {};
      for (const m of aya[1].matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = decode(m[2]);
      verses.push({ surah: Number(sura[1]), ayah: Number(a.index), text: a.text, bismillah: a.bismillah ?? null });
    }
  }
  return verses;
}
