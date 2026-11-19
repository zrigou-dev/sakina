#!/usr/bin/env node
/**
 * Adhan library pipeline.
 *
 *   node scripts/adhan/build-library.mjs evaluate   verify licences + measure audio quality (writes content/adhan/evaluation.json)
 *   node scripts/adhan/build-library.mjs build      master accepted voices, cut notification clips, emit catalogue + hostable folder
 *
 * Source of truth: content/adhan/library.source.json. Nothing is shipped unless its licence is verified
 * (CC0 / CC BY / CC BY-SA on Wikimedia Commons, reviewed) AND it passes the audio-quality gate.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

import {
  curl,
  detectVoicedRegion,
  ensureDir,
  ffmpeg,
  gate,
  GATE,
  measureBrightness,
  measureLoudness,
  measureNoise,
  p,
  probe,
  readJson,
  sha1,
  sha256,
  silences,
  verifyCommons,
  writeJson,
} from './lib.mjs';

const SOURCE = p('content/adhan/library.source.json');
const RAW = p('content/adhan/originals/_raw');
const ORIGINALS = p('content/adhan/originals');
const HOST = p('library/adhan');
const FULL_ASSETS = p('assets/adhan/full');
const CLIP_ASSETS = p('assets/adhan/clips');
const SOUNDS = p('assets/sounds');
const EVAL = p('content/adhan/evaluation.json');

const TARGET = { lufs: -16, truePeak: -2.5, lra: 11 };
const CLIP_MAX = 28; // iOS refuses notification sounds ≥ 30 s; leave headroom
const CLIP_MIN = 14;

const slug = (id) => id.replaceAll('-', '_');
const log = (...a) => console.log(...a);

// ─── evaluate ────────────────────────────────────────────────────────────────────

function rawPathFor(id, fileUrl) {
  return `${RAW}/${id}${extname(fileUrl)}`;
}

function fetchRaw(c, v) {
  const out = rawPathFor(c.id, v.fileUrl);
  const matches = () => existsSync(out) && sha1(readFileSync(out)) === v.sha1;
  if (!matches()) {
    log(`  ↓ downloading ${(v.size / 1048576).toFixed(1)} MB`);
    curl(`${v.fileUrl}`, out);
    if (!matches()) throw new Error(`${c.id}: SHA-1 mismatch against Commons (${v.sha1})`);
  }
  return out;
}

function evaluateOne(c) {
  log(`\n● ${c.id}`);
  const v = verifyCommons(c.commons);
  const result = { id: c.id, commons: c.commons, licence: v, enabled: c.enabled };
  if (!v.accepted) {
    log(`  ✗ licence: ${v.rejectedBecause.join('; ')}`);
    return { ...result, verdict: 'rejected-licence', failures: v.rejectedBecause };
  }
  log(`  ✓ licence ${v.licence} (${v.ownWork ? 'own work' : v.fromYouTube ? 'YouTube, reviewed' : 'external source'}) by ${v.author.slice(0, 40)}`);
  const raw = fetchRaw(c, v);
  const info = probe(raw);
  const full = measureNoise(raw);
  const region = c.trim ? { startSec: c.trim.startSec, endSec: c.trim.endSec } : detectVoicedRegion(full.windows, full.signalDb);
  if (!region) return { ...result, verdict: 'rejected-quality', failures: ['no voiced region found'] };
  const end = Math.min(region.endSec, info.durationSec);
  const win = { start: region.startSec, end };
  const noise = measureNoise(raw, win);
  const loud = measureLoudness(raw, win);
  const brightness = measureBrightness(raw, 6000, win);
  const metrics = {
    durationSec: end - region.startSec,
    sampleRate: info.sampleRate,
    channels: info.channels,
    codec: info.codec,
    floorDb: noise.floorDb,
    signalDb: noise.signalDb,
    dynamicDb: noise.dynamicDb,
    lufs: loud.lufs,
    lra: loud.lra,
    truePeak: loud.truePeak,
    brightnessDb: brightness,
  };
  const failures = gate(metrics);
  log(
    `  ${failures.length ? '✗' : '✓'} ${info.codec} ${info.sampleRate} Hz ${info.channels}ch · ${metrics.durationSec.toFixed(0)} s · floor ${noise.floorDb?.toFixed(0)} dB · voice/bg ${noise.dynamicDb?.toFixed(0)} dB · ${loud.lufs} LUFS · >6k ${brightness?.toFixed(0)} dB`,
  );
  for (const f of failures) log(`      – ${f}`);
  return { ...result, raw, region: { startSec: region.startSec, endSec: end }, metrics, verdict: failures.length ? 'rejected-quality' : 'accepted', failures };
}

function evaluate(only) {
  const src = readJson(SOURCE);
  const previous = existsSync(EVAL) ? readJson(EVAL).results : [];
  const fresh = src.candidates.filter((c) => !only.length || only.includes(c.id)).map(evaluateOne);
  const byId = new Map(previous.filter((r) => src.candidates.some((c) => c.id === r.id)).map((r) => [r.id, r]));
  for (const { raw, ...r } of fresh) byId.set(r.id, r);
  const results = src.candidates.map((c) => byId.get(c.id)).filter(Boolean);
  writeJson(EVAL, { evaluatedAt: new Date().toISOString().slice(0, 10), gate: GATE, results });
  log(`\n${results.filter((r) => r.verdict === 'accepted').length}/${results.length} candidates accepted → ${EVAL}`);
  const bad = src.candidates.filter((c) => c.enabled && results.find((r) => r.id === c.id)?.verdict !== 'accepted');
  if (bad.length) {
    console.error(`✗ enabled candidates failed verification: ${bad.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
}

// ─── build ───────────────────────────────────────────────────────────────────────

function audioExtFor(codec, rawExt) {
  if (rawExt === '.ogg' || rawExt === '.oga' || rawExt === '.mp3' || rawExt === '.wav' || rawExt === '.flac') return rawExt;
  return codec === 'opus' || codec === 'vorbis' ? '.ogg' : codec === 'aac' ? '.m4a' : codec === 'mp3' ? '.mp3' : '.mka';
}

function parseLoudnormJson(stderr) {
  const m = stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!m) throw new Error('loudnorm measurement not found');
  return JSON.parse(m[0]);
}

/** Preserves the untouched original audio stream (no video) next to its attribution record. */
function preserveOriginal(c, v, raw, info) {
  ensureDir(ORIGINALS);
  const ext = audioExtFor(info.codec, extname(raw));
  const out = `${ORIGINALS}/${c.id}${ext}`;
  if (ext === extname(raw)) copyFileSync(raw, out);
  else ffmpeg(['-y', '-i', raw, '-vn', '-map', '0:a:0', '-c:a', 'copy', out]);
  writeJson(`${ORIGINALS}/${c.id}.attribution.json`, {
    id: c.id,
    commonsTitle: v.title,
    pageUrl: v.pageUrl,
    originalFile: v.fileUrl,
    originalSha1: v.sha1,
    originalBytes: v.size,
    author: v.author,
    licence: v.licence,
    licenceUrl: v.licenceUrl,
    ownWork: v.ownWork,
    fromYouTube: v.fromYouTube,
    licenceReviewedOnCommons: v.reviewed,
    verifiedOn: v.checkedAt,
    preservedAudio: `${c.id}${ext}`,
    preservedSha256: sha256(readFileSync(out)),
    note: 'Audio stream copied bit-for-bit from the Commons original (video stream, if any, removed).',
  });
  return out;
}

