import { expect, test, type Page } from '@playwright/test';

/**
 * Switching the portal's style from the dashboard. It changes a setting
 * every page reads, so it runs in the shared-switches project, after the
 * others, and always switches back to Classic.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('look-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

async function useStyle(page: Page, name: 'Classic' | 'Ruled' | 'Studio'): Promise<void> {
  await page.goto('/admin');
  const option = page.getByRole('button', { name: new RegExp(`^${name}`) });
  if (await option.isEnabled()) await option.click();
  await expect(page.locator('html')).toHaveAttribute('data-look', name.toLowerCase());
}

test.afterEach(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== 'shared-switches') return;
  const page = await browser.newPage();
  await signIn(page);
  await useStyle(page, 'Classic');
  await page.close();
});

test('the secretariat switches the whole portal between styles', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'shared-switches', 'Changes a shared switch.');

  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Portal style' })).toBeVisible();
  await useStyle(page, 'Ruled');

  // The attendee home is the Ruled one: the event title, the live panel and
  // the section openers, each with its one control on the heading row.
  await page.goto('/?now=2026-12-14T15:10');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'ruled');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Power Summit');
  await expect(page.getByRole('region', { name: 'On now and next' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /How to take\s*part/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /General\s*Q&A/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See the agenda' }).first()).toBeVisible();

  // Nothing makes a phone scroll sideways.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // And back: the Classic home returns.
  await useStyle(page, 'Classic');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'classic');
  await expect(page.getByRole('heading', { name: /How to take\s*part/ })).toHaveCount(0);
});

test('Studio is Ruled underneath, with its own finish on top', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'shared-switches', 'Changes a shared switch.');
  await signIn(page);
  await useStyle(page, 'Studio');
  await page.goto('/?now=2026-12-14T15:10');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'ruled');
  await expect(page.locator('html')).toHaveAttribute('data-look', 'studio');
  await expect(page.getByRole('list', { name: 'The summit in numbers' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'On now and next' })).toBeVisible();
  // Nothing makes a phone scroll sideways.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // Ruled hides the Studio pieces.
  await useStyle(page, 'Ruled');
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'The summit in numbers' })).toBeHidden();
});
