import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { getSettingsSnapshot, useDbs, useI18n } from '@/runtime/AppProvider';
import { useAudio } from '@/services/audio/AudioProvider';
import { usePackageStates } from '@/services/downloads/DownloadProvider';
import { createStore } from '@/state/store';

import { hasNativeEngine, nativeAdhan, playNativeNow, type NativePlaybackState } from './nativeEngine';
import { loadCustomVoices } from './custom';
import { customFileUri } from './customFiles';
import { levelAt } from './playback';
import { fullSource, previewSource, type PlaybackProfile, type PlaybackSource } from './sources';
import { isLocalVoice, resolveVoice, voiceById, voicePackageId, type Prayer, type VoiceSettings } from './voices';

export type AdhanError = 'missing' | 'playback' | null;

export interface AdhanState {
  readonly id: string | null;
  /** `preview` = the 30 s clip or a full listen from the library; `prayer` = the real adhan (overlay + dua). */
  readonly mode: 'preview' | 'prayer' | null;
  readonly prayer: Prayer | null;
  readonly playing: boolean;
  readonly loading: boolean;
  readonly position: number;
  readonly duration: number;
  /** Prayer playback ended naturally (shows the post-adhan supplication). */
  readonly finished: boolean;
  readonly error: AdhanError;
  readonly engine: 'js' | 'native';
}

const IDLE: AdhanState = {
  id: null,
  mode: null,
  prayer: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  finished: false,
  error: null,
  engine: 'js',
};

export interface AdhanController {
  readonly store: ReturnType<typeof createStore<AdhanState>>;
  /** Toggles the instant 30 s preview (bundled — works offline), or the full recording when `full` is true. */
  preview(voiceId: string, full?: boolean): void;
  /** Plays the adhan for a prayer with the voice the user assigned to it (overlay + supplication). */
  playForPrayer(prayer: Prayer): void;
  stop(): void;
  dismiss(): void;
  /** Voice ids that can play their full recording offline right now. */
  isAvailable(voiceId: string): boolean;
}

const Ctx = createContext<AdhanController | null>(null);

const voiceSettings = (): VoiceSettings => {
  const a = getSettingsSnapshot().adhan;
  return { defaultVoice: a.voice, byPrayer: a.byPrayer };
};

