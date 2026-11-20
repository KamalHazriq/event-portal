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
