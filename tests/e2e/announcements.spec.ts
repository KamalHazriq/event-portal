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

test('the alerts API only takes browser push services', async ({ request }) => {
  const outside = await request.post('/api/push', {
    data: {
      endpoint: 'https://collector.example/steal',
      keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
    },
  });
  expect(outside.status()).toBe(400);
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
  await admin.getByLabel('Message', { exact: true }).fill(text);
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

  // The projector shows it too, across every view.
  const projector = await admin.context().newPage();
  await projector.goto('/screen/welcome');
  await expect(projector.getByText(text)).toBeVisible();

  await admin.getByRole('button', { name: 'Take it down' }).click();
  await expect(admin.getByRole('heading', { name: /^Showing now/ })).toHaveCount(0);
  await expect(admin.getByText(text)).toBeVisible(); // still in "Sent before"
  await phone.goto('/');
  await expect(phone.getByRole('status', { name: 'Announcement' })).toHaveCount(0);
  await projector.reload();
  await expect(projector.getByText(text)).toHaveCount(0);

  // A test goes to this phone only; this browser has no alerts on.
  await admin.getByRole('button', { name: 'Send a test to this phone' }).click();
  await expect(admin.getByText(/has not turned on alerts yet/)).toBeVisible();

  // The automatic feedback reminders switch, on and back off.
  const reminders = admin.locator('form', { hasText: 'Automatic feedback reminders' });
  await reminders.getByRole('button', { name: 'Turn on' }).click();
  await expect(admin.getByText('Automatic feedback reminders: on.')).toBeVisible();
  await admin
    .locator('form', { hasText: 'Automatic feedback reminders' })
    .getByRole('button', { name: 'Turn off' })
    .click();
  await expect(admin.getByText('Automatic feedback reminders: off.')).toBeVisible();

  // Team alerts: no team phone yet, so a team test says so plainly.
  await admin.getByRole('button', { name: /Send a test to the team/ }).click();
  await expect(admin.getByText(/No phone has team alerts on yet/)).toBeVisible();
  await expect(admin.getByText('team alerts off')).toBeVisible();

  await request.delete('/api/push', { data: { endpoint } });
});

test('team alerts can only be switched on by a signed in desk', async ({ browser, request }) => {
  const endpoint = `https://push.invalid/team-${Date.now()}`;
  const body = { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };

  // An attendee phone cannot make itself a team phone.
  expect((await request.post('/api/push', { data: { ...body, team: true } })).status()).toBe(403);
  expect((await request.post('/api/push', { data: body })).ok()).toBe(true);
  const plain = await (
    await request.get(`/api/push?endpoint=${encodeURIComponent(endpoint)}`)
  ).json();
  expect(plain).toMatchObject({ on: true, team: false });

  // A signed in desk can.
  const desk = await (await browser.newContext()).newPage();
  await desk.goto('/admin/sign-in');
  await desk.getByLabel('Which desk is this?').fill('desk-team');
  await desk.getByLabel('Admin PIN').fill(PIN);
  await desk.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    desk.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
  expect((await desk.request.post('/api/push', { data: { ...body, team: true } })).ok()).toBe(true);
  const team = await (
    await desk.request.get(`/api/push?endpoint=${encodeURIComponent(endpoint)}`)
  ).json();
  expect(team).toMatchObject({ on: true, team: true });

  // Turning team alerts off keeps the phone's ordinary alerts.
  await desk.request.delete('/api/push', { data: { endpoint, team: true } });
  const after = await (
    await desk.request.get(`/api/push?endpoint=${encodeURIComponent(endpoint)}`)
  ).json();
  expect(after).toMatchObject({ on: true, team: false });
  await desk.request.delete('/api/push', { data: { endpoint } });
});

test('scheduled reminders: the scheduler call needs its secret, and a due one is sent once', async ({
  page,
  request,
}) => {
  // The scheduler's address: closed without the secret, open with it.
  expect((await request.post('/api/cron/reminders')).status()).toBe(401);
  expect(
    (
      await request.post('/api/cron/reminders', { headers: { authorization: 'Bearer wrong' } })
    ).status(),
  ).toBe(401);

  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('reminders');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/admin/announcements');

  const text = `Projector on ${Date.now()}`;
  await page.getByLabel('Reminder time').fill('2020-01-01T07:00');
  await page.getByLabel('Reminder message').fill(text);
  await page.getByRole('button', { name: 'Add reminder' }).click();
  const row = page.getByRole('listitem').filter({ hasText: text });
  // A time that is long past is shown as missed, never sent late.
  await expect(row).toContainText('Missed');

  // One in the next hour waits, then goes out when the scheduler calls.
  const soon = new Date(Date.now() - 60_000 + 8 * 3600_000); // a minute ago in KL (UTC+8)
  const local = soon.toISOString().slice(0, 16);
  const text2 = `Desks open ${Date.now()}`;
  await page.getByLabel('Reminder time').fill(local);
  await page.getByLabel('Reminder message').fill(text2);
  await page.getByRole('button', { name: 'Add reminder' }).click();
  const row2 = page.getByRole('listitem').filter({ hasText: text2 });
  await expect(row2).toContainText('Waiting');

  const ok = await request.post('/api/cron/reminders', {
    headers: { authorization: 'Bearer e2e-cron-secret' },
  });
  expect(ok.ok()).toBe(true);
  expect((await ok.json()).sent).toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(row2).toContainText('Sent');
  await expect(page.getByText('The scheduler is running')).toBeVisible();

  // Tidy up.
  for (const r of [row, row2]) {
    await r.getByRole('button', { name: 'Remove' }).click();
  }
  await expect(page.getByText(text2)).toHaveCount(0);
});
