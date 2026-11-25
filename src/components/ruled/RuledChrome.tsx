import { portalPollsAvailable } from '@/modules/backup/server';
import { pageNowParam } from '@/lib/test-clock-server';
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
export async function RuledHeader({ config, mark }: { config: EventConfig; mark: string | null }) {
  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: await pageNowParam(null),
  });
  const line = announcement(findNowAndNext(buildAgenda(config), now), config.event, now.date, {
    clock: formatClock,
    shortDate: (d) => formatShortDate(d, config.event.timezone),
  });
  const items = portalNavItems(config);
  const slido = slidoLink(config);
  const portalPolls = config.features.polls && (await portalPollsAvailable().catch(() => false));

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
              {portalPolls ? (
                // Slido is down: the portal's own polls and questions stand in for it.
                <Link
                  href="/poll"
                  className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary no-underline"
                >
                  Vote in the poll
                </Link>
              ) : slido ? (
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
  const slidoHref = slidoLink(config);
  const year = event.endDate.slice(0, 4);
  const dates = `${formatShortDate(event.startDate, event.timezone)} to ${formatShortDate(event.endDate, event.timezone)}`;
  const group = 'text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-soft';

  const takingPart = [
    ...(config.features.leaderboard ? [{ href: '/me', label: 'My points' }] : []),
    ...(config.features.photoWall ? [{ href: '/photos', label: 'Share a photo' }] : []),
    ...(config.features.leaderboard ? [{ href: '/leaderboard', label: 'Leaderboard' }] : []),
  ];
  const help = [
    ...(config.info ? [{ href: '/info', label: config.info.title }] : []),
    { href: '/#faq', label: 'General Q&A' },
  ];

  return (
    <footer className="ruled-footer relative mt-20 overflow-hidden border-t border-line text-sm">
      <div aria-hidden="true" className="ruled-footer-glow" />
      <div className={`${RULED_CONTAINER} relative py-14`}>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
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
            <p className="mt-5 font-display text-2xl font-medium leading-tight text-ink">
              {event.name}
            </p>
            <p className="mt-2 text-ink-soft">
              {dates} · {event.venue}
              {event.city ? `, ${event.city}` : ''}
            </p>
            {slidoHref && slido?.eventCode ? (
              <a
                href={slidoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-chip mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-ink no-underline"
              >
                <span className="text-ink-soft">Slido</span>
                <span className="font-semibold tabular-nums">{slido.eventCode}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>

          <FooterColumn title="Event" className={group} links={portalNavItems(config)} />
          <FooterColumn title="Taking part" className={group} links={takingPart} />
          <div>
            <FooterColumn title="Help" className={group} links={help} />
            <p className="mt-3 text-ink-soft">
              {event.helpText || 'The registration desk, any time.'}
            </p>
          </div>
        </div>
      </div>
      <div className="relative border-t border-line">
        <div
          className={`${RULED_CONTAINER} flex flex-col gap-2 py-5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between`}
        >
          <span>
            {branding.footerText || `© ${year} ${branding.organisationName || event.shortName}`}
          </span>
          <span>For summit participants only. Please keep the event code within the summit.</span>
          <a href="#top" className="footer-link self-start sm:self-auto">
            Back to top <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  className,
  links,
}: {
  title: string;
  className: string;
  links: { href: string; label: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={title}>
      <p className={className}>{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="footer-link">
              {item.label}
              <span aria-hidden="true" className="footer-arrow">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
