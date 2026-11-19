/**
 * Pure recitation queue: which ayah plays next, honouring per-ayah repetition and range repeat.
 */
export interface QueueState {
  readonly surah: number;
  readonly fromAyah: number;
  readonly toAyah: number;
  readonly current: number;
  /** Total plays per ayah (1 = no repetition). */
  readonly repeatAyah: number;
  readonly playedCurrent: number;
  readonly repeatRange: boolean;
}

export function createQueue(surah: number, fromAyah: number, toAyah: number, repeatAyah = 1, repeatRange = false): QueueState {
  if (toAyah < fromAyah) throw new RangeError('Invalid range');
  return { surah, fromAyah, toAyah, current: fromAyah, repeatAyah: Math.max(1, repeatAyah), playedCurrent: 0, repeatRange };
}

export type QueueStep = { readonly action: 'replay' | 'advance'; readonly state: QueueState } | { readonly action: 'stop'; readonly state: QueueState };

/** Called when the current ayah finishes playing. */
export function onTrackFinished(q: QueueState): QueueStep {
  const played = q.playedCurrent + 1;
  if (played < q.repeatAyah) return { action: 'replay', state: { ...q, playedCurrent: played } };
  if (q.current < q.toAyah) return { action: 'advance', state: { ...q, current: q.current + 1, playedCurrent: 0 } };
  if (q.repeatRange) return { action: 'advance', state: { ...q, current: q.fromAyah, playedCurrent: 0 } };
  return { action: 'stop', state: { ...q, playedCurrent: 0 } };
}

export function skip(q: QueueState, delta: 1 | -1): QueueState | null {
  const next = q.current + delta;
  if (next < q.fromAyah || next > q.toAyah) return null;
  return { ...q, current: next, playedCurrent: 0 };
}
