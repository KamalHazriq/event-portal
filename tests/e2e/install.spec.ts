import { expect, test } from '@playwright/test';

/** "Install the app": steps and a pointer on an iPhone, where Apple allows no button. */

test.describe('on an iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });

  test('home shows the steps, and a pointer to the Share button', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'One run is enough.');
    await page.goto('/');
    const card = page.getByRole('region', { name: 'Add to home screen' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Apple does not allow an install button');
    await expect(card).toContainText('Add to Home Screen');

    await card.getByRole('button', { name: 'Show me where Share is' }).click();
    const pointer = page.getByRole('dialog', { name: 'Where to tap' });
    await expect(pointer).toBeVisible();
    await pointer.getByRole('button', { name: /Tap Share/ }).click();
    await expect(pointer).toHaveCount(0);
  });
});

test('desktop Chrome shows no install card until the browser offers one', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One run is enough.');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Add to home screen' })).toHaveCount(0);
});

test('the secretariat installs as its own app, opening at /admin', async ({ page, request }) => {
  const manifest = await (await request.get('/admin/app.webmanifest')).json();
  expect(manifest.start_url).toBe('/admin');
  expect(manifest.scope).toBe('/admin');
  expect(manifest.short_name).toBe('Secretariat');

  await page.goto('/admin/sign-in');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/admin/app.webmanifest',
  );
  // Attendee pages keep the attendee app.
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
});

test('the big screen and the kiosk install as their own full screen apps', async ({ request }) => {
  for (const [path, short] of [
    ['/screen', 'Screen'],
    ['/kiosk', 'Kiosk'],
  ] as const) {
    const manifest = await (await request.get(`${path}/app.webmanifest`)).json();
    expect(manifest.start_url).toBe(path);
    expect(manifest.scope).toBe(path);
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.short_name).toBe(short);
  }
});

test('the health check answers without the event code', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test('every page carries the security headers', async ({ request }) => {
  for (const path of ['/', '/agenda', '/api/health', '/admin/sign-in']) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('DENY');
    expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy'], path).toContain('camera=(self)');
    expect(h['content-security-policy'], path).toContain("frame-ancestors 'none'");
  }
});
