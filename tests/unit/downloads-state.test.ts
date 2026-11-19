import {
  canTransition,
  IllegalTransitionError,
  INITIAL_PACKAGE_STATE,
  progressFraction,
  recoverAfterRestart,
  transition,
  type PackageEvent,
  type PackageState,
  type PackageStatus,
} from '@/services/downloads/state';

const at = (status: PackageStatus, extra: Partial<PackageState> = {}): PackageState => ({ ...INITIAL_PACKAGE_STATE, status, ...extra });
const run = (s: PackageState, ...events: PackageEvent[]) => events.reduce(transition, s);

describe('download state machine', () => {
  it('happy path: download → install', () => {
    const s = run(
      INITIAL_PACKAGE_STATE,
      { type: 'download' },
      { type: 'start' },
      { type: 'progress', bytesDone: 50, bytesTotal: 100 },
      { type: 'files_done' },
      { type: 'verified' },
      { type: 'installed' },
    );
    expect(s).toMatchObject({ status: 'installed', bytesDone: 100, bytesTotal: 100, error: null });
    expect(progressFraction(s)).toBe(1);
  });

  it('pause and resume re-queues', () => {
    const s = run(at('downloading', { bytesDone: 30, bytesTotal: 100 }), { type: 'pause' });
    expect(s.status).toBe('paused');
    expect(progressFraction(s)).toBeCloseTo(0.3);
    expect(run(s, { type: 'resume' }).status).toBe('queued');
  });

  it('failure keeps the error and allows retry', () => {
    const s = run(at('verifying'), { type: 'fail', error: 'integrity' });
    expect(s).toMatchObject({ status: 'failed', error: 'integrity' });
    expect(run(s, { type: 'retry' })).toMatchObject({ status: 'queued', error: null });
  });

  it('cancel resets progress', () => {
    expect(run(at('downloading', { bytesDone: 80, bytesTotal: 100 }), { type: 'cancel' })).toMatchObject({ status: 'not_installed', bytesDone: 0 });
  });

  it('delete only from installed or failed', () => {
    expect(run(at('installed', { bytesTotal: 10, bytesDone: 10 }), { type: 'delete' }).status).toBe('not_installed');
    expect(() => run(at('downloading'), { type: 'delete' })).toThrow(IllegalTransitionError);
  });

  it('rejects illegal transitions instead of corrupting state', () => {
    const illegal: [PackageStatus, PackageEvent][] = [
      ['not_installed', { type: 'start' }],
      ['not_installed', { type: 'installed' }],
      ['queued', { type: 'files_done' }],
      ['downloading', { type: 'installed' }],
      ['installed', { type: 'download' }],
      ['paused', { type: 'progress', bytesDone: 1, bytesTotal: 2 }],
      ['verifying', { type: 'pause' }],
      ['installed', { type: 'fail', error: 'x' }],
    ];
    for (const [status, ev] of illegal) {
      expect(canTransition(at(status), ev)).toBe(false);
    }
  });

  it('ignores a missing Content-Length (totalBytes = -1)', () => {
    const s = run(at('downloading', { bytesTotal: 500 }), { type: 'progress', bytesDone: 10, bytesTotal: -1 });
    expect(s.bytesTotal).toBe(500);
  });

  it('recovers safely after an app restart', () => {
    expect(recoverAfterRestart(at('downloading')).status).toBe('paused');
    expect(recoverAfterRestart(at('queued')).status).toBe('paused');
    expect(recoverAfterRestart(at('verifying'))).toMatchObject({ status: 'failed', error: 'interrupted' });
    expect(recoverAfterRestart(at('installing')).status).toBe('failed');
    expect(recoverAfterRestart(at('installed')).status).toBe('installed');
  });
});
