import { expect, test, type Page } from '@playwright/test';

import { writeXlsx } from '../../src/lib/xlsx/write';

/**
 * Who are you first, then the door gift spin, and the secretariat changing
 * a gift. Runs with the shared switches: it opens the spin for a while.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

// The tests change the same gift stock, so they take turns.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('gift-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

async function giftSettings(
  page: Page,
  opts: { mode: string; secretariat: boolean; stock: [string, string, string] },
): Promise<void> {
  await page.goto('/admin/door-gifts');
  await page.getByText('Gifts, stock and when to spin').click();
  await page.locator(`input[name="mode"][value="${opts.mode}"]`).check();
  const box = page.getByLabel('The secretariat spin too');
  if (opts.secretariat) await box.check();
  else await box.uncheck();
  for (let j = 0; j < 3; j += 1)
    await page.locator(`input[name="g${j}.stock"]`).fill(opts.stock[j]!);
  await page.getByRole('button', { name: 'Save the door gifts' }).click();
  await expect(
    page.getByText(opts.mode === 'on' ? 'The spin is open now.' : 'The spin is closed right now.'),
  ).toBeVisible();
}

test('a new phone says who it is, spins for a door gift, and the desk can change it', async ({
  page,
  browser,
}) => {
  const tag = Math.random().toString(36).slice(2, 7).toUpperCase();
  const name = `Gifty Doorprize${tag}`;
  await signIn(page);

  // A person of our own, marked secretariat so the guest counts never move.
  await page.goto('/admin/attendees');
  await page.getByLabel('Participant list file').setInputFiles({
    name: 'participants.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: writeXlsx([
      {
        name: 'List',
        rows: [
          ['No', 'Staff No', 'Name', 'Role', 'Dept'],
          [950, `G${tag}`, name, 'Secretariat', 'SPTx'],
        ],
      },
    ]),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByText(/^Uploaded: 1 added/)).toBeVisible();

  // Only the pointer is left, so the spin must land on it.
  await giftSettings(page, { mode: 'on', secretariat: true, stock: ['0', '0', '30'] });

  try {
    // The phone says who it is: no spin there, only a note that one waits.
    const phone = await browser.newPage();
    await phone.goto('/welcome?next=/agenda');
    await expect(phone.getByRole('heading', { name: 'Welcome! Who are you?' })).toBeVisible();
    // The backup for someone not on the list is there, but small.
    await expect(phone.getByRole('button', { name: 'continue without a name' })).toBeVisible();
    await phone.getByLabel('Type your name').fill(`doorprize${tag}`);
    await phone.getByRole('button', { name: 'Find me' }).click();
    await phone.getByRole('link', { name: `That is me: ${name}` }).click();
    await expect(phone.getByText(`${name}?`)).toBeVisible();
    await phone.getByRole('button', { name: 'Yes, that is me' }).click();
    await expect(phone).toHaveURL(/\/agenda$/);
    await phone.goto('/door-gift');
    await expect(phone.getByText(/spin for your door gift at the registration desk/)).toBeVisible();

    // At the desk: checking them in opens the spin.
    await page.goto('/admin/desk');
    await page.getByLabel('Search for a name, staff number or department').fill(`G${tag}`);
    await page.getByRole('button', { name: 'Check in' }).first().click();
    const dialog = page.getByRole('dialog', { name: `Door gift for ${name}` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Spin for the gift' }).click();
    await expect(dialog.getByText('Presentation pointer!')).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Later' }).click();
    await expect(
      page.getByText(/Door gift: Presentation pointer, not handed over yet/),
    ).toBeVisible();

    // The phone now shows the gift; asking again never spins twice.
    await phone.goto('/door-gift');
    await expect(phone.getByRole('heading', { name: 'Presentation pointer' })).toBeVisible();
    await phone.close();

    // The desk sees it, changes it, and marks it collected.
    await page.goto('/admin/door-gifts');
    await page.getByLabel('Search people').fill(`doorprize${tag}`);
    const pick = page.getByLabel(`Gift for ${name}`);
    await expect(pick).toHaveValue('pointer');
    await pick.selectOption('massager');
    await expect(page.getByLabel(`Gift for ${name}`)).toHaveValue('massager');
    await page.getByRole('button', { name: `Mark collected: Massager for ${name}` }).click();
    await expect(
      page.getByRole('button', { name: `Collected: Massager for ${name}` }),
    ).toBeVisible();
    // Taking it back lets them spin again.
    await page.getByLabel(`Gift for ${name}`).selectOption('');
    await expect(page.getByLabel(`Gift for ${name}`)).toHaveValue('');
  } finally {
    await giftSettings(page, { mode: 'first-day', secretariat: true, stock: ['30', '30', '30'] });
  }
});

test('the welcome page says when a name is not on the list', async ({ page }) => {
  await page.goto('/welcome?find=zzzzzz&next=https://evil.example');
  await expect(page.getByText(/Nobody on the list has that name/)).toBeVisible();
  await expect(page.getByText(/Ask the registration desk to add you/)).toBeVisible();
  await page.getByRole('button', { name: 'continue without a name' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});

test('the desk gives a guest who is not on the list a spin too', async ({ page }) => {
  await signIn(page);
  await giftSettings(page, { mode: 'on', secretariat: true, stock: ['0', '30', '0'] });
  try {
    await page.goto('/admin/desk');
    await page.getByText('Not on the list? Door gift for a guest').click();
    await page.getByLabel('Guest name (optional)').fill('Walk In Visitor');
    await page.getByRole('button', { name: 'Spin a door gift' }).click();
    const dialog = page.getByRole('dialog', { name: 'Door gift for Walk In Visitor' });
    await dialog.getByRole('button', { name: 'Spin for the gift' }).click();
    await expect(dialog.getByText('Thermal printer!')).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Handed over' }).click();
    await page.goto('/admin/door-gifts');
    const guest = page.locator('li', { hasText: 'Walk In Visitor' });
    await expect(guest.getByRole('button', { name: '✓ Collected' })).toBeVisible();
    await guest.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('li', { hasText: 'Walk In Visitor' })).toHaveCount(0);
  } finally {
    await giftSettings(page, { mode: 'first-day', secretariat: true, stock: ['30', '30', '30'] });
  }
});

test('a gift gets an uploaded photo and a short description', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/door-gifts');
  await page.getByRole('link', { name: 'Edit stock, gifts and when to spin' }).click();
  // A small red square, made here, stands in for a photo from the phone.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGM8ISfHQApgIkn1qIZRDUNKAwBPHwEkcYw1mAAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.getByLabel('Photo of Massager').setInputFiles({
    name: 'gift.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByText('New photo ready. Press Save to keep it.')).toBeVisible();
  await page.locator('input[name="g0.description"]').fill('Rechargeable, four heads');
  await page.getByRole('button', { name: 'Save the door gifts' }).click();

  const tile = page.getByRole('region', { name: 'Stock' });
  await expect(tile.getByText('Rechargeable, four heads')).toBeVisible();
  const src = await tile.locator('img').first().getAttribute('src');
  expect(src).toMatch(/^\/api\/door-gift\/image\/massager\?v=\d+$/);
  const image = await page.request.get(src!);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/jpeg');
});
