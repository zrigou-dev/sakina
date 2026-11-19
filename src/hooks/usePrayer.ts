import { useMemo } from 'react';

import { useSettings } from '@/runtime/AppProvider';
import { calculateDay, nextPrayer, type PrayerConfig } from '@/services/prayer/times';
import type { Settings } from '@/state/settings';
import { toISODate } from '@/utils/date';

export function prayerConfigFrom(settings: Settings): PrayerConfig | null {
  if (!settings.location) return null;
  return {
    latitude: settings.location.latitude,
    longitude: settings.location.longitude,
    method: settings.prayer.method,
    madhab: settings.prayer.madhab,
    highLatitudeRule: settings.prayer.highLatitudeRule,
    adjustments: settings.prayer.adjustments,
  };
}

export function usePrayerConfig(): PrayerConfig | null {
  const [settings] = useSettings();
  return useMemo(() => prayerConfigFrom(settings), [settings]);
}

/** Today's schedule (recomputed when the calendar day changes) and the live next prayer. */
export function usePrayerTimes(now: Date) {
  const config = usePrayerConfig();
  const dayKey = toISODate(now);
  const schedule = useMemo(() => (config ? calculateDay(config, now) : null), [config, dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = config ? nextPrayer(config, now) : null;
  return { config, schedule, next };
}
