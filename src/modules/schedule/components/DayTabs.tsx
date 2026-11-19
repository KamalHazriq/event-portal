import Link from 'next/link';

import { formatShortDate } from '@/lib/time';

import type { ResolvedDay } from '../logic';

/**
 * Day tabs as plain links, not buttons, so the agenda works with no
 * JavaScript at all and each day can be bookmarked or shared.
 */
export function DayTabs({
  days,
  selectedDayId,
  timezone,
  extraParams = '',
  showMine = false,
}: {
  days: ResolvedDay[];
  /** A day id, or "mine" for the starred sessions. */
  selectedDayId: string;
  timezone: string;
  /** Carries a dev ?now= override across tab changes. */
  extraParams?: string;
  /** Adds a "My agenda" tab at the end. */
  showMine?: boolean;
}) {
  const mineSelected = selectedDayId === 'mine';
  return (
    <nav aria-label="Choose a day">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const selected = day.id === selectedDayId;
          return (
            <li key={day.id} className="shrink-0">
              <Link
                href={`/agenda?day=${day.id}${extraParams}`}
                aria-current={selected ? 'page' : undefined}
                className={[
                  'block rounded-lg border px-3 py-2 text-sm no-underline',
                  selected
                    ? 'border-primary bg-primary font-bold text-on-primary'
                    : 'border-line bg-surface font-semibold text-ink hover:border-primary',
                ].join(' ')}
              >
                <span className="block">{day.label}</span>
                <span
                  className={['block text-xs', selected ? 'opacity-90' : 'text-ink-soft'].join(' ')}
                >
                  {formatShortDate(day.date, timezone)}
                </span>
              </Link>
            </li>
          );
        })}
        {showMine ? (
          <li className="shrink-0">
            <Link
              href={`/agenda?day=mine${extraParams}`}
              aria-current={mineSelected ? 'page' : undefined}
              className={[
                'block rounded-lg border px-3 py-2 text-sm no-underline',
                mineSelected
                  ? 'border-primary bg-primary font-bold text-on-primary'
                  : 'border-line bg-surface font-semibold text-ink hover:border-primary',
              ].join(' ')}
            >
              <span className="block">
                <span aria-hidden="true">★ </span>My agenda
              </span>
              <span
                className={['block text-xs', mineSelected ? 'opacity-90' : 'text-ink-soft'].join(
                  ' ',
                )}
              >
                Starred
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
