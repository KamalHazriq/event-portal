import { expect, test, type Page } from '@playwright/test';

/**
 * Modules 2 and 3, the backup for Slido.
 *
 * The brief's "done when" for Q&A: a hidden question never appears to
 * attendees or on the big screen. For polls: votes add up, one per phone.
 *
 * Backup mode is a shared switch, so the full flow runs once, in the desktop
 * project, and switches it back off at the end.
 */

const PIN = process.env.E2E_ADMIN_PIN ?? '246810';
const SESSION = 'd1-keynote';

async function signIn(page: Page, label = 'desk-test'): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Which desk is this?').fill(label);
  await page.getByLabel('Admin PIN').fill(PIN);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/, level: 1 }),
  ).toBeVisible();
}

test('the backup admin pages need the PIN', async ({ page }) => {
  for (const path of ['/admin/qa', '/admin/polls']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  }
});

test('Slido fails: the portal takes over Q&A and polls, then hands back', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes a shared switch, so runs once.');
  test.setTimeout(90_000);

  const admin = await browser.newPage();
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await signIn(admin, 'mc');

  // Off by default: attendees have Slido, and the backup pages do not exist.
  expect((await phone.request.get('/poll')).status()).toBe(404);
  expect((await phone.request.get(`/qa/${SESSION}`)).status()).toBe(404);
  await phone.goto(`/session/${SESSION}`);
  await expect(phone.getByRole('link', { name: 'Ask a question' })).toHaveCount(0);

  await admin.goto('/admin/polls');
  await admin.getByRole('button', { name: 'Slido is down, switch to the portal' }).click();
  await expect(admin.getByText('On: attendees are using the portal')).toBeVisible();

  /* ------------------------------------------------------------ Q&A */
  const marker = Math.random().toString(36).slice(2, 8);
  const good = `Good question ${marker}`;
  const bad = `Rude question ${marker}`;

  await phone.goto(`/session/${SESSION}`);
  await phone.getByRole('link', { name: 'Ask a question' }).click();
  for (const text of [good, bad]) {
    await phone.getByLabel('Your question').fill(text);
    await phone.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(phone.getByRole('status')).toContainText('once a moderator has approved it');
  }
  // Nothing shows until approved.
  await expect(phone.getByText(good)).toHaveCount(0);

  await admin.goto(`/admin/qa?session=${SESSION}`);
  await admin.locator('li', { hasText: good }).getByRole('button', { name: 'Approve' }).click();
  await admin.locator('li', { hasText: bad }).getByRole('button', { name: 'Hide' }).click();
  await expect(admin.locator('li', { hasText: bad })).toHaveCount(0);

  // The approved one is public; the hidden one never is, on phone or projector.
  await phone.goto(`/qa/${SESSION}`);
  await expect(phone.getByText(good)).toBeVisible();
  await expect(phone.getByText(bad)).toHaveCount(0);
  await phone
    .locator('li', { hasText: good })
    .getByRole('button', { name: /Vote up/ })
    .click();
  await expect(
    phone.locator('li', { hasText: good }).getByRole('button', { name: /You voted. 1 votes/ }),
  ).toBeVisible();

  await admin.goto(`/admin/qa?session=${SESSION}`);
  await admin.getByRole('button', { name: 'Show top questions on the big screen' }).click();
  await admin.goto('/screen/qa');
  await expect(admin.getByText(good)).toBeVisible();
  await expect(admin.getByText(bad)).toHaveCount(0);

  /* ---------------------------------------------------------- polls */
  const question = `Test poll ${marker}`;
  await admin.goto('/admin/polls');
  await admin.getByLabel('Question').fill(question);
  await admin.getByLabel(/Choices, one per line/).fill('Tea\nCoffee');
  await admin.getByRole('button', { name: 'Add the poll' }).click();
  const card = admin.locator('li', { hasText: question });
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(card.getByText('Open for answers')).toBeVisible();

  await phone.goto('/');
  await phone.getByRole('link', { name: 'Answer the poll' }).click();
  await expect(phone.getByRole('heading', { level: 1 })).toHaveText(question);
  await phone.getByLabel('Coffee').check();
  await phone.getByRole('button', { name: 'Send my answer' }).click();
  await expect(phone.getByRole('status')).toContainText('your answer is in');
  // A second try from the same phone is not counted.
  const again = await phone.request.post('/api/polls/vote', {
    form: { pollId: 'ignored', choice: '0' },
    headers: { accept: 'application/json' },
  });
  expect(again.ok()).toBe(false);

  // Results stay hidden from the room until revealed.
  await expect(phone.getByText('Results,')).toHaveCount(0);
  await card.getByRole('button', { name: 'Reveal results' }).click();
  await phone.reload();
  await expect(phone.getByText('Results, 1 answer')).toBeVisible();

  await card.getByRole('button', { name: 'Put on the big screen' }).click();
  await admin.goto('/screen/poll');
  await expect(admin.getByText(question)).toBeVisible();
  await expect(admin.getByText('Coffee')).toBeVisible();

  /* ---------------------------------------------------- hand back */
  await admin.goto('/admin/polls');
  await admin.locator('li', { hasText: question }).getByRole('button', { name: 'Close' }).click();
  const closed = admin.locator('li', { hasText: question });
  await closed.getByText('Delete this poll').click();
  await closed.getByLabel(/Yes, delete it/).check();
  await closed.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(admin.locator('li', { hasText: question })).toHaveCount(0);

  await admin.getByRole('button', { name: 'Switch back to Slido' }).click();
  await expect(admin.getByText('Off: attendees are using Slido')).toBeVisible();
  expect((await phone.request.get('/poll')).status()).toBe(404);

  // Put the projector back on the welcome view for whoever runs next.
  await admin.goto('/admin/big-screen');
  await admin.getByRole('button', { name: /^Welcome/ }).click();
});
