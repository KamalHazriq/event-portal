import { expect, test } from '@playwright/test';

/**
 * Module 1 happy path.
 *
 * The ?now= parameter pins the clock, so these tests pass whatever the real
 * date is. It only works while the dev server is running, or when
 * ALLOW_TIME_OVERRIDE is set, which is deliberate.
 */

const DURING_KEYNOTE = '2026-12-14T15:00';
const DURING_BREAKOUTS = '2026-12-15T11:00';
const BEFORE_THE_EVENT = '2026-11-04T09:00';

test('the home page shows the event and what is coming up', async ({ page }) => {
  await page.goto(`/?now=${BEFORE_THE_EVENT}`);

  await expect(
    page.getByRole('heading', { name: 'D&I Power Summit 2026', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Leading the energy transition together')).toBeVisible();

  // Before the event starts, the first session is the one to show.
  await expect(page.getByRole('heading', { name: 'First up' })).toBeVisible();
  await expect(page.getByText('Registration and light lunch').first()).toBeVisible();

  // The test mode banner has to be obvious, or a wrong clock looks like a bug.
  await expect(page.getByText('Test mode: pretending it is now')).toBeVisible();
});

test('the home page highlights the session happening now', async ({ page }) => {
  await page.goto(`/?now=${DURING_KEYNOTE}`);

  await expect(page.getByRole('heading', { name: 'Happening now' })).toBeVisible();
  await expect(page.getByText('Keynote: powering the nation through change').first()).toBeVisible();

  // And it says what follows.
  await expect(page.getByRole('heading', { name: 'Next', exact: true })).toBeVisible();
  await expect(page.getByText('Coffee break').first()).toBeVisible();
});

test('both parallel breakouts show as happening now', async ({ page }) => {
  await page.goto(`/?now=${DURING_BREAKOUTS}`);

  await expect(page.getByRole('heading', { name: 'Happening now' })).toBeVisible();
  await expect(page.getByText('Breakout A: delivery and reliability').first()).toBeVisible();
  await expect(page.getByText('Breakout B: digital and data').first()).toBeVisible();
  await expect(page.getByText('Breakout C: people and capability').first()).toBeVisible();
});

test('the agenda has a tab per day and keeps the pinned clock', async ({ page }) => {
  await page.goto(`/agenda?now=${DURING_KEYNOTE}`);

  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();

  const dayNav = page.getByRole('navigation', { name: 'Choose a day' });
  await expect(dayNav.getByRole('link', { name: /Day 1/ })).toBeVisible();
  await expect(dayNav.getByRole('link', { name: /Day 2/ })).toBeVisible();
  await expect(dayNav.getByRole('link', { name: /Day 3/ })).toBeVisible();

  // Day 1 is selected because the pinned clock is on Day 1.
  await expect(dayNav.getByRole('link', { name: /Day 1/ })).toHaveAttribute('aria-current', 'page');

  await dayNav.getByRole('link', { name: /Day 2/ }).click();

  await expect(page.getByRole('heading', { name: /^Day 2/ })).toBeVisible();
  await expect(page.getByText('Breakout A: delivery and reliability')).toBeVisible();
  // The override must survive the tap, or clicking around resets the clock.
  await expect(page).toHaveURL(/now=/);
});

test('a session page shows times, objectives, speakers and the Slido link', async ({ page }) => {
  await page.goto(`/session/d1-keynote?now=${DURING_KEYNOTE}`);

  await expect(
    page.getByRole('heading', { name: 'Keynote: powering the nation through change', level: 1 }),
  ).toBeVisible();

  await expect(page.getByText('Monday 14 December 2026, 2:50 pm to 3:50 pm')).toBeVisible();
  await expect(page.getByText('Grand Ballroom', { exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'What you will walk away with' })).toBeVisible();
  await expect(page.getByText('Understand the three year outlook')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Speaker', exact: true })).toBeVisible();
  await expect(page.getByText('Group Chief Executive Officer')).toBeVisible();

  // Q&A runs on Slido for this event, with the link coming from config.
  const slido = page.getByRole('link', { name: 'Join Slido' });
  await expect(slido).toBeVisible();
  await expect(slido).toHaveAttribute('href', /sli\.do/);
  await expect(page.getByText('#POWER2026')).toBeVisible();

  // It is live right now, so it says so.
  await expect(page.getByText('Happening now')).toBeVisible();
});

test('a session with no Q&A does not show a Slido button', async ({ page }) => {
  await page.goto('/session/d1-registration');

  await expect(page.getByRole('heading', { name: 'Registration and light lunch' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join Slido' })).toHaveCount(0);
});

test('you can walk from one session to the next', async ({ page }) => {
  await page.goto('/session/d1-opening');

  await page.getByRole('link', { name: /^Next:/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Ice breaker: who is in the room', level: 1 }),
  ).toBeVisible();

  await page.getByRole('link', { name: /^Previous:/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome and opening remarks', level: 1 }),
  ).toBeVisible();
});

test('the resources page lists the take aways', async ({ page }) => {
  await page.goto('/resources');

  await expect(page.getByRole('heading', { name: 'Resources', level: 1 })).toBeVisible();

  const slides = page.getByRole('link', { name: /Summit slide pack/ });
  await expect(slides).toBeVisible();
  // External links must not hand the referrer or window over.
  await expect(slides).toHaveAttribute('rel', /noopener/);
  await expect(slides).toHaveAttribute('target', '_blank');
});

test('an unknown session shows a friendly page, not an error', async ({ page }) => {
  const response = await page.goto('/session/does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'We cannot find that session' })).toBeVisible();
});

test('the main navigation works and marks the current page', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Agenda' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Resources' }).click();
  await expect(page.getByRole('heading', { name: 'Resources', level: 1 })).toBeVisible();
});

test('nothing on the page reaches an external service', async ({ page }) => {
  const offSite: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local && url.protocol.startsWith('http')) offSite.push(request.url());
  });

  await page.goto('/');
  await page.goto('/agenda');
  await page.goto('/session/d1-keynote');
  await page.goto('/resources');
  await page.waitForLoadState('networkidle');

  // Brief hard rule 1: no AI, no analytics, no tracking, no external calls.
  expect(offSite).toEqual([]);
});

test('the phone layout does not scroll sideways at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/?now=${DURING_BREAKOUTS}`);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
