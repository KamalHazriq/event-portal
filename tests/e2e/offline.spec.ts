import { expect, test } from '@playwright/test';

/** Patchy Wi-Fi: a page seen once still opens with no connection. */

test('the agenda still opens offline, with a notice', async ({ page, context }) => {
  await page.goto('/agenda?day=day-1');
  // Wait for the service worker to take charge, then load once through it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  await expect(page.getByText(/You are offline/)).toBeVisible();

  // A page never opened before says so, rather than a browser error.
  await page.goto('/info');
  await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
  await context.setOffline(false);
});
