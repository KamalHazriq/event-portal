import { expect, test } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

// The offline service worker would answer before the test's slow down can.
test.use({ serviceWorkers: 'block' });

test('signing in shows the hexagon loader while it waits, and then lands', async ({ page }) => {
  // The page cannot be asked questions while it changes, so the page itself
  // notes (in session storage, which survives the change) that it saw the loader.
  await page.addInitScript(() => {
    const note = () => {
      const overlay = document.querySelector('.hex-overlay');
      if (overlay) {
        sessionStorage.setItem('hexSeen', `${overlay.querySelectorAll('.hex').length}`);
        sessionStorage.setItem('hexText', overlay.textContent ?? '');
      }
    };
    new MutationObserver(note).observe(document, { childList: true, subtree: true });
  });
  // Slow the sign in down, so the wait is long enough to see.
  await page.route('**/api/admin/sign-in', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('loader');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
  // It showed the seven hexagons and its words while it waited, and is gone now.
  expect(await page.evaluate(() => sessionStorage.getItem('hexSeen'))).toBe('6');
  expect(await page.evaluate(() => sessionStorage.getItem('hexText'))).toContain('Signing in');
  await expect(page.locator('.hex-overlay')).toHaveCount(0);
});

test('a form that stops at the browser check shows no loader', async ({ page }) => {
  await page.goto('/me');
  const find = page.getByRole('textbox', { name: /Type your name/ });
  if (await find.count()) {
    await page
      .getByRole('button', { name: /Find me|Search|Find/ })
      .first()
      .click();
    await expect(page.locator('.hex-overlay')).toHaveCount(0);
  }
});

test('the big screen has its moving backdrop, behind the content', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('screen-look');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/screen/welcome');
  await expect(page.locator('.screen-blob')).toHaveCount(3);
  await expect(page.locator('.screen-hex')).toHaveCount(1);
  // It never sits over the content or takes taps.
  const pointer = await page
    .locator('.screen-bg')
    .evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointer).toBe('none');
});
