import type { BundleData } from './bundle-seed';

/** Loaded lazily (only when seeding) so the JSON is not parsed at app start. */
export function loadBundleData(): BundleData {
  return {
    morningEvening: require('@/content/adhkar/morning-evening.generated.json'),
    hisn: require('@/content/adhkar/hisn.generated.json'),
    forty: require('@/content/hadith/forty.generated.json'),
  };
}
