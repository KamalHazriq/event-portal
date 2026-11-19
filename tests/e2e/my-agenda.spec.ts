import { expect, test } from '@playwright/test';

/** Starring sessions builds "My agenda", kept on the phone only. */

test('star a session, find it under My agenda, then remove it', async ({ page }) => {
  await page.goto('/agenda?day=day-1');
  const star = page.getByRole('button', {
    name: 'Add Keynote: powering the nation through change to my agenda',
  });
  await star.click();
  await expect(
    page.getByRole('button', {
      name: 'Remove Keynote: powering the nation through change from my agenda',
    }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: /My agenda/ }).click();
  await expect(page).toHaveURL(/day=mine/);
  await expect(page.getByRole('heading', { name: /Keynote: powering the nation/ })).toBeVisible();
  await expect(page.getByText('Saved on this phone only.')).toBeVisible();

  // Survives a reload: it is stored on the phone.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Keynote: powering the nation/ })).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Remove Keynote: powering the nation through change from my agenda',
    })
    .click();
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
});