function master(c, raw, region, info, outFile) {
  const dur = region.endSec - region.startSec;
  const seek = ['-ss', region.startSec.toFixed(3), '-to', region.endSec.toFixed(3)];
  const pre = 'highpass=f=35';
  const ln = `loudnorm=I=${TARGET.lufs}:TP=${TARGET.truePeak}:LRA=${TARGET.lra}`;
  const m = parseLoudnormJson(ffmpeg([...seek, '-i', raw, '-vn', '-af', `${pre},${ln}:print_format=json`, '-f', 'null', '-']).stderr);
  const two = `${ln}:measured_I=${m.input_i}:measured_LRA=${m.input_lra}:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  // Bundled voices ship as 64 kbps mono AAC: a single voice on a phone speaker, half the size of 128 kbps stereo
  // (the side channel of these recordings is 16–26 dB below the centre, i.e. near-mono room tone).
  const mono = true;
  const fadeOut = 1.4;
  const filters = `${pre},${two},aresample=44100,alimiter=limit=0.708:attack=5:release=60:level=disabled,afade=t=in:d=0.15,afade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut}`;
  ffmpeg(['-y', ...seek, '-i', raw, '-vn', '-af', filters, '-ac', mono ? '1' : '2', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', outFile]);
  return { channels: 1, bitrateKbps: 64 };
}

/** Cuts a notification clip (< 30 s) at the last phrase boundary so it never ends mid-word. */
function makeClips(c, masterFile) {
  const sil = silences(masterFile, { noiseDb: -40, minSec: 0.3 });
  const cands = sil.filter((s) => s.start >= CLIP_MIN && s.start <= CLIP_MAX - 0.2);
  const cut = cands.length ? Math.min(CLIP_MAX - 0.4, cands[cands.length - 1].start + 0.12) : CLIP_MAX - 0.4;
  const natural = cands.length > 0;
  const fade = natural ? 0.25 : 0.9;
  const af = `atrim=0:${cut.toFixed(3)},afade=t=out:st=${(cut - fade).toFixed(3)}:d=${fade}`;
  const idu = slug(c.id);
  ensureDir(CLIP_ASSETS);
  ensureDir(SOUNDS);
  const mp3 = `${CLIP_ASSETS}/adhan_${idu}.mp3`;
  const wav = `${SOUNDS}/adhan_${idu}.wav`;
  ffmpeg(['-y', '-i', masterFile, '-af', af, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', mp3]);
  ffmpeg(['-y', '-i', masterFile, '-af', af, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', wav]);
  // Hostable copy so a voice learned from the online catalogue can preview by streaming.
  ensureDir(`${HOST}/clips`);
  copyFileSync(mp3, `${HOST}/clips/${c.id}.mp3`);
  return { durationSec: Number(cut.toFixed(2)), endsOnPhrase: natural, mp3, wav };
}

/**
 * Voices delivered by download come straight from Wikimedia Commons (no hosting cost). The served file is pinned by
 * SHA-256, must be playable on iOS (MP3/M4A — Ogg is not), and is levelled at playback time with a stored gain
 * (attenuation only: a player cannot boost without clipping) and trim.
 */
function buildDirect(c, v, raw, region) {
  const rawExt = extname(raw).toLowerCase();
  let file = raw;
  let url = v.fileUrl;
  let format = rawExt.slice(1);
  if (!['.mp3', '.m4a'].includes(rawExt)) {
    const name = decodeURIComponent(v.fileUrl.split('/').pop());
    const h = createHash('md5').update(name).digest('hex');
    url = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(name)}/${encodeURIComponent(name)}.mp3`;
    file = `${RAW}/${c.id}.derivative.mp3`;
    if (!existsSync(file)) curl(url, file);
    format = 'mp3';
  }
  // Keep the exact bytes the app will download: tests serve them to prove verification end to end.
  ensureDir(p('content/adhan/pinned'));
  copyFileSync(file, p(`content/adhan/pinned/${c.id}.${format}`));
  const info = probe(file);
  const loud = measureLoudness(file, { start: region.startSec, end: region.endSec });
  const gainDb = TARGET.lufs - loud.lufs;
  if (gainDb > 0.5) throw new Error(`${c.id}: too quiet (${loud.lufs} LUFS) for playback-time levelling — set delivery to "bundled"`);
  return {
    url,
    format,
    bytes: statSync(file).size,
    sha256: sha256(readFileSync(file)),
    durationSec: Number(info.durationSec.toFixed(2)),
    gainDb: Number(Math.min(0, gainDb).toFixed(1)),
    trim: { startSec: Number(region.startSec.toFixed(2)), endSec: Number(Math.min(region.endSec, info.durationSec).toFixed(2)) },
  };
}

