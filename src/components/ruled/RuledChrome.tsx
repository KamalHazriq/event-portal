import Link from 'next/link';

import type { EventConfig } from '@/lib/event-schema';
import { isPlaceholderUrl } from '@/lib/placeholder';
import { formatClock, formatShortDate, resolveEventNow } from '@/lib/time';
import { announcement } from '@/modules/look/announce';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';

import { SiteNav, type NavItem } from '../SiteNav';

/** The page's container in the Ruled style: 1200 px of content, 24 px margins. */
export const RULED_CONTAINER = 'mx-auto w-full max-w-[1248px] px-6';

export function portalNavItems(config: EventConfig): NavItem[] {
  const { features } = config;
  const items: NavItem[] = [{ href: '/', label: 'Home' }];
  if (features.schedule) items.push({ href: '/agenda', label: 'Agenda' });
  if (features.resources && config.resources.some((r) => !isPlaceholderUrl(r.url))) {
    items.push({ href: '/resources', label: 'Resources' });
  }
  if (features.photoWall) items.push({ href: '/photos', label: 'Photos' });
  if (features.leaderboard) items.push({ href: '/leaderboard', label: 'Leaderboard' });
  return items;
}

/** The Slido link, when a real one is set. */
export function slidoLink(config: EventConfig): string | null {
  const slido = config.integrations.slido;
  return slido?.enabled && slido.eventUrl && !isPlaceholderUrl(slido.eventUrl)
    ? slido.eventUrl
    : null;
}

/**
 * The top of every attendee page in the Ruled style: one line of what
 * matters now, then the brand, menu and actions in a solid bar inset from
 * the page edges. On a phone the menu runs under the bar.
 */
export function RuledHeader({ config, mark }: { config: EventConfig; mark: string | null }) {
  const now = resolveEventNow({ timezone: config.event.timezone });
  const line = announcement(findNowAndNext(buildAgenda(config), now), config.event, now.date, {
    clock: formatClock,
    shortDate: (d) => formatShortDate(d, config.event.timezone),
  });
  const items = portalNavItems(config);
  const slido = slidoLink(config);

  return (
    <>
      <div className="border-b border-line text-sm">
        <p className={`${RULED_CONTAINER} py-2.5 text-center text-ink`}>
          <strong className="font-semibold">{line.strong}</strong> <span>{line.text}</span>{' '}
          <Link
            href={line.link.href}
            className="whitespace-nowrap font-semibold text-accent underline decoration-1 underline-offset-[3px]"
          >
            {line.link.label}
          </Link>
        </p>
      </div>
      <header className="sticky top-0 z-40 bg-canvas pt-3">
        <div className={RULED_CONTAINER}>
          <div className="flex min-h-14 items-center gap-4 rounded-lg border border-line bg-surface py-2 pl-4 pr-2">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
              {mark ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mark} alt="" className="h-7 w-auto" />
              ) : null}
              <span className="font-display text-lg font-semibold tracking-tight text-ink">
                {config.event.shortName}
              </span>
            </Link>
            <div className="hidden min-w-0 flex-1 md:block">
              <SiteNav items={items} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {config.features.leaderboard ? (
                <Link
                  href="/me"
                  className="hidden min-h-10 items-center rounded-lg border border-line px-3.5 text-sm font-semibold text-ink no-underline sm:inline-flex"
                >
                  My points
                </Link>
              ) : null}
              {slido ? (
                <a
                  href={slido}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary no-underline"
                >
                  Join Slido
                </a>
              ) : null}
            </div>
          </div>
          <div className="md:hidden">
            <SiteNav items={items} />
          </div>
        </div>
        <div className="mt-3 border-b border-line md:hidden" />
      </header>
    </>
  );
}

/** The foot of every attendee page in the Ruled style. */
export function RuledFooter({ config }: { config: EventConfig }) {
  const { event, branding } = config;
  const slido = config.integrations.slido;
  const year = event.endDate.slice(0, 4);
  const group = 'text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft';
  const linkClass = 'text-ink no-underline hover:text-primary';

  return (
    <footer className="mt-16 border-t border-line text-sm">
      <div
        className={`${RULED_CONTAINER} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]`}
      >
        <div>
          {branding.organisationLogoPath ? (
            <span className="inline-flex rounded-lg bg-white px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.organisationLogoPath}
                alt={branding.organisationName || 'Organiser logo'}
                className="h-8 w-auto"
              />
            </span>
          ) : null}
          <p className="mt-4 font-display text-lg font-medium text-ink">{event.name}</p>
          <p className="mt-1 text-ink-soft">
            {event.venue}
            {event.city ? `, ${event.city}` : ''}
          </p>
          {event.helpText ? <p className="mt-3 text-ink-soft">{event.helpText}</p> : null}
        </div>

        <nav aria-label="Event">
          <p className={group}>Event</p>
          <ul className="mt-3 space-y-2">
            {portalNavItems(config).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Taking part">
          <p className={group}>Taking part</p>
          <ul className="mt-3 space-y-2">
            {config.features.leaderboard ? (
              <li>
                <Link href="/me" className={linkClass}>
                  My points
                </Link>
              </li>
            ) : null}
            {config.features.photoWall ? (
              <li>
                <Link href="/photos" className={linkClass}>
                  Share a photo
                </Link>
              </li>
            ) : null}
            {slidoLink(config) && slido?.eventCode ? (
              <li className="text-ink-soft">
                Slido code <span className="font-semibold text-ink">{slido.eventCode}</span>
              </li>
            ) : null}
          </ul>
        </nav>

        <nav aria-label="Help">
          <p className={group}>Help</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/guide" className={linkClass}>
                How this portal works
              </Link>
            </li>
            <li className="text-ink-soft">Registration desk, any time</li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p
          className={`${RULED_CONTAINER} flex flex-col gap-1 py-5 text-xs text-ink-soft sm:flex-row sm:justify-between`}
        >
          <span>
            © {year} {branding.organisationName || event.shortName}
          </span>
          <span>For summit participants only. Please keep the event code within the summit.</span>
        </p>
      </div>
    </footer>
  );
}