/** The adhan player: previews everywhere, full prayer-time playback on iOS/web, and a mirror of the native service on Android. */
export function AdhanProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore<AdhanState>(IDLE), []);
  const player = useRef<AudioPlayer | null>(null);
  const profile = useRef<PlaybackProfile | null>(null);
  const audio = useAudio();
  const i18n = useI18n();
  const dbs = useDbs();
  useEffect(() => {
    loadCustomVoices(dbs.user, customFileUri).catch(() => undefined);
  }, [dbs]);
  const states = usePackageStates();
  const latest = useRef({ states, i18n, audio });
  useEffect(() => {
    latest.current = { states, i18n, audio };
  });

  const isAvailable = useCallback((voiceId: string) => {
    const v = voiceById(voiceId);
    if (!v) return false;
    if (isLocalVoice(v)) return true;
    return latest.current.states[voicePackageId(voiceId)]?.status === 'installed' && fullSource(v) !== null;
  }, []);

  // Mirror the native Android service (it plays at prayer time even when the app was closed).
  useEffect(() => {
    if (!nativeAdhan) return;
    const apply = (s: NativePlaybackState) => {
      if (!s.id && !s.playing && !s.finished) return;
      store.set({
        id: s.voiceId,
        mode: 'prayer',
        prayer: s.prayer,
        playing: s.playing,
        loading: false,
        position: s.positionMs / 1000,
        duration: s.durationMs / 1000,
        finished: s.finished,
        error: null,
        engine: 'native',
      });
    };
    apply(nativeAdhan.getPlaybackState());
    const sub = nativeAdhan.addListener('onPlaybackState', apply);
    return () => sub.remove();
  }, [store]);

  useEffect(
    () => () => {
      player.current?.remove();
      player.current = null;
    },
    [],
  );

  const controller = useMemo<AdhanController>(() => {
    const finishJs = () => {
      const p = player.current;
      p?.pause();
      store.set((st) => (st.mode === 'prayer' ? { ...st, playing: false, finished: true } : IDLE));
    };

    const ensure = () => {
      if (!player.current) {
        const p = createAudioPlayer(null, { updateInterval: 100 });
        p.addListener('playbackStatusUpdate', (s: AudioStatus) => {
          const prof = profile.current;
          const duration = s.duration || 0;
          if (prof && s.playing) {
            if (prof.endSec !== null && s.currentTime >= prof.endSec) {
              finishJs();
              return;
            }
            p.volume = levelAt(s.currentTime, prof, duration);
          }
          store.set((st) => (st.id ? { ...st, loading: false, playing: s.playing, position: s.currentTime, duration: duration || st.duration } : st));
          if (s.didJustFinish) finishJs();
        });
        player.current = p;
      }
      return player.current;
    };

    const startJs = async (voiceId: string, mode: 'preview' | 'prayer', prayer: Prayer | null, source: PlaybackSource | null) => {
      if (source === null) {
        store.set({ ...IDLE, id: voiceId, mode, prayer, error: 'missing' });
        return;
      }
      try {
        const p = ensure();
        const prof: PlaybackProfile = source.profile;
        profile.current = prof;
        store.set({ ...IDLE, id: voiceId, mode, prayer, loading: true });
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: mode === 'prayer' ? 'doNotMix' : 'duckOthers' });
        p.volume = prof.startSec > 0 || prof.gainDb !== 0 ? 0 : 1;
        p.replace(source.kind === 'asset' ? source.asset : { uri: source.uri });
        if (prof.startSec > 0) await p.seekTo(prof.startSec);
        p.play();
        store.set((st) => ({ ...st, playing: true }));
      } catch (e) {
        if (__DEV__) console.warn('[adhan] playback failed', e);
        store.set({ ...IDLE, id: voiceId, mode, prayer, error: 'playback' });
      }
    };

    const stopQuranAudio = () => {
      try {
        latest.current.audio.stop();
      } catch {
        // nothing playing
      }
    };

    return {
      store,
      isAvailable,
      preview(voiceId, full = false) {
        const st = store.get();
        if (st.id === voiceId && st.mode === 'preview' && (st.playing || st.loading)) {
          player.current?.pause();
          store.set(IDLE);
          return;
        }
        const v = voiceById(voiceId);
        if (!v) return;
        void startJs(voiceId, 'preview', null, full ? fullSource(v) : previewSource(v));
      },
      playForPrayer(prayer) {
        const v = resolveVoice(prayer, voiceSettings(), isAvailable);
        stopQuranAudio();
        if (hasNativeEngine) {
          store.set({ ...IDLE, id: v.id, mode: 'prayer', prayer, loading: true, engine: 'native' });
          playNativeNow(prayer, v.id, { voiceSettings: voiceSettings(), isAvailable, i18n: latest.current.i18n }).catch(() => {
            // Native service unavailable: play it in the app instead.
            void startJs(v.id, 'prayer', prayer, fullSource(v) ?? previewSource(v));
          });
          return;
        }
        void startJs(v.id, 'prayer', prayer, fullSource(v) ?? previewSource(v));
      },
      stop() {
        const st = store.get();
        if (st.engine === 'native' && nativeAdhan) {
          void nativeAdhan.stopPlayback();
          store.set({ ...st, playing: false, finished: false, mode: null, id: null });
          return;
        }
        player.current?.pause();
        store.set(st.mode === 'prayer' ? { ...st, playing: false, finished: true } : IDLE);
      },
      dismiss() {
        const st = store.get();
        if (st.engine === 'native' && nativeAdhan && st.playing) void nativeAdhan.stopPlayback();
        player.current?.pause();
        store.set(IDLE);
      },
    };
  }, [store, isAvailable]);

  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useAdhan(): AdhanController {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdhan must be used inside <AdhanProvider>');
  return c;
}

export function useAdhanState(): AdhanState {
  const c = useAdhan();
  return useSyncExternalStore(c.store.subscribe, c.store.get, c.store.get);
}
