import { join } from 'node:path';

import { asAttendee } from './as-attendee';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * The photo wall switches: approval off lets a photo straight onto the wall,
 * the projector layout can be changed, and a new photo pops up on the
 * screen. These change settings the whole portal shares, so they run in the
 * shared-switches project, after everything else, and put things back.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';
const PHOTO = join(process.cwd(), 'scripts', 'demo-photos', 'demo-3.jpg');

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-wall');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

/** Sets approval on or off, whatever it was before. */
async function setApproval(page: Page, on: boolean): Promise<void> {
  await page.goto('/admin/photos');
  await page.getByText(/^Approval first: (on|off)\./).waitFor();
  const button = page.getByRole('button', { name: on ? 'Turn approval on' : 'Turn approval off' });
  if (await button.isVisible()) await button.click();
  await expect(page.getByText(`Approval first: ${on ? 'on' : 'off'}.`)).toBeVisible();
}

async function setLayout(page: Page, name: string): Promise<void> {
  await page.goto('/admin/photos');
  await page.getByText(/^Approval first: (on|off)\./).waitFor();
  const button = page.getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

test('approval off, grid layout, and the new photo pop up', async ({ browser }) => {
  const desk = await browser.newContext();
  const admin = await desk.newPage();
  await signIn(admin);
  // Put the shared settings back even if a step below fails.
  try {
    await runWall(admin, browser);
  } finally {
    await setApproval(admin, true);
    await setLayout(admin, 'Slideshow');
  }
});

async function runWall(admin: Page, browser: Browser): Promise<void> {
  await setApproval(admin, false);
  await setLayout(admin, 'Scrolling wall');
  const show = admin.getByRole('button', { name: 'Show the photo wall now' });
  if (await show.isVisible()) await show.click();
  await expect(admin.getByText('The photo wall is on the big screen now.')).toBeVisible();

  const screen = await admin.context().newPage();
  await screen.setViewportSize({ width: 1280, height: 720 });
  await screen.goto('/screen');
  await expect(
    screen.locator('[data-layout="grid"]').or(screen.getByText('Share your photos')),
  ).toBeVisible({ timeout: 15_000 });

  const caption = `Wall ${Math.random().toString(36).slice(2, 8)}`;
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await phone.goto('/photos');
  // One photo: choose it, see it, caption it, then share.
  await phone.locator('input[type=file]').setInputFiles(PHOTO);
  await expect(phone.getByRole('img', { name: 'Photo 1 you chose' })).toBeVisible();
  await phone.getByLabel(/Caption/).fill(caption);
  await phone.getByRole('button', { name: 'Share this photo' }).click();
  await expect(phone.getByText(/1 photo shared from this device/)).toBeVisible({ timeout: 20_000 });

  // The screen picks it up on its next refresh and shows it large first.
  const popup = screen.getByRole('status', { name: 'New photo on the wall' });
  await expect(popup).toBeVisible({ timeout: 15_000 });
  await expect(popup).toContainText(caption);
  await expect(popup).toBeHidden({ timeout: 15_000 });
  await expect(
    screen.locator('[data-layout="grid"] figure', { hasText: caption }).first(),
  ).toBeVisible();

  // On the phone: like the photo, then comment on it under a signed in name.
  await asAttendee(phone, 'D10016');
  await phone.goto('/photos');
  const card = phone.locator('li', { hasText: caption }).first();
  await card.getByRole('button', { name: /Like this photo, 0 so far/ }).click();
  await expect(card.getByRole('button', { name: /Like this photo, 1 so far/ })).toBeDisabled();
  await card.getByText(/^Comments \(0\)$/).click();
  const comment = `Great shot ${Math.random().toString(36).slice(2, 6)}`;
  await card.getByLabel('Add a comment').fill(comment);
  await card.getByRole('button', { name: 'Post comment' }).click();
  await expect(phone.getByText(comment)).toBeVisible();
}
