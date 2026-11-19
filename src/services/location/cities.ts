import { normalizeArabic, normalizeLatin } from '@/services/search/normalize';

export interface City {
  readonly id: number;
  readonly name: string;
  readonly nameAr: string | null;
  readonly country: string;
  readonly countryName: string;
  readonly countryNameAr: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly tz: string;
  readonly pop: number;
}

interface IndexedCity {
  readonly city: City;
  readonly latin: string;
  readonly arabic: string;
}

let index: IndexedCity[] | null = null;

/** Lazily loads the bundled GeoNames list (≈2.5k cities) only when needed. */
function load(): IndexedCity[] {
  if (!index) {
    const cities = require('@/content/cities.generated.json') as City[];
    index = cities.map((city) => ({
      city,
      latin: normalizeLatin(`${city.name} ${city.countryName}`),
      arabic: city.nameAr ? normalizeArabic(`${city.nameAr} ${city.countryNameAr ?? ''}`) : '',
    }));
  }
  return index;
}

/** Prefix-first search across Latin and Arabic names, ordered by population. */
export function searchCities(query: string, limit = 40): City[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const arabic = /[\u0600-\u06FF]/.test(q);
  const nq = arabic ? normalizeArabic(q) : normalizeLatin(q);
  if (!nq) return [];
  const prefix: City[] = [];
  const contains: City[] = [];
  for (const c of load()) {
    const hay = arabic ? c.arabic : c.latin;
    if (!hay) continue;
    if (hay.startsWith(nq) || hay.includes(` ${nq}`)) prefix.push(c.city);
    else if (hay.includes(nq)) contains.push(c.city);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Nearest bundled city to a coordinate (used to name a GPS location without any network call). */
export function nearestCity(lat: number, lng: number, maxKm = 80): City | null {
  const toRad = (d: number) => (d * Math.PI) / 180;
  let best: City | null = null;
  let bestKm = Infinity;
  for (const { city } of load()) {
    const dLat = toRad(city.lat - lat);
    const dLng = toRad(city.lng - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(city.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  return bestKm <= maxKm ? best : null;
}
