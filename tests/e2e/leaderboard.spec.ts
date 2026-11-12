import { expect, test } from '@playwright/test';

/**
 * Points and the leaderboard. Uses the dummy attendee "Lailatul Zainal"
 * (staff number D10002) from config/attendees.sample.csv.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('a phone joins with staff number and first name, and sees its points', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Join the leaderboard' }).click();

  // A staff number with somebody else's name does not get in.
  await page.getByLabel('Staff number').fill('D10002');
  await page.getByLabel('Your first name').fill('Hafiz');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(/do not go together/)).toBeVisible();

  await page.getByLabel('Staff number').fill('D10002');
  await page.getByLabel('Your first name').fill('lailatul');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(/^You are in./)).toBeVisible();
  await expect(page.getByText('Lailatul Zainal', { exact: true })).toBeVisible();
  await expect(page.getByText(/^points, number \d+ of \d+$/)).toBeVisible();

  // The leaderboard shows them, either in the top ten or as "you are number".
  await page.getByRole('link', { name: 'See the leaderboard' }).click();
  await expect(
    page
      .locator('li', { hasText: 'Lailatul Zainal' })
      .or(page.getByText(/You are number \d+/))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible();

  // And signing out stops the phone counting for them.
  await page.getByRole('link', { name: 'My points' }).click();
  await page.getByRole('button', { name: 'Not you? Sign out' }).click();
  await expect(page.getByText(/^Signed out./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Join the leaderboard' })).toBeVisible();
});

test('the projector has a leaderboard view', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('screen-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();

  await page.goto('/screen/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Departments' })).toBeVisible();
  await expect(page.getByText('Scan to join')).toBeVisible();
});
