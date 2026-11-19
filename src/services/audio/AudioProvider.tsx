import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { getSurah, globalIndex } from '@/services/quran/navigation';
import { ayahAudioUrl, reciterById } from '@/services/downloads/catalogue';
import { fileUri } from '@/services/downloads/fs';
import { getSettingsSnapshot } from '@/runtime/AppProvider';
import { createStore } from '@/state/store';

import { createQueue, onTrackFinished, skip, type QueueState } from './queue';

export interface PlayerState {
  readonly queue: QueueState | null;
  readonly playing: boolean;
  readonly buffering: boolean;
  readonly error: 'offline' | 'load' | null;
  readonly rate: number;
  readonly sleepAt: number | null;
  readonly source: 'local' | 'stream' | null;
}

const INITIAL: PlayerState = { queue: null, playing: false, buffering: false, error: null, rate: 1, sleepAt: null, source: null };

export interface AudioController {
  readonly store: ReturnType<typeof createStore<PlayerState>>;
  play(surah: number, fromAyah: number, toAyah?: number): Promise<void>;
  toggle(): void;
  stop(): void;
  next(): void;
  previous(): void;
  setRepeatAyah(n: number): void;
  setRepeatRange(on: boolean): void;
  setRate(rate: number): void;
  setSleepTimer(minutes: number | null): void;
}

const AudioContext = createContext<AudioController | null>(null);

async function isOnline(): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return typeof navigator === 'undefined' ? true : navigator.onLine;
  const s = await Network.getNetworkStateAsync();
  return !!s.isConnected && s.isInternetReachable !== false;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore<PlayerState>(INITIAL), []);
  const playerRef = useRef<AudioPlayer | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef<() => void>(() => undefined);

  const getPlayer = useCallback((): AudioPlayer => {
    if (!playerRef.current) {
      const p = createAudioPlayer(null, { updateInterval: 250 });
      p.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        store.set((s) => ({ ...s, playing: status.playing, buffering: status.isBuffering && !status.playing }));
        if (status.didJustFinish) finishedRef.current();
      });
      playerRef.current = p;
    }
    return playerRef.current;
  }, [store]);

  const load = useCallback(
    async (q: QueueState) => {
      const reciter = reciterById(getSettingsSnapshot().quran.reciter);
      const local = fileUri(`recitation.${reciter.id}.${q.surah}`, `${q.current}.mp3`);
      let uri = local;
      if (!uri) {
        if (!(await isOnline())) {
          store.set((s) => ({ ...s, queue: q, playing: false, error: 'offline', source: null }));
          return;
        }
        uri = ayahAudioUrl(reciter, globalIndex({ surah: q.surah, ayah: q.current }));
      }
      try {
        const p = getPlayer();
        p.replace({ uri });
        p.setPlaybackRate(store.get().rate);
        if (process.env.EXPO_OS !== 'web') {
          const s = getSurah(q.surah);
          p.setActiveForLockScreen(true, { title: `${s.nameArabic} · ${q.current}`, artist: reciter.nameLatin, albumTitle: 'SAKINA' });
        }
        p.play();
        store.set((s) => ({ ...s, queue: q, error: null, source: local ? 'local' : 'stream' }));
      } catch {
        store.set((s) => ({ ...s, queue: q, playing: false, error: 'load' }));
      }
    },
    [getPlayer, store],
  );

  const handleFinished = useCallback(() => {
    const q = store.get().queue;
    if (!q) return;
    const step = onTrackFinished(q);
    if (step.action === 'stop') {
      store.set((s) => ({ ...s, queue: step.state, playing: false }));
      return;
    }
    if (step.action === 'replay') {
      store.set((s) => ({ ...s, queue: step.state }));
      const p = playerRef.current;
      if (p) {
        p.seekTo(0)
          .then(() => p.play())
          .catch(() => undefined);
      }
      return;
    }
    void load(step.state);
  }, [load, store]);
  useEffect(() => {
    finishedRef.current = handleFinished;
  }, [handleFinished]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => undefined);
    return () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const controller = useMemo<AudioController>(
    () => ({
      store,
      async play(surah, fromAyah, toAyah) {
        const s = getSurah(surah);
        const prev = store.get().queue;
        const q = createQueue(surah, fromAyah, toAyah ?? s.ayahCount, prev?.repeatAyah ?? 1, prev?.repeatRange ?? false);
        await load(q);
      },
      toggle() {
        const p = playerRef.current;
        const st = store.get();
        if (!p || !st.queue) return;
        if (st.error) {
          void load(st.queue);
          return;
        }
        if (p.playing) p.pause();
        else p.play();
      },
      stop() {
        const p = playerRef.current;
        if (p) {
          p.pause();
          if (process.env.EXPO_OS !== 'web') p.setActiveForLockScreen(false);
        }
        if (sleepTimer.current) clearTimeout(sleepTimer.current);
        store.set(() => ({ ...INITIAL, rate: store.get().rate }));
      },
      next() {
        const q = store.get().queue;
        const n = q && skip(q, 1);
        if (n) void load(n);
      },
      previous() {
        const q = store.get().queue;
        const n = q && skip(q, -1);
        if (n) void load(n);
      },
      setRepeatAyah(n) {
        store.set((s) => (s.queue ? { ...s, queue: { ...s.queue, repeatAyah: Math.max(1, n), playedCurrent: 0 } } : s));
      },
      setRepeatRange(on) {
        store.set((s) => (s.queue ? { ...s, queue: { ...s.queue, repeatRange: on } } : s));
      },
      setRate(rate) {
        playerRef.current?.setPlaybackRate(rate);
        store.set((s) => ({ ...s, rate }));
      },
      setSleepTimer(minutes) {
        if (sleepTimer.current) clearTimeout(sleepTimer.current);
        if (!minutes) {
          store.set((s) => ({ ...s, sleepAt: null }));
          return;
        }
        const at = Date.now() + minutes * 60_000;
        sleepTimer.current = setTimeout(() => {
          playerRef.current?.pause();
          store.set((s) => ({ ...s, sleepAt: null, playing: false }));
        }, minutes * 60_000);
        store.set((s) => ({ ...s, sleepAt: at }));
      },
    }),
    [load, store],
  );

  return <AudioContext.Provider value={controller}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioController {
  const c = useContext(AudioContext);
  if (!c) throw new Error('useAudio must be used inside <AudioProvider>');
  return c;
}

export function usePlayerState(): PlayerState {
  const c = useAudio();
  return useSyncExternalStore(c.store.subscribe, c.store.get, c.store.get);
}
