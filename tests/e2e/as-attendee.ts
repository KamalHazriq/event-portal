import { expect, type Page } from '@playwright/test';

/**
 * Signs this test phone in as an attendee, by staff number on My points.
 * Comments and feedback carry a name, so a phone must say who it is first.
 * D10012 is one the other tests leave alone.
 */
export async function asAttendee(page: Page, staffNo = 'D10012'): Promise<void> {
  await page.goto('/me');
  await page.getByText('Or sign in with your staff number').click();
  await page.getByLabel('Staff number').fill(staffNo);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText(/^You are in./)).toBeVisible();
}
