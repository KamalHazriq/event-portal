import { expect, test } from '@playwright/test';

/**
 * The test plan page, and "Clear test data". Clearing wipes what people did,
 * which every other test uses, so this runs last, in its own project.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('tick the plan, and clear test data behind a typed word', async ({ page }) => {
  await page.goto('/admin/test-plan');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.getByLabel('Which desk is this?').fill('desk-plan');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Test plan', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready check' })).toBeVisible();
  await expect(page.getByText('Secretariat PIN is set and long enough')).toBeVisible();

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

test('reset the leaderboard sign ins, then sign every desk out', async ({ page, browser }) => {
  // A phone joins the leaderboard by picking its name.
  const phone = await browser.newPage();
  await phone.goto('/me?find=shanti+fernandez');
  await phone.getByRole('button', { name: /Shanti Fernandez/ }).click();
  await expect(phone.getByText(/^You are in./)).toBeVisible();

  // Desk one signs in; a second desk is signed in too.
  const signIn = async (p: typeof page, desk: string) => {
    await p.goto('/admin/sign-in');
    await p.getByLabel('Which desk is this?').fill(desk);
    await p.getByLabel('Admin PIN').fill(PIN);
    await p.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      p.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
    ).toBeVisible();
  };
  await signIn(page, 'desk-reset-1');
  const other = await (await browser.newContext()).newPage();
  await signIn(other, 'desk-reset-2');

  // Not without the box ticked.
  await page.goto('/admin/admins');
  await page.getByRole('button', { name: 'Reset the leaderboard sign ins' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Tick the box' })).toBeVisible();

  // Reset the leaderboard: the phone has to pick its name again.
  await page.getByLabel('Yes, sign every phone out of the leaderboard').check();
  await page.getByRole('button', { name: 'Reset the leaderboard sign ins' }).click();
  await expect(page.getByText(/phones? (was|were) signed out of the leaderboard/)).toBeVisible();
  await phone.goto('/me');
  await expect(phone.getByLabel('Type your name')).toBeVisible();

  // Sign every desk out: both desks need the PIN again.
  await page.getByLabel('Yes, sign every desk out').check();
  await page.getByRole('button', { name: 'Sign everyone out' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in\?out=all/);
  await expect(page.getByText('Every desk was signed out.')).toBeVisible();
  await other.goto('/admin');
  await expect(other).toHaveURL(/\/admin\/sign-in/);

  // The PIN itself still works.
  await signIn(page, 'desk-reset-1');
  await signIn(other, 'desk-reset-2');
});
