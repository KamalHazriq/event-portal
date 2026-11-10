/**
 * Builds the static preview that GitHub Pages serves.
 *
 * Two halves:
 *
 * 1. The schedule, as attendees see it: home, agenda, session pages and
 *    resources, rendered from the real config at the real time.
 *
 * 2. A demo of everything else: the admin console, the big screen views,
 *    the report summary, the feedback forms and the previews. These need a
 *    database and a signed in desk, so the build makes a throwaway database,
 *    fills it with the invented demo data, signs in with a throwaway PIN and
 *    saves what the portal renders. Nothing real is involved: the database
 *    lives in the system temp folder and is deleted afterwards, and the PIN
 *    is random and never written anywhere.
 *
 * GitHub Pages can only serve flat files. It cannot run check in, feedback,
 * the admin console or anything that writes to a database. So this publishes
 * the read-only half of the portal: the home page, the agenda, every session
 * page and the resources page.
 *
 * It works by starting the real portal and saving what it renders, rather
 * than by keeping a second version of the pages. That means the preview can
 * never drift away from the real thing: there is only one set of components.
 *
 * The scripts are stripped out of the saved pages. Every one of these pages
 * is server rendered, so they are complete without JavaScript, and a snapshot
 * has nothing for a script to do anyway.
 *
 * Run it with: npm run preview:static
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { EventConfigSchema } from '../src/lib/event-schema';

/** Where the site lives: https://<user>.github.io/<repo> */
const BASE_PATH = process.env.PREVIEW_BASE_PATH ?? '/event-portal';
const PORT = Number(process.env.PREVIEW_PORT ?? 4310);
const OUT_DIR = join(process.cwd(), 'out');
const ORIGIN = `http://127.0.0.1:${PORT}`;

/** A config with the server-only modules switched off, so the saved pages
 *  carry no links to pages that will not exist on Pages. Generated from the
 *  real config, so the agenda never has to be kept in two places. */
const PREVIEW_CONFIG = join(process.cwd(), 'config', '.event.preview.json');

const DEMO_PORT = PORT + 1;
const DEMO_ORIGIN = `http://127.0.0.1:${DEMO_PORT}`;
const DEMO_DB = join(tmpdir(), `event-portal-demo-${process.pid}.db`);
const DEMO_DB_URL = `file:${DEMO_DB}`;
/** Random every build and never saved, so it unlocks nothing anywhere else. */
const DEMO_PIN = randomBytes(12).toString('hex');
/** Day 2 mid morning: three breakouts running and most people checked in. */
const DEMO_NOW = '2026-12-15T10:40';

type Page = { url: string; file: string };

const SCHEDULE_BANNER = `<div style="background:#042C75;color:#fff;padding:10px 16px;font:14px/1.4 Arial,Helvetica,sans-serif;text-align:center">A preview of the schedule. <a href="/admin/" style="color:#fff;font-weight:bold">See the admin console demo</a>.</div>`;

const DEMO_BANNER = `<div style="background:#A16207;color:#fff;padding:10px 16px;font:14px/1.4 Arial,Helvetica,sans-serif;text-align:center">Demo snapshot with invented people and answers, as if it were Day 2 at 10:40. Buttons and forms do nothing here. <a href="/" style="color:#fff;font-weight:bold">Back to the schedule</a>.</div>`;

