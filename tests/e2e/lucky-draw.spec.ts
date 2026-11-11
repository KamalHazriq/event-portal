import { expect, test, type Page } from '@playwright/test';

import { readXlsx } from '../../src/lib/xlsx/read';

/**
 * Lucky draw happy path.
 *
 * Drawing changes shared state (check ins, winners), so the flow runs once,
 * in the desktop project only. It never puts the draw on the big screen,
 * so it cannot disturb the big screen test running alongside it.
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

test('the lucky draw needs the PIN', async ({ page }) => {
  await page.goto('/admin/lucky-draw');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test('draws winners from people checked in, and nobody wins twice', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared state, so runs once.');
  await signIn(page);

  // Check five guests in for Day 1, which is "today" before the event starts.
  const search = await page.request.get('/api/attendees/search?q=an&dayId=day-1');
  const { results } = (await search.json()) as { results: { id: string; remark: string }[] };
  const guests = results.filter((r) => !/secretariat/i.test(r.remark)).slice(0, 5);
  expect(guests).toHaveLength(5);
  for (const g of guests) {
    const r = await page.request.post('/api/check-in', {
      data: { attendeeId: g.id, dayId: 'day-1', method: 'manual' },
    });
    expect(r.ok()).toBe(true);
  }

  // Start clean, so a rerun against the same database behaves the same.
  await page.goto('/admin/lucky-draw');
  if (await page.getByText('Start over').isVisible()) {
    await page.getByText('Start over').click();
    await page.getByLabel(/Yes, clear all/).check();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByText('Start over')).toHaveCount(0);
  }
  await expect(page.getByText(/^\d+ in the hat$/)).not.toHaveText('0 in the hat');

  await page.getByLabel('Winners').selectOption('2');
  await page.getByLabel('Prize (optional)').fill('Test prize');
  await page.getByLabel('Put it on the big screen').uncheck();
  await page.getByRole('button', { name: 'Draw', exact: true }).click();

  const latest = page.getByRole('heading', { name: 'Latest draw: Test prize' });
  await expect(latest).toBeVisible();
  const winners = page.locator('section', { has: latest }).getByRole('listitem');
  await expect(winners).toHaveCount(2);
  const names = await winners.allTextContents();
  expect(new Set(names).size).toBe(2);

  // The projector view shows the same draw.
  await page.goto('/screen/lucky-draw');
  await expect(page.getByText('Test prize')).toBeVisible();

  // Someone was not in the room.
  await page.goto('/admin/lucky-draw');
  const before = await page.getByRole('button', { name: 'Not here' }).count();
  await page.getByRole('button', { name: 'Not here' }).first().click();
  await expect(page.getByRole('button', { name: 'Not here' })).toHaveCount(before - 1);

  // The winners land in the report.
  const report = await page.request.get('/api/reports/excel');
  const sheet = readXlsx(Buffer.from(await report.body())).find((s) => s.name === 'Lucky draw');
  expect(sheet?.rows[0]).toEqual(['Draw', 'Prize', 'Order', 'Name', 'Department', 'Drawn', 'By']);
  expect(sheet?.rows.some((r) => r[1] === 'Test prize')).toBe(true);
});
