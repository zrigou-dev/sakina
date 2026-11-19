#!/usr/bin/env node
/**
 * SAKINA extended content import — adhkar and hadith. (The adhan library has its own licence-verifying
 * pipeline: scripts/adhan/build-library.mjs.)
 * Every item is downloaded verbatim from a documented, redistributable source;
 * nothing religious is written by hand.
 *
 *   node scripts/content-import/import-extended.mjs
 *
 * Adhkar
 *   Seen-Arabic/Morning-And-Evening-Adhkar-DB (MIT) — morning & evening adhkar with counts,
 *     virtues and full source references (incl. al-Albani gradings), Arabic + English.
 *   YousefAsalya/Islamic-Pro-azkar-API (MIT) — complete Hisn al-Muslim (132 chapters),
 *     Arabic + English, with repeat counts.
 * Hadith
 *   fawazahmed0/hadith-api (The Unlicense) — Forty Hadith of an-Nawawi and Forty Hadith
 *     Qudsi bundled (Arabic, English, French); the nine major collections are listed in a
 *     generated catalogue and downloaded on demand.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const p = (...s) => join(root, ...s);
const UA = { 'User-Agent': 'sakina-content-import/1.0 (open-source Islamic app; content pipeline)' };
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const lock = { generatedAt: new Date().toISOString(), sources: {} };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with polite retry/backoff (Wikimedia rate-limits bursts with HTTP 429). */
async function get(url, as = 'buffer') {
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(url, { headers: UA });
    if (res.status !== 429 && res.status < 500) break;
    const wait = Number(res.headers.get('retry-after')) * 1000 || 15_000 * (attempt + 1);
    process.stdout.write(`  … HTTP ${res.status}, retrying in ${Math.round(wait / 1000)} s\n`);
    await sleep(wait);
  }
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return as === 'json' ? JSON.parse(buf.toString('utf8').replace(/^﻿/, '')) : buf;
}

function record(key, entry) {
  lock.sources[key] = entry;
}

function writeJson(rel, data) {
  mkdirSync(dirname(p(rel)), { recursive: true });
  const text = JSON.stringify(data);
  writeFileSync(p(rel), text);
  return sha256(Buffer.from(text));
}

// ─── Adhkar ──────────────────────────────────────────────────────────────────
async function importAdhkar() {
  const ME = 'https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/HEAD/';
  const HISN = 'https://raw.githubusercontent.com/YousefAsalya/Islamic-Pro-azkar-API/HEAD/data/';
  const [meAr, meEn, hisnAr, hisnEn] = await Promise.all([
    get(`${ME}ar.json`, 'json'),
    get(`${ME}en.json`, 'json'),
    get(`${HISN}ar.json`, 'json'),
    get(`${HISN}en.json`, 'json'),
  ]);

  if (!Array.isArray(meAr) || meAr.length < 20 || meAr.length !== meEn.length) throw new Error('morning/evening: unexpected shape');
  const morningEvening = meAr.map((a, i) => {
    const e = meEn[i];
    if (a.order !== e.order) throw new Error(`morning/evening: misaligned at ${i}`);
    if (!a.content?.trim()) throw new Error(`morning/evening: empty text at ${i}`);
    return {
      order: a.order,
      text: a.content.trim(),
      count: Number(a.count) > 0 ? Number(a.count) : 1,
      countLabel: a.count_description?.trim() || null,
      virtue: a.fadl?.trim() || null,
      source: a.source?.trim() || null,
      session: a.type === 1 ? 'am' : a.type === 2 ? 'pm' : 'both',
      en: { text: e.content?.trim() || null, virtue: e.fadl?.trim() || null, source: e.source?.trim() || null },
    };
  });

  if (!Array.isArray(hisnAr) || hisnAr.length !== 132 || hisnEn.length !== 132) throw new Error('hisn: expected 132 chapters');
  const enById = new Map(hisnEn.map((c) => [c.id, c]));
  const hisn = hisnAr.map((c) => {
    const e = enById.get(c.id);
    if (!e || !Array.isArray(c.array) || !c.array.length) throw new Error(`hisn: chapter ${c.id}`);
    return {
      id: c.id,
      titleAr: c.category.trim(),
      titleEn: e.category.trim(),
      audio: c.filename ? `${c.filename}.mp3` : null,
      items: c.array.map((it, j) => {
        if (!it.text?.trim()) throw new Error(`hisn: empty text ${c.id}/${j}`);
        return {
          n: it.id,
          text: it.text.trim(),
          count: Number(it.count) > 0 ? Number(it.count) : 1,
          en: e.array[j]?.text?.trim() || null,
          audio: it.filename ? `${it.filename}.mp3` : null,
        };
      }),
    };
  });
  const total = hisn.reduce((s, c) => s + c.items.length, 0);
  const h1 = writeJson('src/content/adhkar/morning-evening.generated.json', morningEvening);
  const h2 = writeJson('src/content/adhkar/hisn.generated.json', hisn);
  record('adhkar.morningEvening', {
    name: 'Morning & Evening Adhkar DB',
    url: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    licence: 'MIT',
    items: morningEvening.length,
    sha256: h1,
  });
  record('adhkar.hisn', {
    name: 'Islamic Pro Azkar API — Hisn al-Muslim',
    url: 'https://github.com/YousefAsalya/Islamic-Pro-azkar-API',
    licence: 'MIT',
    chapters: hisn.length,
    items: total,
    sha256: h2,
  });
  console.log(`✓ adhkar: ${morningEvening.length} morning/evening · Hisn al-Muslim ${hisn.length} chapters / ${total} adhkar`);
}

