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

  // The other way in: a staff number and a name that agree.
  await page.getByText('Or sign in with your staff number').click();

  // A staff number with somebody else's name does not get in.
  await page.getByLabel('Staff number').fill('D10002');
  await page.getByLabel('Your first name').fill('Hafiz');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(/do not go together/)).toBeVisible();
  // The page reloads with the staff number form closed again.
  await page.getByText('Or sign in with your staff number').click();

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

// Shanti Fernandez (D10005) is one the demo seed leaves unlinked.
test('a phone joins by picking its name, and a second phone must prove it', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared state, so runs once.');

  // Pick the name from the list: no staff number typed.
  await page.goto('/me');
  await page.getByLabel('Type your name').fill('shanti fernandez');
  await page.getByRole('button', { name: 'Find me' }).click();
  const choice = page.getByRole('button', { name: /Shanti Fernandez/ });
  await expect(choice).toBeVisible();
  // Only the name, title and department show, never a staff number.
  await expect(choice).not.toContainText('D10005');
  await choice.click();
  await expect(page.getByText(/^You are in./)).toBeVisible();
  await expect(page.getByText('Shanti Fernandez', { exact: true })).toBeVisible();

  // A second phone picking the same name is asked for the staff number.
  const other = await browser.newPage();
  await other.goto('/me?find=shanti+fernandez');
  await other.getByRole('button', { name: /Shanti Fernandez/ }).click();
  await expect(
    other.getByText('Shanti Fernandez is already signed in on another phone.'),
  ).toBeVisible();
  await other.getByLabel('Your staff number').fill('D99999');
  await other.getByRole('button', { name: 'This is me' }).click();
  await expect(other.getByText(/That staff number is not theirs/)).toBeVisible();
  await other.getByLabel('Your staff number').fill('d10005');
  await other.getByRole('button', { name: 'This is me' }).click();
  await expect(other.getByText(/^You are in./)).toBeVisible();
  // Leave nothing linked behind, so the test can run again.
  await other.getByRole('button', { name: 'Not you? Sign out' }).click();
  await other.close();

  // A name that is not on the list says so.
  await page.getByRole('button', { name: 'Not you? Sign out' }).click();
  await page.goto('/me?find=zzzzzz');
  await expect(page.getByText(/Nobody on the list has that name/)).toBeVisible();
});

test('finding your name needs three letters, so the list cannot be read out', async ({ page }) => {
  await page.goto('/me?find=sh');
  await expect(page.getByText('Type at least three letters of your name.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Names that match' })).toHaveCount(0);
  // The middle of a name does not match, the start does.
  await page.goto('/me?find=anti');
  await expect(page.getByRole('list', { name: 'Names that match' })).toHaveCount(0);
  await page.goto('/me?find=shan');
  await expect(page.getByRole('list', { name: 'Names that match' })).toBeVisible();
});
