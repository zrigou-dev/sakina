import { useMemo, useSyncExternalStore } from 'react';

import { useSettings } from '@/runtime/AppProvider';
import { supportsFileDownloads } from '@/services/downloads/fs';
import { usePackageState, usePackageStates } from '@/services/downloads/DownloadProvider';
import type { PackageState } from '@/services/downloads/state';
import {
  allVoices,
  isLocalVoice,
  getVoicesVersion,
  PRAYERS,
  resolveVoice,
  subscribeVoices,
  voiceById,
  voicePackageId,
  type AdhanVoice,
  type Prayer,
  type VoiceSettings,
} from '@/services/adhan/voices';

export interface VoiceInstall {
  readonly state: PackageState & { errorCode?: string };
  /** The full recording can play offline right now. */
  readonly available: boolean;
  /** Downloads work on this platform. */
  readonly canDownload: boolean;
}

export function useVoiceInstall(voice: AdhanVoice): VoiceInstall {
  const state = usePackageState(voicePackageId(voice.id));
  return {
    state,
    available: isLocalVoice(voice) || state.status === 'installed',
    canDownload: isLocalVoice(voice) || supportsFileDownloads,
  };
}

/** The voice list; re-renders when a remote catalogue adds voices. */
export function useVoices(): readonly AdhanVoice[] {
  const version = useSyncExternalStore(subscribeVoices, getVoicesVersion, getVoicesVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => allVoices(), [version]);
}

/** Ids of voices whose full recording is available offline (bundled + installed). */
export function useAvailableVoiceIds(): ReadonlySet<string> {
  const states = usePackageStates();
  const voices = useVoices();
  return useMemo(
    () => new Set(voices.filter((v) => isLocalVoice(v) || states[voicePackageId(v.id)]?.status === 'installed').map((v) => v.id)),
    [states, voices],
  );
}

export function useVoiceSettings(): VoiceSettings {
  const [settings] = useSettings();
  return useMemo(() => ({ defaultVoice: settings.adhan.voice, byPrayer: settings.adhan.byPrayer }), [settings.adhan.voice, settings.adhan.byPrayer]);
}

/** Prayers for which this voice is the one that actually sounds (the user's intent, ignoring availability). */
export function prayersUsing(voiceId: string, vs: VoiceSettings): Prayer[] {
  return PRAYERS.filter((p) => resolveVoice(p, vs, () => true).id === voiceId);
}

export function voiceLabel(voiceId: string | null, lang: 'ar' | 'en' | 'fr'): string | null {
  const v = voiceId ? voiceById(voiceId) : null;
  return v ? v.name[lang] : null;
}
