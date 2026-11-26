import { expect, test, type Page } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('floor-manager');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the stage console runs the programme: cues, tiles and the controls of the view on screen', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes a shared setting, so runs once.');
  await signIn(page);
  await page.goto('/admin/big-screen');
  await expect(page.getByRole('heading', { name: 'Stage control', level: 1 })).toBeVisible();

  // Controls only show for the view on the projector.
  await page.getByRole('button', { name: /^Welcome/ }).click();
  await expect(page.getByRole('heading', { name: 'Countdown', level: 2, exact: true })).toHaveCount(
    0,
  );

  // The countdown is set from here.
  await page.getByRole('button', { name: /^Countdown/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Countdown', level: 2, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '10 min' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch it off' }).click();
  await expect(page.getByText(/^Off\./)).toBeVisible();

  // Draw and picker panels.
  await page.getByRole('button', { name: /^Lucky draw/ }).click();
  await expect(page.getByText(/in the hat/)).toBeVisible();
  await page.getByRole('button', { name: /^Name picker/ }).click();
  await expect(page.getByRole('button', { name: 'Pick', exact: true })).toBeVisible();

  // Next cue and Previous cue are presses, and the arrow keys do the same.
  await page.getByRole('button', { name: /^Welcome/ }).click();
  await expect(page.getByRole('button', { name: /^Welcome/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#cue-next').click();
  await expect(page.getByRole('button', { name: /^Welcome/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('#cue-prev').click();
  await expect(page.getByRole('button', { name: /^Welcome/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^Welcome/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: /^Welcome/ }).click();
});
