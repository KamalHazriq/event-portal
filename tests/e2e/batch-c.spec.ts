import { expect, test, type Page } from '@playwright/test';

import { asAttendee } from './as-attendee';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('batch-c');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the projector can show a feedback QR, and the welcome says to scan', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  await signIn(page);
  await page.goto('/screen/feedback');
  await expect(page.getByText('Scan to give feedback')).toBeVisible();
  await page.goto('/screen/welcome');
  await expect(page.getByText('Scan to access the portal')).toBeVisible();
});

test('live control moves the agenda with the room, and goes back to the clock', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the delay is shared by everyone');
  await signIn(page);
  await page.goto('/admin/live');
  await expect(page.getByRole('heading', { name: 'Move the agenda with the room' })).toBeVisible();
  await page.getByRole('button', { name: '+5 min later' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'behind the printed times' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to the clock' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Following the clock' })).toBeVisible();
});

test('the whole-event form has the extra questions and takes a name from the sign in', async ({
  page,
}) => {
  await asAttendee(page, 'D10014');
  await page.goto('/feedback/event');
  await expect(page.getByText('A few more questions')).toBeVisible();
  await expect(page.getByText('Would you recommend this summit to a colleague?')).toBeVisible();
  await expect(page.getByText(/Sent as /)).toBeVisible();
});

test('a person can be given early-arrival times, and the department table is gone', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one run is enough');
  await signIn(page);
  await page.goto('/admin/points#attendance');
  await expect(page.getByRole('heading', { name: 'Attendance points, each day' })).toBeVisible();
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Departments' })).toHaveCount(0);
});
