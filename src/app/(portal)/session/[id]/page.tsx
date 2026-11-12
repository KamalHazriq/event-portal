import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { formatLongDate, formatTimeRange, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { currentDeviceId, readBackupMode } from '@/modules/backup/server';
import { CommentsWall } from '@/modules/talk/components/CommentsWall';
import { ReactionBar } from '@/modules/talk/components/ReactionBar';
import { reactionsOpen } from '@/modules/talk/logic';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { SlidoButton } from '@/modules/schedule/components/SlidoButton';
import { SpeakerList } from '@/modules/schedule/components/SpeakerList';
import { StatusBadge } from '@/modules/schedule/components/StatusBadge';
import { TypeBadge } from '@/modules/schedule/components/TypeBadge';
import { buildAgenda, nowLinkSuffix, readNowParam, sessionStatus } from '@/modules/schedule/logic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const agenda = buildAgenda(getEventConfig());
  const session = agenda.byId.get(id);
  return { title: session?.title ?? 'Session not found' };
}

export default async function SessionPage({ params, searchParams }: PageProps) {
  const config = getEventConfig();
  // Only ask the database when the backup Q&A exists at all, so the static
  // schedule preview (which has no database) never needs one.
  const backupOn = config.features.qa ? await readBackupMode() : false;
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const agenda = buildAgenda(config);
  const session = agenda.byId.get(id);
  if (!session) notFound();

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: readNowParam(query.now),
  });

  const status = sessionStatus(session, now);
  const linkSuffix = nowLinkSuffix(now);
  // Passed back with each reaction and comment, so a test clock agrees.
  const nowParam = now.isOverride ? (readNowParam(query.now) ?? null) : null;
  const state = typeof query.state === 'string' ? query.state : null;

  const data = getData();
  const deviceId =
    config.features.reactions || config.features.comments ? await currentDeviceId() : null;
  const [reactionTotals, comments, likedIds] = await Promise.all([
    config.features.reactions ? data.reactions.totals(session.id) : null,
    config.features.comments ? data.comments.listBySession(session.id) : [],
    config.features.comments && deviceId
      ? data.comments.likedIds(session.id, deviceId)
      : Promise.resolve([] as string[]),
  ]);

  // Previous and next on the same day, so you can walk through the programme.
  const sameDay = agenda.days.find((day) => day.id === session.dayId)?.sessions ?? [];
  const position = sameDay.findIndex((item) => item.id === session.id);
  const previous = position > 0 ? sameDay[position - 1] : undefined;
  const following = position >= 0 ? sameDay[position + 1] : undefined;

  return (
    <article className="space-y-5">
      <AutoRefresh enabled={!now.isOverride} />
      <DevTimeNotice now={now} timezone={config.event.timezone} />

      <nav>
        <Link
          href={`/agenda?day=${session.dayId}${nowLinkSuffix(now, '&')}`}
          className="text-sm font-semibold text-primary"
        >
          Back to {session.dayLabel}
        </Link>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={session.type} />
          <StatusBadge status={status} />
        </div>

        <h1 className="mt-2 text-2xl font-bold leading-tight text-ink">{session.title}</h1>

        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold text-ink">When</dt>
            <dd className="text-ink-soft">
              {formatLongDate(session.date, config.event.timezone)},{' '}
              {formatTimeRange(session.start, session.end)}
            </dd>
          </div>
          {session.room ? (
            <div className="flex gap-2">
              <dt className="font-semibold text-ink">Where</dt>
              <dd className="text-ink-soft">{session.room}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {session.description ? (
        <section>
          <h2 className="sr-only">About this session</h2>
          <p className="text-ink">{session.description}</p>
        </section>
      ) : null}

      {session.objectives.length > 0 ? (
        <section className="rounded-lg border border-line bg-muted p-4">
          <h2 className="text-base font-bold text-ink">What you will walk away with</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
            {session.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.speakers.length > 0 ? (
        <section>
          <h2 className="mb-2 text-base font-bold text-ink">
            {session.speakers.length === 1 ? 'Speaker' : 'Speakers'}
          </h2>
          <SpeakerList speakers={session.speakers} />
        </section>
      ) : null}

      {/*
        Polls and Q&A run on Slido for this event, so the portal links out.
        The portal's own Q&A and feedback appear here instead once those
        modules are built and switched on in config.
      */}
      {backupOn && session.qaEnabled ? (
        // Backup mode: the portal's own Q&A stands in for the Slido button.
        <Link
          href={`/qa/${session.id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          Ask a question
        </Link>
      ) : (session.qaEnabled || session.type === 'activity') && session.slidoLink ? (
        <SlidoButton slido={session.slidoLink} />
      ) : null}

      {reactionTotals ? (
        <ReactionBar
          sessionId={session.id}
          open={reactionsOpen(session, now)}
          initialTotals={reactionTotals}
          nowParam={nowParam}
        />
      ) : null}

      {config.features.feedback && session.feedbackEnabled ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-base font-bold text-ink">Feedback</h2>
          <Link
            href={`/feedback/${session.id}${linkSuffix}`}
            className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
          >
            Rate this session
          </Link>
        </section>
      ) : null}

      {config.features.comments ? (
        <CommentsWall
          sessionId={session.id}
          comments={comments}
          likedIds={likedIds}
          state={state}
          nowParam={nowParam}
        />
      ) : null}

      <nav
        aria-label="Other sessions this day"
        className="flex gap-3 border-t border-line pt-4 text-sm"
      >
        {previous ? (
          <Link
            href={`/session/${previous.id}${linkSuffix}`}
            className="font-semibold text-primary"
          >
            Previous: {previous.title}
          </Link>
        ) : null}
        {following ? (
          <Link
            href={`/session/${following.id}${linkSuffix}`}
            className="ml-auto text-right font-semibold text-primary"
          >
            Next: {following.title}
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
