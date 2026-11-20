import { expect, test } from '@playwright/test';

import { ADMIN_PAGES } from '../../src/components/admin-pages';

/**
 * Attendees must never reach the secretariat side. With no sign in, every
 * admin page, the projector, the kiosk and every admin API turn them away.
 * (Attendee features, like sending a comment or a photo, are open on purpose.)
 */

const PAGES = [
  '/admin',
  ...ADMIN_PAGES.map((p) => p.href),
  '/admin/reports/summary',
  '/screen',
  '/screen/arrivals',
  '/screen/leaderboard',
  '/kiosk',
];

test('every admin page, screen and the kiosk send a stranger to the PIN', async ({ request }) => {
  for (const path of PAGES) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308], `${path} answered ${response.status()}`).toContain(
      response.status(),
    );
    expect(response.headers().location ?? '', path).toContain('/admin/sign-in');
  }
});

test('every admin API refuses a request with no session', async ({ request }) => {
  const gets = [
    '/api/headcount?dayId=day-1',
    '/api/attendees/search?q=an&dayId=day-1',
    '/api/attendees/search?all=1&dayId=day-1',
    '/api/photos/zip',
    '/api/reports/excel',
  ];
  for (const path of gets) {
    expect((await request.get(path)).status(), path).toBe(401);
  }

  const posts = [
    '/api/check-in',
    '/api/check-in/undo',
    '/api/check-in/undo-all',
    '/api/attendees/import',
    '/api/committees',
    '/api/reports/slido',
  ];
  for (const path of posts) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(401);
  }
});

test('a wrong PIN is refused and gives no session', async ({ request }) => {
  const attempt = () =>
    request.post('/api/admin/sign-in', {
      form: { operator: 'someone', pin: '000000', next: '/admin' },
      maxRedirects: 0,
    });
  const first = await attempt();
  // Back to the form with an error, never into the console.
  expect(first.status()).toBe(303);
  expect(first.headers().location).toContain('/admin/sign-in');
  expect(first.headers().location).toContain('error');
  expect(first.headers()['set-cookie'] ?? '').not.toContain('ep_desk=');
});