async function makePreviewConfig(): Promise<ReturnType<typeof EventConfigSchema.parse>> {
  const raw = await readFile(join(process.cwd(), 'config', 'event.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const source = parsed as Record<string, unknown>;

  const features = { ...(source.features as Record<string, unknown>) };
  features.checkIn = false;
  features.feedback = false;
  features.bigScreen = false;

  const preview = { ...source, features };
  await writeFile(PREVIEW_CONFIG, JSON.stringify(preview, null, 2), 'utf8');

  return EventConfigSchema.parse(preview);
}

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function startServer(port: number, env: Record<string, string>): ChildProcess {
  return spawn(NPX, ['next', 'start', '--port', String(port)], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
}

async function waitForServer(origin: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The portal did not start on ${origin}.`);
}

/** Runs a command to completion against the demo database, or stops the build. */
function runDemoStep(label: string, args: string[]): void {
  const result = spawnSync(NPX, args, {
    env: {
      ...process.env,
      DATABASE_URL: DEMO_DB_URL,
      EVENT_CONFIG_PATH: 'config/event.json',
      ATTENDEES_CSV_PATH: 'config/attendees.sample.csv',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`Demo step failed: ${label}`);
}

/**
 * Turns the live page into a flat file.
 *
 * Three jobs: drop the scripts, point every internal link at the Pages
 * sub-path, and turn the agenda's "?day=" links into real folders, since a
 * static host cannot read a query string.
 */
function toStaticHtml(html: string, days: string[], banner: string): string {
  let out = html;

  // Scripts first, so their contents are not caught by the link rewriting.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\/>/gi, '');

  // And the tags that would fetch that JavaScript anyway. Without this the
  // preview downloads the whole bundle and then never runs a line of it.
  out = out.replace(/<link\b[^>]*\brel="(?:preload|modulepreload)"[^>]*>/gi, (tag) =>
    /as="script"|rel="modulepreload"|\.js"/i.test(tag) ? '' : tag,
  );

  // The agenda tabs: /agenda?day=day-2 becomes /agenda/day-2/
  for (const day of days) {
    out = out.replaceAll(`/agenda?day=${day}`, `/agenda/${day}/`);
  }

  // The report download becomes a demo file saved next to the pages.
  out = out.replaceAll('href="/api/reports/excel"', 'href="/demo/event-report-demo.xlsx"');

  // Anything still carrying a query string cannot work on a static host.
  out = out.replace(/(href=")\/([^"]*)\?[^"]*(")/g, '$1/$2$3');

  // Point absolute paths at the sub-path Pages serves from.
  if (BASE_PATH) {
    out = out.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
    out = out.replace(/url\(\/(?!\/)/g, `url(${BASE_PATH}/`);
  }

  // A banner, so nobody mistakes a snapshot for the running portal. Added
  // after the base path rewrite, so its links are rewritten here instead.
  const prefixed = BASE_PATH ? banner.replace(/href="\//g, `href="${BASE_PATH}/`) : banner;
  out = out.replace(/(<body[^>]*>)/i, `$1${prefixed}`);

  return out;
}

async function save(
  page: Page,
  days: string[],
  options: { origin?: string; cookie?: string; banner?: string } = {},
): Promise<void> {
  const origin = options.origin ?? ORIGIN;
  const response = await fetch(`${origin}${page.url}`, {
    headers: options.cookie ? { cookie: options.cookie } : {},
    redirect: 'manual',
  });
  if (!response.ok) {
    throw new Error(`${page.url} answered ${response.status}`);
  }

  const html = toStaticHtml(await response.text(), days, options.banner ?? SCHEDULE_BANNER);
  const target = join(OUT_DIR, page.file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

/** Signs the demo server in like a desk would, and returns the session cookie. */
async function signInDemo(): Promise<string> {
  const response = await fetch(`${DEMO_ORIGIN}/api/admin/sign-in`, {
    method: 'POST',
    body: new URLSearchParams({ operator: 'demo', pin: DEMO_PIN, next: '/admin' }),
    redirect: 'manual',
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('The demo sign in did not return a session.');
  return cookie;
}

/**
 * The countdown ticks against the real clock, so a target taken from the demo
 * data would read "35 days" on the snapshot. Put it 15 minutes after the real
 * moment of building instead.
 */
async function setDemoCountdown(timezone: string): Promise<void> {
  process.env.DATABASE_URL = DEMO_DB_URL;
  const { getData } = await import('../src/data/index');
  const { wallClockInZone } = await import('../src/lib/time');
  const { countdownTargetFromNow, SURPRISE_KEYS } = await import('../src/modules/admin/logic');
  const data = getData();
  await data.settings.set(
    SURPRISE_KEYS.targetAt,
    countdownTargetFromNow(wallClockInZone(timezone), 15),
  );
  await data.settings.set(SURPRISE_KEYS.enabled, 'true');
  await data.close();
}

async function buildDemo(days: string[]): Promise<number> {
  const config = EventConfigSchema.parse(
    JSON.parse(await readFile(join(process.cwd(), 'config', 'event.json'), 'utf8')),
  );

  runDemoStep('create the demo database', ['prisma', 'db', 'push']);
  runDemoStep('load the sample attendees', ['tsx', 'scripts/seed.ts']);
  runDemoStep('add the demo activity', ['tsx', 'scripts/seed-demo.ts']);
  await setDemoCountdown(config.event.timezone);

  const forms = config.days
    .flatMap((day) => day.sessions)
    .filter((s) => s.feedbackEnabled && !s.hidden)
    .map((s) => s.id)
    .concat('event');

  const adminPaths = [
    '',
    'live',
    'desk',
    'headcount',
    'feedback',
    ...forms.map((slug) => `feedback/${slug}`),
    'big-screen',
    'reports',
    'reports/summary',
    'name-tags',
    'qr-assets',
    'previews',
    'lucky-draw',
    'photos',
    'committees',
    'qa',
    'polls',
    'admins',
  ];

  const pages: Page[] = [
    ...adminPaths.map((p) => ({
      url: `/admin${p ? `/${p}` : ''}`,
      file: `admin/${p ? `${p}/` : ''}index.html`,
    })),
    { url: '/screen', file: 'screen/index.html' },
    ...['welcome', 'now-next', 'arrivals', 'countdown', 'lucky-draw'].map((view) => ({
      url: `/screen/${view}`,
      file: `screen/${view}/index.html`,
    })),
    ...forms.map((slug) => ({ url: `/feedback/${slug}`, file: `feedback/${slug}/index.html` })),
  ];

  const server = startServer(DEMO_PORT, {
    DATABASE_URL: DEMO_DB_URL,
    EVENT_CONFIG_PATH: 'config/event.json',
    ADMIN_PIN: DEMO_PIN,
    AUTH_MODE: 'none',
    ALLOW_TIME_OVERRIDE: 'true',
    DEV_FAKE_NOW: DEMO_NOW,
  });

  try {
    await waitForServer(DEMO_ORIGIN);
    const cookie = await signInDemo();
    for (const page of pages) {
      await save(page, days, { origin: DEMO_ORIGIN, cookie, banner: DEMO_BANNER });
    }

    // The report, as the download button would give it.
    const report = await fetch(`${DEMO_ORIGIN}/api/reports/excel`, { headers: { cookie } });
    if (!report.ok) throw new Error(`The demo report answered ${report.status}`);
    await mkdir(join(OUT_DIR, 'demo'), { recursive: true });
    await writeFile(
      join(OUT_DIR, 'demo', 'event-report-demo.xlsx'),
      Buffer.from(await report.arrayBuffer()),
    );
  } finally {
    server.kill();
  }

  return pages.length;
}

async function main(): Promise<void> {
  console.log('Building the static preview');
  console.log(`  base path: ${BASE_PATH}`);

  const config = await makePreviewConfig();
  const days = config.days.map((day) => day.id);
  const sessions = config.days.flatMap((day) =>
    day.sessions.filter((session) => !session.hidden).map((session) => session.id),
  );

  const pages: Page[] = [
    { url: '/', file: 'index.html' },
    { url: '/resources', file: 'resources/index.html' },
    { url: '/agenda', file: 'agenda/index.html' },
    ...days.map((day) => ({ url: `/agenda?day=${day}`, file: `agenda/${day}/index.html` })),
    ...sessions.map((id) => ({ url: `/session/${id}`, file: `session/${id}/index.html` })),
  ];

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const server = startServer(PORT, {
    EVENT_CONFIG_PATH: 'config/.event.preview.json',
    // The schedule snapshot must never offer a time override link.
    ALLOW_TIME_OVERRIDE: 'false',
    DEV_FAKE_NOW: '',
  });
  try {
    await waitForServer(ORIGIN);
    for (const page of pages) await save(page, days);
    console.log(`  saved ${pages.length} pages`);

    // A 404 that matches the rest of the site.
    await save({ url: '/no-such-page', file: '404.html' }, days).catch(async () => {
      await writeFile(join(OUT_DIR, '404.html'), '<h1>Page not found</h1>', 'utf8');
    });
  } finally {
    server.kill();
  }

  try {
    const saved = await buildDemo(days);
    console.log(`  saved ${saved} demo pages and the demo report`);
  } finally {
    await rm(DEMO_DB, { force: true });
    await rm(`${DEMO_DB}-journal`, { force: true });
  }

  // The stylesheets and fonts the saved pages point at.
  await cp(join(process.cwd(), '.next', 'static'), join(OUT_DIR, '_next', 'static'), {
    recursive: true,
  });
  await cp(join(process.cwd(), 'public'), OUT_DIR, { recursive: true });

  // Without this, Pages hides every folder whose name starts with_underscore.
  await writeFile(join(OUT_DIR, '.nojekyll'), '', 'utf8');

  await rm(PREVIEW_CONFIG, { force: true });

  console.log(`  wrote ${OUT_DIR}`);
  console.log('Done.');
}

main().catch(async (error) => {
  await rm(PREVIEW_CONFIG, { force: true });
  await rm(DEMO_DB, { force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
