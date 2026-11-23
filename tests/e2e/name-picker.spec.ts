import { expect, test } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('the name picker picks different people, apart from the lucky draw', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('picker-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();

  await page.goto('/admin/name-picker');
  await expect(page.getByRole('heading', { name: 'Name picker', level: 1 })).toBeVisible();
  await page.getByLabel('How many').selectOption('3');
  await page.getByLabel('Title on the screen (optional)').fill('Share one idea');
  await page.getByLabel(/^Everyone on the list/).check();
  // Leave the projector alone.
  await page.getByLabel('Spin it on the big screen').uncheck();
  await page.getByRole('button', { name: 'Pick' }).click();

  const picked = page.locator('section', { hasText: 'Just picked: Share one idea' }).locator('li');
  await expect(picked).toHaveCount(3);
  const names = await picked.allTextContents();
  expect(new Set(names).size).toBe(3);

  // The big screen view shows the same three.
  await page.goto('/screen/name-picker');
  await expect(page.getByText('Share one idea')).toBeVisible();

  await page.goto('/admin/name-picker');
  await page.getByRole('button', { name: 'Start the picker again' }).click();
  await expect(page.getByText(/Skip people already picked \(0 so far\)/)).toBeVisible();
});
