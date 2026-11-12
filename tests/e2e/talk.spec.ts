import { expect, test, type Page } from '@playwright/test';

/**
 * Reactions and comments during talks, against the frozen test agenda:
 * the keynote runs 14:50 to 15:50 on Day 1 (2026-12-14).
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';
const DURING = '/session/d1-keynote?now=2026-12-14T15:10';
const BEFORE = '/session/d1-keynote?now=2026-12-14T13:00';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('talk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('reactions are open during the talk, count at once, and reach the server', async ({
  page,
}) => {
  await page.goto(DURING);
  await expect(page.getByRole('heading', { name: 'React live' })).toBeVisible();
  const clap = page.getByRole('button', { name: /^Applause, \d+ so far$/ });
  await expect(clap).toBeEnabled();

  const before = Number((await clap.getAttribute('aria-label'))?.match(/\d+/)?.[0]);
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/react'));
  await clap.click();
  expect((await sent).status()).toBe(200);
  await expect(clap).toHaveAttribute('aria-label', `Applause, ${before + 1} so far`);
});

test('reactions are closed before the talk starts', async ({ page, request }) => {
  await page.goto(BEFORE);
  await expect(page.getByText('Opens when the talk starts.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Applause/ })).toBeDisabled();

  // And the server agrees, whatever the page says.
  const response = await request.post('/api/react', {
    data: { sessionId: 'd1-keynote', kind: 'clap', now: '2026-12-14T13:00' },
  });
  expect(response.status()).toBe(409);
});

test('a comment waits for approval, then shows, can be liked, and reaches the projector', async ({
  page,
  browser,
}) => {
  const text = `Loved the practical examples ${Date.now()}`;

  // An attendee posts.
  await page.goto('/session/d1-panel');
  await page.getByLabel('Your comment').fill(text);
  await page.getByLabel(/Your name/).fill('Test Person');
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText(/shows here once the secretariat has approved it/)).toBeVisible();
  await expect(page.getByText(text)).toHaveCount(0);

  // The secretariat approves it and puts it on the big screen.
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin);
  await admin.goto('/admin/comments?session=d1-panel&status=pending');
  const row = admin.locator('li', { hasText: text });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.locator('li', { hasText: text })).toHaveCount(0);
  await admin.getByRole('button', { name: 'Show comments on the big screen' }).click();

  // Now the room sees it, and can like it once.
  await page.goto('/session/d1-panel');
  const mine = page.locator('li', { hasText: text });
  await expect(mine).toBeVisible();
  await mine.getByRole('button', { name: 'Like, 0 so far' }).click();
  await expect(page.getByText('Liked.')).toBeVisible();
  await expect(page.locator('li', { hasText: text }).getByRole('button')).toBeDisabled();

  await admin.goto('/screen/comments');
  await expect(admin.getByRole('heading', { name: 'What people are saying' })).toBeVisible();
  await expect(admin.getByText(text)).toBeVisible();
  await expect(admin.getByText('Scan to comment')).toBeVisible();
});

test('the comments page needs the PIN', async ({ page }) => {
  await page.goto('/admin/comments');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});
