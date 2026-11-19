import { expect, test } from '@playwright/test';

/** Insights: behind the PIN, and shows the rules' output and the numbers. */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('insights needs the PIN', async ({ page }) => {
  await page.goto('/admin/insights');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test('insights shows what needs attention, the numbers and arrivals', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-insights');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();

  await page.goto('/admin/insights');
  await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible();
  await expect(page.getByText(/no AI/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByText('Guests on the list')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Arrivals per 15 minutes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Liveliest sessions' })).toBeVisible();
});
