// Shared helpers for the adhan library pipeline (no dependencies besides Node + ffmpeg-static).
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const p = (...parts) => resolve(ROOT, ...parts);

const require_ = (await import('node:module')).createRequire(import.meta.url);
export const FFMPEG = require_('ffmpeg-static');

/** Generic, non-identifying client name (Wikimedia asks automated clients to identify themselves). */
export const UA = 'SakinaAdhanLibraryBuilder/1.0 (open-source offline Islamic app; content licensing audit)';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data, pretty = true) {
  ensureDir(dirname(file));
  const text = pretty ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(data);
  writeFileSync(file, text);
  return sha256(Buffer.from(text));
}

export function ffmpeg(args, { allowFail = false } = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`ffmpeg ${args.join(' ').slice(0, 200)} failed:\n${(r.stderr ?? '').slice(-600)}`);
  return { stderr: r.stderr ?? '', stdout: r.stdout ?? '', status: r.status };
}

/** curl with retries — Node's fetch gets rate limited (HTTP 429) by Wikimedia far more often. */
export function curl(url, outFile, { retries = 6 } = {}) {
  ensureDir(dirname(outFile));
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = spawnSync('curl', ['-sSL', '-A', UA, '--fail', '--retry', '3', '-o', outFile, url], { encoding: 'utf8' });
    if (r.status === 0 && existsSync(outFile) && statSync(outFile).size > 0) return;
    spawnSync('sleep', [String(8 * (attempt + 1))]);
  }
  throw new Error(`download failed: ${url}`);
}

export function curlJson(url, retries = 6) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = spawnSync('curl', ['-sS', '-A', UA, url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    try {
      return JSON.parse(r.stdout);
    } catch {
      spawnSync('sleep', [String(5 * (attempt + 1))]);
    }
  }
  throw new Error(`could not fetch JSON: ${url}`);
}

// ─── Audio measurement ───────────────────────────────────────────────────────────

