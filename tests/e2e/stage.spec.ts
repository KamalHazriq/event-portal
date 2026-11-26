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

test('a pretend scan time shows Early or Late without the real date', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared state, so runs once.');
  await signIn(page);
  await page.goto('/admin/desk?day=day-3');
  await expect(page.getByText('Using real time.')).toBeVisible();

  const search = await page.request.get('/api/attendees/search?q=an');
  const people = (await search.json()) as { results?: { id: string }[] } | { id: string }[];
  const list = Array.isArray(people) ? people : (people.results ?? []);
  const id = list[0]?.id;
  expect(id).toBeTruthy();

  await page.getByLabel('Pretend it is').fill('2020-01-01T03:00');
  await page.getByRole('button', { name: 'Use this time' }).click();
  await expect(page.getByText(/Scans are recorded as 2020-01-01 at 03:00/)).toBeVisible();
  const early = await page.request.post('/api/check-in', {
    data: { dayId: 'day-3', attendeeId: id, method: 'manual' },
  });
  expect((await early.json()).timing.early).toBe(true);

  // Undo, then scan again "late".
  await page.request.post('/api/check-in/undo-all', { data: { dayId: 'day-3', confirm: 'UNDO' } });
  await page.getByLabel('Pretend it is').fill('2099-01-01T23:00');
  await page.getByRole('button', { name: 'Use this time' }).click();
  await expect(page.getByText(/Scans are recorded as 2099-01-01 at 23:00/)).toBeVisible();
  const late = await page.request.post('/api/check-in', {
    data: { dayId: 'day-3', attendeeId: id, method: 'manual' },
  });
  expect((await late.json()).timing.early).toBe(false);

  // Put everything back.
  await page.request.post('/api/check-in/undo-all', { data: { dayId: 'day-3', confirm: 'UNDO' } });
  await page.getByRole('button', { name: 'Back to real time' }).click();
  await expect(page.getByText('Using real time.')).toBeVisible();
});
