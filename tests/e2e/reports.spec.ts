import { expect, test, type Page } from '@playwright/test';

import { readXlsx } from '../../src/lib/xlsx/read';
import { writeXlsx } from '../../src/lib/xlsx/write';

/**
 * Module 7 happy path: the Excel download, the Slido upload and the summary
 * that becomes the PDF.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-test');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

/** Shaped like a Slido export: a title row, polls, questions, and a participant list. */
function slidoExport(): Buffer {
  return writeXlsx([
    {
      name: 'Poll results',
      rows: [
        ['Slido export'],
        [],
        ['Poll', 'Option', 'Votes'],
        ['How ready?', 'Very', 31],
        ['', 'Fairly', 40],
      ],
    },
    {
      name: 'Questions',
      rows: [
        ['Question', 'Author', 'Likes'],
        ['Who owns this?', 'Anonymous', 12],
      ],
    },
    {
      name: 'Participants',
      rows: [
        ['Name', 'Email'],
        ['Someone', 'someone@example.com'],
      ],
    },
  ]);
}

test('the report download needs the PIN', async ({ request }) => {
  const response = await request.get('/api/reports/excel');
  expect(response.status()).toBe(401);
});

test('downloads the report as a real Excel file', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/reports');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^power-summit-report-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const names = readXlsx(readFileSync(path)).map((s) => s.name);
  expect(names).toEqual(
    expect.arrayContaining(['Summary', 'Attendance', 'Feedback', 'Feedback by session']),
  );
});

test('refuses a file that is not Excel', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/reports');
  await page.getByLabel(/Slido Excel export/).setInputFiles({
    name: 'results.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b\n1,2'),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toContainText('not an .xlsx file');
});

test('imports Slido results into the report, leaving out participant lists', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/reports');
  await page.getByLabel(/Slido Excel export/).setInputFiles({
    name: 'slido-results.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: slidoExport(),
  });
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 2 sheets');
  await expect(page.getByRole('status')).toContainText('Left out 1 other sheet');
  await expect(page.getByText('Most liked question')).toContainText('Who owns this?');

  const response = await page.request.get('/api/reports/excel');
  const sheets = readXlsx(Buffer.from(await response.body()));
  expect(sheets.map((s) => s.name)).toEqual(
    expect.arrayContaining(['Slido Poll results', 'Slido Questions']),
  );
  expect(JSON.stringify(sheets)).not.toContain('someone@example.com');
});

test('the summary is ready to print, with no names in it', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/reports/summary');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Power Summit');
  await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
  // The sample list's first person should not appear: the summary is counts only.
  await expect(page.getByText('Maria Rahman')).toHaveCount(0);
});
