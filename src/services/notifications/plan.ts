import { dayTags } from '@/services/hijri/occasions';
import { calculateDay, FARD_PRAYERS, type FardPrayer, type PrayerConfig } from '@/services/prayer/times';
import type { AdhanSound, Settings } from '@/state/settings';
import { addDays, parseHHMM, startOfDay } from '@/utils/date';

/**
 * Pure notification planner.
 * iOS allows at most 64 pending local notifications, so SAKINA schedules a rolling window
 * capped at MAX_PENDING with a priority order (prayer times always win) and re-plans
 * whenever the app is foregrounded or settings change. No native API is touched here.
 */
export const DAYS_AHEAD = 4;
export const DHIKR_DAYS_AHEAD = 2;
export const MAX_PENDING = 60;

export type PlannedKind = 'prayer' | 'pre_prayer' | 'after_prayer' | 'morning' | 'evening' | 'sleep' | 'quran' | 'friday' | 'fasting' | 'dhikr';
export type Channel = 'prayer-adhan' | 'prayer' | 'prayer-silent' | 'reminders' | 'dhikr';

export interface PlannedNotification {
  readonly id: string;
  readonly kind: PlannedKind;
  readonly date: Date;
  readonly prayer?: FardPrayer;
  readonly minutesBefore?: number;
  readonly channel: Channel;
  /** 'adhan' → the voice's bundled notification clip; 'default' → system sound; null → silent. */
  readonly sound: 'adhan' | 'default' | null;
  /** Catalogue voice whose clip sounds (only when `sound` is 'adhan'). */
  readonly voiceId?: string;
  readonly priority: number;
  /** Monday / Thursday / white day, for fasting reminders. */
  readonly fastingReason?: 'monday' | 'thursday' | 'white_day';
  /** Index into the dhikr text list (rotates through short adhkar). */
  readonly dhikrIndex?: number;
}

const PRIORITY: Record<PlannedKind, number> = {
  prayer: 0,
  morning: 1,
  evening: 1,
  sleep: 1,
  quran: 1,
  friday: 1,
  fasting: 1,
  after_prayer: 2,
  pre_prayer: 3,
  dhikr: 4,
};

function prayerChannel(sound: AdhanSound): { channel: Channel; sound: PlannedNotification['sound'] } {
  if (sound === 'adhan') return { channel: 'prayer-adhan', sound: 'adhan' };
  if (sound === 'silent') return { channel: 'prayer-silent', sound: null };
  return { channel: 'prayer', sound: 'default' };
}

const at = (day: Date, hhmm: string) => {
  const mins = parseHHMM(hhmm);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(mins / 60), mins % 60);
};

export interface PlanOptions {
  /** Voice that sounds for a prayer (resolution lives in the adhan module). Default: the default voice. */
  readonly voiceFor?: (prayer: FardPrayer) => string;
  /** The native alarm engine plays the adhan: do not also schedule a notification sound for those prayers. */
  readonly nativeAdhan?: boolean;
}

export function planNotifications(
  settings: Settings,
  config: PrayerConfig | null,
  now: Date,
  dhikrCount = 0,
  options: PlanOptions = {},
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const n = settings.notifications;
  const push = (p: Omit<PlannedNotification, 'priority'>) => out.push({ ...p, priority: PRIORITY[p.kind] });

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = addDays(startOfDay(now), d);
    const key = `${day.getFullYear()}${day.getMonth() + 1}${day.getDate()}`;
    if (config) {
      const schedule = calculateDay(config, day);
      for (const p of FARD_PRAYERS) {
        const time = schedule.times.find((t) => t.name === p)!.time;
        if (n.prayers[p]) {
          const mode = prayerChannel(settings.adhan.sound[p]);
          const handledNatively = options.nativeAdhan === true && mode.sound === 'adhan';
          if (!handledNatively) {
            const voiceId = mode.sound === 'adhan' ? (options.voiceFor?.(p) ?? settings.adhan.voice) : undefined;
            push({ id: `prayer-${p}-${key}`, kind: 'prayer', date: time, prayer: p, ...mode, ...(voiceId ? { voiceId } : {}) });
          }
          if (n.preReminderMinutes > 0) {
            push({
              id: `pre-${p}-${key}`,
              kind: 'pre_prayer',
              date: new Date(time.getTime() - n.preReminderMinutes * 60_000),
              prayer: p,
              minutesBefore: n.preReminderMinutes,
              channel: 'reminders',
              sound: 'default',
            });
          }
        }
        if (n.afterPrayer.enabled) {
          push({
            id: `after-${p}-${key}`,
            kind: 'after_prayer',
            date: new Date(time.getTime() + n.afterPrayer.minutes * 60_000),
            prayer: p,
            channel: 'reminders',
            sound: 'default',
          });
        }
      }
    }
    const daily: [PlannedKind, typeof n.morning][] = [
      ['morning', n.morning],
      ['evening', n.evening],
      ['sleep', n.sleep],
      ['quran', n.quran],
    ];
    for (const [kind, r] of daily) {
      if (r.enabled) push({ id: `${kind}-${key}`, kind, date: at(day, r.time), channel: 'reminders', sound: 'default' });
    }
    if (n.friday.enabled && day.getDay() === 5)
      push({ id: `friday-${key}`, kind: 'friday', date: at(day, n.friday.time), channel: 'reminders', sound: 'default' });
    if (n.fastingDays.enabled) {
      const tags = dayTags(addDays(day, 1), settings.hijriOffset);
      const reason = tags.includes('white_day') ? 'white_day' : tags.includes('monday') ? 'monday' : tags.includes('thursday') ? 'thursday' : null;
      if (reason)
        push({ id: `fasting-${key}`, kind: 'fasting', date: at(day, n.fastingDays.time), channel: 'reminders', sound: 'default', fastingReason: reason });
    }
  }

  const dr = settings.dhikrReminders;
  if (dr.enabled && dhikrCount > 0 && dr.endHour > dr.startHour) {
    let i = 0;
    for (let d = 0; d < DHIKR_DAYS_AHEAD; d++) {
      const day = addDays(startOfDay(now), d);
      for (let m = dr.startHour * 60; m < dr.endHour * 60; m += dr.intervalMinutes) {
        const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
        push({ id: `dhikr-${date.getTime()}`, kind: 'dhikr', date, channel: 'dhikr', sound: null, dhikrIndex: (date.getDate() * 31 + i++) % dhikrCount });
      }
    }
  }

  const future = out.filter((x) => x.date.getTime() > now.getTime() + 5_000);
  const kept = [...future].sort((a, b) => a.priority - b.priority || a.date.getTime() - b.date.getTime()).slice(0, MAX_PENDING);
  return kept.sort((a, b) => a.date.getTime() - b.date.getTime());
}
