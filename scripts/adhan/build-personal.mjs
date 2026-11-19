#!/usr/bin/env node
/**
 * PERSONAL-USE adhan catalogue.
 *
 * Builds src/content/adhan/personal.generated.json from the public GitHub collection Kiwifu/adhan-mp3 (pinned commit).
 * That collection states NO licence, so these recordings are NOT licence-verified. They are for personal use on the owner's
 * own device only and are kept strictly separate from the verified library (build-library.mjs). Do not publish an app
 * build that includes this catalogue — set `expo.extra.personalAdhanLibrary` to false (or delete the generated file) first.
 *
 *   node scripts/adhan/build-personal.mjs
 *
 * Each file is downloaded once to measure it (duration, loudness) and to pin its SHA-256 and size, so the app can verify
 * every download exactly like the licensed voices.
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpegPath from 'ffmpeg-static';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const p = (...s) => resolve(root, ...s);
const REPO = 'Kiwifu/adhan-mp3';
const UA = 'SakinaPersonalAdhan/1.0 (personal-use hobby app)';
const CACHE = p('content/adhan/personal/_cache');
const TARGET_LUFS = -16;
const MIN_SECONDS = 15;
const MAX_SECONDS = 600;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const run = (cmd, args) =>
  new Promise((res) => {
    const c = spawn(cmd, args);
    let out = '';
    let err = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (err += d));
    c.on('close', (code) => res({ code, out, err }));
  });

async function getJson(url) {
  const r = await run('curl', ['-sS', '--fail', '-A', UA, url]);
  if (r.code !== 0) throw new Error(`GET ${url}: ${r.err}`);
  return JSON.parse(r.out);
}

async function download(url, file) {
  for (let i = 0; i < 4; i++) {
    const r = await run('curl', ['-sSL', '--fail', '-A', UA, '-o', file, url]);
    if (r.code === 0 && existsSync(file) && statSync(file).size > 0) return;
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  throw new Error(`download failed: ${url}`);
}

async function measure(file) {
  const r = await run(ffmpegPath, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const dur = r.err.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const sum = r.err.split('Summary:').pop() ?? '';
  const num = (re) => {
    const m = sum.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    durationSec: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
    lufs: num(/I:\s+(-?[\d.]+) LUFS/),
    lra: num(/LRA:\s+([\d.]+) LU/),
    truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/),
  };
}

/** "Ahmad_Ali_1_-_Egypt_(أحمد_علي_-_مصر).mp3" → names. Arabic comes from the parenthesised part of the file name. */
function names(file) {
  const stem = file.replace(/\.mp3$/i, '');
  const m = stem.match(/^(.*?)_?\((.+)\)$/);
  const clean = (s) =>
    s
      .replaceAll('_', ' ')
      .replace(/\s+-\s+/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
  const en = clean(m ? m[1] : stem);
  let ar = clean(m ? m[2] : stem);
  const num = en.match(/\s(\d+)(?=\s-|\s*$)/);
  if (m && num && !/\d/.test(ar)) ar = `${ar} ${num[1]}`;
  return { en, ar };
}

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const commit = (await getJson(`https://api.github.com/repos/${REPO}/commits/main`)).sha;
const tree = (await getJson(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`)).tree.filter(
  (e) => e.type === 'blob' && /\.mp3$/i.test(e.path),
);
console.log(`${REPO}@${commit.slice(0, 10)}: ${tree.length} mp3 files`);
mkdirSync(CACHE, { recursive: true });

const used = new Set();
const entries = (
  await pool(tree, 4, async (e, i) => {
    const url = `https://raw.githubusercontent.com/${REPO}/${commit}/${encodeURIComponent(e.path)}`;
    const file = `${CACHE}/${slug(e.path).slice(0, 80)}-${e.sha.slice(0, 8)}.mp3`;
    if (!existsSync(file) || statSync(file).size !== e.size) await download(url, file);
    const buf = readFileSync(file);
    const hash = sha256(buf);
    const m = await measure(file);
    process.stdout.write(`\r${i + 1}/${tree.length} ${e.path.slice(0, 40).padEnd(40)}`);
    if (m.durationSec < MIN_SECONDS || m.durationSec > MAX_SECONDS || m.lufs == null) return null;
    const { en, ar } = names(e.path);
    let id = `p-${slug(en)}`.slice(0, 44);
    if (!id || used.has(id)) id = `${id}-${e.sha.slice(0, 4)}`;
    used.add(id);
    const fajr = /fajr|الفجر|فجر/i.test(e.path);
    const gainDb = Math.min(0, Number((TARGET_LUFS - m.lufs).toFixed(1)));
    const personName = /^(Adhan|Azan|Fajr Adhan)\b/i.test(en) ? null : en.replace(/\s+\d+$/, '').replace(/\s-\s.*$/, '');
    return {
      id,
      tier: 'personal',
      kind: fajr ? 'fajr' : 'adhan',
      name: { ar, en, fr: en },
      place: null,
      style: null,
      delivery: 'download',
      performer: personName ? { name: personName, basis: 'Taken from the file name in the source collection; not independently verified.' } : null,
      durationSec: Number(m.durationSec.toFixed(1)),
      bytes: e.size,
      sha256: hash,
      format: 'mp3',
      file: `${id}.mp3`,
      direct: {
        url,
        format: 'mp3',
        bytes: e.size,
        sha256: hash,
        durationSec: Number(m.durationSec.toFixed(2)),
        gainDb,
        trim: { startSec: 0, endSec: Number(m.durationSec.toFixed(2)) },
      },
      clip: null,
      audio: {
        lufs: m.lufs,
        truePeak: m.truePeak ?? 0,
        lra: m.lra ?? 0,
        sampleRateHz: 44100,
        channels: 2,
        bitrateKbps: Math.round((e.size * 8) / m.durationSec / 1000),
      },
      credit: {
        recordist: 'Unknown (collection Kiwifu/adhan-mp3)',
        licence: 'Personal use only — rights not verified',
        licenceUrl: null,
        sourceTitle: e.path,
        sourceUrl: `https://github.com/${REPO}`,
        modified: 'None — played as published; volume is lowered at playback when the file is louder than the library level.',
        shareAlike: false,
        commercialUse: false,
        verifiedOn: new Date().toISOString().slice(0, 10),
      },
    };
  })
).filter(Boolean);

entries.sort((a, b) => a.name.en.localeCompare(b.name.en));
const catalogue = { schemaVersion: 2, tier: 'personal', generatedAt: new Date().toISOString().slice(0, 10), source: { repo: REPO, commit }, voices: entries };
const text = JSON.stringify(catalogue);
writeFileSync(p('src/content/adhan/personal.generated.json'), text);
mkdirSync(p('content/adhan'), { recursive: true });
writeFileSync(
  p('content/adhan/PERSONAL_SOURCES.lock.json'),
  JSON.stringify(
    { repo: REPO, commit, licence: 'NONE STATED — personal use only; do not publish', voices: entries.length, catalogueSha256: sha256(Buffer.from(text)) },
    null,
    2,
  ) + '\n',
);
console.log(`\n✓ ${entries.length} personal voices (${entries.filter((v) => v.kind === 'fajr').length} Fajr) → src/content/adhan/personal.generated.json`);
