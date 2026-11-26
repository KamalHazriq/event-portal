import { expect, test, type Page } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('podium-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the podium is revealed one place at a time, then put back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one project flips the shared screen');
  await signIn(page);
  await page.goto('/admin/big-screen');
  // The reveal controls only show while the podium is on the projector.
  await page.getByRole('button', { name: /^Podium/ }).click();
  await expect(page.getByRole('heading', { name: 'Podium reveal', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Top 5', exact: true }).click();
  await expect(page.getByText(/0 of \d+ places revealed|Nobody has points yet/)).toBeVisible();
  await page
    .getByRole('button', { name: /^Reveal (\d+(st|nd|rd|th) place|next)|All revealed/ })
    .last()
    .click();
  await expect(page.getByText(/1 of \d+ places revealed|Nobody has points yet/)).toBeVisible();

  // The projector shows the podium view.
  await page.goto('/screen?view=podium');
  await expect(page.getByRole('heading', { name: 'Top 5 best participants' })).toBeVisible();

  // Put the screen back for the other tests.
  await page.goto('/admin/big-screen');
  await page.getByRole('button', { name: 'Start again' }).click();
  await page.getByRole('button', { name: 'Top 3', exact: true }).click();
  await page
    .locator('form', { has: page.locator('input[name="view"][value="welcome"]') })
    .first()
    .getByRole('button')
    .click();
});

test('the test plan has a floating progress bar, Latest labels and a checked log', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/admin/test-plan');
  await expect(page.getByRole('progressbar', { name: 'Test plan progress' })).toBeVisible();
  await expect(page.getByText('Latest', { exact: true }).first()).toBeVisible();

  const first = page.getByRole('checkbox').first();
  await first.check();
  await expect(page.getByRole('status').getByText(/^1 of \d+$/)).toBeVisible();

  // The log button stays off until every step is ticked.
  await expect(page.getByRole('button', { name: 'I have checked all of this' })).toBeDisabled();
  await first.uncheck();
});
