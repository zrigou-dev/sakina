import { Coordinates, Qibla } from 'adhan';

export const KAABA = { latitude: 21.4225, longitude: 39.8262 } as const;

/** Initial great-circle bearing from the location to the Kaaba, degrees clockwise from true north. */
export function qiblaBearing(latitude: number, longitude: number): number {
  return Qibla(new Coordinates(latitude, longitude));
}

/** Great-circle distance in kilometres (haversine). */
export function distanceToKaabaKm(latitude: number, longitude: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(KAABA.latitude - latitude);
  const dLng = toRad(KAABA.longitude - longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latitude)) * Math.cos(toRad(KAABA.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Normalises an angle to [0, 360). */
export function normalizeDegrees(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** Signed smallest rotation from `heading` to `bearing`, in (-180, 180]. Positive = turn clockwise. */
export function relativeAngle(heading: number, bearing: number): number {
  const d = normalizeDegrees(bearing - heading);
  return d > 180 ? d - 360 : d;
}

export type HeadingQuality = 'good' | 'fair' | 'poor' | 'unavailable';

/**
 * expo-location heading accuracy: on iOS a value in degrees (lower is better, <0 invalid);
 * on Android an enum 0..3 (3 = high). Mapped to a single quality scale.
 */
export function headingQuality(accuracy: number | null | undefined, platform: 'ios' | 'android' | 'web'): HeadingQuality {
  if (accuracy == null || platform === 'web') return 'unavailable';
  if (platform === 'android') {
    if (accuracy >= 3) return 'good';
    if (accuracy === 2) return 'fair';
    return 'poor';
  }
  if (accuracy < 0) return 'unavailable';
  if (accuracy <= 15) return 'good';
  if (accuracy <= 35) return 'fair';
  return 'poor';
}

/** "Facing the Qibla" tolerance in degrees. */
export const ALIGNED_TOLERANCE = 5;
