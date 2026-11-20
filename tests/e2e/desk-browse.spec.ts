import { expect, test, type Page } from '@playwright/test';

/**
 * The desk's two ways to find someone, and undoing everything for testing.
 * Undo all wipes the shared check ins, so this runs in the shared-switches
 * project, after everything else.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-browse');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('search finds a whole department, and the whole list checks people in', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/desk');

  // A department name finds its people.
  await page.getByLabel('Search for a name, staff number or department').fill('TNS');
  await expect(page.getByText('Nobody matches that.')).toHaveCount(0);
  const rows = page.locator('li', { has: page.getByText(/Already in|^Check in$/) });
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(1);

  // The whole list, by department, with a tap to check in.
  await page.getByRole('button', { name: 'Whole list' }).click();
  await page.getByRole('combobox', { name: 'Department' }).selectOption('CDOS');
  await page.getByLabel('Only people not in yet').uncheck();
  const section = page.getByRole('region', { name: 'CDOS' });
  await expect(section).toBeVisible();
  const checkIn = section.getByRole('button', { name: 'Check in' });
  if (await checkIn.count()) {
    const before = await section.getByText('Already in').count();
    await checkIn.first().click();
    await expect(section.getByText('Already in')).toHaveCount(before + 1);
  }
});

test('undo all clears the day, behind a typed word', async ({ page, request }) => {
  await signIn(page);
  await page.goto('/admin/headcount');
  await page.getByText('Undo all attendance').click();

  // The button stays off until the word is typed.
  const undoAll = page.getByRole('button', { name: 'Undo all check ins' });
  await expect(undoAll).toBeDisabled();
  await page.getByLabel('Which days').selectOption('all');
  await page.getByLabel('Type UNDO to confirm').fill('undo');
  await expect(undoAll).toBeEnabled();
  await undoAll.click();
  await expect(page.getByText(/check ins undone\./)).toBeVisible();
  await expect(page.getByText('Nobody has checked in yet.')).toBeVisible();

  // Not without a session.
  const refused = await request.post('/api/check-in/undo-all', {
    data: { dayId: 'all', confirm: 'UNDO' },
  });
  expect(refused.status()).toBe(401);
});
