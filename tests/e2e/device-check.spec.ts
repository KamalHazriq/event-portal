import { expect, test } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('the device check needs the PIN, then reports on this browser', async ({ page, request }) => {
  await page.goto('/admin/device-check');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.getByLabel('Which desk is this?').fill('device-check');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Device check', level: 1 })).toBeVisible();
  await expect(page.getByText('Speed to the portal')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Clock', { exact: true })).toBeVisible();
  await expect(page.getByText('Secure connection')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy the results' })).toBeEnabled();

  // The clock the page compares against is public and holds nothing else.
  const body = await (await request.get('/api/time')).json();
  expect(Object.keys(body)).toEqual(['now']);
});
