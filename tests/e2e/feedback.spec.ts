import { expect, test, type Page } from '@playwright/test';

/**
 * Module 5 happy path.
 *
 * Each test uses its own browser context, so each one is a fresh "phone" with
 * no device cookie. That is what makes the one answer per device rule
 * testable.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

/** A session that asks for feedback in the shipped config. */
const SESSION_FORM = 'd1-keynote';

/** Unique per run, so one project's answer is never mistaken for another's. */
function marker(label: string): string {
  return `${label} ${Math.random().toString(36).slice(2, 10)}`;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Secretariat', level: 1, exact: true }),
  ).toBeVisible();
}

test.describe('a session feedback form', () => {
  test('takes stars and a comment, then says thank you', async ({ page }) => {
    await page.goto(`/feedback/${SESSION_FORM}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Keynote');
    await expect(page.getByRole('group', { name: 'How was this session?' })).toBeVisible();

    await page.getByRole('radio', { name: '4 stars' }).check();
    await page.getByLabel(/Any comments/).fill('Clear and useful, thank you.');
    await page.getByRole('button', { name: 'Send feedback' }).click();

    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
  });

  test('refuses a second answer from the same phone', async ({ page }) => {
    await page.goto(`/feedback/${SESSION_FORM}`);
    await page.getByRole('radio', { name: '5 stars' }).check();
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();

    // Coming back to the form says so rather than offering it again.
    await page.goto(`/feedback/${SESSION_FORM}`);
    await expect(
      page.getByRole('heading', { name: 'You have already answered this one' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0);
  });

  test('the browser stops a submission with no rating', async ({ page }) => {
    await page.goto(`/feedback/${SESSION_FORM}`);

    await page.getByLabel(/Any comments/).fill('Forgot to pick stars.');
    await page.getByRole('button', { name: 'Send feedback' }).click();

    // Still on the form, because the radios are required.
    await expect(page.getByRole('button', { name: 'Send feedback' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thank you' })).toHaveCount(0);
  });

  test('a form that is not in the config is not found', async ({ page }) => {
    const response = await page.goto('/feedback/not-a-real-session');
    expect(response?.status()).toBe(404);
  });

  test('a session that does not ask for feedback has no form', async ({ page }) => {
    // The Day 1 coffee break has feedbackEnabled false.
    const response = await page.goto('/feedback/d1-break-pm');
    expect(response?.status()).toBe(404);
  });
});

test.describe('the whole event form', () => {
  test('asks the extra questions and records them', async ({ page }) => {
    await page.goto('/feedback/event');

    await expect(page.getByRole('group', { name: 'Overall, how was the summit?' })).toBeVisible();

    await page.getByRole('radio', { name: '5 stars' }).check();
    await page
      .getByLabel('Which session was the most useful?')
      .selectOption({ label: 'Day 1: Keynote: powering the nation through change' });
    await page.getByLabel('One thing we should improve').fill('Longer breaks between sessions.');
    await page.getByLabel(/Anything else/).fill('Best one yet.');
    await page.getByRole('button', { name: 'Send feedback' }).click();

    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
  });
});

test.describe('names', () => {
  test('an optional name is kept when given', async ({ page }) => {
    await page.goto(`/feedback/${SESSION_FORM}`);

    await expect(page.getByLabel('Your name (optional)')).toBeVisible();
    await expect(page.getByText('Leave it blank to stay anonymous.')).toBeVisible();

    await page.getByRole('radio', { name: '3 stars' }).check();
    const who = marker('Siti Osman');
    await page.getByLabel('Your name (optional)').fill(who);
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();

    // The secretariat sees the name against that answer.
    await signIn(page);
    await page.goto(`/admin/feedback/${SESSION_FORM}`);
    await expect(page.getByText(who)).toBeVisible();
  });
});

test.describe('the secretariat view', () => {
  test('shows results per session, which is the module done when', async ({ page }) => {
    // Leave an answer first so there is something to look at.
    await page.goto(`/feedback/${SESSION_FORM}`);
    await page.getByRole('radio', { name: '5 stars' }).check();
    const comment = marker('A comment the secretariat should see');
    await page.getByLabel(/Any comments/).fill(comment);
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();

    await signIn(page);
    await page.goto('/admin/feedback');

    await expect(page.getByRole('heading', { name: 'Feedback', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Forms' })).toBeVisible();

    await page.getByRole('link', { name: 'Keynote: powering the nation through change' }).click();

    await expect(page.getByRole('heading', { name: 'What people wrote' })).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();
  });

  test('is shut to anyone not signed in', async ({ page }) => {
    await page.goto('/admin/feedback');
    await expect(page.getByRole('heading', { name: 'Secretariat sign in' })).toBeVisible();
  });

  test('closing a form stops it taking answers', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/feedback');

    // Close the whole event form.
    const row = page.locator('li', { hasText: 'About Power Summit' }).first();
    await row.getByRole('button', { name: 'Close this form' }).click();
    await expect(row.getByRole('button', { name: 'Closed, reopen it' })).toBeVisible();

    // An attendee now sees that it is closed.
    await page.context().clearCookies();
    await page.goto('/feedback/event');
    await expect(page.getByRole('heading', { name: 'This form is closed' })).toBeVisible();

    // Put it back, so the suite can run again.
    await signIn(page);
    await page.goto('/admin/feedback');
    const again = page.locator('li', { hasText: 'About Power Summit' }).first();
    await again.getByRole('button', { name: 'Closed, reopen it' }).click();
    await expect(again.getByRole('button', { name: 'Close this form' })).toBeVisible();
  });
});

test('the feedback pages reach nothing outside this machine', async ({ page }) => {
  const offSite: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local && url.protocol.startsWith('http')) offSite.push(request.url());
  });

  await page.goto('/feedback/event');
  await page.goto(`/feedback/${SESSION_FORM}`);
  await page.waitForLoadState('networkidle');

  expect(offSite).toEqual([]);
});
