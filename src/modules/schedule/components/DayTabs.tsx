'use client';

import Link from 'next/link';

import { formatShortDate } from '@/lib/time';

import type { ResolvedDay } from '../logic';

/**
 * Day tabs. They are real links, so the agenda works with no JavaScript and
 * each day can be bookmarked or shared; with JavaScript, onSelect switches
 * the day in place at once, with no trip to the server.
 */
export function DayTabs({
  days,
  selectedDayId,
  timezone,
  extraParams = '',
  showMine = false,
  onSelect,
}: {
  days: ResolvedDay[];
  /** A day id, or "mine" for the starred sessions. */
  selectedDayId: string;
  timezone: string;
  /** Carries a dev ?now= override across tab changes. */
  extraParams?: string;
  /** Adds a "Favourites" tab at the end. */
  showMine?: boolean;
  /** Switch in place instead of loading the page again. */
  onSelect?: (dayId: string) => void;
}) {
  const choose = (dayId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onSelect(dayId);
  };
  const mineSelected = selectedDayId === 'mine';
  return (
    <nav aria-label="Choose a day">
      {/* A phone: four equal columns, every tab on screen. Wider: a row of fixed widths. */}
      <ul className="grid auto-cols-fr grid-flow-col gap-1.5 pb-1 sm:flex">
        {days.map((day) => {
          const selected = day.id === selectedDayId;
          return (
            <li key={day.id} className="min-w-0 sm:shrink-0">
              <Link
                href={`/agenda?day=${day.id}${extraParams}`}
                onClick={choose(day.id)}
                aria-current={selected ? 'page' : undefined}
                className={[
                  // One width for every day, whichever is selected (bold is wider).
                  'block w-full rounded-lg border px-1 py-2 text-center text-sm no-underline sm:w-[5rem] sm:px-2',
                  selected
                    ? 'border-primary bg-primary font-bold text-on-primary'
                    : 'border-line bg-surface font-semibold text-ink hover:border-primary',
                ].join(' ')}
              >
                <span className="block">{day.label}</span>
                <span className={['block text-xs', selected ? '' : 'text-ink-soft'].join(' ')}>
                  {formatShortDate(day.date, timezone).replace(/^\w+\s/, '')}
                </span>
              </Link>
            </li>
          );
        })}
        {showMine ? (
          <li className="min-w-0 sm:shrink-0">
            <Link
              href={`/agenda?day=mine${extraParams}`}
              onClick={choose('mine')}
              aria-current={mineSelected ? 'page' : undefined}
              className={[
                'block w-full rounded-lg border px-1 py-2 text-center text-sm no-underline sm:px-2.5',
                mineSelected
                  ? 'border-primary bg-primary font-bold text-on-primary'
                  : 'border-line bg-surface font-semibold text-ink hover:border-primary',
              ].join(' ')}
            >
              <span className="block truncate text-[0.8rem] sm:text-sm">Favourites</span>
              <span className={['block text-xs', mineSelected ? '' : 'text-ink-soft'].join(' ')}>
                <span aria-hidden="true">★ </span>Starred
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
