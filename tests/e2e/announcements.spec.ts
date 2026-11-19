import { expect, test } from '@playwright/test';

/**
 * Announcements and phone alerts. Changes what every attendee page shows,
 * so it runs in the shared-switches project and takes its message down.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('the alerts API hands out a key, and checks what it is sent', async ({ request }) => {
  const key = await request.get('/api/push');
  expect(key.ok()).toBe(true);
  expect((await key.json()).publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);

  expect((await request.post('/api/push', { data: { endpoint: 'not a url' } })).status()).toBe(400);
  expect(
    (
      await request.post('/api/push', {
        data: {
          endpoint: 'http://insecure.test/x',
          keys: { p256dh: 'x'.repeat(20), auth: 'abcd' },
        },
      })
    ).status(),
  ).toBe(400);
});

test('post an announcement, see it on a phone, take it down', async ({ browser, request }) => {
  // A phone that turned alerts on (a made-up push address: sending to it
  // fails quietly, which is what a phone that went away looks like).
  const endpoint = `https://push.invalid/e2e-${Date.now()}`;
  const saved = await request.post('/api/push', {
    data: { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } },
  });
  expect(saved.ok()).toBe(true);

  const admin = await (await browser.newContext()).newPage();
  await admin.goto('/admin/sign-in');
  await admin.getByLabel('Which desk is this?').fill('desk-announce');
  await admin.getByLabel('Admin PIN').fill(PIN);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    admin.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();

  await admin.goto('/admin/announcements');
  await expect(admin.getByText(/Also send it as a notification to \d+ phones?/)).toBeVisible();
  const text = `Buses leave at 7:30 ${Math.random().toString(36).slice(2, 6)}`;
  await admin.getByLabel('Message').fill(text);
  await admin.getByLabel('Tapping it opens').selectOption('/agenda');
  await admin.getByRole('button', { name: 'Post announcement' }).click();
  await expect(admin.getByRole('heading', { name: /^Showing now/ })).toBeVisible({
    timeout: 20_000,
  });
  await expect(admin.getByText(text).first()).toBeVisible();

  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await phone.goto('/');
  const banner = phone.getByRole('status', { name: 'Announcement' });
  await expect(banner).toContainText(text);
  await banner.getByRole('link').click();
  await expect(phone).toHaveURL(/\/agenda/);

  await admin.getByRole('button', { name: 'Take it down' }).click();
  await expect(admin.getByRole('heading', { name: /^Showing now/ })).toHaveCount(0);
  await expect(admin.getByText(text)).toBeVisible(); // still in "Sent before"
  await phone.goto('/');
  await expect(phone.getByRole('status', { name: 'Announcement' })).toHaveCount(0);

  // The automatic feedback reminders switch, on and back off.
  await admin.getByRole('button', { name: 'Turn on' }).click();
  await expect(admin.getByText('Automatic feedback reminders: on.')).toBeVisible();
  await admin.getByRole('button', { name: 'Turn off' }).click();
  await expect(admin.getByText('Automatic feedback reminders: off.')).toBeVisible();

  await request.delete('/api/push', { data: { endpoint } });
});
