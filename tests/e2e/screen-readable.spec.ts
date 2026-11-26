import { expect, test, type Page } from '@playwright/test';

/**
 * The big screen is read from the back of a ballroom, on a 1080p or a 4K
 * projector. Every view's smallest text must stay big enough on both: at
 * least 22px at 1080p, and double that at 4K, so nothing shrinks relative to
 * the screen as the screen gets bigger.
 */
const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

const VIEWS = [
  'welcome',
  'now-next',
  'arrivals',
  'countdown',
  'lucky-draw',
  'name-picker',
  'photos',
  'qa',
  'poll',
  'leaderboard',
  'comments',
  'podium',
  'feedback',
  'loop',
];

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('readable');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

async function smallestText(page: Page): Promise<{ size: number; text: string }> {
  return page.evaluate(() => {
    let size = 999;
    let text = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (!value || !el || el.closest('.sr-only')) continue;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || box.width === 0) continue;
      const px = parseFloat(style.fontSize);
      if (px < size) {
        size = px;
        text = value.slice(0, 40);
      }
    }
    return { size, text };
  });
}

test('every big screen view stays readable at 1080p and at 4K', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser is enough');
  test.setTimeout(180_000);
  await signIn(page);
  for (const [width, height, floor] of [
    [1920, 1080, 22],
    [3840, 2160, 44],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const view of VIEWS) {
      await page.goto(`/screen/${view}`);
      await expect(page.locator('main#main')).toBeVisible();
      await page.waitForTimeout(700);
      const small = await smallestText(page);
      expect(
        small.size,
        `${view} at ${width}px: smallest text is ${small.size}px ("${small.text}")`,
      ).toBeGreaterThanOrEqual(floor);
    }
  }
});
