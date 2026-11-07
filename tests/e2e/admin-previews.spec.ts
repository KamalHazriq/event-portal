import { expect, test, type Page } from '@playwright/test';

/**
 * Module 6 previews: every page for a module that is not built yet opens,
 * says plainly that it is dummy data, and its main button does something.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Secretariat', level: 1, exact: true }),
  ).toBeVisible();
}

const PAGES = [
  ['/admin/previews', 'Previews'],
  ['/admin/reports', 'Reports'],
  ['/admin/lucky-draw', 'Lucky draw'],
  ['/admin/photos', 'Photo wall'],
  ['/admin/committees', 'Committee summary'],
  ['/admin/qa', 'Q&A queue'],
  ['/admin/polls', 'Polls'],
  ['/admin/admins', 'Admins'],
] as const;

test('preview pages need the PIN', async ({ page }) => {
  await page.goto('/admin/lucky-draw');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test('every preview page opens and is labelled as dummy data', async ({ page }) => {
  await signIn(page);
  for (const [path, heading] of PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    if (path !== '/admin/previews') {
      await expect(page.getByText('Preview with dummy data.')).toBeVisible();
    }
  }
});

test('the polls preview opens one poll at a time', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/polls');
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByText('Open for votes')).toHaveCount(1);
});
