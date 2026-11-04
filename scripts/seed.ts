/**
 * Fills the local database with dummy data so the portal can be demonstrated
 * without any real people (brief section 7).
 *
 * Run it with: npm run db:seed
 * Start over with: npm run db:reset
 *
 * Right now it loads the attendee list. Module 1 needs no stored data at all,
 * but the list is what Module 4 check in will use, and having it in place
 * makes the admin pages worth looking at. Each later module adds its own
 * section here.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { getData } from '../src/data/index';
import { parseAttendeeCsv } from '../src/lib/attendee-import';
import { tryLoadEventConfig } from '../src/lib/config';

// Loaded the same way prisma.config.ts does it: Next reads .env.local for the
// app, but a plain script has to ask for it. Every module above reads the
// environment inside a function, not on import, so this still happens first.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

function resolveCsvPath(): string {
  const fromEnv = process.env.ATTENDEES_CSV_PATH?.trim();
  const relative = fromEnv && fromEnv.length > 0 ? fromEnv : 'config/attendees.sample.csv';
  return isAbsolute(relative) ? relative : join(process.cwd(), relative);
}

async function main(): Promise<void> {
  const configResult = tryLoadEventConfig();
  if (!configResult.ok) {
    console.error('The event config is not valid, so there is nothing to seed against:');
    for (const problem of configResult.error.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const config = configResult.config;
  console.log(`Event: ${config.event.name}`);
  console.log(`Days:  ${config.days.map((day) => day.id).join(', ')}`);

  const data = getData();
  const health = await data.healthCheck();
  if (!health.ok) {
    console.error(health.detail);
    process.exit(1);
  }

  const csvPath = resolveCsvPath();
  console.log(`\nReading attendees from ${csvPath}`);

  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf8');
  } catch {
    console.error(
      `Could not read ${csvPath}.\n` +
        'Run "npm run attendees:generate" to create the dummy list, or set\n' +
        'ATTENDEES_CSV_PATH in .env.local to point at your own file.',
    );
    process.exit(1);
  }

  const parsed = parseAttendeeCsv(csvText);
  if (parsed.problems.length > 0) {
    console.warn(`\n${parsed.problems.length} row(s) could not be read:`);
    for (const problem of parsed.problems.slice(0, 10)) {
      console.warn(`  line ${problem.row}: ${problem.reason}`);
    }
    if (parsed.problems.length > 10) {
      console.warn(`  ... and ${parsed.problems.length - 10} more`);
    }
  }

  const result = await data.attendees.importRows(parsed.rows);
  const total = await data.attendees.count();
  const secretariat = parsed.rows.filter((row) => row.isSecretariat).length;

  console.log('\nAttendees loaded.');
  console.log(`  created:   ${result.created}`);
  console.log(`  updated:   ${result.updated}`);
  console.log(`  unchanged: ${result.unchanged}`);
  console.log(`  skipped:   ${result.skipped.length}`);
  console.log(`\nIn the database now: ${total} people`);
  console.log(`  attendees:   ${total - secretariat}`);
  console.log(`  secretariat: ${secretariat}`);

  const departments = await data.attendees.departments();
  console.log(`  departments: ${departments.length}`);

  console.log('\nDone. Nothing here is a real person.');
  await data.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
