import { defineConfig, devices } from '@playwright/test';

/**
 * A few key flows only (brief section 7).
 *
 * By default these run against a production build, which is what will be
 * running in the ballroom. That matters: "next dev" and "next start" do not
 * render a notFound() page the same way, and only the production behaviour is
 * worth testing.
 *
 * Set PLAYWRIGHT_DEV=1 for a faster loop against the dev server while you are
 * writing a test. Point PLAYWRIGHT_BASE_URL at a running server to skip
 * starting one.
 *
 * Both projects run on Chromium so there is nothing extra to download. The
 * phone project is pinned to 375 px wide, the narrow screen the brief asks
 * the portal to work on. To also cover the engine behind iPhone Safari, add a
 * project using devices['iPhone 13'] and run "npx playwright install webkit".
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const useDevServer = process.env.PLAYWRIGHT_DEV === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: { baseURL, trace: 'on-first-retry' },

  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: useDevServer ? `npx next dev --port ${PORT}` : `npx next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // The ?now= override is refused on a production build unless this is
        // set, and the tests pin the clock so they pass on any date.
        env: {
          // The browser tests are written against the frozen dummy agenda,
          // not the real one, which changes as the event is planned.
          EVENT_CONFIG_PATH: 'config/event.test.json',
          ALLOW_TIME_OVERRIDE: 'true',
          // The tests seed and reset data, so they run on local SQLite unless
          // a run asks for Postgres. Next does not override names already
          // set, so a .env.local pointing at Neon cannot leak in.
          DATA_ADAPTER: process.env.DATA_ADAPTER ?? 'sqlite',
          // Next fills in .env.local only for names it does not already have,
          // so this wins and the tests do not depend on anyone's local PIN.
          ADMIN_PIN: process.env.E2E_ADMIN_PIN ?? '246810',
        },
      },
});
