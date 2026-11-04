import Link from 'next/link';

import { formatTimeRange } from '@/lib/time';

import type { ResolvedSession, SessionStatus } from '../logic';
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

  return (
    <li>
      <Link
        href={`/session/${session.id}${linkSuffix}`}
        className={[
          'block rounded-lg border bg-surface p-3 no-underline transition-colors',
          'hover:border-primary focus-visible:border-primary',
          status === 'live'
            ? 'border-live border-l-4'
            : status === 'past'
              ? 'border-line opacity-70'
              : 'border-line',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-ink-soft">
            {formatTimeRange(session.start, session.end)}
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
    <ul className="space-y-2">
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