function creditFor(v, c, changes) {
  const author = v.author || 'Unknown';
  return {
    recordist: author,
    licence: v.licence,
    licenceUrl: v.licenceUrl,
    sourceTitle: v.title.replace(/^File:/, ''),
    sourceUrl: v.pageUrl,
    modified: changes,
    shareAlike: /-SA/.test(v.licence),
    commercialUse: true,
    verifiedOn: v.checkedAt,
  };
}

function build() {
  const src = readJson(SOURCE);
  if (!existsSync(EVAL)) throw new Error('run `evaluate` first');
  const evaluation = readJson(EVAL);
  const lock = { generatedAt: new Date().toISOString(), gate: GATE, target: TARGET, voices: {}, excluded: src.excluded };

  // Clean previous generated outputs so removed voices disappear everywhere.
  for (const dir of [FULL_ASSETS, CLIP_ASSETS, HOST]) rmSync(dir, { recursive: true, force: true });
  for (const f of existsSync(SOUNDS) ? readdirSync(SOUNDS) : []) if (/^adhan_/.test(f)) rmSync(`${SOUNDS}/${f}`);
  ensureDir(HOST);

  const voices = [];
  for (const c of src.candidates.filter((x) => x.enabled)) {
    const ev = evaluation.results.find((r) => r.id === c.id);
    if (!ev || ev.verdict !== 'accepted') throw new Error(`${c.id} is enabled but not accepted by evaluation`);
    log(`\n● building ${c.id}`);
    const v = ev.licence;
    const raw = fetchRaw(c, v);
    const info = probe(raw);
    preserveOriginal(c, v, raw, info);
    const region = c.trim ? { startSec: c.trim.startSec, endSec: Math.min(c.trim.endSec, info.durationSec) } : ev.region;
    const masterFile = `${HOST}/${c.id}.m4a`;
    const enc = master(c, raw, region, info, masterFile);
    const final = { ...measureLoudness(masterFile), ...measureNoise(masterFile), ...probe(masterFile) };
    if (final.truePeak != null && final.truePeak > -0.9) throw new Error(`${c.id}: true peak ${final.truePeak} too hot after mastering`);
    if (final.lufs != null && Math.abs(final.lufs - TARGET.lufs) > 1.2) throw new Error(`${c.id}: loudness ${final.lufs} LUFS off target`);
    const clip = makeClips(c, masterFile);
    const direct = c.delivery === 'download' ? buildDirect(c, ev.licence, raw, region) : null;
    const bytes = statSync(masterFile).size;
    const hash = sha256(readFileSync(masterFile));
    if (c.delivery === 'bundled') {
      ensureDir(FULL_ASSETS);
      copyFileSync(masterFile, `${FULL_ASSETS}/${c.id}.m4a`);
    }
    const changes = 'Audio extracted, trimmed to the adhan, high-passed at 35 Hz, loudness-normalised to −16 LUFS, faded and re-encoded (AAC).';
    const entry = {
      id: c.id,
      kind: c.kind,
      name: c.name,
      place: c.place,
      style: c.style,
      delivery: c.delivery,
      performer: c.performer ?? null,
      durationSec: Number(final.durationSec.toFixed(1)),
      bytes,
      sha256: hash,
      format: 'm4a',
      file: `${c.id}.m4a`,
      direct,
      clip: { durationSec: clip.durationSec, endsOnPhrase: clip.endsOnPhrase, file: `clips/${c.id}.mp3` },
      audio: {
        lufs: final.lufs,
        truePeak: final.truePeak,
        lra: final.lra,
        noiseFloorDb: Number(final.floorDb.toFixed(1)),
        voiceToBackgroundDb: Number(final.dynamicDb.toFixed(1)),
        sampleRateHz: final.sampleRate,
        channels: enc.channels,
        bitrateKbps: enc.bitrateKbps,
        sourceCodec: info.codec,
        sourceSampleRateHz: info.sampleRate,
      },
      credit: creditFor(v, c, changes),
    };
    voices.push(entry);
    lock.voices[c.id] = { commons: v.title, originalSha1: v.sha1, masterSha256: hash, masterBytes: bytes, evaluation: ev.metrics, region };
    log(
      `  ✓ ${entry.durationSec}s · ${(bytes / 1048576).toFixed(2)} MB · ${final.lufs} LUFS · TP ${final.truePeak} · clip ${clip.durationSec}s${clip.endsOnPhrase ? ' (phrase end)' : ''}`,
    );
  }

  const catalogue = { schemaVersion: 2, generatedAt: new Date().toISOString().slice(0, 10), voices };
  const appHash = writeJson(p('src/content/adhan/catalogue.generated.json'), catalogue, false);
  writeJson(`${HOST}/catalogue.json`, catalogue);
  writeAssetsModule(voices);
  syncAppJson(voices);
  writeHostReadme(voices);
  lock.catalogueSha256 = appHash;
  writeJson(p('content/adhan/SOURCES.lock.json'), lock);
  log(`\n✓ ${voices.length} voices → src/content/adhan/catalogue.generated.json, library/adhan/ (host this folder)`);
}

