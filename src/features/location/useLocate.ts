import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { nearestCity } from '@/services/location/cities';
import type { SavedLocation } from '@/state/settings';

export type LocateState = 'idle' | 'locating' | 'denied' | 'failed';

/** Requests foreground location once and resolves to a SavedLocation named from the bundled city list. */
export function useLocate() {
  const [state, setState] = useState<LocateState>('idle');
  const locate = useCallback(async (): Promise<SavedLocation | null> => {
    setState('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setState('denied');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const city = nearestCity(latitude, longitude);
      setState('idle');
      return {
        source: 'gps',
        latitude: Math.round(latitude * 1e4) / 1e4,
        longitude: Math.round(longitude * 1e4) / 1e4,
        name: city?.name ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
        nameAr: city?.nameAr ?? null,
        country: city?.country ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      };
    } catch {
      setState('failed');
      return null;
    }
  }, []);
  return { state, locate, reset: () => setState('idle') };
}
