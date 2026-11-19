import { dbToVolume } from './voices';

export interface LevelProfile {
  readonly gainDb: number;
  readonly startSec: number;
  readonly endSec: number | null;
  readonly fadeOutSec: number;
}

export const FADE_IN_SEC = 0.25;

/**
 * Output level (0..1) at a playback position: the voice's levelling gain, a short fade-in from the start point
 * (no click when seeking into a file) and a fade-out before the trim end. Pure so it can be unit-tested.
 */
export function levelAt(position: number, profile: LevelProfile, duration: number): number {
  let level = dbToVolume(profile.gainDb);
  const end = profile.endSec ?? duration;
  const since = Math.max(0, position - profile.startSec);
  if (since < FADE_IN_SEC) level *= since / FADE_IN_SEC;
  const remaining = end - position;
  if (profile.fadeOutSec > 0 && remaining < profile.fadeOutSec) level *= Math.max(0, remaining / profile.fadeOutSec);
  return Math.min(1, Math.max(0, level));
}
