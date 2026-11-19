import { expect, test, type Page } from '@playwright/test';

import { back, onboard, shot, tid } from './helpers';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('adhan library: instant preview, filters, muezzin + attribution, Fajr-only rule, per-prayer choices persist', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/adhan');
  await expect(tid(page, 'adhan-screen')).toBeVisible();

  // The bundled 30 s preview plays instantly (offline) and the control flips to "stop".
  const preview = tid(page, 'adhan-preview-aaqib-azeez');
  await preview.scrollIntoViewIfNeeded();
  await preview.click();
  await expect(preview).toHaveAttribute('aria-label', /إيقاف|Stop/, { timeout: 20_000 });
  await shot(page, 'adhan-hub-playing-ar');
  await preview.click();
  await expect(preview).toHaveAttribute('aria-label', /استماع|Preview/);

  // Filters: Fajr shows only the Fajr adhan.
  await tid(page, 'adhan-filter-fajr').click();
  await expect(tid(page, 'adhan-malmo-fajr')).toBeVisible();
  await expect(tid(page, 'adhan-aaqib-azeez')).toHaveCount(0);
  await tid(page, 'adhan-filter-all').click();
  await expect(tid(page, 'adhan-aaqib-azeez')).toBeVisible();

  // Details: the muezzin is named, attribution is complete, the full recording plays.
  await tid(page, 'adhan-open-malmo-fajr').click();
  await expect(tid(page, 'adhan-detail')).toBeVisible();
  await expect(tid(page, 'adhan-muezzin')).toContainText('Besim Azemi');
  await expect(tid(page, 'adhan-attribution')).toContainText('CC BY 3.0');
  await expect(tid(page, 'adhan-attribution')).toContainText('Islamic Center Malmö');
  // A Fajr-only adhan can only be assigned to Fajr (it contains the extra Fajr phrase).
  await expect(tid(page, 'adhan-use-fajr')).toBeVisible();
  await expect(tid(page, 'adhan-use-dhuhr')).toHaveCount(0);
  await expect(tid(page, 'adhan-use-default')).toHaveCount(0);
  await tid(page, 'adhan-play-full').click();
  await expect(tid(page, 'adhan-play-full')).toHaveText(/إيقاف|Stop/, { timeout: 20_000 });
  await tid(page, 'adhan-play-full').click();
  await back(page);

  // Per-prayer sheets: Dhuhr never offers the Fajr adhan; Fajr offers both. Mute Isha; it survives a reload.
  await tid(page, 'adhan-row-dhuhr').click();
  await expect(tid(page, 'prayer-sheet-dhuhr')).toBeVisible();
  await tid(page, 'prayer-voice-dhuhr').click();
  await expect(tid(page, 'adhan-pick')).toBeVisible();
  await expect(tid(page, 'pick-voice-aaqib-azeez')).toBeVisible();
  await expect(tid(page, 'pick-voice-malmo-fajr')).toHaveCount(0);
  await tid(page, 'pick-cancel').click();
  await expect(tid(page, 'adhan-screen')).toBeVisible();
  await tid(page, 'adhan-row-fajr').click();
  await tid(page, 'prayer-voice-fajr').click();
  await expect(tid(page, 'pick-voice-malmo-fajr')).toBeVisible();
  await expect(tid(page, 'pick-voice-aaqib-azeez')).toBeVisible();
  await tid(page, 'pick-voice-aaqib-azeez').click();
  await tid(page, 'pick-confirm').click();
  await expect(tid(page, 'adhan-screen')).toBeVisible();
  await tid(page, 'adhan-row-isha').click();
  await tid(page, 'adhan-sound-isha').getByRole('radio').last().click();
  await page.reload();
  await expect(tid(page, 'adhan-screen')).toBeVisible({ timeout: 60_000 });
  await expect(tid(page, 'adhan-row-fajr')).toContainText(/عاقب عزيز|Aaqib Azeez/);
  await tid(page, 'adhan-row-isha').click();
  await expect(tid(page, 'adhan-sound-isha').getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('adhan voice picker: searchable list of reciters, cloud icon for undownloaded, radio, own file, Confirm/Cancel', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/adhan');
  await tid(page, 'adhan-all-voices').click();
  await expect(tid(page, 'adhan-pick')).toBeVisible();
  await shot(page, 'adhan-pick-ar');

  // Search by Arabic and Latin names; an undownloaded voice shows the cloud download icon and the personal-use badge.
  await tid(page, 'pick-search-toggle').click();
  await tid(page, 'pick-search').fill('العفاسي');
  const alafasy = page.locator('[data-testid^="pick-voice-p-mishary-rashid-alafasy"]').first();
  await expect(alafasy).toBeVisible();
  await expect(page.locator('[data-testid^="pick-download-p-mishary"]').first()).toBeVisible();
  await expect(tid(page, 'pick-voice-aaqib-azeez')).toHaveCount(0);
  await tid(page, 'pick-search').fill('alafasy');
  await expect(alafasy).toBeVisible();
  await tid(page, 'pick-search').fill('zzzzzz-no-such-voice');
  await expect(alafasy).toHaveCount(0);
  await tid(page, 'pick-search-toggle').click();

  // Radio selection is staged until Confirm; Cancel keeps the old choice.
  await tid(page, 'pick-voice-aaqib-azeez').click();
  await expect(tid(page, 'pick-voice-aaqib-azeez')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'pick-cancel').click();
  await expect(tid(page, 'adhan-screen')).toBeVisible();

  // "More…" is there; on the web preview it explains that own files need the mobile app.
  await tid(page, 'adhan-all-voices').click();
  await tid(page, 'pick-more').click();
  await expect(tid(page, 'adhan-pick')).toContainText(/الجوال|mobile/i);
  await tid(page, 'pick-confirm').click();
  await expect(tid(page, 'adhan-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('adhan: test button plays the real adhan with the overlay; storage and reliability screens work', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/adhan/reliability');
  await expect(tid(page, 'adhan-reliability')).toBeVisible();
  await tid(page, 'adhan-test-now').click();
  await expect(tid(page, 'adhan-overlay')).toBeVisible({ timeout: 30_000 });
  await shot(page, 'adhan-overlay-ar');
  await tid(page, 'adhan-stop').click();
  await tid(page, 'adhan-dismiss').click();
  await expect(tid(page, 'adhan-overlay')).toHaveCount(0);

  await page.goto('/adhan/storage');
  await expect(tid(page, 'adhan-storage')).toBeVisible();
  await expect(tid(page, 'adhan-storage-used')).toBeVisible();
  await shot(page, 'adhan-storage-ar');
  expect(errors).toEqual([]);
});

test('hadith: search, read a collection, bookmark and see it in bookmarks', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/hadith');
  await expect(tid(page, 'hadith-index')).toBeVisible();
  await tid(page, 'hadith-search').fill('النيات');
  await expect(tid(page, 'hadith-search-count')).toBeVisible();
  await expect(tid(page, 'hadith-nawawi-1')).toBeVisible();
  await shot(page, 'hadith-search-ar');
  await tid(page, 'hadith-search').fill('');
  await tid(page, 'hadith-open-nawawi').click();
  await expect(tid(page, 'hadith-book')).toBeVisible();
  await tid(page, 'hadith-bookmark-nawawi-1').click();
  await expect(tid(page, 'hadith-bookmark-nawawi-1')).toHaveAttribute('aria-selected', 'true');
  // Deep link from "hadith of the day" scrolls to a later hadith (beyond the first page render).
  await page.goto('/hadith/qudsi?n=35');
  await expect(tid(page, 'hadith-qudsi-35')).toBeInViewport({ timeout: 30_000 });
  await page.goto('/hadith');
  await expect(tid(page, 'hadith-index').getByTestId('hadith-nawawi-1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reminders: periodic dhikr and after-prayer settings persist', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/reminders');
  await expect(tid(page, 'reminders-screen')).toBeVisible();
  const periodic = tid(page, 'dhikr-periodic');
  await expect(periodic).toHaveAttribute('aria-checked', 'false');
  await periodic.click();
  await expect(periodic).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'reminders-ar');
  await page.reload();
  await expect(tid(page, 'dhikr-periodic')).toHaveAttribute('aria-checked', 'true', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('khatma plan: start, mark a day, progress; qada counters', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/khatma');
  await tid(page, 'khatma-30').click();
  await expect(tid(page, 'khatma-read')).toBeVisible();
  await tid(page, 'khatma-day-1').click();
  await expect(tid(page, 'khatma-day-1')).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'khatma-ar');
  await tid(page, 'khatma-read').click();
  await expect(tid(page, 'reader')).toBeVisible({ timeout: 60_000 });
  await expect(tid(page, 'ayah-1-1')).toBeVisible();

  await page.goto('/qada');
  const fajr = tid(page, 'qada-fajr');
  for (let i = 0; i < 3; i++) await fajr.getByRole('button').last().click();
  await expect(fajr).toContainText('3');
  await fajr.getByRole('button').first().click();
  await expect(fajr).toContainText('2');
  await page.reload();
  await expect(tid(page, 'qada-fajr')).toContainText('2', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('guides open Hisn chapters; kids quiz accepts the right answer', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  await page.goto('/learn/guides');
  await expect(tid(page, 'learn-guides')).toBeVisible();
  const first = page.locator('[data-testid^="guide-"]').first();
  await first.locator('[role="button"]').first().click(); // collapse
  await first.locator('[role="button"]').first().click(); // expand again
  await first.locator('[role="button"]').nth(1).click(); // first chapter
  await expect(tid(page, 'adhkar-collection')).toBeVisible();
  await expect(page.locator('[data-testid^="dhikr-hisn:"]').first()).toBeVisible();

  await page.goto('/learn/family');
  const quiz = tid(page, 'quiz-names');
  await expect(quiz).toBeVisible();
  const options = quiz.locator('[data-testid^="quiz-option-"]');
  await expect(options).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await options.nth(i).click();
    if (await tid(page, 'quiz-next-names').isVisible()) break;
  }
  await expect(tid(page, 'quiz-next-names')).toBeVisible();
  await expect(quiz).toContainText('1');
  await shot(page, 'kids-quiz-ar');
  await tid(page, 'quiz-next-names').click();
  await expect(tid(page, 'quiz-next-names')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sadaqah jariyah page and contact: reachable, sincere, real sources, correct mailto draft', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await onboard(page);
  // Capture the link the app opens instead of leaving the page.
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((u?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(u));
      return null;
    }) as typeof window.open;
  });
  await page.goto('/more');
  await tid(page, 'more-sadaqah').click();
  await expect(tid(page, 'sadaqah-screen')).toBeVisible();
  await expect(tid(page, 'sadaqah-hero')).toContainText('صدقةً جارية');
  await expect(tid(page, 'sadaqah-request')).toContainText('والديّ');
  await expect(tid(page, 'sadaqah-hadith')).toContainText('صَدَقَةٍ جَارِيَةٍ');
  await expect(tid(page, 'sadaqah-hadith')).toContainText('1631');
  await expect(tid(page, 'sadaqah-ayah-17-24')).toBeVisible();
  await expect(tid(page, 'sadaqah-ayah-14-41')).toBeVisible();
  await expect(tid(page, 'sadaqah-ayah-71-28')).toBeVisible();
  await shot(page, 'sadaqah-ar');

  await tid(page, 'sadaqah-contact-row').click();
  await expect(tid(page, 'contact-screen')).toBeVisible();
  await expect(tid(page, 'contact-email')).toHaveText('zrigoudev@gmail.com');
  await expect(tid(page, 'contact-privacy')).toBeVisible();
  await shot(page, 'contact-ar');

  await tid(page, 'contact-report').click();
  await tid(page, 'contact-suggest').click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(2);
  for (const url of opened) expect(url.startsWith('mailto:zrigoudev@gmail.com?subject=')).toBe(true);
  const report = new URL(opened[0]!.replace('mailto:', 'https://x.invalid/'));
  expect(report.searchParams.get('subject')).toContain('SAKINA');
  expect(report.searchParams.get('body')).toMatch(/SAKINA .* · (web|android|ios) .* · ar/);
  await back(page);
  await back(page);
  await tid(page, 'more-contact').click();
  await expect(tid(page, 'contact-screen')).toBeVisible();
  expect(errors).toEqual([]);
});