/** Integrated loudness / loudness range / true peak (EBU R128). */
export function measureLoudness(file, { start, end } = {}) {
  const seek = [...(start != null ? ['-ss', String(start)] : []), ...(end != null ? ['-to', String(end)] : [])];
  const { stderr } = ffmpeg([...seek, '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { allowFail: true });
  const sum = stderr.split('Summary:').pop() ?? '';
  const num = (re) => {
    const m = sum.match(re);
    return m ? Number(m[1]) : null;
  };
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+([\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/**
 * Short-term (100 ms) RMS profile → noise floor (10th percentile) and signal level (90th percentile).
 * A clean recording has a low floor and a large gap between the two.
 */
export function measureNoise(file, { start, end } = {}) {
  const seek = [...(start != null ? ['-ss', String(start)] : []), ...(end != null ? ['-to', String(end)] : [])];
  const r = spawnSync(
    FFMPEG,
    [
      '-hide_banner',
      '-nostats',
      ...seek,
      '-i',
      file,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-af',
      'asetnsamples=n=4410:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  const levels = [...r.stdout.matchAll(/RMS_level=(-?[\d.]+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
  if (!levels.length) return { floorDb: null, signalDb: null, dynamicDb: null, windows: [] };
  const at = (q) => levels[Math.min(levels.length - 1, Math.floor(levels.length * q))];
  const raw = [...r.stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -120 : Number(m[1])));
  return { floorDb: at(0.1), signalDb: at(0.9), dynamicDb: at(0.9) - at(0.1), windows: raw };
}

/** Energy above `hz` relative to the whole signal (dB). Close to 0 = bright/wide-band, very negative = band-limited. */
export function measureBrightness(file, hz = 6000, { start, end } = {}) {
  const seek = [...(start != null ? ['-ss', String(start)] : []), ...(end != null ? ['-to', String(end)] : [])];
  const mean = (filter) => {
    const { stderr } = ffmpeg([...seek, '-i', file, '-vn', '-ac', '1', '-af', `${filter},volumedetect`, '-f', 'null', '-'], { allowFail: true });
    const m = stderr.match(/mean_volume: (-?[\d.]+) dB/);
    return m ? Number(m[1]) : null;
  };
  const full = mean('anull');
  const high = mean(`highpass=f=${hz}`);
  return full != null && high != null ? high - full : null;
}

export function probe(file) {
  const { stderr } = ffmpeg(['-i', file], { allowFail: true });
  const dur = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const audio = stderr.match(/Stream #\d+:\d+[^:]*: Audio: (\w+)[^,]*, (\d+) Hz, (\w+)/);
  return {
    durationSec: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
    codec: audio?.[1] ?? null,
    sampleRate: audio ? Number(audio[2]) : null,
    channels: audio ? (audio[3] === 'mono' ? 1 : audio[3] === 'stereo' ? 2 : 2) : null,
  };
}

/** Silence intervals (seconds), used to cut notification clips at phrase boundaries. */
export function silences(file, { noiseDb = -38, minSec = 0.35 } = {}) {
  const { stderr } = ffmpeg(['-i', file, '-vn', '-af', `silencedetect=noise=${noiseDb}dB:d=${minSec}`, '-f', 'null', '-'], { allowFail: true });
  const starts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((s, i) => ({ start: Math.max(0, s), end: ends[i] ?? Infinity }));
}

/**
 * Finds where the voiced adhan starts and ends from the 100 ms RMS profile: the first/last second in which
 * the level is within 14 dB of the 90th-percentile signal level. Padded so breaths are not clipped.
 */
export function detectVoicedRegion(windows, signalDb) {
  const thr = signalDb - 14;
  const hot = windows.map((w) => w >= thr);
  const run = 10; // 1 s
  let first = -1;
  for (let i = 0; i + run <= hot.length; i++) {
    if (hot.slice(i, i + run).filter(Boolean).length >= 7) {
      first = i;
      break;
    }
  }
  let last = -1;
  for (let i = hot.length - run; i >= 0; i--) {
    if (hot.slice(i, i + run).filter(Boolean).length >= 7) {
      last = i + run;
      break;
    }
  }
  if (first < 0 || last < 0) return null;
  return { startSec: Math.max(0, first / 10 - 0.4), endSec: (last + 0) / 10 + 1.2 };
}

/**
 * Quality gate. Thresholds are deliberately strict — a recording that fails is not shipped.
 *  - floor ≤ −34 dBFS: background (crowd, traffic, hiss) at least ~20 dB under the voice
 *  - dynamic ≥ 20 dB: the voice clearly stands out of the background
 *  - sample rate ≥ 32 kHz and some energy above 6 kHz: not a telephone-band / 16 kHz capture
 *  - duration within 40–420 s: a complete adhan, not a fragment or a compilation
 */
export const GATE = { maxFloorDb: -34, minDynamicDb: 20, minSampleRate: 32000, minDurationSec: 40, maxDurationSec: 420, maxBrightnessDb: -45 };

export function gate(m) {
  const failures = [];
  if (m.floorDb == null || m.floorDb > GATE.maxFloorDb) failures.push(`noise floor ${m.floorDb?.toFixed(1)} dBFS > ${GATE.maxFloorDb}`);
  if (m.dynamicDb == null || m.dynamicDb < GATE.minDynamicDb) failures.push(`voice-to-background ${m.dynamicDb?.toFixed(1)} dB < ${GATE.minDynamicDb}`);
  if (m.sampleRate < GATE.minSampleRate) failures.push(`sample rate ${m.sampleRate} Hz < ${GATE.minSampleRate}`);
  if (m.durationSec < GATE.minDurationSec || m.durationSec > GATE.maxDurationSec)
    failures.push(`duration ${m.durationSec.toFixed(0)} s outside ${GATE.minDurationSec}–${GATE.maxDurationSec}`);
  if (m.brightnessDb != null && m.brightnessDb < GATE.maxBrightnessDb) failures.push(`band-limited (${m.brightnessDb.toFixed(1)} dB above 6 kHz)`);
  return failures;
}

// ─── Licence verification (Wikimedia Commons) ────────────────────────────────────

/**
 * Licences we accept. Commercial use AND redistribution AND adaptation (trimming/normalising) must be allowed:
 * CC0, CC BY, CC BY-SA. NC and ND variants are rejected. "Public domain" is only accepted when it is the
 * author's own dedication (PD-self / CC0) — third-party "PD" claims need a documented rationale and are rejected here.
 */
export const ACCEPTED_LICENCES = /^(CC0|CC BY(-SA)? [2-4]\.\d)$/;
const REJECTED_TEMPLATES = /(\bnc\b|-nc|noncommercial|\bnd\b|-nd|no[- ]?derivs|fair[- ]use|non-free|copyvio|speedy|delete|no permission|no source)/i;

export function commonsApi(params) {
  const q = new URLSearchParams({ format: 'json', ...params });
  return curlJson(`https://commons.wikimedia.org/w/api.php?${q}`);
}

const strip = (s) =>
  (s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Fetches licence metadata + wikitext for a Commons file and decides whether it may be used. */
export function verifyCommons(title) {
  const info = commonsApi({
    action: 'query',
    titles: title,
    prop: 'imageinfo|revisions',
    iiprop: 'url|size|mime|sha1|extmetadata|timestamp',
    rvprop: 'content',
    rvslots: 'main',
  });
  const page = Object.values(info.query.pages)[0];
  const ii = page.imageinfo?.[0];
  if (!ii) throw new Error(`Commons file not found: ${title}`);
  const wikitext = page.revisions?.[0]?.slots?.main?.['*'] ?? '';
  const em = ii.extmetadata ?? {};
  const v = (k) => strip(em[k]?.value);
  const licence = v('LicenseShortName');
  const reasons = [];
  if (!ACCEPTED_LICENCES.test(licence)) reasons.push(`licence "${licence}" is not CC0 / CC BY / CC BY-SA`);
  const licenceTemplates = [...wikitext.matchAll(/\{\{\s*([^{}|]*(?:cc|licen|pd|self|youtube)[^{}|]*)/gi)].map((m) => m[1].trim());
  if (licenceTemplates.some((t) => REJECTED_TEMPLATES.test(t))) reasons.push(`restrictive template: ${licenceTemplates.join(', ')}`);
  if (/\{\{\s*(copyvio|no permission|no source|npd|speedydelete|delete)/i.test(wikitext)) reasons.push('page is flagged for deletion / missing permission');
  // A YouTube-sourced file is only trustworthy when a human reviewer confirmed the channel's licence.
  const fromYouTube = /youtube/i.test(wikitext);
  const reviewed = /\{\{\s*(YouTubeReview|LicenseReview)/i.test(wikitext);
  if (fromYouTube && !reviewed) reasons.push('YouTube source without licence review');
  // Third-party copy (not the uploader's own work, not a reviewed YouTube import): the original may be gone or
  // may never have carried that licence — Commons volunteers must have reviewed it, otherwise we cannot rely on it.
  const ownWork = /\{\{\s*own\s*\}\}/i.test(wikitext) || /\{\{\s*self\s*\|/i.test(wikitext);
  if (!ownWork && !fromYouTube && !reviewed) reasons.push('third-party source without a licence review (original not verifiable)');
  return {
    title,
    pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
    fileUrl: ii.url.split('?')[0],
    size: ii.size,
    mime: ii.mime,
    sha1: ii.sha1,
    uploadedAt: ii.timestamp,
    licence,
    licenceUrl: v('LicenseUrl') || null,
    author: v('Artist'),
    credit: v('Credit'),
    attribution: v('AttributionRequired'),
    ownWork: /\{\{\s*own\s*\}\}/i.test(wikitext) || /\{\{\s*self\s*\|/i.test(wikitext),
    fromYouTube,
    reviewed,
    accepted: reasons.length === 0,
    rejectedBecause: reasons,
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}
