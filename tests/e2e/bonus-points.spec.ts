import { expect, test, type Page } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('bonus-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('bonus points are given by hand, count on the board, and can be taken back', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project at a time touches the shared points');
  await signIn(page);
  await page.goto('/admin/points#bonus');
  await expect(page.getByRole('heading', { name: 'Bonus points' })).toBeVisible();

  // A wrong person is refused, a real staff number works.
  await page.getByLabel('Who', { exact: true }).fill('nobody at all');
  await page.getByRole('button', { name: 'Give bonus' }).click();
  await expect(page.getByRole('status')).toContainText('Pick a person');

  await page.getByLabel('Who', { exact: true }).fill('D10015');
  await page.getByLabel('Points', { exact: true }).fill('12');
  await page.getByLabel('Why (optional)').fill('Helped on the day');
  await page.getByRole('button', { name: 'Give bonus' }).click();
  await expect(page.getByRole('status')).toContainText('Gave bonus points');
  const row = page.getByRole('listitem').filter({ hasText: 'Helped on the day' });
  await expect(row).toContainText('+12');

  // The person is on the ranking, with the bonus in its own column.
  await expect(page.getByRole('columnheader', { name: 'Bonus' })).toBeVisible();

  await row.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toContainText('Took that bonus back');
  await expect(page.getByText('Helped on the day')).toHaveCount(0);
});
