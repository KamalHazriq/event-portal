import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { UndoCheckInButton } from '@/modules/check-in/components/UndoCheckInButton';
import {
  arrivalRate,
  checkInDays,
  resolveCheckInDay,
  sortByOutstanding,
} from '@/modules/check-in/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Headcount' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/** "14:32" in the event's own time zone. */
function arrivalClock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export default async function HeadcountPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/headcount');

  const config = getEventConfig();
  const params = await searchParams;
  const now = resolveEventNow({ timezone: config.event.timezone });
  const days = checkInDays(config);
  const day = resolveCheckInDay(days, now, first(params.day));

  if (!day) return <p className="text-ink">This event has no days set up yet.</p>;

  const data = getData();
  const [headcount, arrived, missing] = await Promise.all([
    data.checkIns.headcount(day.id),
    data.checkIns.listByDay(day.id),
    data.checkIns.listMissing(day.id),
  ]);

  const rate = arrivalRate(headcount.arrived, headcount.expected);
  const departments = sortByOutstanding(headcount.byDepartment);
  const newestFirst = [...arrived].reverse();

  return (
    <div className="space-y-5">
      {/* Other desks are checking people in too, so keep this fresh. */}
      <AutoRefresh intervalMs={10_000} />

      <header>
        <h1 className="text-2xl font-bold text-ink">Headcount</h1>
        <p className="mt-1 text-ink-soft">
          {day.label}, {formatShortDate(day.date, config.event.timezone)}
        </p>
      </header>

      {days.length > 1 ? (
        <nav aria-label="Choose a day">
          <ul className="flex flex-wrap gap-2">
            {days.map((option) => (
              <li key={option.id}>
                <Link
                  href={`/admin/headcount?day=${option.id}`}
                  aria-current={option.id === day.id ? 'page' : undefined}
                  className={[
                    'block rounded-lg border px-3 py-2 text-sm no-underline',
                    option.id === day.id
                      ? 'border-primary bg-primary font-bold text-on-primary'
                      : 'border-line bg-surface font-semibold text-ink',
                  ].join(' ')}
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-5xl font-bold tabular-nums leading-none text-ink">
          {rate.arrived}
          <span className="text-3xl font-normal text-ink-soft"> / {rate.expected}</span>
        </p>
        <p className="mt-1 text-ink-soft">
          {rate.percent}% arrived, {rate.remaining} still to come
        </p>
        <div
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={rate.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Arrivals so far"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${rate.percent}%` }} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">By department</h2>
        <p className="mb-2 text-sm text-ink-soft">Whoever is furthest behind is at the top.</p>
        <ul className="stagger grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {departments.map((row) => {
            const departmentRate = arrivalRate(row.arrived, row.expected);
            return (
              <li key={row.department} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{row.department}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {row.arrived} / {row.expected}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={departmentRate.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.department} arrivals`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${departmentRate.percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">
          Arrived <span className="font-normal text-ink-soft">({newestFirst.length})</span>
        </h2>
        {newestFirst.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
            Nobody has checked in yet.
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {newestFirst.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{row.attendee.name}</p>
                  <p className="text-sm text-ink-soft">
                    {row.attendee.department} / {arrivalClock(row.at, config.event.timezone)} /{' '}
                    {row.method === 'manual' ? 'by name' : 'scanned'} at {row.byOperator || 'desk'}
                  </p>
                </div>
                <UndoCheckInButton
                  attendeeId={row.attendeeId}
                  dayId={day.id}
                  name={row.attendee.name}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-ink">
          Not yet arrived <span className="font-normal text-ink-soft">({missing.length})</span>
        </h2>
        {missing.length === 0 ? (
          <p className="rounded-lg border border-success bg-success/10 p-4 font-semibold text-ink">
            Everyone is in.
          </p>
        ) : (
          <ul className="space-y-1">
            {missing.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-line bg-surface px-3 py-2"
              >
                <span className="font-semibold text-ink">{person.name}</span>
                <span className="text-sm text-ink-soft">{person.department}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
