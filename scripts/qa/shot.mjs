#!/usr/bin/env node
/**
 * Visual QA helper: opens the web build in headless Chromium at phone size,
 * optionally seeds settings via the onboarding flow, and saves screenshots.
 *
 *   node scripts/qa/shot.mjs <url> <out.png> [--dark] [--wait=ms] [--width=390] [--height=844]
 * Console errors are printed so rendering problems are visible.
 */
import { chromium } from '@playwright/test';

const [url = 'http://localhost:8081', out = 'shot.png', ...flags] = process.argv.slice(2);
const opt = Object.fromEntries(flags.map((f) => f.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: Number(opt.width ?? 390), height: Number(opt.height ?? 844) },
  deviceScaleFactor: 2,
  colorScheme: opt.dark ? 'dark' : 'light',
  timezoneId: opt.tz ?? 'Europe/Paris',
  locale: opt.locale ?? 'ar',
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 400));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
await page.waitForTimeout(Number(opt.wait ?? 6000));
await page.screenshot({ path: out, fullPage: !!opt.full });
console.log('saved', out);
await browser.close();
