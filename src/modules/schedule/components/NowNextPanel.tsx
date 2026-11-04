import Link from 'next/link';

import { formatShortDate, formatTimeRange, type EventNow } from '@/lib/time';

import { formatMinutesUntil, type NowAndNext } from '../logic';
import { SpeakerNames } from './SpeakerList';
import { TypeBadge } from './TypeBadge';

/**
 * The panel at the top of the home page: what is on right now, and what is
 * next. This is the one thing most people open the portal to find out.
 */
export function NowNextPanel({
  nowAndNext,
  now,
  timezone,
  linkSuffix = '',
}: {
  nowAndNext: NowAndNext;
  now: EventNow;
  timezone: string;
  linkSuffix?: string;
}) {
  const { live, next, minutesUntilNext, beforeEventStarts, afterEventEnds } = nowAndNext;

  if (afterEventEnds) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-lg font-bold text-ink">That is a wrap</h2>
        <p className="mt-1 text-ink-soft">
          Thank you for joining us. The full agenda and the take away resources stay available here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {live.length > 0 ? (
        <div className="rounded-xl border-2 border-live bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-live">
            <span aria-hidden="true" className="live-dot size-2 rounded-full bg-live" />
            Happening now
          </h2>

          <ul className="mt-2 space-y-3">
            {live.map((session) => (
              <li key={session.id}>
                <Link href={`/session/${session.id}${linkSuffix}`} className="block no-underline">
                  <p className="text-xl font-bold leading-snug text-ink">{session.title}</p>
                  <p className="mt-0.5 font-mono text-sm text-ink-soft">
                    {formatTimeRange(session.start, session.end)}
                    {session.room ? ` / ${session.room}` : ''}
                  </p>
                  <SpeakerNames speakers={session.speakers} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {next ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {live.length > 0 ? 'Next' : beforeEventStarts ? 'First up' : 'Up next'}
          </h2>

          <Link href={`/session/${next.id}${linkSuffix}`} className="mt-1 block no-underline">
            <p className="text-lg font-bold leading-snug text-ink">{next.title}</p>
            <p className="mt-0.5 font-mono text-sm text-ink-soft">
              {next.date === now.date
                ? formatTimeRange(next.start, next.end)
                : `${formatShortDate(next.date, timezone)}, ${formatTimeRange(next.start, next.end)}`}
              {next.room ? ` / ${next.room}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <TypeBadge type={next.type} />
              {minutesUntilNext !== null ? (
                <span className="text-sm font-semibold text-ink">
                  Starts {formatMinutesUntil(minutesUntilNext)}
                </span>
              ) : null}
            </div>
          </Link>
        </div>
      ) : null}

      {live.length === 0 && next === null && !afterEventEnds ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-lg font-bold text-ink">Nothing scheduled right now</h2>
          <p className="mt-1 text-ink-soft">Have a look at the full agenda for what is coming.</p>
        </div>
      ) : null}
    </section>
  );
}
