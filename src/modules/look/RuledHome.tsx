/**
 * The home page in the Ruled style. Same content, routes and behaviour as
 * the Classic home, set as an editorial page in this order:
 *
 *  3. Hero: the event over a full-bleed brand field, with the live panel
 *  4. Departments (the "logo cloud"): the teams in the room, in a ruled grid
 *  5. Gallery: the newest photos from the photo wall
 *  6. Process: how to take part, five connected steps
 *  7. Team: who people will hear from, as round initials
 *  8. The three days (the "plan rows"), smallest date first
 *  9. FAQ: six practical answers, two columns, all open
 * 10. Closing: an inverted banner with two actions
 *
 * The announcement, header and footer come from the layout. Every section
 * but the hero and the closing opens with a two-line heading and its one
 * control on the same row.
 *
 * There is no event photography, so the hero's full-bleed picture is the
 * brand field and the event wordmark; a venue photo can replace it later.
 */
import Link from 'next/link';

import { getData } from '@/data';
import type { EventConfig } from '@/lib/event-schema';
import { logoFor } from '@/lib/theme';
import { formatClock, formatLongDate, formatShortDate, type EventNow } from '@/lib/time';
import { RULED_CONTAINER, slidoLink } from '@/components/ruled/RuledChrome';
import {
  nowLinkSuffix,
  sessionStatus,
  type NowAndNext,
  type ResolvedSession,
} from '@/modules/schedule/logic';
import { REACTIONS } from '@/modules/talk/logic';
import { AlertsOptIn } from '@/modules/announce/components/AlertsOptIn';
import { shortDepartment } from '@/lib/departments';

const SECTION = 'pt-16 pb-12 lg:pt-24 lg:pb-16';
const H2 = 'font-display text-[1.75rem] font-medium leading-[1.1] text-ink sm:text-[2.5rem]';
const SMALL_BUTTON =
  'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-line px-3.5 text-sm font-semibold text-ink no-underline hover:border-primary';
const BUTTON =
  'inline-flex min-h-12 items-center whitespace-nowrap rounded-lg px-5 font-semibold no-underline';

