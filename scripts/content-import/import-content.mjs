#!/usr/bin/env node
/**
 * SAKINA content import.
 *
 * Downloads verified, redistributable source content VERBATIM and generates
 * small typed metadata modules from it. Nothing here is written by hand or by
 * a language model: every religious text comes from the cited source.
 *
 *   node scripts/content-import/import-content.mjs
 *
 * Outputs
 *   assets/content/quran-uthmani.xml        Tanzil Uthmani text, XML export (verbatim, CC BY 3.0)
 *   assets/content/quran-simple-clean.xml   Tanzil Simple-Clean text, XML export (verbatim, CC BY 3.0) — search index only
 *
 * The XML export is used (not TXT) because it keeps the Basmala as a separate `bismillah`
 * attribute on the first ayah, whereas the TXT export prefixes it to the ayah text.
 *   scripts/content-import/sources/quran-data.xml   Tanzil metadata (CC BY)
 *   src/content/quran/metadata.generated.ts  Surah / juz / hizb / page / sajda tables
 *   src/content/asma/asma.generated.ts       Asma al-Husna (Arabic + English meaning, AlAdhan API)
 *   src/content/integrity.generated.ts       SHA-256 of every bundled source file
 *   content/SOURCES.lock.json                Provenance record (URL, date, hash, licence)
 */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMetadata, parseTanzilXml, validate } from './tanzil.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const p = (...s) => join(root, ...s);

const SOURCES = {
  uthmani: {
    url: 'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=xml&agree=true',
    out: 'assets/content/quran-uthmani.xml',
    name: 'Tanzil Quran Text (Uthmani)',
    licence: 'CC BY 3.0 — verbatim copies only, attribution + link to tanzil.net required',
  },
  simpleClean: {
    url: 'https://tanzil.net/pub/download/index.php?quranType=simple-clean&outType=xml&agree=true',
    out: 'assets/content/quran-simple-clean.xml',
    name: 'Tanzil Quran Text (Simple Clean) — used only as a search index',
    licence: 'CC BY 3.0 — verbatim copies only, attribution + link to tanzil.net required',
  },
  metadata: {
    url: 'https://tanzil.net/res/text/metadata/quran-data.xml',
    out: 'scripts/content-import/sources/quran-data.xml',
    name: 'Tanzil Quran Metadata',
    licence: 'CC BY (Tanzil.info)',
  },
  cities: {
    url: 'https://download.geonames.org/export/dump/cities15000.zip',
    out: 'scripts/content-import/sources/cities15000.zip',
    name: 'GeoNames cities15000',
    licence: 'CC BY 4.0 — GeoNames (geonames.org)',
  },
  countries: {
    url: 'https://download.geonames.org/export/dump/countryInfo.txt',
    out: 'scripts/content-import/sources/countryInfo.txt',
    name: 'GeoNames countryInfo',
    licence: 'CC BY 4.0 — GeoNames (geonames.org)',
  },
  asma: {
    url: 'https://api.aladhan.com/v1/asmaAlHusna',
    out: 'scripts/content-import/sources/asma-al-husna.json',
    name: 'Asma al-Husna (AlAdhan API)',
    licence: 'Public API by Islamic Network (aladhan.com); names are scriptural, English meanings attributed to AlAdhan',
  },
};

/**
 * Streams GeoNames alternateNamesV2 (≈205 MB, cached in the OS temp dir, never committed)
 * and returns geonameid → best Arabic name (preferred, then short, skipping colloquial/historic).
 */
function loadArabicAlternateNames() {
  const zip = join(tmpdir(), 'sakina-geonames-alternateNamesV2.zip');
  try {
    execFileSync('test', ['-s', zip]);
  } catch {
    console.log('  ↓ GeoNames alternateNamesV2.zip (one-off, ~205 MB) …');
    execFileSync('curl', ['-sSL', '-o', zip, 'https://download.geonames.org/export/dump/alternateNamesV2.zip'], { stdio: 'inherit' });
  }
  const tsv = execFileSync('sh', ['-c', `unzip -p "${zip}" alternateNamesV2.txt | awk -F'\t' '$3=="ar"'`], {
    maxBuffer: 256 * 1024 * 1024,
  }).toString('utf8');
  const best = new Map();
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 4) continue;
    const [, id, , name, preferred, short, colloquial, historic] = c;
    if (colloquial === '1' || historic === '1') continue;
    const score = (preferred === '1' ? 4 : 0) + (short === '1' ? 2 : 0);
    const cur = best.get(Number(id));
    if (!cur || score > cur.score || (score === cur.score && name.length < cur.name.length)) {
      best.set(Number(id), { name, score });
    }
  }
  return new Map([...best].map(([k, v]) => [k, v.name]));
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(key) {
  const src = SOURCES[key];
  const res = await fetch(src.url, { headers: { 'User-Agent': 'sakina-content-import/1.0' } });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`${key}: suspiciously small payload (${buf.length} bytes)`);
  mkdirSync(dirname(p(src.out)), { recursive: true });
  writeFileSync(p(src.out), buf);
  return { buf, hash: sha256(buf) };
}

const header = (sources) =>
  `/* eslint-disable */\n// AUTO-GENERATED by scripts/content-import/import-content.mjs — DO NOT EDIT BY HAND.\n// Sources: ${sources}\n`;

