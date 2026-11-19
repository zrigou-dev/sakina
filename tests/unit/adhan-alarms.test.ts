import { ADHAN_ALARM_DAYS, planAdhanAlarms } from '@/services/adhan/alarmPlan';
import { buildNativePayload } from '@/services/adhan/nativeEngine';
import { DEFAULT_FAJR_VOICE_ID, DEFAULT_VOICE_ID, voiceById, type VoiceSettings } from '@/services/adhan/voices';
import en from '@/localization/locales/en';
import ar from '@/localization/locales/ar';
import { translate } from '@/localization/translate';
import { planNotifications } from '@/services/notifications/plan';
import { NO_ADJUSTMENTS, type PrayerConfig } from '@/services/prayer/times';
import { DEFAULT_SETTINGS, type Settings } from '@/state/settings';

import { fixtureVoice, registerFixtureVoice } from '../helpers/adhan-fixtures';

beforeAll(() => registerFixtureVoice());

const makkah: PrayerConfig = {
  latitude: 21.4225,
  longitude: 39.8262,
  method: 'umm_al_qura',
  madhab: 'shafi',
  highLatitudeRule: 'auto',
  adjustments: NO_ADJUSTMENTS,
};
const now = new Date(2026, 10, 18, 10, 0);
const withAdhan = (over: Partial<Settings['adhan']> = {}): Settings => ({ ...DEFAULT_SETTINGS, adhan: { ...DEFAULT_SETTINGS.adhan, ...over } });

describe('planAdhanAlarms', () => {
  it('plans every enabled prayer for two weeks, in order, with unique ids', () => {
    const plan = planAdhanAlarms(DEFAULT_SETTINGS, makkah, now);
    // Today's already-passed prayers are dropped, so a bit under 14 × 5.
    expect(plan.length).toBeGreaterThanOrEqual(ADHAN_ALARM_DAYS * 5 - 5);
    expect(plan.length).toBeLessThanOrEqual(ADHAN_ALARM_DAYS * 5);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (let i = 1; i < plan.length; i++) expect(plan[i]!.at.getTime()).toBeGreaterThan(plan[i - 1]!.at.getTime());
    expect(plan.every((p) => p.at.getTime() > now.getTime())).toBe(true);
  });

  it('skips prayers that are off, or set to a short tone / silent; plans nothing without a location', () => {
    const s: Settings = {
      ...withAdhan({ sound: { fajr: 'silent', dhuhr: 'default', asr: 'adhan', maghrib: 'adhan', isha: 'adhan' } }),
      notifications: { ...DEFAULT_SETTINGS.notifications, prayers: { ...DEFAULT_SETTINGS.notifications.prayers, isha: false } },
    };
    const kinds = new Set(planAdhanAlarms(s, makkah, now).map((p) => p.prayer));
    expect([...kinds].sort()).toEqual(['asr', 'maghrib']);
    expect(planAdhanAlarms(DEFAULT_SETTINGS, null, now)).toEqual([]);
  });
});

describe('planNotifications with the adhan engine', () => {
  it('stamps the resolved voice on adhan prayer notifications (iOS clip / Android channel)', () => {
    const plan = planNotifications(DEFAULT_SETTINGS, makkah, now, 0, { voiceFor: (p) => (p === 'fajr' ? DEFAULT_FAJR_VOICE_ID : DEFAULT_VOICE_ID) });
    const prayers = plan.filter((n) => n.kind === 'prayer');
    expect(prayers.length).toBeGreaterThan(0);
    for (const n of prayers) expect(n.voiceId).toBe(n.prayer === 'fajr' ? DEFAULT_FAJR_VOICE_ID : DEFAULT_VOICE_ID);
  });

  it('leaves adhan prayers to the native alarm engine, but still notifies for tone/silent prayers', () => {
    const s = withAdhan({ sound: { fajr: 'adhan', dhuhr: 'default', asr: 'silent', maghrib: 'adhan', isha: 'adhan' } });
    const plan = planNotifications(s, makkah, now, 0, { nativeAdhan: true });
    const prayers = plan.filter((n) => n.kind === 'prayer');
    expect(prayers.every((n) => n.sound !== 'adhan')).toBe(true);
    expect(new Set(prayers.map((n) => n.prayer))).toEqual(new Set(['dhuhr', 'asr']));
  });

  it('without the native engine every adhan prayer gets a notification carrying a voice', () => {
    const plan = planNotifications(DEFAULT_SETTINGS, makkah, now, 0, { nativeAdhan: false });
    expect(plan.filter((n) => n.kind === 'prayer' && n.sound === 'adhan').length).toBeGreaterThan(0);
  });
});

