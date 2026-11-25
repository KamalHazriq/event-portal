import { expect, test, type Page } from '@playwright/test';

/**
 * Test mode is shared by every test, so this runs last, on its own (the "wipe"
 * project in playwright.config.ts), never while the others rely on the tools.
 */
const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('test-mode');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('test mode can be switched off, which takes the testing tools away, and on again', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/admin/admins#test-mode');
  await expect(page.getByRole('heading', { name: 'Test mode' })).toBeVisible();
  try {
    await page.getByRole('button', { name: 'Turn test mode off' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Test mode is off.' })).toBeVisible();
    // The testing pages leave the menu and send you back here.
    await page.goto('/admin/test-plan');
    await expect(page).toHaveURL(/\/admin\/admins/);
    await page.goto('/admin/tour');
    await expect(page).toHaveURL(/\/admin\/admins/);
  } finally {
    await page.goto('/admin/admins#test-mode');
    const on = page.getByRole('button', { name: 'Turn test mode on' });
    if (await on.isVisible()) {
      await on.click();
      await page.waitForURL(/testmode=on/);
    }
  }
  await page.goto('/admin/test-plan');
  await expect(page.getByRole('heading', { name: 'Test plan', level: 1 })).toBeVisible();
});
