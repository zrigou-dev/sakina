import { expect, test, type Page } from '@playwright/test';

import { back, dir, onboard, shot, tid } from './helpers';

/**
 * Core user journeys on the web build. Each test starts from a fresh browser
 * context (fresh OPFS/SQLite), i.e. a first installation.
 */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('first launch → Arabic onboarding (RTL) → all tabs', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page, { lang: 'ar' });
  expect(await dir(page)).toBe('rtl');
  await expect(tid(page, 'greeting')).toBeVisible();
  await shot(page, 'home-ar-light');
  for (const tab of ['prayer', 'quran', 'learn', 'more'] as const) {
    await tid(page, `tab-${tab}`).click();
    await expect(tid(page, `${tab}-tab`)).toBeVisible();
    await shot(page, `tab-${tab}-ar-light`);
  }
  await tid(page, 'tab-index').click();
  await expect(tid(page, 'home')).toBeVisible();
  expect(errors).toEqual([]);
});

test('read the Quran, bookmark an ayah, continue from last read after reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await tid(page, 'tab-quran').click();
  await tid(page, 'surah-36').click();
  await expect(tid(page, 'reader')).toBeVisible();
  await expect(tid(page, 'basmala')).toBeVisible();
  await expect(tid(page, 'ayah-36-1')).toBeVisible();
  await shot(page, 'reader-36-ar-light');
  await tid(page, 'ayah-36-3').click();
  await expect(tid(page, 'ayah-sheet')).toBeVisible();
  await shot(page, 'reader-ayah-sheet-ar');
  await tid(page, 'action-bookmark').click();
  await expect(tid(page, 'ayah-36-3').getByText('تم وضع العلامة')).toBeVisible();
  // Last-read position is recorded from visible ayahs.
  await page.waitForTimeout(2500);
  // Reopen the app (new page load at the root) and check persistence.
  await page.goto('/');
  await expect(tid(page, 'home')).toBeVisible({ timeout: 60_000 });
  await expect(tid(page, 'continue-reading')).toContainText('يس');
  await tid(page, 'tab-quran').click();
  await tid(page, 'quran-bookmarks').click();
  await expect(tid(page, 'bookmark-36-3')).toBeVisible();
  await shot(page, 'bookmarks-ar');
  expect(errors).toEqual([]);
});

test('search Quran text with and without diacritics', async ({ page }) => {
  await page.goto('/');
  await onboard(page);
  await tid(page, 'tab-quran').click();
  await tid(page, 'quran-search').click();
  await tid(page, 'quran-search-input').fill('رب العالمين');
  await expect(tid(page, 'hit-1-2')).toBeVisible();
  await shot(page, 'quran-search-ar');
  await tid(page, 'quran-search-input').fill('الْحَمْدُ لِلَّهِ');
  await expect(tid(page, 'hit-1-2')).toBeVisible();
  await tid(page, 'hit-1-2').click();
  await expect(tid(page, 'reader')).toBeVisible();
  // Jump to mushaf page 604 (starts at Al-Ikhlas 112:1) and to hizb 60 via the Go-to sheet.
  await back(page);
  await back(page);
  await tid(page, 'quran-jump').click();
  await tid(page, 'jump-a').fill('604');
  await tid(page, 'jump-go').click();
  await expect(tid(page, 'ayah-112-1')).toBeVisible();
});

test('complete a Hisn al-Muslim chapter with the counter; morning adhkar render', async ({ page }) => {
  await page.goto('/');
  await onboard(page);
  await page.goto('/adhkar/morning');
  await expect(tid(page, 'adhkar-collection')).toBeVisible();
  await expect(tid(page, 'count-me:1')).toBeVisible();
  await shot(page, 'adhkar-morning-ar');
  await page.goto('/adhkar/hisn:9');
  await expect(tid(page, 'adhkar-collection')).toBeVisible();
  for (const n of [1, 2, 3]) await tid(page, `count-hisn:9:${n}`).click();
  await expect(page.getByText('أتممت هذه الأذكار اليوم')).toBeVisible();
  await shot(page, 'adhkar-completed-ar');
});

test('switch to English (LTR) and French, then dark theme; settings persist after reload', async ({ page }) => {
  await page.goto('/');
  await onboard(page);
  await page.goto('/settings');
  await expect(tid(page, 'settings-screen')).toBeVisible();
  await tid(page, 'settings-language').getByText('English').click();
  expect(await dir(page)).toBe('ltr');
  await expect(page.getByText('Settings').first()).toBeVisible();
  await shot(page, 'settings-en-light');
  await tid(page, 'settings-language').getByText('Français').click();
  await expect(page.getByText('Réglages').first()).toBeVisible();
  await tid(page, 'settings-theme').getByText('Minuit (sombre)').click();
  await shot(page, 'settings-fr-dark');
  await page.reload();
  await expect(tid(page, 'settings-screen')).toBeVisible({ timeout: 60_000 });
  expect(await dir(page)).toBe('ltr');
  await expect(page.getByText('Réglages').first()).toBeVisible();
  await page.goto('/');
  await expect(tid(page, 'home')).toBeVisible();
  await shot(page, 'home-fr-dark');
  await tid(page, 'tab-quran').click();
  await shot(page, 'tab-quran-fr-dark');
  await tid(page, 'surah-1').click();
  await expect(tid(page, 'reader')).toBeVisible();
  await shot(page, 'reader-1-fr-dark');
});