/** Keeps app.json's expo-notifications `sounds` list in step with the voices (iOS wav + Android mp3 clips). */
function syncAppJson(voices) {
  const file = p('app.json');
  const app = readJson(file);
  const plugin = app.expo.plugins.find((x) => Array.isArray(x) && x[0] === 'expo-notifications');
  if (!plugin) throw new Error('expo-notifications plugin not found in app.json');
  plugin[1] = {
    ...(plugin[1] ?? {}),
    sounds: voices.flatMap((v) => [`./assets/sounds/adhan_${slug(v.id)}.wav`, `./assets/adhan/clips/adhan_${slug(v.id)}.mp3`]),
  };
  writeJson(file, app);
}

function writeAssetsModule(voices) {
  const lines = ['// GENERATED by scripts/adhan/build-library.mjs — do not edit.', ''];
  const clipMap = [];
  const fullMap = [];
  for (const v of voices) {
    const idu = slug(v.id);
    lines.push(`import clip_${idu} from '../../../assets/adhan/clips/adhan_${idu}.mp3';`);
    clipMap.push(`  '${v.id}': clip_${idu},`);
    if (v.delivery === 'bundled') {
      lines.push(`import full_${idu} from '../../../assets/adhan/full/${v.id}.m4a';`);
      fullMap.push(`  '${v.id}': full_${idu},`);
    }
  }
  lines.push(
    '',
    '/** 30-second previews (also the Android fallback notification sound) — always available offline. */',
    'export const CLIP_ASSETS: Readonly<Record<string, number>> = {',
    ...clipMap,
    '};',
    '',
  );
  lines.push(
    '/** Full recordings that ship inside the app. */',
    'export const BUNDLED_FULL_ASSETS: Readonly<Record<string, number>> = {',
    ...fullMap,
    '};',
    '',
  );
  lines.push(
    '/** iOS notification sound file name per voice (the .wav is copied into the app by the expo-notifications plugin). */',
    'export const IOS_NOTIFICATION_SOUNDS: Readonly<Record<string, string>> = {',
  );
  for (const v of voices) lines.push(`  '${v.id}': 'adhan_${slug(v.id)}.wav',`);
  lines.push(
    '};',
    '',
    '/** Android fallback notification sound (res/raw name, without extension) per voice. */',
    'export const ANDROID_NOTIFICATION_SOUNDS: Readonly<Record<string, string>> = {',
  );
  for (const v of voices) lines.push(`  '${v.id}': 'adhan_${slug(v.id)}.mp3',`);
  lines.push('};', '');
  writeFileSync(p('src/content/adhan/assets.generated.ts'), lines.join('\n'));
}

function writeHostReadme(voices) {
  const total = voices.reduce((n, v) => n + v.bytes, 0);
  writeFileSync(
    `${HOST}/README.md`,
    `# SAKINA adhan library (hostable)\n\nUpload this whole folder to any static host (CDN bucket, GitHub Pages, …) and set\n\`extra.adhanLibraryUrl\` in app.json to its base URL. The app then fetches \`catalogue.json\` (validated, SHA-256 pinned per file)\nand can offer every voice for download without an app update.\n\n${voices.length} voices · ${(total / 1048576).toFixed(1)} MB.\nEach file is a modification of a Creative Commons recording; see the \`credit\` block of each voice in \`catalogue.json\` for author, licence and changes — attribution must stay visible in the app.\n`,
  );
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'evaluate') evaluate(rest);
else if (cmd === 'build') build();
else {
  console.error('usage: build-library.mjs evaluate [id…] | build');
  process.exit(2);
}
