import { BUNDLED_FULL_ASSETS, CLIP_ASSETS } from '@/content/adhan/assets.generated';
import { fileUri } from '@/services/downloads/fs';

import { adhanLibraryBaseUrl } from './config';

import { playbackProfile, voiceById, voicePackageId, type AdhanVoice } from './voices';

export interface PlaybackProfile {
  readonly gainDb: number;
  readonly startSec: number;
  readonly endSec: number | null;
  readonly fadeOutSec: number;
}

export type PlaybackSource =
  | { readonly kind: 'asset'; readonly asset: number; readonly profile: PlaybackProfile }
  | { readonly kind: 'file'; readonly uri: string; readonly profile: PlaybackProfile };

/** Installed file names a downloaded voice may have, in preference order (mastered mirror file first). */
export const INSTALLED_FILES = ['adhan.m4a', 'adhan.mp3'] as const;

/** Previews of full-length files stop after this long. */
const PREVIEW_SECONDS = 25;

const NEUTRAL: PlaybackProfile = { gainDb: 0, startSec: 0, endSec: null, fadeOutSec: 0 };

/** 30-second preview. Always bundled → works offline, instantly. (The clip is already levelled and faded.) */
export function previewSource(voice: AdhanVoice): PlaybackSource | null {
  const asset = CLIP_ASSETS[voice.id];
  if (asset !== undefined) return { kind: 'asset', asset, profile: NEUTRAL };
  // The user's own file: play it from storage.
  if (voice.delivery === 'local' && voice.localUri)
    return { kind: 'file', uri: voice.localUri, profile: { ...NEUTRAL, endSec: PREVIEW_SECONDS, fadeOutSec: 1.2 } };
  // A personal-catalogue voice has no bundled clip: stream the first seconds of the file itself (or play the local copy).
  if (voice.tier === 'personal' && voice.direct) {
    const local = installedFile(voice);
    return {
      kind: 'file',
      uri: local?.uri ?? voice.direct.url,
      profile: { gainDb: voice.direct.gainDb, startSec: 0, endSec: Math.min(PREVIEW_SECONDS, voice.direct.trim.endSec), fadeOutSec: 1.2 },
    };
  }
  // A voice learned from the online catalogue has no bundled clip: stream it from the mirror.
  const base = adhanLibraryBaseUrl();
  return base && voice.clip?.file ? { kind: 'file', uri: `${base}/${voice.clip.file}`, profile: NEUTRAL } : null;
}

/** The installed local file of a downloaded voice, or null. */
export function installedFile(voice: AdhanVoice): { uri: string; file: string } | null {
  if (voice.delivery !== 'download') return null;
  for (const file of INSTALLED_FILES) {
    const uri = fileUri(voicePackageId(voice.id), file);
    if (uri) return { uri, file };
  }
  return null;
}

/** Full recording ready to play offline: the bundled asset, or the verified downloaded file. */
export function fullSource(voice: AdhanVoice): PlaybackSource | null {
  if (voice.delivery === 'local') return voice.localUri ? { kind: 'file', uri: voice.localUri, profile: NEUTRAL } : null;
  if (voice.delivery === 'bundled') {
    const asset = BUNDLED_FULL_ASSETS[voice.id];
    return asset === undefined ? null : { kind: 'asset', asset, profile: playbackProfile(voice, 'adhan.m4a') };
  }
  const f = installedFile(voice);
  return f ? { kind: 'file', uri: f.uri, profile: playbackProfile(voice, f.file) } : null;
}

export function fullSourceById(id: string): PlaybackSource | null {
  const v = voiceById(id);
  return v ? fullSource(v) : null;
}

/** True when the voice can play its full recording without a connection. */
export function isAvailableOffline(voice: AdhanVoice): boolean {
  return fullSource(voice) !== null;
}