describe('native alarm payload', () => {
  const i18nFor = (lang: 'en' | 'ar') => {
    const tree = lang === 'en' ? en : ar;
    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isRTL: lang === 'ar',
      t: (key: string, params?: Record<string, string | number>) => translate(tree as never, en as never, lang, key, params),
    } as never;
  };
  const vs = (over: Partial<VoiceSettings> = {}): VoiceSettings => ({
    defaultVoice: DEFAULT_VOICE_ID,
    byPrayer: { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null },
    ...over,
  });
  const localFile = async (v: { id: string }) => ({ uri: `file:///data/adhan/${v.id}.m4a`, profile: { gainDb: 0, startSec: 0, endSec: null, fadeOutSec: 0 } });
  const plan = (prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' = 'dhuhr') => [{ id: `adhan-${prayer}-1`, at: new Date(2026, 10, 19, 12, 5), prayer }];
  const build = async (
    p: ReturnType<typeof plan>,
    settings: VoiceSettings,
    available: (id: string) => boolean,
    lang: 'en' | 'ar' = 'en',
    lf: unknown = localFile,
  ) =>
    JSON.parse(await buildNativePayload(p, { voiceSettings: settings, isAvailable: available, i18n: i18nFor(lang), localFile: lf as never })) as {
      alarms: Record<string, unknown>[];
      ensureAudible: boolean;
      tz: { title: string; body: string };
    };

  it('carries everything the service needs while the app process is dead', async () => {
    const out = await build(plan('dhuhr'), vs(), () => true);
    expect(out.alarms).toHaveLength(1);
    expect(out.alarms[0]).toMatchObject({
      id: 'adhan-dhuhr-1',
      atMs: new Date(2026, 10, 19, 12, 5).getTime(),
      prayer: 'dhuhr',
      voiceId: DEFAULT_VOICE_ID,
      path: `file:///data/adhan/${DEFAULT_VOICE_ID}.m4a`,
      startMs: 0,
      endMs: 0,
      gain: 1,
      fallbackRaw: 'adhan_aaqib_azeez',
    });
    expect(out.alarms[0]!.title).toBe('Dhuhr');
    expect(out.alarms[0]!.body).toBe('The adhan is playing');
    expect(String(out.alarms[0]!.doneTitle)).toContain('Dhuhr');
    expect(out.tz.title.length).toBeGreaterThan(3);
    expect(out.ensureAudible).toBe(true);
  });

  it('uses the Fajr adhan for Fajr and a per-prayer choice for that prayer', async () => {
    const out = await build(
      [...plan('fajr'), ...plan('maghrib')],
      vs({ byPrayer: { fajr: null, dhuhr: null, asr: null, maghrib: fixtureVoice.id, isha: null } }),
      () => true,
    );
    expect(out.alarms.map((a) => a.voiceId)).toEqual([DEFAULT_FAJR_VOICE_ID, fixtureVoice.id]);
  });

  it('applies the levelling gain and trim of a raw downloaded file (seconds → ms, dB → linear)', async () => {
    const d = fixtureVoice.direct!;
    const lf = async () => ({ uri: 'file:///x/adhan.mp3', profile: { gainDb: d.gainDb, startSec: d.trim.startSec, endSec: d.trim.endSec, fadeOutSec: 1.4 } });
    const out = await build(plan('asr'), vs({ byPrayer: { fajr: null, dhuhr: null, asr: fixtureVoice.id, maghrib: null, isha: null } }), () => true, 'en', lf);
    const a = out.alarms[0]!;
    expect(a.voiceId).toBe(fixtureVoice.id);
    expect(a.startMs).toBe(Math.round(d.trim.startSec * 1000));
    expect(a.endMs).toBe(Math.round(d.trim.endSec * 1000));
    expect(a.gain as number).toBeCloseTo(10 ** (d.gainDb / 20), 5);
    expect(a.fadeOutMs).toBe(1400);
  });

  it('a voice whose file was deleted falls back to a bundled voice — never a missing path', async () => {
    const out = await build(
      plan('asr'),
      vs({ byPrayer: { fajr: null, dhuhr: null, asr: fixtureVoice.id, maghrib: null, isha: null } }),
      (id) => voiceById(id)?.delivery === 'bundled',
    );
    expect(voiceById(out.alarms[0]!.voiceId as string)?.delivery).toBe('bundled');
  });

  it('localises titles (Arabic) and keeps a bundled fallback clip name for undecodable files', async () => {
    const out = await build(plan('isha'), vs(), () => true, 'ar');
    expect(out.alarms[0]!.title).toBe('العشاء');
    expect(String(out.alarms[0]!.doneTitle)).toContain('العشاء');
    expect(out.alarms[0]!.fallbackRaw).toMatch(/^adhan_[a-z0-9_]+$/);
  });

  it('skips a voice with no local file instead of arming a silent alarm', async () => {
    const none = async () => null;
    const out = await build(plan('dhuhr'), vs(), () => true, 'en', none);
    // The alarm is still armed (the service plays the bundled clip), with an empty path.
    expect(out.alarms).toHaveLength(1);
    expect(out.alarms[0]!.path).toBe('');
    expect(out.alarms[0]!.fallbackRaw).toBeTruthy();
  });
});