test('English onboarding end-to-end with manual coordinates (location denied path)', async ({ page }) => {
  await page.goto('/');
  await expect(tid(page, 'onboarding')).toBeVisible({ timeout: 90_000 });
  await tid(page, 'onboarding-next').click();
  await tid(page, 'lang-en').click();
  expect(await dir(page)).toBe('ltr');
  await tid(page, 'onboarding-next').click();
  await tid(page, 'theme-light').click();
  await tid(page, 'onboarding-next').click();
  await tid(page, 'choose-city').click();
  await tid(page, 'city-manual').click();
  await tid(page, 'manual-lat').fill('200');
  await tid(page, 'manual-lng').fill('10');
  await tid(page, 'manual-save').click();
  await expect(page.getByText('Please enter a latitude between')).toBeVisible();
  await tid(page, 'manual-name').fill('London');
  await tid(page, 'manual-lat').fill('51.5074');
  await tid(page, 'manual-lng').fill('-0.1278');
  await tid(page, 'manual-save').click();
  await expect(tid(page, 'location-set')).toContainText('London');
  await tid(page, 'onboarding-next').click();
  await shot(page, 'onboarding-method-en');
  await tid(page, 'onboarding-next').click();
  await tid(page, 'onboarding-next').click();
  await tid(page, 'onboarding-next').click();
  await expect(tid(page, 'home')).toBeVisible();
  await shot(page, 'home-en-light');
  await tid(page, 'tab-prayer').click();
  await expect(tid(page, 'prayer-schedule')).toBeVisible();
  await tid(page, 'log-fajr').click();
  await shot(page, 'tab-prayer-en-light');
});

test('works fully offline after first load (network blocked)', async ({ page, context }) => {
  await page.goto('/');
  await onboard(page);
  // From here on there is no network at all; navigation happens inside the app as on a phone.
  // Block every external request. (Not `setOffline`: the production *web* build lazy-loads its own route chunks from the
  // local server, which a native app — everything is in the bundle — never does.)
  await context.route(
    (url) => !url.href.startsWith(new URL(page.url()).origin),
    (r) => r.abort(),
  );

  await tid(page, 'tab-more').click();
  await tid(page, 'more-library').click();
  await expect(tid(page, 'library-screen')).toBeVisible();
  await shot(page, 'library-ar');
  await tid(page, 'download-translation.en.sahih').click();
  await expect(tid(page, 'pkg-error-translation.en.sahih')).toBeVisible();
  await shot(page, 'library-offline-error-ar');
  await back(page);

  await tid(page, 'tab-quran').click();
  await tid(page, 'surah-2').click();
  await expect(tid(page, 'ayah-2-1')).toBeVisible({ timeout: 60_000 });
  await shot(page, 'reader-2-offline');
  await back(page);

  await tid(page, 'tab-index').click();
  await tid(page, 'tool-calendar').click();
  await expect(tid(page, 'calendar-screen')).toBeVisible();
  await shot(page, 'calendar-ar');
  await back(page);

  await tid(page, 'tool-zakat').click();
  await tid(page, 'zakat-cash').fill('10000');
  await tid(page, 'zakat-silverPricePerGram').fill('1');
  await expect(tid(page, 'zakat-due')).toHaveText('250');
  await shot(page, 'zakat-ar');
  await back(page);

  await tid(page, 'tool-qibla').click();
  await expect(tid(page, 'qibla-screen')).toBeVisible();
  await shot(page, 'qibla-ar');
  await back(page);

  await tid(page, 'tool-tasbih').click();
  for (let i = 0; i < 5; i++) await tid(page, 'tasbih-tap').click();
  await expect(tid(page, 'tasbih-count')).toHaveText('5');
  await shot(page, 'tasbih-ar');
});

test('large text and remaining screens render', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/settings');
  for (let i = 0; i < 6; i++) await tid(page, 'settings-font-scale').getByRole('button').last().click();
  await page.goto('/');
  await expect(tid(page, 'home')).toBeVisible();
  await shot(page, 'home-ar-largetext');
  for (const [path, id, name] of [
    ['/hajj', 'hajj-screen', 'hajj-ar'],
    ['/asma', 'asma-screen', 'asma-ar'],
    ['/journey', 'journey-screen', 'journey-ar'],
    ['/about', 'about-screen', 'about-ar'],
    ['/adhkar', 'adhkar-index', 'adhkar-index-ar'],
    ['/quran/memorization', 'memorization-screen', 'memorization-ar'],
    ['/learn/academy', 'learn-academy', 'learn-academy-ar'],
    ['/settings/notifications', 'notifications-screen', 'notifications-ar'],
    ['/settings/prayer', 'prayer-settings-screen', 'prayer-settings-ar'],
  ] as const) {
    await page.goto(path);
    await expect(tid(page, id)).toBeVisible();
    await shot(page, name);
  }
  expect(errors).toEqual([]);
});
