/** Pure dhikr / tasbih counter logic. */
export interface CounterState {
  readonly count: number;
  readonly target: number | null;
  /** Completed rounds when cycling a target (e.g. 33 × 3). */
  readonly rounds: number;
}

export function increment(state: CounterState, cycle = false): { state: CounterState; completed: boolean } {
  const count = state.count + 1;
  if (state.target && count >= state.target) {
    if (cycle) return { state: { ...state, count: 0, rounds: state.rounds + 1 }, completed: true };
    return { state: { ...state, count: state.target }, completed: count === state.target };
  }
  return { state: { ...state, count }, completed: false };
}

export function decrement(state: CounterState): CounterState {
  return { ...state, count: Math.max(0, state.count - 1) };
}

export function resetCounter(state: CounterState): CounterState {
  return { ...state, count: 0, rounds: 0 };
}

export function isComplete(state: CounterState): boolean {
  return state.target != null && state.count >= state.target;
}

export function counterProgress(state: CounterState): number {
  if (!state.target) return 0;
  return Math.min(1, state.count / state.target);
}
