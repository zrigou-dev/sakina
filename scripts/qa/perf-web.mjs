#!/usr/bin/env node
/**
 * Web performance probe (headless Chrome, phone viewport). Measures, on a fresh profile:
 *  - time to first interactive screen (onboarding visible)
 *  - first-launch Quran seeding time (until a surah renders in the reader)
 *  - Quran search latency reported by the app (median of several queries)
 *  - reader open time for the longest surah (Al-Baqarah, 286 ayahs)
 *   node scripts/qa/perf-web.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:8089';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Riyadh' })).newPage();
const t = () => performance.now();
const results = {};

let t0 = t();
await page.goto(base);
await page.getByTestId('onboarding').waitFor({ timeout: 120_000 });
results.firstScreenMs = Math.round(t() - t0);

// Seeding runs in the background from app start; measure until the reader can show Al-Fatiha.
t0 = t();
await page.goto(`${base}/quran/1`);
await page.getByTestId('ayah-1-7').waitFor({ timeout: 180_000 });
results.seedAndOpenReaderMs = Math.round(t() - t0);

t0 = t();
await page.goto(`${base}/quran/2`);
await page.getByTestId('ayah-2-1').waitFor({ timeout: 60_000 });
results.openBaqarahMs = Math.round(t() - t0);

const latencies = [];
await page.goto(`${base}/quran/search`);
for (const q of ['رب العالمين', 'الصلاة', 'يا أيها الذين آمنوا', 'الجنة', 'موسى']) {
  await page.getByTestId('quran-search-input').fill(q);
  await page.waitForFunction(
    (query) => document.querySelector('[data-testid="search-count"]')?.textContent?.includes('ms') && document.querySelector('input')?.value === query,
    q,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(400);
  const text = await page.getByTestId('search-count').textContent();
  const m = /([\d٠-٩]+)\s*ms/.exec(text ?? '');
  if (m) latencies.push(Number(m[1].replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
}
latencies.sort((a, b) => a - b);
results.searchLatencyMs = { samples: latencies, median: latencies[Math.floor(latencies.length / 2)] };
console.log(JSON.stringify(results, null, 2));
await browser.close();
