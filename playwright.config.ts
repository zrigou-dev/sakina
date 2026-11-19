import { defineConfig } from '@playwright/test';

/**
 * E2E journeys against the Expo web build.
 * BASE_URL defaults to a local `expo start --web --port 8089` (or a static export served
 * with COOP/COEP headers, see scripts/qa/serve-dist.mjs).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.output/results.json' }]],
  outputDir: 'e2e/.output/artifacts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8089',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    timezoneId: 'Asia/Riyadh',
    locale: 'ar',
    trace: 'retain-on-failure',
  },
});
