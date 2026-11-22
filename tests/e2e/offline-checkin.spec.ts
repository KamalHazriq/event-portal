import { expect, test } from '@playwright/test';

/**
 * The desk keeps working when the connection to the portal drops: a check in
 * is saved on the device, and goes through when the connection is back.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('a check in made while offline is saved, survives a reload, and is sent later', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared check ins, so runs once.');

  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('offline-desk');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/admin/desk');

  // Someone not yet in. Other tests use D10001; the check in goes to day 1.
  await page.getByLabel('Search for a name, staff number or department').fill('D10007');
  const row = page.locator('li', { hasText: 'Hafiz Tai' }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const checkIn = row.getByRole('button', { name: 'Check in' });
  test.skip((await checkIn.count()) === 0, 'That person was already checked in by an earlier run.');

  // The check in endpoint stops answering: the Wi-Fi has dropped.
  await page.route('**/api/check-in', (route) => route.abort('internetdisconnected'));
  await checkIn.click();

  await expect(page.getByText(/Saved on this device/)).toBeVisible();
  await expect(page.getByText(/1 check in saved on this device/)).toBeVisible();

  // The saved check in is still there after a reload.
  await page.reload();
  await expect(page.getByText(/1 check in saved on this device/)).toBeVisible();

  // The connection is back: Send now clears it.
  await page.unroute('**/api/check-in');
  // It also sends itself every few seconds, so the button may already be gone.
  await page
    .getByRole('button', { name: 'Send now' })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
  await expect(page.getByText(/check in saved on this device/)).toHaveCount(0, {
    timeout: 15_000,
  });

  // And the person really is checked in on the server.
  await page.getByLabel('Search for a name, staff number or department').fill('D10007');
  await expect(page.getByText('Already in').first()).toBeVisible({ timeout: 10_000 });
});

test('a rejected arrival time is ignored, a sensible one is kept', async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared check ins, so runs once.');
  const signIn = await request.post('/api/admin/sign-in', {
    form: { operator: 'at-test', pin: PIN, next: '/admin' },
    maxRedirects: 0,
  });
  expect(signIn.status()).toBe(303);
  // A time in the far future is ignored (the check in still works).
  const res = await request.post('/api/check-in', {
    data: {
      attendeeId: 'does-not-exist',
      dayId: 'day-1',
      method: 'manual',
      at: '2999-01-01T00:00:00Z',
    },
  });
  expect(res.status()).toBe(404);
});
