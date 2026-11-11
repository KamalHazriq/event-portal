import { expect, test, type Page } from '@playwright/test';

import { writeXlsx } from '../../src/lib/xlsx/write';

/**
 * The committee summary and the team guide.
 *
 * The upload test changes shared state (the stored file and who can see it),
 * so it runs once, in the desktop project, and puts access back at the end.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

function committeeFile(): Buffer {
  return writeXlsx([
    {
      name: 'Papers',
      rows: [
        ['Committee papers 2026'],
        ['Ref', 'Paper', 'Decision'],
        ['OTC/01', 'First paper', 'Approved'],
        ['OTC/02', 'Second paper', 'Approved'],
        ['OTC/03', 'Third paper', 'Deferred'],
        ['OTC/04', 'Fourth paper', 'Approved'],
      ],
    },
  ]);
}

test('the guide explains the portal and needs no sign in', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('portal works');
  await expect(page.getByRole('heading', { name: 'Three kinds of screen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'An event day, start to finish' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lucky draw' })).toBeVisible();
});

test('the committee pages are shut by default', async ({ page, request }) => {
  await page.goto('/admin/committees');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  const upload = await request.post('/api/committees', { multipart: { intent: 'access' } });
  expect(upload.status()).toBe(401);
});

test('uploads a committee file, summarises it, and controls who sees it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared state, so runs once.');
  await signIn(page);
  await page.goto('/admin/committees');

  const otc = page.locator('section#otc');
  await otc.locator('input[type=file]').setInputFiles({
    name: 'otc.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: committeeFile(),
  });
  await otc.getByRole('button', { name: 'Upload' }).click();

  await expect(otc.getByRole('status')).toContainText('Uploaded');
  await expect(otc.getByText('4 rows')).toBeVisible();
  await expect(otc.getByRole('cell', { name: 'Second paper' })).toBeVisible();
  // The Decision column is counted: three approved, one deferred.
  const tally = otc.locator('dl');
  await expect(tally).toContainText('Decision');
  await expect(tally).toContainText('Approved3');
  await expect(tally).toContainText('Deferred1');

  // Hidden from attendees until an admin opens it up.
  expect((await page.request.get('/committees')).status()).toBe(404);
  await page.getByLabel('Anyone with the portal link').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('Saved');
  await page.goto('/committees');
  await expect(page.getByRole('cell', { name: 'Second paper' })).toBeVisible();

  // Put it back, and take the file out again.
  await page.goto('/admin/committees');
  await page.getByLabel('Secretariat only').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await page.request.get('/committees')).status()).toBe(404);
  await page.locator('section#otc').getByRole('button', { name: 'Remove this file' }).click();
  await expect(page.locator('section#otc').getByText('Nothing uploaded yet.')).toBeVisible();
});
