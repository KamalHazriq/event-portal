import { expect, test, type Page } from '@playwright/test';

/**
 * The agenda and event details can be edited from the secretariat pages.
 * These change what every page shows, so this runs in the shared-switches
 * project, after everything else, and resets what it changed.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill('desk-content');
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

async function reset(page: Page): Promise<void> {
  await page.goto('/admin/event-info');
  await page.getByLabel('Yes, throw away all my changes').check();
  await page.getByRole('button', { name: 'Reset everything' }).click();
  await expect(page.getByText(/Reset\. Everything is back to the event file/)).toBeVisible();
}

test('edit a session, add one, and get a plain reason when it does not fit', async ({
  page,
  request,
}) => {
  await signIn(page);
  await reset(page);
  try {
    await page.goto('/admin/agenda');
    const session = page.locator('details', { hasText: 'Welcome and opening remarks' }).first();
    await session.locator('summary').click();
    await session.getByLabel('Title', { exact: true }).fill('Opening, edited by the secretariat');
    await session.getByLabel('Room').fill('Room 42');
    await session.getByRole('button', { name: 'Save this session' }).click();
    await expect(page.getByText('Saved. It is live now.')).toBeVisible();
    await expect(page.getByText('Opening, edited by the secretariat').first()).toBeVisible();

    // Attendees see it straight away.
    const agenda = await request.get('/agenda?day=day-1');
    expect(await agenda.text()).toContain('Opening, edited by the secretariat');

    // Backwards times are refused, in plain words, and nothing is saved.
    await page.goto('/admin/agenda');
    const again = page
      .locator('details', { hasText: 'Opening, edited by the secretariat' })
      .first();
    await again.locator('summary').click();
    await again.getByLabel('Starts').fill('12:00');
    await again.getByLabel('Ends').fill('11:00');
    await again.getByRole('button', { name: 'Save this session' }).click();
    const refused = page.getByRole('alert').filter({ hasText: 'That was not saved.' });
    await expect(refused).toContainText('end time must be after start time');

    // Add a session to Day 1.
    await page.goto('/admin/agenda');
    await page.getByText('+ Add a session to Day 1').click();
    const form = page.locator('#add-day-1 form');
    await form.getByLabel('Title').fill('Bus to the dinner');
    await form.getByLabel('Starts').fill('18:30');
    await form.getByLabel('Ends').fill('19:00');
    await form.getByLabel('Room').fill('Hotel lobby');
    await form.getByRole('button', { name: 'Add session' }).click();
    await expect(page.getByText('Saved. It is live now.')).toBeVisible();
    expect(await (await request.get('/agenda?day=day-1')).text()).toContain('Bus to the dinner');

    // An added session can be deleted again.
    const added = page.locator('details', { hasText: 'Bus to the dinner' }).first();
    // A session just added is already open.
    if (!(await added.evaluate((el) => (el as HTMLDetailsElement).open))) {
      await added.locator('summary').click();
    }
    await added.getByRole('button', { name: 'Delete this session' }).click();
    // The delete saves in the background: wait until the agenda drops it.
    await expect
      .poll(async () => (await request.get('/agenda?day=day-1')).text(), { timeout: 10_000 })
      .not.toContain('Bus to the dinner');
  } finally {
    await reset(page);
  }
  expect(await (await request.get('/agenda?day=day-1')).text()).not.toContain(
    'Opening, edited by the secretariat',
  );
});

test('edit the event details, an info line and a resource', async ({ page, request }) => {
  await signIn(page);
  await reset(page);
  try {
    await page.goto('/admin/event-info');
    await page.getByLabel('Footer credit').fill('© 2026 Test credit line');
    await page.getByLabel('Venue', { exact: true }).fill('The Test Hall');
    await page.getByRole('button', { name: 'Save the event details' }).click();
    await expect(page.getByText('Saved. It is live now.')).toBeVisible();
    const info = await (await request.get('/info')).text();
    expect(info).toContain('© 2026 Test credit line');
    expect(info).toContain('The Test Hall');

    // An info line that read "Coming soon" now has its text.
    await page.goto('/admin/event-info');
    const parking = page.locator('fieldset', { hasText: 'Getting there' });
    await parking.getByLabel('Text', { exact: true }).last().fill('Level 3 car park, free');
    await page.getByRole('button', { name: 'Save the info page' }).click();
    await expect(page.getByText('Saved. It is live now.')).toBeVisible();
    expect(await (await request.get('/info')).text()).toContain('Level 3 car park, free');

    // A resource link is added, and a bad link is refused.
    await page.goto('/admin/event-info');
    const fresh = page.locator('fieldset', { hasText: 'Add a resource' }).first();
    await fresh.getByLabel('Title').fill('Summit slides');
    await fresh.getByLabel(/^Link/).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save the resources' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That was not saved.' })).toBeVisible();
    await page.goto('/admin/event-info');
    const fresh2 = page.locator('fieldset', { hasText: 'Add a resource' }).first();
    await fresh2.getByLabel('Title').fill('Summit slides');
    await fresh2.getByLabel(/^Link/).fill('https://files.example.org/slides.pdf');
    await page.getByRole('button', { name: 'Save the resources' }).click();
    await expect(page.getByText('Saved. It is live now.')).toBeVisible();
    expect(await (await request.get('/resources')).text()).toContain('Summit slides');
  } finally {
    await reset(page);
  }
});

test('the editor pages are shut to anyone without the PIN', async ({ request }) => {
  for (const path of ['/admin/agenda', '/admin/event-info']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain('/admin/sign-in');
  }
});
