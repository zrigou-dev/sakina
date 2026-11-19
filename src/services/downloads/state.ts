/**
 * Download package state machine. Pure and exhaustively unit-tested.
 *
 *   not_installed ─download→ queued ─start→ downloading ─files_done→ verifying ─verified→ installing ─installed→ installed
 *                              │               │  ⇅ pause/resume                │                     │
 *                              └──cancel───────┴────────→ not_installed          └─fail→ failed ←──────┘
 *   failed ─retry→ queued        installed ─delete→ not_installed        installed ─update→ queued
 */
export type PackageStatus = 'not_installed' | 'queued' | 'downloading' | 'paused' | 'verifying' | 'installing' | 'installed' | 'failed';

export type PackageEvent =
  | { type: 'download' }
  | { type: 'start' }
  | { type: 'progress'; bytesDone: number; bytesTotal: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'files_done' }
  | { type: 'verified' }
  | { type: 'installed' }
  | { type: 'fail'; error: string }
  | { type: 'cancel' }
  | { type: 'retry' }
  | { type: 'delete' }
  | { type: 'update' };

export interface PackageState {
  readonly status: PackageStatus;
  readonly bytesDone: number;
  readonly bytesTotal: number;
  readonly error: string | null;
}

export const INITIAL_PACKAGE_STATE: PackageState = { status: 'not_installed', bytesDone: 0, bytesTotal: 0, error: null };

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: PackageStatus,
    readonly event: PackageEvent['type'],
  ) {
    super(`Illegal package transition: ${event} from ${from}`);
    this.name = 'IllegalTransitionError';
  }
}

const reset = (s: PackageState): PackageState => ({ ...s, status: 'not_installed', bytesDone: 0, error: null });

export function transition(state: PackageState, event: PackageEvent): PackageState {
  const s = state.status;
  const illegal = () => {
    throw new IllegalTransitionError(s, event.type);
  };
  switch (event.type) {
    case 'download':
      return s === 'not_installed' ? { ...state, status: 'queued', error: null, bytesDone: 0 } : illegal();
    case 'update':
      return s === 'installed' ? { ...state, status: 'queued', error: null, bytesDone: 0 } : illegal();
    case 'retry':
      return s === 'failed' ? { ...state, status: 'queued', error: null } : illegal();
    case 'start':
      return s === 'queued' ? { ...state, status: 'downloading' } : illegal();
    case 'progress':
      if (s !== 'downloading') return illegal();
      return {
        ...state,
        bytesDone: Math.max(0, event.bytesDone),
        bytesTotal: event.bytesTotal > 0 ? event.bytesTotal : state.bytesTotal,
      };
    case 'pause':
      return s === 'downloading' || s === 'queued' ? { ...state, status: 'paused' } : illegal();
    case 'resume':
      return s === 'paused' ? { ...state, status: 'queued' } : illegal();
    case 'files_done':
      return s === 'downloading' ? { ...state, status: 'verifying', bytesDone: Math.max(state.bytesDone, state.bytesTotal) } : illegal();
    case 'verified':
      return s === 'verifying' ? { ...state, status: 'installing' } : illegal();
    case 'installed':
      return s === 'installing' ? { ...state, status: 'installed', error: null } : illegal();
    case 'fail':
      return s === 'downloading' || s === 'verifying' || s === 'installing' || s === 'queued' || s === 'paused'
        ? { ...state, status: 'failed', error: event.error }
        : illegal();
    case 'cancel':
      return s === 'queued' || s === 'downloading' || s === 'paused' || s === 'failed' ? reset(state) : illegal();
    case 'delete':
      return s === 'installed' || s === 'failed' ? { ...reset(state), bytesTotal: state.bytesTotal } : illegal();
  }
}

export function canTransition(state: PackageState, event: PackageEvent): boolean {
  try {
    transition(state, event);
    return true;
  } catch {
    return false;
  }
}

export function progressFraction(state: PackageState): number {
  if (state.status === 'installed') return 1;
  if (state.bytesTotal <= 0) return 0;
  return Math.min(1, state.bytesDone / state.bytesTotal);
}

export const ACTIVE_STATUSES: readonly PackageStatus[] = ['queued', 'downloading', 'verifying', 'installing'];

/**
 * After an app restart, in-flight states cannot be trusted: downloading/queued resume as
 * paused (user resumes explicitly), verifying/installing are treated as failed so partial
 * content is never activated.
 */
export function recoverAfterRestart(state: PackageState): PackageState {
  switch (state.status) {
    case 'queued':
    case 'downloading':
      return { ...state, status: 'paused' };
    case 'verifying':
    case 'installing':
      return { ...state, status: 'failed', error: 'interrupted' };
    default:
      return state;
  }
}
