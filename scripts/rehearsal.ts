/**
 * Dress rehearsal against the live portal, before the event.
 *
 *   REHEARSAL_PASS=<event code> npm run rehearsal -- https://<the portal address>
 *
 * Talks to the site only over the internet, like real phones, and writes
 * nothing: safe to run against the real event database at any time.
 *
 *   1. The event pass: no code is refused, a wrong code is refused, the
 *      right code lets you in and is remembered.
 *   2. Every attendee page loads with the pass: home, the agenda for each
 *      day, every session, resources, photos, leaderboard, guide.
 *   3. 100 phones at once (PHONES to change), each getting the pass and
 *      opening the pages a person opens in the first minute. Errors and
 *      response times are reported.
 *
 * Exit code 0 only when every check passes.
 *
 * The full browser test suite runs against a local copy of the same build
 * with invented data (npm run test:e2e); it writes test data, so it is not
 * pointed at the live database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Config = {
  days: { id: string; sessions: { id: string }[] }[];
  features: Record<string, boolean>;
};

const BASE = (process.argv[2] ?? '').replace(/\/$/, '');
const PASS = process.env.REHEARSAL_PASS ?? '';
const PHONES = Number(process.env.PHONES ?? 100);
/** The slowest response a phone on hotel Wi-Fi should wait, in ms. */
const SLOW_MS = Number(process.env.SLOW_MS ?? 3000);

let failures = 0;
function check(label: string, pass: boolean, detail = ''): void {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `: ${detail}` : ''}`);
}

/** One pretend phone: keeps its cookies like a browser. */
class Phone {
  private cookies = new Map<string, string>();

  async get(path: string): Promise<{ status: number; ms: number; body: string; location: string }> {
    const started = performance.now();
    const response = await fetch(`${BASE}${path}`, {
      redirect: 'manual',
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        'user-agent': 'event-portal-rehearsal',
      },
    });
    const body = await response.text();
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const eq = pair?.indexOf('=') ?? -1;
      if (pair && eq > 0) this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    return {
      status: response.status,
      ms: performance.now() - started,
      body,
      location: response.headers.get('location') ?? '',
    };
  }

  has(cookie: string): boolean {
    return this.cookies.has(cookie);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

function pagesFor(config: Config): string[] {
  const pages = ['/', '/agenda', '/guide'];
  for (const day of config.days) pages.push(`/agenda?day=${day.id}`);
  for (const day of config.days) for (const s of day.sessions) pages.push(`/session/${s.id}`);
  if (config.features.resources) pages.push('/resources');
  if (config.features.photoWall) pages.push('/photos');
  if (config.features.leaderboard) pages.push('/leaderboard', '/me');
  // Not /committees: it stays hidden (404) until the secretariat opens it.
  return pages;
}

async function main(): Promise<void> {
  if (!/^https?:\/\//.test(BASE)) {
    throw new Error('Give the portal address: npm run rehearsal -- https://...');
  }
  if (!PASS) throw new Error('Set REHEARSAL_PASS to the event code.');

  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'config', 'event.json'), 'utf8'),
  ) as Config;
  const pages = pagesFor(config);
  console.log(`Rehearsal against ${BASE}: ${pages.length} pages, ${PHONES} phones\n`);

  /* ------------------------------------------------------- 1. the pass */
  const stranger = new Phone();
  const cold = await stranger.get('/agenda');
  check('a phone with no code is stopped', cold.status === 401, `HTTP ${cold.status}`);
  check('it sees the participants only page', /participants/i.test(cold.body));
  console.log(`      first response took ${Math.round(cold.ms)} ms (includes any cold start)`);

  const wrong = await stranger.get('/agenda?pass=not-the-code');
  check('a wrong code is refused', wrong.status === 401 && /not right/i.test(wrong.body));

  const entry = await stranger.get(`/agenda?pass=${encodeURIComponent(PASS)}`);
  check(
    'the right code lets you in',
    entry.status === 307 && stranger.has('event_pass'),
    `HTTP ${entry.status}`,
  );
  check(
    'the code is taken out of the address bar',
    entry.location.length > 0 && !entry.location.includes('pass='),
  );
  const api = await new Phone().get('/api/headcount?dayId=day-1');
  check('the API is closed without the code', api.status === 401, `HTTP ${api.status}`);

  /* ---------------------------------------------------- 2. every page */
  for (const path of pages) {
    const page = await stranger.get(path);
    check(`page ${path}`, page.status === 200, `HTTP ${page.status}, ${Math.round(page.ms)} ms`);
  }

  /* ------------------------------------------------ 3. phones at once */
  // What someone does in the first minute after scanning the welcome QR.
  const journey = [
    `/?pass=${encodeURIComponent(PASS)}`,
    '/',
    '/agenda',
    pages.find((p) => p.startsWith('/session/')) ?? '/agenda',
    config.features.leaderboard ? '/leaderboard' : '/guide',
  ];
  const times: number[] = [];
  const errors: string[] = [];
  const started = performance.now();
  await Promise.all(
    Array.from({ length: PHONES }, async () => {
      const phone = new Phone();
      for (const path of journey) {
        try {
          const result = await phone.get(path);
          times.push(result.ms);
          // The first step answers with a redirect into the portal.
          if (result.status !== 200 && result.status !== 307) {
            errors.push(`${path} HTTP ${result.status}`);
          }
        } catch (error) {
          errors.push(`${path} ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  times.sort((a, b) => a - b);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const max = times[times.length - 1] ?? 0;

  console.log(
    `\n      ${PHONES} phones, ${times.length} requests in ${seconds.toFixed(1)} s: ` +
      `median ${Math.round(p50)} ms, 95% under ${Math.round(p95)} ms, slowest ${Math.round(max)} ms`,
  );
  check(`${PHONES} phones at once, no errors`, errors.length === 0, `${errors.length} errors`);
  if (errors.length > 0) console.log(`      first errors: ${errors.slice(0, 5).join('; ')}`);
  check(`95% of responses under ${SLOW_MS} ms`, p95 < SLOW_MS, `${Math.round(p95)} ms`);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
