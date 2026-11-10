import Link from 'next/link';

import type { EventInfo, Features } from '@/lib/event-schema';
import { formatShortDate } from '@/lib/time';

import { SiteNav, type NavItem } from './SiteNav';

/**
 * The top of every attendee page. Sticky, so the nav is always one tap away
 * on a phone, and short enough not to eat the screen.
 */
export function SiteHeader({
  event,
  features,
  mark = null,
}: {
  event: EventInfo;
  features: Features;
  /** The small header logo for the current theme, if the config has one. */
  mark?: string | null;
}) {
  const items: NavItem[] = [{ href: '/', label: 'Home' }];
  if (features.schedule) items.push({ href: '/agenda', label: 'Agenda' });
  if (features.resources) items.push({ href: '/resources', label: 'Resources' });

  const dates =
    event.startDate === event.endDate
      ? formatShortDate(event.startDate, event.timezone)
      : `${formatShortDate(event.startDate, event.timezone)} to ${formatShortDate(event.endDate, event.timezone)}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 no-underline">
          <span className="flex items-center gap-2 text-lg font-bold leading-tight text-ink">
            {mark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mark} alt="" className="h-7 w-auto shrink-0" />
            ) : (
              <span aria-hidden="true" className="h-5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <span className="truncate">{event.shortName}</span>
          </span>
          <span className="block text-xs text-ink-soft">{dates}</span>
        </Link>
      </div>
      <SiteNav items={items} />
    </header>
  );
}
