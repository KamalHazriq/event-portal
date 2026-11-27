import { pageNowParam } from '@/lib/test-clock-server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { formatLongDate, formatTimeRange, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { NavChevron } from '@/components/NavChevron';
import { getData } from '@/data';
import { currentDeviceId, readBackupMode } from '@/modules/backup/server';
import { CommentsWall } from '@/modules/talk/components/CommentsWall';
import { ReactionBar } from '@/modules/talk/components/ReactionBar';
import { isInteractiveSession, reactionsOpen } from '@/modules/talk/logic';
import { currentPlayer } from '@/modules/points/server';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { SlidoButton } from '@/modules/schedule/components/SlidoButton';
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
    overrideParam: await pageNowParam(readNowParam(query.now)),
  });

  const status = sessionStatus(session, now);
  const linkSuffix = nowLinkSuffix(now);
  // Passed back with each reaction and comment, so a test clock agrees.
  const nowParam = now.isOverride ? await pageNowParam(readNowParam(query.now)) : null;
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

  // Registration, meals, breaks and free time: nothing to react to or comment on.
  const interactive = isInteractiveSession(session);
  const me = interactive && config.features.comments ? await currentPlayer() : null;
  // Slido (or the backup Q&A) and the reaction buttons, kept together.
  const takePart = (
    <>
      {!interactive ? null : backupOn && session.qaEnabled ? (
        // Backup mode: the portal's own Q&A stands in for the Slido button.
        <Link
          href={`/qa/${session.id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          Ask a question
        </Link>
      ) : (session.qaEnabled || session.type === 'activity') && session.slidoLink ? (
        <SlidoButton slido={session.slidoLink} />
      ) : session.qaEnabled && config.integrations.slido?.enabled ? (
        // The Slido link is not set yet (still a placeholder in the config).
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-base font-bold text-ink">Polls and questions</h2>
          <p className="mt-1 text-ink-soft">
            This session uses Slido. The link appears here on the day.
          </p>
        </section>
      ) : null}

      {session.slidesUrl ? (
        <a
          href={session.slidesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 py-2.5 font-semibold text-ink no-underline hover:border-primary"
        >
          {session.slidesLabel || 'Open the slides'}
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </>
  );

  // Reactions come first, right under the details: while a talk is on, that is
  // what people open the page for.
  const reactions =
    reactionTotals && interactive ? (
      <ReactionBar
        sessionId={session.id}
        open={reactionsOpen(session, now)}
        initialTotals={reactionTotals}
        nowParam={nowParam}
      />
    ) : null;

  const commentsWall =
    config.features.comments && interactive ? (
      <CommentsWall
        timezone={config.event.timezone}
        sessionId={session.id}
        comments={comments}
        likedIds={likedIds}
        state={state}
        nowParam={nowParam}
        deviceId={deviceId}
        signedInAs={me?.name ?? null}
      />
    ) : null;

  return (
    <article className="space-y-5">
      <AutoRefresh enabled={!now.isOverride} />
      <DevTimeNotice now={now} timezone={config.event.timezone} />

      <nav>
        <Link
          href={`/agenda?day=${session.dayId}${nowLinkSuffix(now, '&')}`}
          className="nav-pill no-underline"
        >
          <NavChevron dir="back" />
          {session.dayLabel} agenda
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
          {session.speakers.length > 0 ? (
            <div className="flex gap-2">
              <dt className="font-semibold text-ink">
                {session.speakers.length === 1 ? 'Speaker' : 'Speakers'}
              </dt>
              <dd className="min-w-0 text-ink-soft">
                {session.speakers.map((sp, i) => (
                  <span key={sp.id}>
                    {i > 0 ? '; ' : ''}
                    <span className="text-ink">{sp.name}</span>
                    {sp.title ? `, ${sp.title}` : ''}
                  </span>
                ))}
              </dd>
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

      {reactions}

      {commentsWall}

      {/* Polls, questions and feedback sit at the bottom, smaller: they come after the talk. */}
      {takePart}

      {config.features.feedback && session.feedbackEnabled && interactive ? (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
          <p className="text-sm text-ink-soft">
            <strong className="font-semibold text-ink">Feedback</strong>: a minute, stars and an
            optional comment.
          </p>
          <Link
            href={`/feedback/${session.id}${linkSuffix}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-bold text-on-primary no-underline"
          >
            Rate this session
          </Link>
        </section>
      ) : null}

      <nav
        aria-label="Other sessions this day"
        className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      >
        {previous ? (
          <Link href={`/session/${previous.id}${linkSuffix}`} className="nav-step no-underline">
            <NavChevron dir="back" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Previous
              </span>
              <span className="block truncate font-semibold text-ink">{previous.title}</span>
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {following ? (
          <Link
            href={`/session/${following.id}${linkSuffix}`}
            className="nav-step no-underline justify-end text-right"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Next
              </span>
              <span className="block truncate font-semibold text-ink">{following.title}</span>
            </span>
            <NavChevron dir="next" />
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
