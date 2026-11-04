import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { DeskConsole } from '@/modules/check-in/components/DeskConsole';
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

      <DeskConsole
        dayId={day.id}
        dayLabel={day.label}
        initialHeadcount={arrivalRate(headcount.arrived, headcount.expected)}
      />

      <p className="text-sm text-ink-soft">
        Checked the wrong person in? Undo it on the{' '}
        <Link href={`/admin/headcount?day=${day.id}`} className="font-semibold text-primary">
          headcount page
        </Link>
        .
      </p>
    </div>
  );
}
