import { expect, test } from '@playwright/test';

/** The self check in kiosk: behind the PIN, no menus, and asks for a card. */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('the kiosk needs the PIN, then waits for a card', async ({ page }) => {
  await page.goto('/kiosk');
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fkiosk/);
  await page.getByLabel('Which desk is this?').fill('kiosk-1');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(page.getByRole('heading', { name: 'Check yourself in' })).toBeVisible();
  await expect(page.getByText(/business card in your TNB app/)).toBeVisible();
  // Nothing to wander off to.
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
