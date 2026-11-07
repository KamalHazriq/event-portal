import { expect, test, type Page } from '@playwright/test';

/**
 * Module 8 happy path: the projector pages, and the MC switching them.
 *
 * The fixed /screen/<view> pages are used for checking content, because they
 * do not depend on the shared "which view is live" setting. Only one test
 * changes that setting, and only in one project, so the phone and desktop
 * runs never fight over it.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page, label = 'screen'): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill(label);
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Secretariat', level: 1, exact: true }),
  ).toBeVisible();
}

test('the projector pages need the PIN', async ({ page }) => {
  await page.goto('/screen');
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fscreen/);
});

test.describe('the views', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('welcome shows the event and the portal QR', async ({ page }) => {
    await signIn(page);
    await page.goto('/screen/welcome');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Power Summit');
    await expect(page.getByRole('img', { name: /opens the event portal/ })).toBeVisible();
  });

  test('now and next shows the running session and what follows', async ({ page }) => {
    await signIn(page);
    await page.goto('/screen/now-next?now=2026-12-14T15:10');
    await expect(page.getByText('On now')).toBeVisible();
    await expect(page.getByText(/Keynote/)).toBeVisible();
    await expect(page.getByText('40 min left')).toBeVisible();
    await expect(page.getByText('Coffee break')).toBeVisible();
  });

  test('arrivals counts guests, not the secretariat', async ({ page }) => {
    await signIn(page);
    await page.goto('/screen/arrivals?now=2026-12-14T13:00');
    await expect(page.getByText(/^Arrived,/)).toBeVisible();
    await expect(page.getByText('/ 78')).toBeVisible();
  });

  test('fills a 1920 x 1080 screen without scrolling', async ({ page }) => {
    await signIn(page);
    for (const view of ['welcome', 'now-next', 'arrivals', 'countdown']) {
      await page.goto(`/screen/${view}?now=2026-12-15T10:40`);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth > window.innerWidth ||
          document.documentElement.scrollHeight > window.innerHeight,
      );
      expect(overflow, view).toBe(false);
    }
  });

  test('an unknown view is a not found page', async ({ page }) => {
    await signIn(page);
    const response = await page.goto('/screen/nonsense');
    expect(response?.status()).toBe(404);
  });

  test('reaches nothing outside this machine', async ({ page }) => {
    const offSite: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
      if (!local && url.protocol.startsWith('http')) offSite.push(request.url());
    });
    await signIn(page);
    await page.goto('/screen/welcome');
    await page.waitForLoadState('networkidle');
    expect(offSite).toEqual([]);
  });
});

test('the MC switches the projector from a phone', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes a shared setting, so runs once.');

  const projector = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await signIn(projector, 'screen');
  await signIn(phone, 'mc');

  await phone.goto('/admin/big-screen');
  await phone.getByRole('button', { name: /^Arrivals/ }).click();
  await expect(phone.getByRole('button', { name: /^Arrivals/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await projector.goto('/screen?now=2026-12-14T13:00');
  await expect(projector.getByText(/^Arrived,/)).toBeVisible();

  // Switch while the projector page stays open: it follows on its next poll.
  await phone.getByRole('button', { name: /^Now and next/ }).click();
  await expect(projector.getByText(/^Arrived,/)).toHaveCount(0, { timeout: 10_000 });

  // Hide names, check, and put it back for whoever runs next.
  await phone.getByRole('button', { name: 'Hide names, counter only' }).click();
  await expect(phone.getByRole('button', { name: 'Show names' })).toBeVisible();
  await projector.goto('/screen/arrivals?now=2026-12-14T13:00');
  await expect(projector.getByText(/^Welcome,/)).toHaveCount(0);
  await phone.getByRole('button', { name: 'Show names' }).click();
  await phone.getByRole('button', { name: /^Welcome/ }).click();
});
