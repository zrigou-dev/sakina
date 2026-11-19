import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BUNDLED_CATALOGUE, parseCatalogue } from '@/services/adhan/voices';
import { sniffAudioContainer } from '@/services/downloads/validators';

const ROOT = join(__dirname, '..', '..');
const p = (...parts: string[]) => join(ROOT, ...parts);
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const FFMPEG = ffmpegPath as string;
const idu = (id: string) => id.replaceAll('-', '_');
const head = (file: string) => new Uint8Array(readFileSync(file).subarray(0, 12));

const voices = BUNDLED_CATALOGUE.voices;

describe('shipped adhan library — real files', () => {
  it.each(voices.map((v) => [v.id, v] as const))('%s: mastered file matches the catalogue (size, SHA-256, AAC container)', (_id, v) => {
    const file = p('library', 'adhan', v.file);
    expect(statSync(file).size).toBe(v.bytes);
    expect(sha256(file)).toBe(v.sha256);
    expect(sniffAudioContainer(head(file))).toBe('m4a');
    if (v.delivery === 'bundled') {
      expect(sha256(p('assets', 'adhan', 'full', v.file))).toBe(v.sha256);
    } else {
      expect(existsSync(p('assets', 'adhan', 'full', v.file))).toBe(false); // downloadable voices are not in the app binary
    }
  });

  it.each(voices.map((v) => [v.id, v] as const))('%s: decodes cleanly and its measured loudness/peak match the catalogue', (_id, v) => {
    const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', p('library', 'adhan', v.file), '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/error|invalid|corrupt/i);
    const sum = r.stderr.split('Summary:').pop()!;
    const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(sum)![1]);
    const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)![1]);
    expect(Math.abs(lufs - v.audio.lufs)).toBeLessThan(0.3);
    expect(Math.abs(lufs + 16)).toBeLessThan(1);
    expect(peak).toBeLessThanOrEqual(-0.9);
    const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr)!;
    const seconds = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
    expect(Math.abs(seconds - v.durationSec)).toBeLessThan(0.5);
  });

  it.each(voices.map((v) => [v.id, v] as const))('%s: notification clips obey the iOS 30-second limit (wav) and Android channel needs (mp3)', (_id, v) => {
    const wav = readFileSync(p('assets', 'sounds', `adhan_${idu(v.id)}.wav`));
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1); // linear PCM — the only wav encoding iOS accepts for notification sounds
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(22050);
    expect(wav.readUInt16LE(34)).toBe(16);
    const dataIdx = wav.indexOf('data');
    const seconds = wav.readUInt32LE(dataIdx + 4) / (22050 * 2);
    expect(seconds).toBeLessThan(30);
    expect(Math.abs(seconds - v.clip!.durationSec)).toBeLessThan(0.1);

    const mp3 = p('assets', 'adhan', 'clips', `adhan_${idu(v.id)}.mp3`);
    expect(sniffAudioContainer(head(mp3))).toBe('mp3');
    expect((statSync(mp3).size * 8) / 96_000).toBeLessThan(30);
  });

  it.each(voices.map((v) => [v.id, v] as const))('%s: original recording and attribution are preserved and agree with the catalogue', (_id, v) => {
    const attr = JSON.parse(readFileSync(p('content', 'adhan', 'originals', `${v.id}.attribution.json`), 'utf8'));
    expect(attr.licence).toBe(v.credit.licence);
    expect(attr.pageUrl).toBe(v.credit.sourceUrl);
    expect(attr.originalSha1).toMatch(/^[0-9a-f]{40}$/);
    const preserved = p('content', 'adhan', 'originals', attr.preservedAudio);
    expect(existsSync(preserved)).toBe(true);
    expect(sha256(preserved)).toBe(attr.preservedSha256);
    // Provenance rule: the licence must be the uploader's own, or a YouTube licence a Commons reviewer verified.
    expect(attr.ownWork || (attr.fromYouTube && attr.licenceReviewedOnCommons)).toBe(true);
  });

  it('any download-delivered voice pins the exact bytes the app will fetch (MP3, iOS-playable)', () => {
    // Today every shipped voice is bundled (only voices that passed the rights + listening review ship); this guards the
    // day a downloadable one is added.
    for (const v of voices.filter((x) => x.delivery === 'download')) {
      const file = p('content', 'adhan', 'pinned', `${v.id}.${v.direct!.format}`);
      expect(statSync(file).size).toBe(v.direct!.bytes);
      expect(sha256(file)).toBe(v.direct!.sha256);
      expect(sniffAudioContainer(head(file))).toBe(v.direct!.format);
      expect(v.direct!.gainDb).toBeLessThanOrEqual(0);
    }
  });

  it('is consistent everywhere: assets module, app.json sounds, lockfile, hostable catalogue, source manifest', () => {
    const assets = readFileSync(p('src', 'content', 'adhan', 'assets.generated.ts'), 'utf8');
    const app = JSON.parse(readFileSync(p('app.json'), 'utf8'));
    const plugin = app.expo.plugins.find((x: unknown) => Array.isArray(x) && x[0] === 'expo-notifications');
    const sounds: string[] = plugin[1].sounds;
    for (const v of voices) {
      expect(assets).toContain(`'${v.id}': clip_${idu(v.id)}`);
      expect(assets.includes(`'${v.id}': full_${idu(v.id)}`)).toBe(v.delivery === 'bundled');
      expect(sounds).toContain(`./assets/sounds/adhan_${idu(v.id)}.wav`);
      expect(sounds).toContain(`./assets/adhan/clips/adhan_${idu(v.id)}.mp3`);
    }
    expect(sounds).toHaveLength(voices.length * 2);
    expect(app.expo.ios.entitlements['com.apple.developer.usernotifications.time-sensitive']).toBe(true);

    const lock = JSON.parse(readFileSync(p('content', 'adhan', 'SOURCES.lock.json'), 'utf8'));
    expect(lock.catalogueSha256).toBe(sha256(p('src', 'content', 'adhan', 'catalogue.generated.json')));
    for (const v of voices) expect(lock.voices[v.id].masterSha256).toBe(v.sha256);

    const hosted = parseCatalogue(JSON.parse(readFileSync(p('library', 'adhan', 'catalogue.json'), 'utf8')));
    expect(hosted.rejected).toEqual([]);
    expect(hosted.catalogue.voices).toEqual(voices);

    const source = JSON.parse(readFileSync(p('content', 'adhan', 'library.source.json'), 'utf8'));
    expect(
      source.candidates
        .filter((c: { enabled: boolean }) => c.enabled)
        .map((c: { id: string }) => c.id)
        .sort(),
    ).toEqual(voices.map((v) => v.id).sort());
  });

  it('the first library is gone: no old recordings, notification sounds or bundled assets remain', () => {
    expect(readdirSync(p('assets', 'adhan')).sort()).toEqual(['clips', 'full']);
    const sounds = readdirSync(p('assets', 'sounds'));
    expect(sounds.every((f) => /^adhan_[a-z0-9_]+\.wav$/.test(f))).toBe(true);
    expect(sounds).not.toContain('adhan_short.wav');
    expect(sounds).not.toContain('adhan_full.mp3');
    const all = readdirSync(p('assets', 'adhan', 'clips')).concat(readdirSync(p('assets', 'adhan', 'full')));
    expect(all.join(' ')).not.toMatch(/makkah-2013|maghrib-2012|sabah|fakhri|hassan/i);
  });

  it('records why rejected recordings were rejected, including the invalid public-domain claim', () => {
    const source = JSON.parse(readFileSync(p('content', 'adhan', 'library.source.json'), 'utf8'));
    const sabah = source.excluded.find((e: { commons?: string }) => e.commons?.includes('Sabah Fakhry'));
    expect(sabah.reason).toMatch(/copyright/i);
    const ids = JSON.stringify(source.candidates);
    expect(ids).not.toMatch(/Sabah|Maghrib Adhan at the Masjid|Beautiful adhan|Great Mosque of Mecca|Shalqar/);
    const reason = (needle: string) => source.excluded.find((e: { commons?: string }) => e.commons?.includes(needle))?.reason as string;
    expect(reason('Beautiful adhan')).toMatch(/blocked indefinitely/);
    expect(reason('Great Mosque of Mecca')).toMatch(/performer rights/);
    expect(reason('Shalqar')).toMatch(/consent/);
    const evalr = JSON.parse(readFileSync(p('content', 'adhan', 'evaluation.json'), 'utf8'));
    expect(evalr.results.every((r: { verdict: string }) => r.verdict === 'accepted')).toBe(true);
  });
});
