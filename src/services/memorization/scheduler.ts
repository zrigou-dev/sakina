import { addDays, toISODate } from '@/utils/date';

/**
 * Gentle spaced-repetition for memorisation (a simplified SM-2).
 * Grades: 'again' (forgot), 'hard', 'good', 'easy'. No streaks, no penalties beyond
 * bringing the ayah back sooner — the goal is consistency without pressure.
 */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  readonly ease: number;
  readonly intervalDays: number;
  readonly repetitions: number;
}

export const NEW_REVIEW_STATE: ReviewState = { ease: 2.5, intervalDays: 0, repetitions: 0 };
const MIN_EASE = 1.3;
const MAX_INTERVAL = 180;

export function review(state: ReviewState, grade: ReviewGrade): ReviewState {
  const q = { again: 1, hard: 3, good: 4, easy: 5 }[grade];
  if (q < 3) return { ease: Math.max(MIN_EASE, state.ease - 0.2), intervalDays: 1, repetitions: 0 };
  const ease = Math.max(MIN_EASE, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  let intervalDays: number;
  if (state.repetitions === 0) intervalDays = grade === 'easy' ? 3 : 1;
  else if (state.repetitions === 1) intervalDays = grade === 'hard' ? 3 : 6;
  else intervalDays = Math.round(state.intervalDays * (grade === 'hard' ? 1.2 : ease) * (grade === 'easy' ? 1.3 : 1));
  return { ease, intervalDays: Math.min(MAX_INTERVAL, Math.max(1, intervalDays)), repetitions: state.repetitions + 1 };
}

export function dueDateAfter(today: Date, state: ReviewState): string {
  return toISODate(addDays(today, state.intervalDays));
}

/** An ayah is considered "memorised" after three successful spaced reviews. */
export function isMemorized(state: ReviewState): boolean {
  return state.repetitions >= 3;
}
