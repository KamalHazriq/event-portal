import { expect, test, type Page } from '@playwright/test';

/**
 * Module 6, several admins at once: each desk sees who else is signed in,
 * and what was done shows in a shared log.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page, label: string): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill(label);
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the admins page needs the PIN', async ({ page }) => {
  await page.goto('/admin/admins');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test('two desks see each other, and the log records what was done', async ({ browser }) => {
  // Labels unique to this run, so the phone and desktop projects do not collide.
  const tag = Math.random().toString(36).slice(2, 6);
  const first = await browser.newPage();
  const second = await browser.newPage();
  await signIn(first, `one-${tag}`);
  await signIn(second, `two-${tag}`);

  await first.goto('/admin/headcount');
  await second.goto('/admin/admins');

  const desks = second.locator('section').first();
  await expect(desks.getByText(`two-${tag}`)).toBeVisible();
  await expect(desks.getByText('You', { exact: true })).toBeVisible();
  await expect(desks.locator('li', { hasText: `one-${tag}` })).toContainText('Headcount, here now');

  // Signing in is itself logged, under the desk's label.
  const log = second.locator('ol');
  await expect(log.locator('li', { hasText: `one-${tag}` }).first()).toContainText('Signed in');
});

test('every page in the admin navigation opens', async ({ page }) => {
  await signIn(page, 'desk-test');
  const links = await page
    .getByRole('navigation', { name: 'Secretariat' })
    .first()
    .getByRole('link')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(links.length).toBeGreaterThan(10);
  for (const href of links) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});
