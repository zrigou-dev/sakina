import type { PlaybackProfile } from './sources';
import type { AdhanVoice } from './voices';

/** Web has no native alarm engine and no durable file storage for audio. */
export async function ensureLocalFile(_voice: AdhanVoice): Promise<{ uri: string; profile: PlaybackProfile } | null> {
  return null;
}