// ─── Hadith ──────────────────────────────────────────────────────────────────
async function importHadith() {
  const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/';
  const editions = await get(`${BASE}editions.json`, 'json');
  const BOOKS = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'nawawi', 'qudsi'];
  const catalogue = [];
  for (const book of BOOKS) {
    const ed = editions[book];
    if (!ed) throw new Error(`hadith: missing ${book}`);
    const pick = (lang) => ed.collection.find((c) => c.name === `${lang}-${book}`)?.name ?? null;
    catalogue.push({ book, name: ed.name, ara: pick('ara'), eng: pick('eng'), fra: pick('fra') });
  }
  // Sizes for the download manager.
  for (const c of catalogue) {
    for (const lang of ['ara', 'eng', 'fra']) {
      if (!c[lang]) continue;
      const res = await fetch(`${BASE}editions/${c[lang]}.min.json`, { method: 'HEAD', headers: UA });
      c[`${lang}Bytes`] = Number(res.headers.get('content-length')) || null;
    }
  }

  const forty = {};
  for (const book of ['nawawi', 'qudsi']) {
    const [ar, en, fr] = await Promise.all(['ara', 'eng', 'fra'].map((l) => get(`${BASE}editions/${l}-${book}.min.json`, 'json')));
    if (ar.hadiths.length < 40 || ar.hadiths.length !== en.hadiths.length || ar.hadiths.length !== fr.hadiths.length)
      throw new Error(`${book}: misaligned editions`);
    forty[book] = ar.hadiths.map((h, i) => {
      if (en.hadiths[i].hadithnumber !== h.hadithnumber || fr.hadiths[i].hadithnumber !== h.hadithnumber) throw new Error(`${book}: misaligned at ${i}`);
      if (!h.text?.trim()) throw new Error(`${book}: empty ${h.hadithnumber}`);
      return { n: h.hadithnumber, ar: h.text.trim(), en: en.hadiths[i].text?.trim() || null, fr: fr.hadiths[i].text?.trim() || null, grades: h.grades ?? [] };
    });
  }
  const h1 = writeJson('src/content/hadith/forty.generated.json', forty);
  const h2 = writeJson('src/content/hadith/catalogue.generated.json', catalogue);
  record('hadith.forty', {
    name: 'hadith-api — Forty Hadith of an-Nawawi & Forty Hadith Qudsi (ar/en/fr)',
    url: 'https://github.com/fawazahmed0/hadith-api',
    licence: 'The Unlicense (dataset); translators retain rights in translations',
    sha256: h1,
  });
  record('hadith.catalogue', { name: 'hadith-api editions', url: `${BASE}editions.json`, licence: 'The Unlicense', sha256: h2 });
  console.log(`✓ hadith: Nawawi ${forty.nawawi.length} · Qudsi ${forty.qudsi.length} bundled · ${catalogue.length} collections catalogued`);
}

