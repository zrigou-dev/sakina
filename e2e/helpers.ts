import { expect, type Page } from '@playwright/test';

export const SHOTS = 'e2e/screenshots';

export const tid = (page: Page, id: string) => page.getByTestId(id);

/** Waits for the app shell: either onboarding or the home tab. */
export async function waitForApp(page: Page) {
  await expect(page.locator('[data-testid="onboarding"], [data-testid="home"]').first()).toBeVisible({ timeout: 90_000 });
}

export async function shot(page: Page, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Completes onboarding choosing a city via search (the "location denied" path). */
export async function onboard(page: Page, opts: { lang?: 'ar' | 'en' | 'fr'; theme?: 'light' | 'dark' | 'system'; city?: string; screenshots?: boolean } = {}) {
  const { lang = 'ar', theme = 'light', city = 'Makkah', screenshots = false } = opts;
  await waitForApp(page);
  await expect(tid(page, 'onboarding')).toBeVisible();
  if (screenshots) await shot(page, `onboarding-0-welcome-${lang}`);
  await tid(page, 'onboarding-next').click();
  await tid(page, `lang-${lang}`).click();
  if (screenshots) await shot(page, `onboarding-1-language-${lang}`);
  await tid(page, 'onboarding-next').click();
  await tid(page, `theme-${theme}`).click();
  await tid(page, 'onboarding-next').click();
  await tid(page, 'choose-city').click();
  await tid(page, 'city-search').fill(city);
  await page.locator('[data-testid^="city-result-"]').first().click();
  await expect(tid(page, 'location-set')).toBeVisible();
  if (screenshots) await shot(page, `onboarding-3-location-${lang}`);
  await tid(page, 'onboarding-next').click();
  if (screenshots) await shot(page, `onboarding-4-method-${lang}`);
  await tid(page, 'onboarding-next').click();
  await tid(page, 'onboarding-next').click();
  if (screenshots) await shot(page, `onboarding-6-finish-${lang}`);
  await tid(page, 'onboarding-next').click();
  await expect(tid(page, 'home')).toBeVisible();
}

export async function dir(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.dir);
}

/** Taps the visible header back button (web keeps earlier stack screens mounted but hidden). */
export async function back(page: Page) {
  await page.getByTestId('header-back').filter({ visible: true }).last().click();
}
