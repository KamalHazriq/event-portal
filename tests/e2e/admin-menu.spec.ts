import { expect, test } from '@playwright/test';

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

test('each menu name is its address, and each section has its own page', async ({ page }) => {
  await page.goto('/admin/set-up');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.getByLabel('Which desk is this?').fill('menu');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Set up', level: 1 })).toBeVisible();

  for (const [path, heading] of [
    ['/admin/on-the-day', 'On the day'],
    ['/admin/engage-the-room', 'Engage the room'],
    ['/admin/set-up', 'Set up'],
    ['/admin/more', 'More'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }

  // The names in the menu are the addresses.
  for (const [path, heading] of [
    ['/admin/announce', 'Announcements'],
    ['/admin/event-info', 'Event info'],
    ['/admin/test-plan', 'Test plan'],
    ['/admin/device-check', 'Device check'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }

  // Old links still land in the right place.
  await page.goto('/admin/checklist');
  await expect(page).toHaveURL(/\/admin\/test-plan$/);
  await page.goto('/admin/announcements');
  await expect(page).toHaveURL(/\/admin\/announce$/);
  await page.goto('/admin/event');
  await expect(page).toHaveURL(/\/admin\/event-info$/);

  // An unknown section is a not found page, not an error.
  await page.goto('/admin/nothing-here');
  await expect(
    page.getByText(/not found|cannot find|could not find|does not exist/i).first(),
  ).toBeVisible();
});

test('the sidebar shows the four sections, and opens the one you are in', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the sidebar is for laptop width');
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('menu2');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/admin/test-plan');

  const nav = page.getByRole('navigation', { name: 'Secretariat' });
  for (const name of ['On the day', 'Engage the room', 'Set up', 'More']) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  // Only the section you are in is open.
  await expect(nav.getByRole('link', { name: 'Device check' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Headcount' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'On the day' }).click();
  await expect(page).toHaveURL(/\/admin\/on-the-day$/);
  await expect(nav.getByRole('link', { name: 'Headcount' })).toBeVisible();
});

test('on a phone the tab you are on is brought into view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the tab row is for phone width');
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('menu3');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/admin/more');
  const tab = page
    .getByRole('navigation', { name: 'Secretariat' })
    .getByRole('link', { name: 'More', exact: true });
  await expect(tab).toBeInViewport({ ratio: 0.9 });
});

test('the secretariat finds a page by typing a word', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One run is enough.');
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('search-test');
  await page.getByLabel('Admin PIN').fill(process.env.E2E_ADMIN_PIN ?? '246810');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
  await page.keyboard.press('/');
  await page.keyboard.type('stock');
  const results = page.getByRole('listbox', { name: 'Pages that match' }).filter({ visible: true });
  await expect(results.getByRole('option').first()).toContainText('Door gifts');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/door-gifts$/);
});
