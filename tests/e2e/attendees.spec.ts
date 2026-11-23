import { expect, test, type Page } from '@playwright/test';

import { writeXlsx } from '../../src/lib/xlsx/write';

/** Uploading the participant list on the secretariat's Attendees page. */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('list-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the attendees page needs the PIN', async ({ page, request }) => {
  await page.goto('/admin/attendees');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  const upload = await request.post('/api/attendees/import', { multipart: { intent: 'x' } });
  expect(upload.status()).toBe(401);
});

// Both test people are secretariat, so the guest counts other tests check
// (78 arrivals expected) never change, whatever order the tests run in.
test('an Excel list uploads, shows up, and a second upload duplicates nobody', async ({ page }) => {
  const tag = Math.random().toString(36).slice(2, 7).toUpperCase();
  const file = writeXlsx([
    {
      name: 'List',
      rows: [
        ['Participants'],
        ['No', 'Staff No', 'Name', 'Role', 'Dept', 'Remarks', 'Email'],
        [
          901,
          `T${tag}1`,
          `Uploaded Person ${tag}`,
          'Secretariat',
          'SPTx',
          '',
          `up.${tag}@example.com`,
        ],
        [902, `T${tag}2`, `Uploaded Helper ${tag}`, 'Secretariat', 'SPTx', '', ''],
      ],
    },
  ]);
  const upload = async () => {
    await page.getByLabel('Participant list file').setInputFiles({
      name: 'participants.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: file,
    });
    await page.getByRole('button', { name: 'Upload' }).click();
  };

  await signIn(page);
  await page.goto('/admin/attendees');
  await upload();
  await expect(page.getByText('Uploaded: 2 added, 0 updated, 0 unchanged.')).toBeVisible();

  // The list filters as you type: no button to press.
  await page.getByLabel('Search the list').fill(tag);
  await expect(
    page.getByRole('cell', { name: new RegExp(`^Uploaded Person ${tag}`) }),
  ).toBeVisible();
  // Flagged as secretariat: the badge next to the name.
  await expect(
    page
      .getByRole('cell', { name: new RegExp(`Uploaded Helper ${tag}`) })
      .locator('span', { hasText: /^Secretariat$/ }),
  ).toBeVisible();

  await upload();
  await expect(page.getByText('Uploaded: 0 added, 0 updated, 2 unchanged.')).toBeVisible();

  // A missing role is filled in by hand.
  await page.getByLabel('Search the list').fill(tag);
  await page.getByRole('link', { name: `Edit Uploaded Person ${tag}` }).click();
  await page.getByLabel('Role').fill(`Fixed role ${tag}`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved. The changes show everywhere now.')).toBeVisible();
  await page.getByLabel('Search the list').fill(tag);
  await expect(page.getByRole('cell', { name: `Fixed role ${tag}` })).toBeVisible();
});

test('removing everyone needs the box ticked', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/attendees');
  await page.getByText('Uploaded the wrong file? Remove everyone').click();
  await page.getByRole('button', { name: 'Remove everyone' }).click();
  await expect(page.getByText('Tick the box to confirm')).toBeVisible();
});