// ─── Sadaqah jariyah page: the hadith on ongoing charity (Sahih Muslim 1631), verbatim ─────────
async function importSadaqah() {
  const book = async (ed) => get(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${ed}-muslim.min.json`, 'json');
  const [ar, en, fr] = await Promise.all([book('ara'), book('eng'), book('fra')]);
  const pick = (d) => {
    const hits = d.hadiths.filter((h) => String(h.arabicnumber) === '1631');
    if (hits.length !== 1) throw new Error(`sadaqah: expected exactly one hadith with arabicnumber 1631, found ${hits.length}`);
    return hits[0];
  };
  const [a, e, f] = [pick(ar), pick(en), pick(fr)];
  if (a.hadithnumber !== e.hadithnumber || a.hadithnumber !== f.hadithnumber) throw new Error('sadaqah: editions disagree on the hadith number');
  // The saying itself is the quoted part; the chain of narrators before it is kept in `arFull`.
  const first = a.text.indexOf('"');
  const last = a.text.lastIndexOf('"');
  if (first < 0 || last <= first) throw new Error('sadaqah: could not find the quoted saying');
  const arMatn = a.text
    .slice(first + 1, last)
    .replace(/[\u200f\u200e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  for (const needle of ['صَدَقَةٍ جَارِيَةٍ', 'عِلْمٍ يُنْتَفَعُ بِهِ', 'وَلَدٍ صَالِحٍ يَدْعُو لَهُ']) {
    if (!arMatn.includes(needle)) throw new Error(`sadaqah: expected phrase missing: ${needle}`);
  }
  const out = {
    collection: 'muslim',
    hadithNumber: a.hadithnumber,
    arabicNumber: String(a.arabicnumber),
    reference: a.reference,
    ar: arMatn,
    arFull: a.text,
    en: e.text,
    fr: f.text,
  };
  const h = writeJson('src/content/sadaqah/hadith.generated.json', out);
  record('sadaqah.hadith', {
    name: 'Sahih Muslim 1631 (ongoing charity) — Arabic, English, French',
    url: 'https://github.com/fawazahmed0/hadith-api',
    licence: 'The Unlicense (dataset); translators retain rights in translations',
    sha256: h,
  });
  console.log(`✓ sadaqah hadith: Sahih Muslim ${out.arabicNumber} (dataset #${out.hadithNumber}), ${out.ar.length} Arabic chars`);
}

// `ONLY=sadaqah` re-imports just that piece and merges into the existing lockfile (verified data elsewhere stays untouched).
const only = process.env.ONLY;
if (only === 'sadaqah') {
  await importSadaqah();
  const existing = JSON.parse(readFileSync(p('content/SOURCES.extended.lock.json'), 'utf8'));
  existing.sources['sadaqah.hadith'] = lock.sources['sadaqah.hadith'];
  writeFileSync(p('content/SOURCES.extended.lock.json'), JSON.stringify(existing, null, 2) + '\n');
  console.log('✓ merged sadaqah.hadith into content/SOURCES.extended.lock.json');
} else {
  await importAdhkar();
  await importSadaqah();
  await importHadith();
  mkdirSync(p('content'), { recursive: true });
  writeFileSync(p('content/SOURCES.extended.lock.json'), JSON.stringify(lock, null, 2) + '\n');
  console.log('✓ wrote content/SOURCES.extended.lock.json');
}
