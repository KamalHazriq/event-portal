import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Photo wall happy path: a phone shares a photo (shrunk in the browser), it
 * stays private until approved, then it is public and on the slideshow.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';
const PHOTO = join(process.cwd(), 'scripts', 'demo-photos', 'demo-2.jpg');

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Secretariat', level: 1, exact: true }),
  ).toBeVisible();
}

test('the server refuses something that is not a photo', async ({ request }) => {
  const response = await request.post('/api/photos', {
    multipart: {
      image: {
        name: 'x.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('<svg onload=alert(1)>'),
      },
      thumbnail: { name: 't.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('nope') },
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).problem).toBe('not-a-photo');
});

test('the photo admin page and the zip need the PIN', async ({ page, request }) => {
  await page.goto('/admin/photos');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  expect((await request.get('/api/photos/zip')).status()).toBe(401);
});

test('a shared photo waits for approval, then reaches the slideshow', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared state, so runs once.');

  const caption = `E2E photo ${Math.random().toString(36).slice(2, 8)}`;
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await phone.goto('/photos');
  await expect(phone.getByText('10 photos left to share from this phone')).toBeVisible();
  await phone.getByLabel(/A caption/).fill(caption);
  await phone.locator('input[type=file]').setInputFiles(PHOTO);
  await expect(phone.getByText('Sent, waiting for approval')).toBeVisible({ timeout: 20_000 });
  await expect(phone.getByText('9 photos left to share from this phone')).toBeVisible();

  const admin = await browser.newPage();
  await signIn(admin);
  await admin.goto('/admin/photos');
  const card = admin.locator('li', { hasText: caption });
  await expect(card).toBeVisible();
  const src = (await card.locator('img').getAttribute('src')) ?? '';
  const full = src.replace('?size=thumb', '');

  // Private while waiting.
  expect((await phone.request.get(full)).status()).toBe(404);

  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.locator('li', { hasText: caption })).toHaveCount(0);

  // Public once approved, and on the projector.
  const image = await phone.request.get(full);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/jpeg');
  await admin.goto('/screen/photos');
  await expect(admin.locator('img[src^="/api/photos/"]')).toBeVisible();

  const zip = await admin.request.get('/api/photos/zip');
  expect(zip.status()).toBe(200);
  expect(zip.headers()['content-type']).toBe('application/zip');
});
