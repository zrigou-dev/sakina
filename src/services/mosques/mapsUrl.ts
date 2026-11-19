export type MapsPlatform = 'ios' | 'android' | 'web';

/**
 * Deep link that opens the device's own maps app on a "mosque" search around a point.
 * SAKINA never sends the position itself: the user's map application receives it only when they tap the row.
 */
export function mosqueSearchUrl(latitude: number, longitude: number, platform: MapsPlatform): string {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  if (platform === 'android') return `geo:${lat},${lon}?q=${encodeURIComponent('mosque')}`;
  if (platform === 'ios') return `https://maps.apple.com/?q=${encodeURIComponent('mosque')}&sll=${lat},${lon}&z=14`;
  return `https://www.google.com/maps/search/mosque/@${lat},${lon},14z`;
}
