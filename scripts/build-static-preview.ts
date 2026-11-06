/**
 * Builds the static schedule preview that GitHub Pages serves.
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
import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

type Page = { url: string; file: string };

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

function startServer(): ChildProcess {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'start', '--port', String(PORT)],
    {
      env: {
        ...process.env,
        EVENT_CONFIG_PATH: 'config/.event.preview.json',
        // The snapshot must never offer a time override link.
        ALLOW_TIME_OVERRIDE: 'false',
        DEV_FAKE_NOW: '',
      },
      stdio: 'ignore',
      shell: process.platform === 'win32',
    },
  );
  return child;
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The portal did not start on ${ORIGIN}.`);
}

/**
 * Turns the live page into a flat file.
 *
 * Three jobs: drop the scripts, point every internal link at the Pages
 * sub-path, and turn the agenda's "?day=" links into real folders, since a
 * static host cannot read a query string.
 */
function toStaticHtml(html: string, days: string[]): string {
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

  // Anything still carrying a query string cannot work on a static host.
  out = out.replace(/(href=")\/([^"]*)\?[^"]*(")/g, '$1/$2$3');

  // Point absolute paths at the sub-path Pages serves from.
  if (BASE_PATH) {
    out = out.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
    out = out.replace(/url\(\/(?!\/)/g, `url(${BASE_PATH}/`);
  }

  // A banner, so nobody mistakes a snapshot for the running portal.
  const banner = `<div style="background:#042C75;color:#fff;padding:10px 16px;font:14px/1.4 Arial,Helvetica,sans-serif;text-align:center">This is a preview of the schedule only. Check in, feedback and the admin pages need the full portal.</div>`;
  out = out.replace(/(<body[^>]*>)/i, `$1${banner}`);

  return out;
}

async function save(page: Page, days: string[]): Promise<void> {
  const response = await fetch(`${ORIGIN}${page.url}`);
  if (!response.ok) {
    throw new Error(`${page.url} answered ${response.status}`);
  }

  const html = toStaticHtml(await response.text(), days);
  const target = join(OUT_DIR, page.file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

async function main(): Promise<void> {
  console.log('Building the static schedule preview');
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

  const server = startServer();
  try {
    await waitForServer();
    for (const page of pages) await save(page, days);
    console.log(`  saved ${pages.length} pages`);

    // A 404 that matches the rest of the site.
    await save({ url: '/no-such-page', file: '404.html' }, days).catch(async () => {
      await writeFile(join(OUT_DIR, '404.html'), '<h1>Page not found</h1>', 'utf8');
    });
  } finally {
    server.kill();
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
