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
      <ul className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const selected = day.id === selectedDayId;
          return (
            <li key={day.id} className="shrink-0">
              <Link
                href={`/agenda?day=${day.id}${extraParams}`}
                onClick={choose(day.id)}
                aria-current={selected ? 'page' : undefined}
                className={[
                  'block rounded-lg border px-2.5 py-2 text-sm no-underline',
                  selected
                    ? 'border-primary bg-primary font-bold text-on-primary'
                    : 'border-line bg-surface font-semibold text-ink hover:border-primary',
                ].join(' ')}
              >
                <span className="block">{day.label}</span>
                <span
                  className={['block text-xs', selected ? 'opacity-90' : 'text-ink-soft'].join(' ')}
                >
                  {formatShortDate(day.date, timezone).replace(/^\w+\s/, '')}
                </span>
              </Link>
            </li>
          );
        })}
        {showMine ? (
          <li className="shrink-0">
            <Link
              href={`/agenda?day=mine${extraParams}`}
              onClick={choose('mine')}
              aria-current={mineSelected ? 'page' : undefined}
              className={[
                'block rounded-lg border px-2.5 py-2 text-sm no-underline',
                mineSelected
                  ? 'border-primary bg-primary font-bold text-on-primary'
                  : 'border-line bg-surface font-semibold text-ink hover:border-primary',
              ].join(' ')}
            >
              <span className="block">
                <span aria-hidden="true">★ </span>Favourites
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
