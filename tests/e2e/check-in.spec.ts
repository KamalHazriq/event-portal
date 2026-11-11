import { expect, test, type Page } from '@playwright/test';

/**
 * Module 4 happy path, plus the checks that matter most: that the
 * secretariat pages are actually shut to everyone else.
 *
 * The PIN comes from the test server's own environment, set in
 * playwright.config.ts, so these do not depend on anyone's .env.local.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page, operator = 'desk-test'): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill(operator);
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test.describe('the secretariat pages are shut', () => {
  test('every admin page sends a stranger to the PIN screen', async ({ page }) => {
    for (const path of [
      '/admin',
      '/admin/desk',
      '/admin/headcount',
      '/admin/name-tags',
      '/admin/qr-assets',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Secretariat sign in' })).toBeVisible();
      // And it remembers where they were heading.
      await expect(page).toHaveURL(new RegExp(`next=${encodeURIComponent(path)}`));
    }
  });

  test('the check in endpoint refuses a request with no session', async ({ request }) => {
    const response = await request.post('/api/check-in', {
      data: { payload: 'AbCd1234EfGh5678xyz', dayId: 'day-1' },
    });
    expect(response.status()).toBe(401);
  });

  test('the headcount endpoint refuses a request with no session', async ({ request }) => {
    const response = await request.get('/api/headcount?dayId=day-1');
    expect(response.status()).toBe(401);
  });

  test('the search endpoint refuses a request with no session', async ({ request }) => {
    const response = await request.get('/api/attendees/search?q=an');
    expect(response.status()).toBe(401);
  });

  test('a wrong PIN does not get in', async ({ page }) => {
    await page.goto('/admin/sign-in');
    await page.getByLabel('Admin PIN').fill('000000');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('That PIN is not right. Try again.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Secretariat sign in' })).toBeVisible();
  });
});

test.describe('a name tag scanned by an attendee', () => {
  test('tells them to show it at the desk, and checks nobody in', async ({ page }) => {
    await page.goto('/c/SomeTokenThatIsLongEnough123');

    await expect(page.getByRole('heading', { name: 'Please show this at the desk' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the event portal' })).toBeVisible();
  });
});

test.describe('the registration desk', () => {
  test('signs in, finds someone by name, checks them in, then undoes it', async ({ page }) => {
    await signIn(page);

    await page
      .getByRole('navigation', { name: 'Secretariat' })
      .getByRole('link', { name: 'Desk', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Registration desk', level: 1 })).toBeVisible();

    // The counter is there before anyone is scanned.
    const counter = page.getByRole('progressbar', { name: 'Arrivals so far' });
    await expect(counter).toBeVisible();

    // Search by name. Every dummy attendee has a staff number starting D1.
    await page.getByLabel('Search for a name or staff number').fill('D10001');
    const row = page.locator('li', { hasText: 'D10001' }).first();

    // Either they are already in from an earlier run, or we check them in.
    const checkInButton = page.getByRole('button', { name: 'Check in' }).first();
    const alreadyIn = page.getByText('Already in').first();

    await expect(checkInButton.or(alreadyIn)).toBeVisible({ timeout: 10_000 });

    if (await checkInButton.isVisible()) {
      await checkInButton.click();
      await expect(page.getByText('Checked in', { exact: true })).toBeVisible();
    }

    // The headcount page should now list that person, and let us undo it.
    await page
      .getByRole('navigation', { name: 'Secretariat' })
      .getByRole('link', { name: 'Headcount' })
      .click();
    await expect(page.getByRole('heading', { name: 'Headcount', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Arrived/ })).toBeVisible();

    const undo = page.getByRole('button', { name: 'Undo' }).first();
    await expect(undo).toBeVisible();
    await undo.click();
    await page.getByRole('button', { name: 'Yes' }).click();

    // The row goes away once the page refetches itself.
    await expect(page.getByRole('heading', { name: /^Not yet arrived/ })).toBeVisible();
    await expect(row).toBeHidden();
  });

  test('a code that is not one of ours is refused, not guessed at', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/desk');

    await page.getByLabel(/handheld scanner/).fill('https://app.sli.do/event/abc123');
    await page.getByLabel(/handheld scanner/).press('Enter');

    await expect(page.getByText('Could not read that code')).toBeVisible();
  });
});

test.describe('printable assets', () => {
  test('name tag fronts carry a personal QR code', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/name-tags?side=front');

    await expect(page.getByRole('heading', { name: 'Name tags', level: 1 })).toBeVisible();

    // One QR per person, each labelled with whose tag it is.
    const codes = page.getByRole('img', { name: /^Check in code for / });
    expect(await codes.count()).toBeGreaterThan(50);
  });

  test('name tag backs carry the portal QR', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/name-tags?side=back');

    const codes = page.getByRole('img', { name: 'Event portal' });
    expect(await codes.count()).toBeGreaterThan(50);
    await expect(page.getByText('Scan for the agenda').first()).toBeVisible();
  });

  test('the QR assets page offers a slide ready file and table tents', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/qr-assets');

    await expect(page.getByRole('heading', { name: 'QR assets', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save PNG for a slide' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Event portal' }).first()).toBeVisible();
  });

  test('it warns while the portal address is still the placeholder', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/qr-assets');

    // The shipped config still points at example.com, so this must warn.
    await expect(page.getByText(/portal address is still the placeholder/)).toBeVisible();
  });
});

test('the secretariat pages reach nothing outside this machine', async ({ page }) => {
  const offSite: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local && url.protocol.startsWith('http')) offSite.push(request.url());
  });

  await signIn(page);
  await page.goto('/admin/desk');
  await page.goto('/admin/headcount');
  await page.goto('/admin/qr-assets');
  await page.waitForLoadState('networkidle');

  expect(offSite).toEqual([]);
});
