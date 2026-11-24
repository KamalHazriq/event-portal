import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const PIN = process.env.E2E_ADMIN_PIN ?? '246810';
const pages = [
  '/',
  '/agenda',
  '/info',
  '/photos',
  '/leaderboard',
  '/me',
  '/session/d1-welcome',
  '/resources',
  '/admin',
  '/admin/desk',
  '/admin/announce',
  '/admin/attendees',
  '/admin/test-plan',
  '/admin/device-check',
  '/admin/big-screen',
  '/admin/event-info',
  '/admin/agenda',
  '/admin/runbook',
  '/admin/name-tags',
  '/admin/headcount',
  '/admin/tour',
  '/kiosk',
  '/screen/welcome',
];

test('no serious accessibility problems on the main pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser size is enough for this scan');
  const problems: string[] = [];
  test.setTimeout(240_000);
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('axe');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin$/);
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle').catch(() => null);
    await page.addScriptTag({ content: axe });
    const result = await page.evaluate(async () => {
      // @ts-expect-error injected
      const r = await window.axe.run(document, { resultTypes: ['violations'] });
      return r.violations
        .filter((v: { impact: string }) => ['serious', 'critical'].includes(v.impact))
        .map(
          (v: { id: string; impact: string; nodes: { target: string[] }[] }) =>
            `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes
              .slice(0, 2)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        );
    });
    problems.push(...result.map((r) => `${path}: ${r}`));
  }
  expect(problems).toEqual([]);
});
