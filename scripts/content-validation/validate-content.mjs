#!/usr/bin/env node
/**
 * Offline content validation (CI-friendly, no network):
 *  - re-hashes bundled Tanzil assets and compares with src/content/integrity.generated.ts
 *  - re-parses both editions and checks 114 surahs / 6236 ayahs / ordering / Basmala structure
 *  - checks that both editions align ayah-by-ayah
 *  - checks generated metadata tables and Asma al-Husna count
 *  - checks that the Tanzil copyright block is still present (verbatim distribution)
 *
 *   node scripts/content-validation/validate-content.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMetadata, parseTanzilXml, validate } from '../content-import/tanzil.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p));
const errors = [];
const ok = (msg) => console.log(`✓ ${msg}`);

const integritySrc = read('src/content/integrity.generated.ts').toString('utf8');
const expected = Object.fromEntries([...integritySrc.matchAll(/"([^"]+\.xml)":\s*"([0-9a-f]{64})"/g)].map((m) => [m[1], m[2]]));

const meta = parseMetadata(read('scripts/content-import/sources/quran-data.xml').toString('utf8'));
const editions = {};
for (const file of ['quran-uthmani.xml', 'quran-simple-clean.xml']) {
  const buf = read(`assets/content/${file}`);
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== expected[file]) errors.push(`${file}: SHA-256 ${hash} does not match integrity module ${expected[file]}`);
  else ok(`${file} SHA-256 matches`);
  const text = buf.toString('utf8');
  if (!/PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK/.test(text) || !/Tanzil Project/.test(text)) errors.push(`${file}: Tanzil copyright block missing`);
  const verses = parseTanzilXml(text);
  const problems = validate(verses, meta, file);
  verses.forEach((v) => {
    const expectB = v.ayah === 1 && v.surah !== 1 && v.surah !== 9;
    if (expectB !== !!v.bismillah) problems.push(`${file}: Basmala structure at ${v.surah}:${v.ayah}`);
  });
  if (problems.length) errors.push(...problems);
  else ok(`${file}: 114 surahs, 6236 ayahs, ordering and Basmala structure intact`);
  editions[file] = verses;
}
const a = editions['quran-uthmani.xml'];
const b = editions['quran-simple-clean.xml'];
if (a && b && a.every((v, i) => b[i] && b[i].surah === v.surah && b[i].ayah === v.ayah)) ok('editions aligned verse-by-verse');
else errors.push('editions are not aligned');

const metaTs = read('src/content/quran/metadata.generated.ts').toString('utf8');
const count = (name) => JSON.parse(metaTs.match(new RegExp(`${name}[^=]*= (\\[.*?\\]\\]);`))[1]).length;
const counts = { JUZ_STARTS: 30, HIZB_QUARTER_STARTS: 240, PAGE_STARTS: 604, RUKU_STARTS: 556 };
for (const [k, n] of Object.entries(counts)) {
  if (count(k) !== n) errors.push(`metadata ${k}: expected ${n}`);
}
ok('metadata tables: 30 juz / 240 hizb quarters / 604 pages / 556 rukuʿ');

const asma = read('src/content/asma/asma.generated.ts').toString('utf8');
const names = (asma.match(/"number":/g) ?? []).length;
if (names !== 99) errors.push(`asma: expected 99 names, found ${names}`);
else ok('Asma al-Husna: 99 entries');

// ─── Extended content (adhkar, hadith, adhan) against content/SOURCES.extended.lock.json ───
const lock = JSON.parse(read('content/SOURCES.extended.lock.json').toString('utf8'));
const generated = {
  'adhkar.morningEvening': 'src/content/adhkar/morning-evening.generated.json',
  'adhkar.hisn': 'src/content/adhkar/hisn.generated.json',
  'hadith.forty': 'src/content/hadith/forty.generated.json',
  'hadith.catalogue': 'src/content/hadith/catalogue.generated.json',
  'sadaqah.hadith': 'src/content/sadaqah/hadith.generated.json',
};
for (const [key, file] of Object.entries(generated)) {
  const h = createHash('sha256').update(read(file)).digest('hex');
  if (h !== lock.sources[key]?.sha256) errors.push(`${file}: SHA-256 does not match the lockfile (${key})`);
  else ok(`${file.split('/').pop()} SHA-256 matches lockfile`);
}
const json = (file) => JSON.parse(read(file).toString('utf8'));
const hisn = json(generated['adhkar.hisn']);
const hisnItems = hisn.reduce((n, c) => n + c.items.length, 0);
const badHisn = hisn.flatMap((c) => c.items.filter((i) => !i.text?.trim() || !(Number.isInteger(i.count) && i.count >= 1)).map((i) => `${c.id}:${i.n}`));
if (hisn.length !== 132 || hisnItems !== lock.sources['adhkar.hisn'].items || badHisn.length)
  errors.push(`hisn: ${hisn.length} chapters / ${hisnItems} items; invalid: ${badHisn.join(', ')}`);
else ok(`Ḥiṣn al-Muslim: 132 chapters, ${hisnItems} items, all with text and counts`);
const me = json(generated['adhkar.morningEvening']);
if (me.length !== 34 || me.some((m) => !m.text?.trim() || !['am', 'pm', 'both'].includes(m.session))) errors.push('morning/evening adhkar: structure');
else ok('morning/evening adhkar: 34 items with session');
const sadaqah = json(generated['sadaqah.hadith']);
if (
  sadaqah.arabicNumber !== '1631' ||
  !['صَدَقَةٍ جَارِيَةٍ', 'عِلْمٍ يُنْتَفَعُ بِهِ', 'وَلَدٍ صَالِحٍ يَدْعُو لَهُ'].every((p) => sadaqah.ar.includes(p)) ||
  !sadaqah.arFull.includes(sadaqah.ar)
)
  errors.push('sadaqah hadith: not the verified Sahih Muslim 1631 text');
else ok('Sadaqah page hadith: Sahih Muslim 1631, verbatim slice of the source');
const forty = json(generated['hadith.forty']);
if (forty.nawawi?.length !== 42 || forty.qudsi?.length !== 40 || [...forty.nawawi, ...forty.qudsi].some((h) => !h.ar?.trim()))
  errors.push('forty hadith: structure');
else ok('Forty Nawawi (42) and Qudsi (40): Arabic text present');
// ─── Adhan library (licence-verified recordings; see content/adhan/SOURCES.lock.json) ───
const adhanLock = json('content/adhan/SOURCES.lock.json');
const adhanFile = 'src/content/adhan/catalogue.generated.json';
const adhan = json(adhanFile);
const adhanHash = createHash('sha256').update(read(adhanFile)).digest('hex');
if (adhanHash !== adhanLock.catalogueSha256) errors.push('adhan catalogue SHA-256 does not match content/adhan/SOURCES.lock.json');
for (const v of adhan.voices) {
  if (!/^(CC0|CC BY(-SA)? [2-4]\.\d)$/.test(v.credit.licence))
    errors.push(`adhan ${v.id}: licence ${v.credit.licence} does not allow commercial redistribution`);
  const master = createHash('sha256')
    .update(read(`library/adhan/${v.file}`))
    .digest('hex');
  if (master !== v.sha256 || master !== adhanLock.voices[v.id]?.masterSha256) errors.push(`adhan ${v.id}: mastered file SHA-256 mismatch`);
  if (v.clip.durationSec >= 30) errors.push(`adhan ${v.id}: notification clip must be shorter than 30 s (iOS)`);
  if (v.delivery === 'bundled') {
    if (
      createHash('sha256')
        .update(read(`assets/adhan/full/${v.file}`))
        .digest('hex') !== v.sha256
    )
      errors.push(`adhan ${v.id}: bundled asset differs from the mastered file`);
  } else {
    const pinned = createHash('sha256')
      .update(read(`content/adhan/pinned/${v.id}.${v.direct.format}`))
      .digest('hex');
    if (pinned !== v.direct.sha256 || !/^https:\/\/upload\.wikimedia\.org\/\S+\.mp3$/.test(v.direct.url)) errors.push(`adhan ${v.id}: pinned download source`);
  }
  const attribution = json(`content/adhan/originals/${v.id}.attribution.json`);
  if (!(attribution.ownWork || (attribution.fromYouTube && attribution.licenceReviewedOnCommons)))
    errors.push(`adhan ${v.id}: licence provenance not verifiable`);
}
ok(`adhan library: ${adhan.voices.length} voices — free licences, provenance verified, hashes match the lockfile, clips < 30 s`);

// ─── Personal-use adhan catalogue (NOT licence-verified; personal builds only) ───
const personalFile = 'src/content/adhan/personal.generated.json';
if (existsSync(resolve(root, personalFile))) {
  const personalLock = json('content/adhan/PERSONAL_SOURCES.lock.json');
  const personal = json(personalFile);
  const personalHash = createHash('sha256').update(read(personalFile)).digest('hex');
  if (personalHash !== personalLock.catalogueSha256) errors.push('personal adhan catalogue SHA-256 does not match content/adhan/PERSONAL_SOURCES.lock.json');
  const ids = new Set();
  for (const v of personal.voices) {
    if (ids.has(v.id)) errors.push(`personal adhan ${v.id}: duplicate id`);
    ids.add(v.id);
    if (v.tier !== 'personal' || !/^Personal use only/.test(v.credit.licence) || v.credit.commercialUse !== false)
      errors.push(`personal adhan ${v.id}: must be labelled personal-use only`);
    if (!/^https:\/\/raw\.githubusercontent\.com\/Kiwifu\/adhan-mp3\/[0-9a-f]{40}\//.test(v.direct.url))
      errors.push(`personal adhan ${v.id}: source must be the pinned commit`);
    if (!/^[0-9a-f]{64}$/.test(v.direct.sha256) || v.direct.gainDb > 0) errors.push(`personal adhan ${v.id}: pin or gain invalid`);
  }
  console.warn(
    `\n⚠ PERSONAL-USE ADHAN CATALOGUE PRESENT: ${personal.voices.length} recordings whose rights are NOT verified.\n` +
      '  Fine for your own phone. Before ANY public release run `npm run adhan:strip-personal`.\n',
  );
  ok(`personal adhan catalogue: ${personal.voices.length} voices pinned (size + SHA-256, commit-pinned source), all labelled personal-use`);
}
const publishing = process.env.SAKINA_PUBLISH === '1';
const appJson = json('app.json');
const personalCount = existsSync(resolve(root, personalFile)) ? json(personalFile).voices.length : 0;
if (publishing && (appJson.expo.extra?.personalAdhanLibrary === true || personalCount > 0)) {
  errors.push('SAKINA_PUBLISH=1: run `npm run adhan:strip-personal` (disables the personal-use adhan catalogue and empties its file) before publishing');
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('\nAll content checks passed.');
