import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUNDLED_CATALOGUE, setRemoteVoices, voiceById, type AdhanVoice } from '@/services/adhan/voices';

/**
 * The shipped library currently has no download-delivered voice (only voices that passed the rights and quality review
 * ship, and they are bundled). The downloader, mirror, levelling and storage code is still real and must stay
 * tested, so tests use this voice: built from REAL bytes — a Commons-style MP3 and the real mastered AAC — never mocks.
 */
export const FIXTURE_ID = 'fixture-download-voice';
export const FIXTURE_PACKAGE = `adhan.${FIXTURE_ID}`;
export const FIXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Fixture_download_voice.mp3';

const root = join(__dirname, '..', '..');
export const fixtureMp3 = new Uint8Array(readFileSync(join(root, 'tests', 'fixtures', 'adhan', 'download-fixture.mp3')));
const base = BUNDLED_CATALOGUE.voices.find((v) => v.delivery === 'bundled' && v.kind === 'adhan')!;
export const fixtureMaster = new Uint8Array(readFileSync(join(root, 'library', 'adhan', base.file)));

export const fixtureVoice: AdhanVoice = {
  ...base,
  id: FIXTURE_ID,
  delivery: 'download',
  file: `${FIXTURE_ID}.m4a`,
  performer: null,
  clip: { ...base.clip!, file: `clips/${FIXTURE_ID}.mp3` },
  direct: {
    url: FIXTURE_URL,
    format: 'mp3',
    bytes: fixtureMp3.length,
    sha256: createHash('sha256').update(fixtureMp3).digest('hex'),
    durationSec: 85.1,
    gainDb: -2.4,
    trim: { startSec: 0.2, endSec: 84.9 },
  },
};

export function registerFixtureVoice(): void {
  setRemoteVoices([fixtureVoice]);
}

export const shippedVoice = (id: string): AdhanVoice => voiceById(id)!;
