/**
 * The simulated registration run from the brief.
 *
 * Module 4 is done when "the registration desk can check in 80 people in
 * under 15 minutes". This drives the real HTTP endpoints against a running
 * portal and reports how long it actually takes, so the claim is measured
 * rather than assumed.
 *
 * Run it against a production build:
 *
 *   npm run build
 *   npm run start
 *   npm run simulate:check-in
 *
 * Nothing here is a real person. It uses the dummy list only, and it refuses
 * to run if the database holds a list that is not the sample one.
 */
import { isAbsolute, join } from 'node:path';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

const BASE_URL = (process.env.SIMULATE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const PIN = process.env.ADMIN_PIN ?? '';
const DESKS = Number(process.env.SIMULATE_DESKS ?? 2);
const TARGET_MINUTES = 15;

type Summary = {
  attempted: number;
  checkedIn: number;
  alreadyIn: number;
  notFound: number;
  failed: number;
  durations: number[];
};

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 0;
}

/** Signs a desk in and returns its session cookie. */
async function signIn(operator: string): Promise<string> {
  const form = new URLSearchParams({ pin: PIN, operator, next: '/admin' });
  const response = await fetch(`${BASE_URL}/api/admin/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    redirect: 'manual',
  });

  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = /ep_desk=([^;]+)/.exec(setCookie);
  if (!match?.[1] || match[1].length < 5) {
    throw new Error(
      `${operator} could not sign in. Check ADMIN_PIN in .env.local matches the running server.`,
    );
  }
  return `ep_desk=${match[1]}`;
}

async function main(): Promise<void> {
  if (PIN.length === 0) {
    console.error('No ADMIN_PIN set. Add it to .env.local first.');
    process.exit(1);
  }

  // Read the people straight from the sample CSV, so this never touches a
  // real attendee list even if one is loaded.
  const { readFileSync } = await import('node:fs');
  const { parseAttendeeCsv } = await import('../src/lib/attendee-import');
  const { getData } = await import('../src/data/index');
  const { getEventConfig } = await import('../src/lib/config');

  const csvPath = (() => {
    const relative = 'config/attendees.sample.csv';
    return isAbsolute(relative) ? relative : join(process.cwd(), relative);
  })();

  const sample = parseAttendeeCsv(readFileSync(csvPath, 'utf8'));
  const config = getEventConfig();
  const day = config.days[0];
  if (!day) throw new Error('The event config has no days.');

  const data = getData();
  const everyone = await data.attendees.list();
  const sampleStaffNumbers = new Set(sample.rows.map((row) => row.staffNo));
  const unknown = everyone.filter((person) => !sampleStaffNumbers.has(person.staffNo));

  if (unknown.length > 0) {
    console.error(
      `The database holds ${unknown.length} people who are not in the sample list.\n` +
        'This looks like a real attendee list. Refusing to run a simulation against it.\n' +
        'Run "npm run db:reset" to go back to dummy data first.',
    );
    process.exit(1);
  }

  // Everyone who is not secretariat: the 78 attendees from the brief.
  const attendees = everyone.filter((person) => !person.isSecretariat);
  console.log(`Portal:    ${BASE_URL}`);
  console.log(`Day:       ${day.id}`);
  console.log(`People:    ${attendees.length}`);
  console.log(`Desks:     ${DESKS}`);
  console.log('');

  // Start from nobody having arrived.
  for (const person of attendees) {
    await data.checkIns.remove(person.id, day.id);
  }

  const cookies = await Promise.all(
    Array.from({ length: DESKS }, (_, index) => signIn(`sim-desk-${index + 1}`)),
  );

  const summary: Summary = {
    attempted: 0,
    checkedIn: 0,
    alreadyIn: 0,
    notFound: 0,
    failed: 0,
    durations: [],
  };

  const queue = [...attendees];
  const startedAt = Date.now();

  /** One desk, working through the queue, scanning as fast as it can. */
  const runDesk = async (cookie: string): Promise<void> => {
    for (;;) {
      const person = queue.shift();
      if (!person) return;

      const began = Date.now();
      summary.attempted += 1;

      try {
        const response = await fetch(`${BASE_URL}/api/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          // Exactly what the scanner sends: the URL printed on the name tag.
          body: JSON.stringify({
            payload: `${config.event.portalUrl.replace(/\/+$/, '')}/c/${person.checkInToken}`,
            dayId: day.id,
            method: 'qr',
          }),
        });

        const body = (await response.json()) as { outcome?: string };
        summary.durations.push(Date.now() - began);

        if (body.outcome === 'checked-in') summary.checkedIn += 1;
        else if (body.outcome === 'already-checked-in') summary.alreadyIn += 1;
        else if (body.outcome === 'not-found') summary.notFound += 1;
        else summary.failed += 1;
      } catch {
        summary.failed += 1;
        summary.durations.push(Date.now() - began);
      }
    }
  };

  await Promise.all(cookies.map(runDesk));

  const elapsedMs = Date.now() - startedAt;
  const sorted = [...summary.durations].sort((a, b) => a - b);
  const headcount = await data.checkIns.headcount(day.id);

  console.log('Results');
  console.log(`  checked in:     ${summary.checkedIn}`);
  console.log(`  already in:     ${summary.alreadyIn}`);
  console.log(`  not found:      ${summary.notFound}`);
  console.log(`  failed:         ${summary.failed}`);
  console.log('');
  console.log('Timing');
  console.log(`  total:          ${(elapsedMs / 1000).toFixed(1)} seconds`);
  console.log(`  per person:     ${(elapsedMs / summary.attempted).toFixed(0)} ms of server time`);
  console.log(`  median request: ${percentile(sorted, 0.5)} ms`);
  console.log(`  95th percent:   ${percentile(sorted, 0.95)} ms`);
  console.log(`  slowest:        ${sorted[sorted.length - 1] ?? 0} ms`);
  console.log('');
  console.log(`Headcount now:    ${headcount.arrived} / ${headcount.expected}`);
  console.log('');

  // The real desk spends most of its time on people, not on the portal. This
  // measures the part the portal is responsible for.
  const everyoneIn = summary.checkedIn === attendees.length && summary.failed === 0;
  const withinTarget = elapsedMs < TARGET_MINUTES * 60 * 1000;

  if (everyoneIn && withinTarget) {
    const budgetPerPerson = (TARGET_MINUTES * 60 * 1000) / attendees.length;
    const spent = elapsedMs / attendees.length;
    console.log(
      `PASS. ${attendees.length} people in ${(elapsedMs / 1000).toFixed(1)} seconds, ` +
        `against a target of ${TARGET_MINUTES} minutes.`,
    );
    console.log(
      `The portal used ${spent.toFixed(0)} ms per person of the ` +
        `${budgetPerPerson.toFixed(0)} ms available, leaving the rest for the queue itself.`,
    );
  } else {
    console.log('FAIL.');
    if (!everyoneIn) console.log(`  Expected ${attendees.length} check ins.`);
    if (!withinTarget) console.log(`  Took longer than ${TARGET_MINUTES} minutes.`);
    process.exitCode = 1;
  }

  await data.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
