import { expect, test } from '@playwright/test';

/** Know before you go: config driven, and unsettled lines read "Coming soon". */

test('the info page shows the details, with unconfirmed ones as coming soon', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Know before you go' }).first().click();
  await expect(page).toHaveURL(/\/info/);
  await expect(page.getByRole('heading', { name: 'Know before you go', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Getting there' })).toBeVisible();
  await expect(page.getByText('Grand Ballroom, Level 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Coming soon')).toBeVisible();
  await expect(page.getByText('To confirm')).toHaveCount(0);
});
