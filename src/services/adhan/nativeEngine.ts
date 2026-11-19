import { requireOptionalNativeModule } from 'expo';

import type { I18n } from '@/runtime/AppProvider';

import type { AdhanAlarmPlan } from './alarmPlan';
import { ensureLocalFile } from './localFiles';
import { ANDROID_NOTIFICATION_SOUNDS } from '@/content/adhan/assets.generated';
import { DEFAULT_VOICE_ID, dbToVolume, resolveVoice, voiceById, type AdhanVoice, type Prayer, type VoiceSettings } from './voices';

export interface NativePlaybackState {
  readonly playing: boolean;
  readonly finished: boolean;
  readonly id: string | null;
  readonly prayer: Prayer | null;
  readonly voiceId: string | null;
  readonly positionMs: number;
  readonly durationMs: number;
}

export interface NativeStatus {
  readonly sdk: number;
  readonly manufacturer: string;
  readonly notificationsEnabled: boolean;
  readonly ignoringBatteryOptimizations: boolean;
  readonly armedCount: number;
  readonly nextAlarmAtMs: number | null;
  readonly alarmVolume: number;
  readonly alarmVolumeMax: number;
  readonly needsReplan: boolean;
}

interface NativeAdhanModule {
  scheduleAlarms(payload: string): Promise<number>;
  cancelAlarms(): Promise<void>;
  playNow(payload: string): Promise<void>;
  stopPlayback(): Promise<void>;
  getPlaybackState(): NativePlaybackState;
  getStatus(): NativeStatus;
  openSettings(kind: 'battery' | 'notifications' | 'app'): boolean;
  addListener(event: 'onPlaybackState', listener: (s: NativePlaybackState) => void): { remove(): void };
}

/** The native Android adhan engine, or null (iOS, web, Expo Go, or a build without the module). */
export const nativeAdhan: NativeAdhanModule | null = process.env.EXPO_OS === 'android' ? requireOptionalNativeModule<NativeAdhanModule>('SakinaAdhan') : null;

export const hasNativeEngine = nativeAdhan !== null;

/** Set by the scheduler: true while native alarms are armed, so the in-app watcher does not play a second adhan. */
export const engineStatus = { nativeScheduled: false };

export interface NativeAlarmInput {
  readonly id: string;
  readonly at: Date;
  readonly prayer: Prayer;
}

interface BuildDeps {
  readonly voiceSettings: VoiceSettings;
  readonly isAvailable: (voiceId: string) => boolean;
  readonly i18n: I18n;
  readonly ensureAudible?: boolean;
  /** Test seam. */
  readonly localFile?: typeof ensureLocalFile;
}

/** Fade lengths for the native player (the mastered files already fade; raw Commons files do not). */
const FADE_IN_MS = 250;

async function alarmFor(item: NativeAlarmInput, voice: AdhanVoice, deps: BuildDeps): Promise<Record<string, unknown> | null> {
  const local = await (deps.localFile ?? ensureLocalFile)(voice);
  const { t } = deps.i18n;
  const prayer = t(`prayers.${item.prayer}`);
  const raw = ANDROID_NOTIFICATION_SOUNDS[voice.id] ?? ANDROID_NOTIFICATION_SOUNDS[DEFAULT_VOICE_ID];
  const profile = local?.profile;
  return {
    id: item.id,
    atMs: item.at.getTime(),
    prayer: item.prayer,
    voiceId: voice.id,
    path: local?.uri ?? '',
    startMs: Math.round((profile?.startSec ?? 0) * 1000),
    endMs: profile?.endSec ? Math.round(profile.endSec * 1000) : 0,
    gain: dbToVolume(profile?.gainDb ?? 0),
    fadeInMs: FADE_IN_MS,
    fadeOutMs: Math.round((profile?.fadeOutSec ?? 0) * 1000),
    fallbackRaw: raw ? raw.replace(/\.[a-z0-9]+$/, '') : null,
    title: t('adhan.nowPlayingTitle', { prayer }),
    body: t('adhan.nowPlayingBody', { prayer }),
    stopLabel: t('adhan.stop'),
    doneTitle: t('notify.prayerTitle', { prayer }),
    doneBody: t('notify.prayerBody', { prayer }),
  };
}

/** Resolves the voice per prayer, makes sure its file is on disk, and builds the native payload. */
export async function buildNativePayload(plan: readonly NativeAlarmInput[], deps: BuildDeps): Promise<string> {
  const alarms: Record<string, unknown>[] = [];
  // Two weeks of alarms use at most a handful of distinct voices: prepare each file once.
  const prepare = deps.localFile ?? ensureLocalFile;
  const cache = new Map<string, ReturnType<typeof ensureLocalFile>>();
  const memo: typeof ensureLocalFile = (v) => {
    if (!cache.has(v.id)) cache.set(v.id, prepare(v));
    return cache.get(v.id)!;
  };
  for (const item of plan) {
    const voice = resolveVoice(item.prayer, deps.voiceSettings, deps.isAvailable);
    const a = await alarmFor(item, voice, { ...deps, localFile: memo });
    if (a) alarms.push(a);
  }
  return JSON.stringify({
    alarms,
    ensureAudible: deps.ensureAudible ?? true,
    tz: { title: deps.i18n.t('adhan.tzTitle'), body: deps.i18n.t('adhan.tzBody') },
  });
}

/** Arms the plan with the native engine. Throws if the engine is unavailable (caller falls back to notifications). */
export async function scheduleNativeAdhan(plan: readonly AdhanAlarmPlan[], deps: BuildDeps): Promise<number> {
  if (!nativeAdhan) throw new Error('native adhan engine unavailable');
  return nativeAdhan.scheduleAlarms(await buildNativePayload(plan, deps));
}

/** Plays the adhan right now through the native service ("test adhan", in-app prayer time). */
export async function playNativeNow(prayer: Prayer, voiceId: string, deps: BuildDeps): Promise<void> {
  if (!nativeAdhan) throw new Error('native adhan engine unavailable');
  const voice = voiceById(voiceId) ?? resolveVoice(prayer, deps.voiceSettings, deps.isAvailable);
  const alarm = await alarmFor({ id: `now-${Date.now()}`, at: new Date(), prayer }, voice, deps);
  if (alarm) await nativeAdhan.playNow(JSON.stringify(alarm));
}