async function main() {
  const results = {};
  for (const key of Object.keys(SOURCES)) {
    process.stdout.write(`↓ ${key} … `);
    results[key] = await download(key);
    console.log(`${results[key].buf.length} bytes  sha256=${results[key].hash.slice(0, 16)}…`);
  }

  const meta = parseMetadata(results.metadata.buf.toString('utf8'));
  const uthmani = parseTanzilXml(results.uthmani.buf.toString('utf8'));
  const simple = parseTanzilXml(results.simpleClean.buf.toString('utf8'));
  const errors = [...validate(uthmani, meta, 'uthmani'), ...validate(simple, meta, 'simple-clean')];
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('✓ Quran text validated: 114 surahs, 6236 ayahs, ordering intact (both editions)');

  mkdirSync(p('src/content/quran'), { recursive: true });
  writeFileSync(
    p('src/content/quran/metadata.generated.ts'),
    `${header('Tanzil quran-data.xml (CC BY)')}
import type { SurahMeta, VerseKeyTuple, SajdaMeta } from './types';

export const SURAHS: readonly SurahMeta[] = ${JSON.stringify(meta.surahs, null, 0)} as const;

/** First ayah of each of the 30 juz, as [surah, ayah]. */
export const JUZ_STARTS: readonly VerseKeyTuple[] = ${JSON.stringify(meta.juz)};

/** First ayah of each of the 240 hizb quarters (rub' al-hizb), as [surah, ayah]. */
export const HIZB_QUARTER_STARTS: readonly VerseKeyTuple[] = ${JSON.stringify(meta.hizbQuarters)};

/** First ayah of each of the 604 pages of the Madani mushaf layout, as [surah, ayah]. */
export const PAGE_STARTS: readonly VerseKeyTuple[] = ${JSON.stringify(meta.pages)};

/** First ayah of each of the 556 rukuʿ (thematic sections), as [surah, ayah]. */
export const RUKU_STARTS: readonly VerseKeyTuple[] = ${JSON.stringify(meta.rukus)};

export const SAJDAS: readonly SajdaMeta[] = ${JSON.stringify(meta.sajdas)};

export const TOTAL_AYAHS = 6236;
`,
  );

  const asma = JSON.parse(results.asma.buf.toString('utf8'));
  if (asma.code !== 200 || !Array.isArray(asma.data) || asma.data.length !== 99) {
    console.error('asma: unexpected payload');
    process.exit(1);
  }
  mkdirSync(p('src/content/asma'), { recursive: true });
  writeFileSync(
    p('src/content/asma/asma.generated.ts'),
    `${header('AlAdhan API /v1/asmaAlHusna')}
export interface AsmaName { readonly number: number; readonly arabic: string; readonly transliteration: string; readonly meaningEn: string }

export const ASMA_AL_HUSNA: readonly AsmaName[] = ${JSON.stringify(
      asma.data.map((n) => ({
        number: n.number,
        arabic: n.name,
        transliteration: n.transliteration,
        meaningEn: n.en?.meaning ?? '',
      })),
    )};
`,
  );

  // ── Cities (manual location when GPS is unavailable or declined) ──────────
  const countries = {};
  for (const line of results.countries.buf.toString('utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('\t');
    countries[c[0]] = { name: c[4], geonameId: Number(c[16]) };
  }
  const tsv = execFileSync('unzip', ['-p', p(SOURCES.cities.out), 'cities15000.txt'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  // Arabic names: language-tagged GeoNames alternate names (isolanguage = 'ar'), never guessed from script.
  const arNames = loadArabicAlternateNames();
  const cities = [];
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 18) continue;
    const population = Number(c[14]);
    const isCapital = c[7] === 'PPLC';
    if (population < 250000 && !isCapital) continue;
    const ar = arNames.get(Number(c[0])) ?? null;
    cities.push({
      id: Number(c[0]),
      name: c[1],
      nameAr: ar,
      country: c[8],
      countryName: countries[c[8]]?.name ?? c[8],
      countryNameAr: arNames.get(countries[c[8]]?.geonameId ?? -1) ?? null,
      lat: Math.round(Number(c[4]) * 1e4) / 1e4,
      lng: Math.round(Number(c[5]) * 1e4) / 1e4,
      tz: c[17],
      pop: population,
    });
  }
  cities.sort((a, b) => b.pop - a.pop);
  if (cities.length < 1500) {
    console.error(`cities: only ${cities.length} entries — unexpected`);
    process.exit(1);
  }
  mkdirSync(p('assets/content'), { recursive: true });
  writeFileSync(p('src/content/cities.generated.json'), JSON.stringify(cities));
  console.log(`✓ ${cities.length} cities (pop ≥ 250k or capital) → src/content/cities.generated.json`);

  const integrity = {
    'quran-uthmani.xml': results.uthmani.hash,
    'quran-simple-clean.xml': results.simpleClean.hash,
  };
  writeFileSync(
    p('src/content/integrity.generated.ts'),
    `${header('computed from assets/content/*')}
/** SHA-256 of bundled content assets. Verified at runtime before seeding the content database. */
export const BUNDLED_CONTENT_SHA256 = ${JSON.stringify(integrity, null, 2)} as const;
`,
  );

  const lock = {
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([k, s]) => [
        k,
        { name: s.name, url: s.url, file: s.out, sha256: results[k].hash, bytes: results[k].buf.length, licence: s.licence },
      ]),
    ),
  };
  mkdirSync(p('content'), { recursive: true });
  writeFileSync(p('content/SOURCES.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  console.log('✓ wrote generated modules and content/SOURCES.lock.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
