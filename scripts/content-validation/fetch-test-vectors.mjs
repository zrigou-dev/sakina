#!/usr/bin/env node
/**
 * Captures INDEPENDENT reference values used by unit tests:
 *  - prayer times from the AlAdhan API (separate implementation from adhan-js)
 *  - Gregorian → Hijri (Umm al-Qura) conversions from the AlAdhan API
 *
 * The fixtures are committed so that tests run offline and deterministically.
 *   node scripts/content-validation/fetch-test-vectors.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tests', 'fixtures');
mkdirSync(out, { recursive: true });

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'sakina-test-vectors/1.0' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const body = await res.json();
  if (body.code !== 200) throw new Error(`${url} → ${JSON.stringify(body).slice(0, 200)}`);
  return body.data;
};

// AlAdhan method ids → SAKINA method ids. School: 0 = Shafi/standard, 1 = Hanafi.
const PRAYER_CASES = [
  { city: 'Makkah', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', aladhanMethod: 4, method: 'umm_al_qura', school: 0 },
  { city: 'Cairo', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', aladhanMethod: 5, method: 'egyptian', school: 0 },
  { city: 'Karachi', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi', aladhanMethod: 1, method: 'karachi', school: 1 },
  { city: 'Paris', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris', aladhanMethod: 3, method: 'muslim_world_league', school: 0 },
  { city: 'New York', lat: 40.7128, lng: -74.006, tz: 'America/New_York', aladhanMethod: 2, method: 'north_america', school: 0 },
  { city: 'Istanbul', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul', aladhanMethod: 13, method: 'turkey', school: 0 },
  { city: 'Dubai', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai', aladhanMethod: 16, method: 'dubai', school: 0 },
  { city: 'Lyon', lat: 45.764, lng: 4.8357, tz: 'Europe/Paris', aladhanMethod: 12, method: 'france_uoif', school: 0 },
  { city: 'Algiers', lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers', aladhanMethod: 19, method: 'algeria', school: 0 },
  { city: 'Casablanca', lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca', aladhanMethod: 21, method: 'morocco', school: 0 },
  { city: 'Tunis', lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis', aladhanMethod: 18, method: 'tunisia', school: 0 },
  { city: 'Kuala Lumpur', lat: 3.139, lng: 101.6869, tz: 'Asia/Kuala_Lumpur', aladhanMethod: 17, method: 'jakim', school: 0 },
  { city: 'Jakarta', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta', aladhanMethod: 20, method: 'kemenag', school: 0 },
  { city: 'Amman', lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman', aladhanMethod: 23, method: 'jordan', school: 0 },
  { city: 'Kuwait City', lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait', aladhanMethod: 9, method: 'kuwait', school: 0 },
  { city: 'Doha', lat: 25.2854, lng: 51.531, tz: 'Asia/Qatar', aladhanMethod: 10, method: 'qatar', school: 0 },
  { city: 'Singapore', lat: 1.3521, lng: 103.8198, tz: 'Asia/Singapore', aladhanMethod: 11, method: 'singapore', school: 0 },
  { city: 'Kazan', lat: 55.7963, lng: 49.1088, tz: 'Europe/Moscow', aladhanMethod: 14, method: 'russia', school: 0 },
  { city: 'Tehran', lat: 35.6892, lng: 51.389, tz: 'Asia/Tehran', aladhanMethod: 7, method: 'tehran', school: 0 },
  { city: 'Abu Dhabi', lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai', aladhanMethod: 8, method: 'gulf', school: 0 },
];
const DATES = ['2026-03-20', '2026-06-21', '2026-12-21'];

const prayer = [];
for (const c of PRAYER_CASES) {
  for (const d of DATES) {
    const [y, m, day] = d.split('-');
    const data = await get(
      `https://api.aladhan.com/v1/timings/${day}-${m}-${y}?latitude=${c.lat}&longitude=${c.lng}&method=${c.aladhanMethod}&school=${c.school}&timezonestring=${encodeURIComponent(c.tz)}`,
    );
    const t = data.timings;
    prayer.push({
      ...c,
      date: d,
      expected: { fajr: t.Fajr, sunrise: t.Sunrise, dhuhr: t.Dhuhr, asr: t.Asr, maghrib: t.Maghrib, isha: t.Isha },
    });
    process.stdout.write('.');
  }
}
writeFileSync(
  join(out, 'prayer-times.aladhan.json'),
  JSON.stringify({ source: 'api.aladhan.com/v1/timings', fetchedAt: new Date().toISOString(), cases: prayer }, null, 2),
);

const HIJRI_DATES = [
  '2024-03-11',
  '2024-04-10',
  '2025-03-01',
  '2025-06-06',
  '2026-02-18',
  '2026-11-18',
  '2027-01-01',
  '2028-05-05',
  '2023-07-19',
  '2030-01-15',
];
const hijri = [];
for (const d of HIJRI_DATES) {
  const [y, m, day] = d.split('-');
  const data = await get(`https://api.aladhan.com/v1/gToH/${day}-${m}-${y}?calendarMethod=UAQ`);
  hijri.push({ gregorian: d, hijri: { day: Number(data.hijri.day), month: data.hijri.month.number, year: Number(data.hijri.year) } });
  process.stdout.write('.');
}
writeFileSync(
  join(out, 'hijri-umalqura.aladhan.json'),
  JSON.stringify({ source: 'api.aladhan.com/v1/gToH?calendarMethod=UAQ', fetchedAt: new Date().toISOString(), cases: hijri }, null, 2),
);
console.log(`\n✓ ${prayer.length} prayer cases, ${hijri.length} hijri cases written to tests/fixtures`);
