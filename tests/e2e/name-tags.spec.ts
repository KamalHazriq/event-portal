import { expect, test } from '@playwright/test';

/** Name tags: the organiser's logo on every tag, in a white and a blue design. */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('name tags carry the logo, in a white and a blue card', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-tags');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();

  await page.goto('/admin/name-tags');
  await expect(page.getByRole('link', { name: 'White card' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.tag').first()).toBeVisible();
  await expect(page.locator('.tag-blue')).toHaveCount(0);
  await expect(
    page
      .locator('.tag')
      .first()
      .getByRole('img', { name: /Digital/ }),
  ).toBeVisible();
  // The white card uses the normal logo.
  await expect(page.locator('.tag .tag-logo').first()).toHaveAttribute(
    'src',
    /digital-information\.webp$/,
  );

  await page.getByRole('link', { name: 'Blue card' }).click();
  await expect(page).toHaveURL(/design=blue/);
  await expect(page.locator('.tag-blue').first()).toBeVisible();
  // The blue card uses the white logo, and keeps the other options.
  await expect(page.locator('.tag-blue .tag-logo').first()).toHaveAttribute(
    'src',
    /digital-information-white\.webp$/,
  );
  await page.getByRole('link', { name: 'Leave out secretariat' }).click();
  await expect(page).toHaveURL(/design=blue/);
});
