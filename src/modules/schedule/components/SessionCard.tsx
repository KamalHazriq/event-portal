import Link from 'next/link';

import { formatTimeRange } from '@/lib/time';

import type { ResolvedSession, SessionStatus } from '../logic';
import { FavouriteStar } from './FavouriteStar';
import { SpeakerNames } from './SpeakerList';
import { StatusBadge } from './StatusBadge';
import { TypeBadge } from './TypeBadge';

/**
 * One row in the agenda.
 *
 * The whole card is the link, so it is easy to hit with a thumb. Breaks and
 * meals are quieter than working sessions, and a live session gets a coloured
 * edge so you can find it while walking into the room.
 */
export function SessionCard({
  session,
  status,
  /** Pass a query string such as "?now=..." so a dev override survives taps. */
  linkSuffix = '',
}: {
  session: ResolvedSession;
  status: SessionStatus;
  linkSuffix?: string;
}) {
  const quiet = session.type === 'break' || session.type === 'logistics';
  const starrable = !quiet && session.type !== 'meal';

  return (
    <li className="relative lg:grid lg:grid-cols-[9rem_1fr] lg:items-stretch lg:gap-5">
      {/* On a laptop the time stands on the left, the session on the right. */}
      <div className="hidden pt-4 text-right lg:block">
        <p className="font-mono text-base font-bold tabular-nums text-ink">
          {formatTimeRange(session.start, session.end).split(' to ')[0]}
        </p>
        <p className="font-mono text-sm tabular-nums text-ink-soft">
          {formatTimeRange(session.start, session.end).split(' to ')[1] ?? ''}
        </p>
      </div>
      <Link
        href={`/session/${session.id}${linkSuffix}`}
        className={[
          // The same height for every card, so the grid reads evenly.
          'flex h-full min-h-[5.5rem] flex-col rounded-lg border bg-surface p-3 no-underline sm:p-4',
          'hover:border-primary focus-visible:border-primary',
          status === 'live'
            ? 'session-live border-live'
            : status === 'past'
              ? 'border-line opacity-60'
              : 'border-line',
        ].join(' ')}
      >
        <div className={`flex flex-wrap items-center gap-2 ${starrable ? 'pr-10' : ''}`}>
          <span className="text-sm font-semibold tabular-nums text-ink-soft lg:hidden">
            {formatTimeRange(session.start, session.end).replace(' to ', ' – ')}
          </span>
          {/* Studio's code label: day and start time, like D1·1450. Decoration, so not on a
              phone, where it crowds the time and the title. */}
          <span className="hidden sm:contents">
            <span className="code-tag studio-only">
              <b>{`D${session.dayId.replace(/\D+/g, '') || '1'}`}</b>
              {session.start.replace(':', '')}
            </span>
          </span>
          <TypeBadge type={session.type} />
          <StatusBadge status={status} />
        </div>

        <h3
          className={[
            'mt-1 text-base leading-snug text-ink',
            quiet ? 'font-medium' : 'font-bold',
          ].join(' ')}
        >
          {session.title}
        </h3>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <SpeakerNames speakers={session.speakers} />
          {session.speakers.length > 0 && session.room ? (
            <span aria-hidden="true" className="text-ink-soft">
              /
            </span>
          ) : null}
          {session.room ? <span className="text-sm text-ink-soft">{session.room}</span> : null}
        </div>
      </Link>
      {starrable ? (
        <div className="absolute top-1 right-1">
          <FavouriteStar sessionId={session.id} title={session.title} />
        </div>
      ) : null}
    </li>
  );
}

/** A plain list of cards, with the status worked out for each one. */
export function SessionList({
  sessions,
  statusOf,
  linkSuffix = '',
  emptyMessage = 'Nothing scheduled.',
}: {
  sessions: ResolvedSession[];
  statusOf: (session: ResolvedSession) => SessionStatus;
  linkSuffix?: string;
  emptyMessage?: string;
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">{emptyMessage}</p>
    );
  }

  return (
    <ul className="stagger space-y-2 lg:space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          status={statusOf(session)}
          linkSuffix={linkSuffix}
        />
      ))}
    </ul>
  );
}
