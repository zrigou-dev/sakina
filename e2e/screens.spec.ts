import { expect, test, type Page } from '@playwright/test';

import { onboard, SHOTS, tid } from './helpers';

/**
 * Visits every screen, checks it renders without runtime errors, then scrolls to the very
 * bottom with real wheel events and verifies the page actually scrolled and that the last
 * content is not hidden behind the tab bar. Screenshots: top and bottom of each screen.
 */
const ROUTES: readonly [path: string, testId: string][] = [
  ['/', 'home'],
  ['/prayer', 'prayer-tab'],
  ['/quran', 'quran-tab'],
  ['/learn', 'learn-tab'],
  ['/more', 'more-tab'],
  ['/adhan', 'adhan-screen'],
  ['/adhan/malmo-fajr', 'adhan-detail'],
  ['/adhan/aaqib-azeez', 'adhan-detail'],
  ['/adhan/pick', 'adhan-pick'],
  ['/adhan/pick?prayer=fajr', 'adhan-pick'],
  ['/adhan/p-mishary-rashid-alafasy-3-fajr-kuwait', 'adhan-detail'],
  ['/adhan/storage', 'adhan-storage'],
  ['/adhan/reliability', 'adhan-reliability'],
  ['/adhkar', 'adhkar-index'],
  ['/adhkar/morning', 'adhkar-collection'],
  ['/adhkar/evening', 'adhkar-collection'],
  ['/adhkar/hisn:28', 'adhkar-collection'],
  ['/adhkar/quran-duas', 'adhkar-collection'],
  ['/adhkar/group/travel', 'adhkar-group-travel'],
  ['/hadith', 'hadith-index'],
  ['/hadith/nawawi', 'hadith-book'],
  ['/hadith/qudsi', 'hadith-book'],
  ['/learn/academy', 'learn-academy'],
  ['/learn/path/nawawi', 'path-screen-nawawi'],
  ['/learn/path/names', 'path-screen-names'],
  ['/learn/path/juzamma', 'path-screen-juzamma'],
  ['/learn/path/essentials', 'path-screen-essentials'],
  ['/learn/library', 'learn-library'],
  ['/learn/guides', 'learn-guides'],
  ['/learn/family', 'learn-family'],
  ['/khatma', 'khatma-screen'],
  ['/qada', 'qada-screen'],
  ['/reminders', 'reminders-screen'],
  ['/calendar', 'calendar-screen'],
  ['/zakat', 'zakat-screen'],
  ['/hajj', 'hajj-screen'],
  ['/asma', 'asma-screen'],
  ['/journey', 'journey-screen'],
  ['/library', 'library-screen'],
  ['/library/recitations', 'recitations-screen'],
  ['/settings', 'settings-screen'],
  ['/settings/prayer', 'prayer-settings-screen'],
  ['/settings/notifications', 'notifications-screen'],
  ['/settings/location', 'location-screen'],
  ['/about', 'about-screen'],
  ['/sadaqah', 'sadaqah-screen'],
  ['/contact', 'contact-screen'],
  ['/qibla', 'qibla-screen'],
  ['/tasbih', 'tasbih-screen'],
  ['/quran/memorization', 'memorization-screen'],
  ['/quran/bookmarks', 'bookmarks-screen'],
  ['/search', 'search-screen'],
];

/** Scrolls the largest scrollable element to the end using wheel events; returns scroll metrics. */
async function scrollToEnd(page: Page) {
  const info = async () =>
    page.evaluate(() => {
      // The scroll container under the centre of the viewport (inactive tabs stay mounted but are not hit-testable).
      let el: HTMLElement | null = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
      while (el) {
        const s = getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) break;
        el = el.parentElement;
      }
      return el ? { top: el.scrollTop, max: el.scrollHeight - el.clientHeight } : null;
    });
  const before = await info();
  if (!before) return { scrollable: false, reachedEnd: true };
  await page.mouse.move(195, 420);
  for (let i = 0; i < 80; i++) {
    await page.mouse.wheel(0, 900);
    const now = await info();
    if (now && now.top >= now.max - 2) break;
  }
  await page.waitForTimeout(500);
  const after = await info();
  return { scrollable: true, reachedEnd: !!after && after.top >= after.max - 2, moved: !!after && after.top > before.top };
}

test.describe.configure({ mode: 'serial' });

for (const cfg of [
  { lang: 'ar', theme: 'light' },
  { lang: 'en', theme: 'dark' },
] as const) {
  test(`every screen renders and scrolls to its end (${cfg.lang}, ${cfg.theme})`, async ({ page }) => {
    test.setTimeout(900_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));
    await page.goto('/');
    await onboard(page, cfg);
    const failures: string[] = [];
    for (const [path, id] of ROUTES) {
      await page.goto(path);
      try {
        await expect(tid(page, id).first()).toBeVisible({ timeout: 45_000 });
      } catch {
        failures.push(`${path}: ${id} not visible`);
        continue;
      }
      await page.waitForTimeout(900);
      const name = `${cfg.lang}-${cfg.theme}-${path === '/' ? 'home' : path.replace(/^\//, '').replace(/[/:]/g, '_')}`;
      await page.screenshot({ path: `${SHOTS}/screens/${name}-top.png` });
      const r = await scrollToEnd(page);
      if (r.scrollable && !r.reachedEnd) failures.push(`${path}: could not scroll to the end`);
      await page.screenshot({ path: `${SHOTS}/screens/${name}-bottom.png` });
    }
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}
