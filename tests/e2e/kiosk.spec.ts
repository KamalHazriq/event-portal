import { expect, test } from '@playwright/test';

/** The self check in kiosk: behind the PIN, no menus, and asks for a card. */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('the kiosk needs the PIN, then waits for a card', async ({ page }) => {
  await page.goto('/kiosk');
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fkiosk/);
  await page.getByLabel('Which desk is this?').fill('kiosk-1');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(page.getByRole('heading', { name: 'Check yourself in' })).toBeVisible();
  await expect(page.getByText(/business card in your TNB app/)).toBeVisible();
  // Nothing to wander off to.
  await expect(page.getByRole('navigation')).toHaveCount(0);

  // Previewing the kiosk does NOT lock this device: the console still opens.
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible({ timeout: 15_000 });

  // Locking is a choice: /kiosk?lock=1. Admin addresses then ask for the PIN.
  await page.goto('/kiosk?lock=1');
  await expect(page.getByRole('heading', { name: 'Check yourself in' })).toBeVisible();
  for (const path of ['/admin', '/admin/attendees']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(page.getByText(/locked to the self check in kiosk/)).toBeVisible();
  }
  // The kiosk itself still works while locked.
  await page.goto('/kiosk');
  await expect(page.getByRole('heading', { name: 'Check yourself in' })).toBeVisible();

  // Entering the PIN unlocks it.
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-1');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible({ timeout: 15_000 });
  await page.goto('/admin/attendees');
  await expect(page.getByRole('heading', { name: 'Attendees', level: 1 })).toBeVisible();
});

test('the kiosk moves on to the camera even when the browser never finishes play()', async ({
  page,
}) => {
  // A working camera (a drawing on a canvas), but a video that never finishes
  // starting: what a hidden video can do in desktop Chrome.
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d')?.fillRect(0, 0, 320, 240);
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(5);
    HTMLMediaElement.prototype.play = () => new Promise(() => undefined);
  });

  await page.goto('/kiosk');
  await page.getByLabel('Which desk is this?').fill('kiosk-2');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Check yourself in' })).toBeVisible();

  // The camera view is up: no Start button, and the video is on screen.
  await expect(page.getByRole('button', { name: 'Start the camera' })).toHaveCount(0);
  await expect(page.locator('video')).toBeVisible();
});
