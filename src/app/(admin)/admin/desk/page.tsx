import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { cookies } from 'next/headers';
import { parsePretendScan, SCAN_AT_COOKIE } from '@/modules/check-in/pretend';
import { setPretendScan } from '@/modules/check-in/pretend-actions';
import { testModeOn } from '@/modules/test-mode/server';
import { DeskConsole } from '@/modules/check-in/components/DeskConsole';
import { addPersonToList } from '@/modules/check-in/add-person';
import { UndoAllButton } from '@/modules/check-in/components/UndoAllButton';
import { arrivalRate, checkInDays, resolveCheckInDay } from '@/modules/check-in/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Registration desk' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export default async function DeskPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/desk');

  const config = getEventConfig();
  const params = await searchParams;
  const now = resolveEventNow({ timezone: config.event.timezone });
  const days = checkInDays(config);
  const day = resolveCheckInDay(days, now, first(params.day));

  if (!day) {
    return <p className="text-ink">This event has no days set up yet.</p>;
  }

  const data = getData();
  const headcount = await data.checkIns.headcount(day.id);
  const testMode = await testModeOn();
  const pretend = testMode ? parsePretendScan((await cookies()).get(SCAN_AT_COOKIE)?.value) : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Registration desk</h1>
        <p className="mt-1 text-ink-soft">
          Checking people in for {day.label}, {formatShortDate(day.date, config.event.timezone)}
        </p>
      </header>

      {days.length > 1 ? (
        <nav aria-label="Choose a day">
          <ul className="flex flex-wrap gap-2">
            {days.map((option) => {
              const selected = option.id === day.id;
              return (
                <li key={option.id}>
                  <Link
                    href={`/admin/desk?day=${option.id}`}
                    aria-current={selected ? 'page' : undefined}
                    className={[
                      'block rounded-lg border px-3 py-2 text-sm no-underline',
                      selected
                        ? 'border-primary bg-primary font-bold text-on-primary'
                        : 'border-line bg-surface font-semibold text-ink',
                    ].join(' ')}
                  >
                    {option.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {/* Keyed by the day, so switching Day 1, 2, 3 starts that day's own count and list. */}
      {pretend ? (
        <p className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-sm font-semibold text-ink">
          Test: scans are recorded as {pretend.replace('T', ' at ')}.{' '}
          <a href="#pretend" className="text-primary">
            Change or go back to real time
          </a>
        </p>
      ) : null}

      <DeskConsole
        key={day.id}
        dayId={day.id}
        dayLabel={day.label}
        initialHeadcount={arrivalRate(headcount.arrived, headcount.expected)}
      />

      <details className="rounded-xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-semibold text-ink">
          Long queue? Add a self check in kiosk
        </summary>
        <div className="mt-2 space-y-2 text-ink">
          <p>
            On a spare tablet, sign in here with the PIN, then open the kiosk. People hold up the
            business card in their TNB app to the tablet&apos;s back camera (it focuses better) and
            see a big welcome. Anyone it cannot match is sent to this desk; it never shows other
            people&apos;s names.
          </p>
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">Preview</strong> opens it on this device and changes
            nothing. <strong className="text-ink">Open and lock</strong> is for the tablet on the
            stand: from then on, any admin address on that tablet asks for the PIN, so nobody can
            wander into the console. The Secretariat link at the foot of the kiosk, or /admin,
            unlocks it with the PIN. Pin the screen too (screen pinning on Android, Guided Access on
            an iPad) so the browser stays open on it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/kiosk?day=${day.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold text-ink no-underline"
            >
              Preview the kiosk for {day.label}
            </Link>
            <Link
              href={`/kiosk?lock=1&day=${day.id}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-on-primary no-underline"
            >
              Open and lock this device for {day.label}
            </Link>
          </div>
        </div>
      </details>

      {testMode ? (
        <section
          id="pretend"
          aria-label="Pretend scan time"
          className="rounded-xl border-2 border-warning bg-warning/10 p-4"
        >
          <h2 className="font-bold text-ink">Test: pretend scan time</h2>
          <p className="mt-1 text-sm text-ink-soft">
            To try early and late, pick any date and time. Scans on this desk are recorded at that
            time until you switch back. The result shows Early or Late against the day&apos;s
            cut-off (set on Points, Attendance). Clear the test scans afterwards.
          </p>
          <form action={setPretendScan} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm font-semibold text-ink">
              Pretend it is
              <input
                type="datetime-local"
                name="at"
                defaultValue={pretend ?? ''}
                required
                className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
              />
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
            >
              Use this time
            </button>
            {pretend ? (
              <button
                type="submit"
                name="clear"
                value="yes"
                formNoValidate
                className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
              >
                Back to real time
              </button>
            ) : null}
          </form>
          <p className="mt-2 text-sm font-semibold text-ink">
            {pretend
              ? `Scans are recorded as ${pretend.replace('T', ' at ')}.`
              : 'Using real time.'}
          </p>
        </section>
      ) : null}

      {typeof params.added === 'string' ? (
        <p
          role="status"
          className={`rounded-lg border p-3 font-semibold ${
            params.added === 'short' || params.added === 'error'
              ? 'border-warning text-warning'
              : 'border-success text-success'
          }`}
        >
          {params.added === 'short'
            ? 'Type the full name (at least three letters).'
            : params.added === 'error'
              ? 'Could not add them. Try again.'
              : `${params.added} is on the list. Search their name above and check them in.`}
        </p>
      ) : null}

      <details
        className="rounded-xl border border-dashed border-line bg-surface p-4"
        id="add-person"
        open={typeof params.added === 'string'}
      >
        <summary className="cursor-pointer font-semibold text-ink">
          Not on the list? Add them
        </summary>
        <p className="mt-2 text-sm text-ink-soft">
          Add the person to the participant list, then search their name above and check them in as
          usual. They get points, a door gift spin and feedback like everyone else.
        </p>
        <form action={addPersonToList} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
            Full name
            <input
              name="name"
              required
              minLength={3}
              maxLength={120}
              autoComplete="off"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
          <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
            Role (optional)
            <input
              name="title"
              maxLength={120}
              autoComplete="off"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Add to the list
          </button>
        </form>
      </details>

      <p className="text-sm text-ink-soft">
        Checked the wrong person in? Undo it on the{' '}
        <Link href={`/admin/headcount?day=${day.id}`} className="font-semibold text-primary">
          headcount page
        </Link>
        .
      </p>

      <UndoAllButton days={days.map((d) => ({ id: d.id, label: d.label }))} currentDayId={day.id} />
    </div>
  );
}
