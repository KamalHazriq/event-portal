import { expect, test } from '@playwright/test';

/**
 * The test plan page, and "Clear test data". Clearing wipes what people did,
 * which every other test uses, so this runs last, in its own project.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('tick the plan, and clear test data behind a typed word', async ({ page }) => {
  await page.goto('/admin/checklist');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.getByLabel('Which desk is this?').fill('desk-plan');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Test plan', level: 1 })).toBeVisible();

  // Both user types are there, and ticks survive a reload.
  await expect(page.getByRole('heading', { name: 'As an attendee, on a phone' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'As the secretariat, on a laptop and a phone' }),
  ).toBeVisible();
  const first = page.getByRole('checkbox').first();
  await expect(first).not.toBeChecked();
  await first.check();
  await expect(page.getByText(/^1 of \d+ done$/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('button', { name: 'Clear all the ticks' }).click();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();

  // Someone is checked in, so there is something to clear.
  const everyone = (await (
    await page.request.get('/api/attendees/search?all=1&dayId=day-1')
  ).json()) as { results: { id: string }[] };
  expect(everyone.results.length).toBeGreaterThan(10);
  await page.request.post('/api/check-in', {
    data: { attendeeId: everyone.results[0]!.id, dayId: 'day-1', method: 'manual' },
  });

  // Not without the word.
  await page.getByLabel('Type CLEAR to confirm').fill('nope');
  await page.getByRole('button', { name: 'Clear all test data' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Type CLEAR' })).toBeVisible();

  await page.getByLabel('Type CLEAR to confirm').fill('clear');
  await page.getByRole('button', { name: 'Clear all test data' }).click();
  await expect(page.getByText('Cleared. The event starts from a clean slate.')).toBeVisible();

  // Activity is gone; the list is still there.
  const headcount = (await (await page.request.get('/api/headcount?dayId=day-1')).json()) as {
    total: { arrived: number };
  };
  expect(headcount.total.arrived).toBe(0);
  const after = (await (
    await page.request.get('/api/attendees/search?all=1&dayId=day-1')
  ).json()) as { results: unknown[] };
  expect(after.results.length).toBe(everyone.results.length);
});