/** A section opener: the two-line heading at the left, its one control on the same row. */
function Opener({
  id,
  lines,
  control,
}: {
  id: string;
  lines: [string, string];
  control: { href: string; label: string } | null;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line pb-5">
      <h2 id={id} className={H2}>
        {lines[0]}
        <br />
        {lines[1]}
      </h2>
      {control ? (
        <Link href={control.href} className={SMALL_BUTTON}>
          {control.label}
        </Link>
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  // A role written as an acronym ("CDIO") reads best whole.
  if (/^[A-Z&]{2,4}$/.test(name.trim())) return name.trim();
  const words = name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(bin|binti|of|and|the|a\/l|a\/p)$/i.test(w));
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '·';
}

export async function RuledHome({
  config,
  now,
  nowAndNext,
  eventFeedbackOpen,
  eventFeedbackHref,
  pollOpen,
  notice,
}: {
  config: EventConfig;
  now: EventNow;
  nowAndNext: NowAndNext;
  eventFeedbackOpen: boolean;
  eventFeedbackHref: string;
  pollOpen: boolean;
  /** The test clock notice, shown under the live panel rather than over the hero. */
  notice?: React.ReactNode;
}) {
  const { event, features, branding } = config;
  const data = getData();
  const tz = event.timezone;
  const linkSuffix = nowLinkSuffix(now);
  const slido = slidoLink(config);
  const slidoCode = config.integrations.slido?.eventCode ?? '';

  const live = nowAndNext.live[0] ?? null;
  const next = nowAndNext.next;
  const focusDay = nowAndNext.focusDay;
  const later = (focusDay?.sessions ?? [])
    .filter((s) => sessionStatus(s, now) === 'upcoming' && s.id !== next?.id)
    .slice(0, 4);

  // The database bits, each optional: the page still renders without them.
  const [departments, photos, liveTotals] = await Promise.all([
    data.attendees
      .departments()
      .then((list) => list.filter((d) => !/secretariat/i.test(d)))
      .catch(() => [] as string[]),
    features.photoWall
      ? data.photos
          .list('approved')
          .then((list) => list.slice(0, 4))
          .catch(() => [])
      : Promise.resolve([]),
    live && features.reactions
      ? data.reactions.totals(live.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  // One tile per department, by short name ("Cores" and "Corporate &
  // Engineering Services" are the same team).
  const teams = [...new Set(departments.map((d) => shortDepartment(config, d)))];
  const sessionCount = config.days.reduce(
    (n, d) => n + d.sessions.filter((s) => !s.hidden).length,
    0,
  );
  const speakers = config.speakers.slice(0, 4);
  const dates = `${formatShortDate(event.startDate, tz)} to ${formatShortDate(event.endDate, tz)}`;

  const faqs: [string, string][] = [
    [
      'How do I check in?',
      'Show the business card in your TNB app at the registration desk; the desk scans it. If it will not scan, they find you by name in seconds.',
    ],
    slido
      ? [
          'Where do I ask the speakers a question?',
          `On Slido. Tap Join Slido on the session's page, or go to slido.com and enter ${slidoCode}.`,
        ]
      : [
          'Where do I ask the speakers a question?',
          'Each session with questions has a button on its page during the talk.',
        ],
    [
      'How do points work?',
      'Join once with your staff number and first name. Arriving early, feedback, polls, photos and reactions then earn points for you and your department.',
    ],
    [
      'Can I share photos?',
      'Yes, from the Photos page. They appear on the big screen once the secretariat has approved them.',
    ],
    [
      'Is my feedback anonymous?',
      'Points only count that you sent a form, never what you wrote, and you choose whether to give your name.',
    ],
    ['Who do I ask for help?', event.helpText || 'Anyone at the registration desk.'],
  ];

  const steps: [string, string][] = [
    ['Check in', 'Show the business card in your TNB app at the desk.'],
    ['Follow the day', 'The agenda shows what is on now and what is next.'],
    ['Ask and react', 'Questions on Slido, reactions on the big screen.'],
    ['Share the moments', 'Photos go up on the wall once approved.'],
    ['Rate each session', 'A rating and a sentence is plenty.'],
  ];

  return (
    <div className="!max-w-none">
      {/* 3. Hero: copy over a full-bleed brand field. */}
      <section
        aria-labelledby="hero-title"
        className="relative -mt-8 ml-[calc(50%-50vw)] w-screen overflow-hidden border-y border-line lg:-mt-12"
        style={{ backgroundColor: branding.brand.navy }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 [background-image:linear-gradient(rgba(234,244,243,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(234,244,243,.07)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(100deg,transparent_20%,#000_75%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -right-36 size-64 rounded-full border-[40px] border-primary/30 md:-right-20 md:-top-16 md:bottom-auto md:size-[560px] md:border-[90px]"
        />
        <div className={`${RULED_CONTAINER} relative pb-12 pt-16 lg:pb-[88px] lg:pt-24`}>
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#9FC3FF]">
            {dates}
            {event.city ? ` · ${event.city}` : ''}
          </p>
          <h1
            id="hero-title"
            // Wraps by width, not balanced, so "Power Summit" stays on one line.
            className="mt-4 max-w-[12ch] font-display text-[2.9rem] font-medium leading-[1.04] text-white [text-wrap:wrap] sm:text-[3.875rem]"
          >
            {event.name}
          </h1>
          {event.tagline ? (
            <p className="mt-5 max-w-[36ch] text-lg leading-normal text-[#D4E3F7] sm:text-xl">
              {event.tagline}
            </p>
          ) : null}
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={`/agenda${focusDay ? `?day=${focusDay.id}${nowLinkSuffix(now, '&')}` : linkSuffix}`}
              className={`${BUTTON} bg-primary text-on-primary`}
            >
              {nowAndNext.today ? 'See today’s agenda' : 'See the agenda'}
            </Link>
            {features.photoWall ? (
              <Link
                href="/photos"
                className={`${BUTTON} border border-white/35 text-white hover:border-white`}
              >
                Share a photo
              </Link>
            ) : null}
          </div>
          <p className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#C7D8EE]">
            {[
              event.venue,
              `${config.days.length} days, ${sessionCount} sessions`,
              branding.organisationName,
            ]
              .filter(Boolean)
              .map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                  {item}
                </span>
              ))}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoFor(branding, 'dark')}
            alt=""
            width={1000}
            height={318}
            className="mt-9 h-auto w-56 lg:absolute lg:bottom-[88px] lg:right-6 lg:mt-0 lg:w-[300px]"
          />
        </div>
      </section>

      {/* The product: what is on now, next and later, framed. */}
      <section aria-label="On now and next" className="mt-12">
        <div className="rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-ink-soft">
            <span>
              <span className="font-semibold text-ink">
                {nowAndNext.today ? 'Live' : 'Coming up'}
              </span>
              {focusDay ? ` · ${focusDay.label}, ${formatLongDate(focusDay.date, tz)}` : ''}
            </span>
            <Link
              href={`/agenda${linkSuffix}`}
              className="shrink-0 whitespace-nowrap pl-3 font-semibold text-accent"
            >
              Full agenda
            </Link>
          </div>
          <div className="grid md:grid-cols-[1.15fr_1fr_1fr] md:divide-x md:divide-line">
            <PanelCell
              tag={live ? 'Happening now' : next ? 'First up' : 'Nothing scheduled'}
              live={Boolean(live)}
              session={live ?? next}
              linkSuffix={linkSuffix}
            >
              {live && liveTotals ? (
                <Link
                  href={`/session/${live.id}${linkSuffix}`}
                  aria-label="React live on the session page"
                  className="mt-4 grid grid-cols-4 gap-2 no-underline"
                >
                  {REACTIONS.map((r) => (
                    <span
                      key={r.kind}
                      className="rounded-lg border border-line py-2 text-center text-xl"
                    >
                      <span aria-hidden="true">{r.emoji}</span>
                      <span className="block text-xs tabular-nums text-ink-soft">
                        {liveTotals[r.kind]}
                      </span>
                    </span>
                  ))}
                </Link>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {live?.slidoLink && slido ? (
                  <a
                    href={slido}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary no-underline"
                  >
                    Ask on Slido
                  </a>
                ) : null}
                {live?.slidoLink && slidoCode ? (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[13px] text-ink-soft">
                    Code {slidoCode}
                  </span>
                ) : null}
                {pollOpen ? (
                  <Link
                    href="/poll"
                    className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary no-underline"
                  >
                    Answer the poll
                  </Link>
                ) : null}
              </div>
            </PanelCell>
            <PanelCell
              tag={
                live && next
                  ? nowAndNext.minutesUntilNext !== null
                    ? `Next, in ${nowAndNext.minutesUntilNext} minutes`
                    : 'Next'
                  : 'Then'
              }
              session={live ? next : (later[0] ?? null)}
              linkSuffix={linkSuffix}
            />
            <div className="border-t border-line p-6 md:border-t-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">
                Later {nowAndNext.today ? 'today' : `on ${focusDay?.label ?? 'the day'}`}
              </p>
              {later.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">That is all for the day.</p>
              ) : (
                <ul className="mt-2">
                  {(live ? later : later.slice(1)).map((s) => (
                    <li key={s.id} className="border-t border-line first:border-t-0">
                      <Link
                        href={`/session/${s.id}${linkSuffix}`}
                        className="grid grid-cols-[4.25rem_1fr] gap-2 py-2.5 text-[15px] text-ink no-underline hover:text-primary"
                      >
                        <span className="tabular-nums text-ink-soft">{formatClock(s.start)}</span>
                        <span>{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 max-w-xl">
        <AlertsOptIn />
      </div>

      {notice ? <div className="mt-6">{notice}</div> : null}

      {/* 4. The departments in the room, in a ruled grid. */}
      {departments.length > 0 ? (
        <section aria-labelledby="teams" className={SECTION}>
          <Opener
            id="teams"
            lines={[`${teams.length} departments,`, 'one room']}
            control={features.leaderboard ? { href: '/leaderboard', label: 'Leaderboard' } : null}
          />
          <ul className="mt-8 grid grid-cols-2 border-l border-t border-line sm:grid-cols-4 lg:grid-cols-7">
            {teams.map((d) => (
              <li
                key={d}
                className="flex min-h-20 items-center justify-center border-b border-r border-line px-3 text-center font-display text-lg font-medium text-ink"
              >
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">
            {features.leaderboard
              ? 'Departments are ranked by average points per person, so a small team can top the board.'
              : 'Everyone on the participant list.'}
          </p>
        </section>
      ) : null}

      {/* 5. Gallery: the newest approved photos. */}
      {features.photoWall ? (
        <section aria-labelledby="gallery" className={SECTION}>
          <Opener
            id="gallery"
            lines={['From the', 'photo wall']}
            control={{ href: '/photos', label: 'Share a photo' }}
          />
          {photos.length === 0 ? (
            <p className="mt-8 rounded-lg border border-dashed border-line p-8 text-center text-ink-soft">
              No photos yet. The first approved ones appear here and on the big screen.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${p.id}?size=thumb`}
                    alt={p.caption || 'A photo from the photo wall'}
                    className="aspect-[4/3] h-auto w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* 6. Process: how to take part. */}
      <section aria-labelledby="how" className={SECTION}>
        <Opener
          id="how"
          lines={['How to take', 'part']}
          control={{ href: '/guide', label: 'Guide' }}
        />
        <ol className="mt-8 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(([title, text], i) => (
            <li key={title} className="relative border-line py-5 pr-5 lg:border-t-0 lg:py-0">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line font-display text-sm font-medium tabular-nums text-ink">
                  {i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <span aria-hidden="true" className="hidden h-px flex-1 bg-line lg:block" />
                ) : null}
              </div>
              <h3 className="mt-4 font-display text-lg font-medium text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. Team: who people will hear from. */}
      {speakers.length > 0 ? (
        <section aria-labelledby="people" className={SECTION}>
          <Opener
            id="people"
            lines={['Who you will', 'hear from']}
            control={{ href: `/agenda${linkSuffix}`, label: 'Agenda' }}
          />
          <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {speakers.map((s) => (
              <li key={s.id}>
                {s.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photoPath}
                    alt=""
                    className="mx-auto size-24 rounded-full border border-line object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mx-auto flex size-24 items-center justify-center rounded-full border border-line bg-surface font-display text-2xl font-medium text-ink"
                  >
                    {initials(s.name)}
                  </span>
                )}
                <p className="mt-4 font-display text-lg font-medium leading-snug text-ink">
                  {s.name}
                </p>
                {s.title ? <p className="mt-1 text-sm text-ink-soft">{s.title}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 8. The three days, as full-width rows. */}
      <section aria-labelledby="days" className={SECTION}>
        <Opener
          id="days"
          lines={[`${config.days.length} days,`, 'one direction']}
          control={{ href: `/agenda${linkSuffix}`, label: 'Agenda' }}
        />
        <ol className="mt-8 border-t border-line">
          {config.days.map((day) => {
            const visible = day.sessions.filter((s) => !s.hidden);
            const talks = visible.filter((s) => s.type === 'talk' || s.type === 'panel').length;
            const isToday = nowAndNext.today?.id === day.id;
            return (
              <li key={day.id} className="border-b border-line">
                <Link
                  href={`/agenda?day=${day.id}${nowLinkSuffix(now, '&')}`}
                  className="grid gap-2 py-6 no-underline hover:text-primary sm:grid-cols-[10rem_1fr_auto] sm:items-baseline sm:gap-8"
                >
                  <span className="font-display text-2xl font-medium text-ink">
                    {day.label}
                    {isToday ? (
                      <span className="ml-3 align-middle text-xs font-bold uppercase tracking-[0.12em] text-live">
                        Today
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">
                      {formatLongDate(day.date, tz)}
                    </span>
                    {day.subtitle ? (
                      <span className="mt-1 block text-ink-soft">{day.subtitle}</span>
                    ) : null}
                  </span>
                  <span className="text-sm tabular-nums text-ink-soft">
                    {visible.length} sessions, {talks} talks
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 9. FAQ: all six answers open, in two columns. */}
      <section aria-labelledby="faq" className={SECTION}>
        <Opener
          id="faq"
          lines={['Good to', 'know']}
          control={
            config.info
              ? { href: '/info', label: config.info.title }
              : { href: '/guide', label: 'Full guide' }
          }
        />
        <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <div key={q} className="border-t border-line pt-5">
              <dt className="font-display text-lg font-medium text-ink">{q}</dt>
              <dd className="mt-2 text-ink-soft">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 10. Closing: inverted banner, title and two actions in one row. */}
      <section
        aria-labelledby="closing"
        className="mb-4 mt-8 flex flex-col gap-6 rounded-lg bg-ink p-8 text-canvas sm:p-12 lg:flex-row lg:items-center lg:justify-between"
      >
        <h2
          id="closing"
          className="font-display text-3xl font-medium leading-tight sm:text-[2.5rem]"
        >
          {eventFeedbackOpen ? 'Tell us how it went' : `See you in ${event.city || event.venue}`}
        </h2>
        <div className="flex flex-wrap gap-3">
          {eventFeedbackOpen ? (
            <Link href={eventFeedbackHref} className={`${BUTTON} bg-primary text-on-primary`}>
              Give feedback on the summit
            </Link>
          ) : features.leaderboard ? (
            <Link href="/me" className={`${BUTTON} bg-primary text-on-primary`}>
              Join the leaderboard
            </Link>
          ) : null}
          <Link
            href={`/agenda${linkSuffix}`}
            className={`${BUTTON} border border-canvas/30 text-canvas hover:border-canvas`}
          >
            See the agenda
          </Link>
        </div>
      </section>
    </div>
  );
}

function PanelCell({
  tag,
  live = false,
  session,
  linkSuffix,
  children,
}: {
  tag: string;
  live?: boolean;
  session: ResolvedSession | null;
  linkSuffix: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-line p-6 first:border-t-0 md:border-t-0">
      <p
        className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] ${
          live ? 'text-live' : 'text-ink-soft'
        }`}
      >
        {live ? <span aria-hidden="true" className="size-2 rounded-full bg-live" /> : null}
        {tag}
      </p>
      {session ? (
        <>
          <h3 className="mt-3 font-display text-2xl font-medium leading-tight text-ink">
            <Link
              href={`/session/${session.id}${linkSuffix}`}
              className="no-underline hover:text-primary"
            >
              {session.title}
            </Link>
          </h3>
          <p className="mt-1.5 text-[15px] text-ink-soft">
            {formatClock(session.start)} to {formatClock(session.end)}
            {session.room ? ` · ${session.room}` : ''}
            {session.speakers.length > 0
              ? ` · ${session.speakers.map((s) => s.name).join(', ')}`
              : ''}
          </p>
        </>
      ) : null}
      {children}
    </div>
  );
}
