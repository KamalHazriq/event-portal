import Link from 'next/link';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { logoFor, resolveTheme } from '@/lib/theme';
import { formatLongDate, formatShortDate, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { readBackupMode } from '@/modules/backup/server';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { NowNextPanel } from '@/modules/schedule/components/NowNextPanel';
import { SessionList } from '@/modules/schedule/components/SessionCard';
import { EVENT_FORM_ID, EVENT_FORM_SLUG } from '@/modules/feedback/logic';
import { readFormSettings } from '@/modules/feedback/settings';
import {
  buildAgenda,
  findNowAndNext,
  nowLinkSuffix,
  readNowParam,
  sessionStatus,
} from '@/modules/schedule/logic';

// What this page shows depends on the current time, so it is never cached.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const config = getEventConfig();
  const params = await searchParams;

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: readNowParam(params.now),
  });

  const agenda = buildAgenda(config);
  const nowAndNext = findNowAndNext(agenda, now);
  const linkSuffix = nowLinkSuffix(now);

  // Only offer the event form while it is actually taking answers.
  const eventFeedbackOpen = config.features.feedback
    ? (await readFormSettings(EVENT_FORM_ID)).open
    : false;
  // Backup mode only: offer the open poll. Skipped entirely when polls are
  // off, so the static schedule preview never needs a database.
  const pollOpen =
    config.features.polls && (await readBackupMode())
      ? (await getData().polls.list()).some((poll) => poll.status === 'open')
      : false;
  const focusDay = nowAndNext.focusDay;
  const isToday = nowAndNext.today !== null;

  return (
    <div className="space-y-6 lg:!max-w-none">
      {/* Keeps the "happening now" highlight honest as the clock moves on. */}
      <AutoRefresh enabled={!now.isOverride} />

      <DevTimeNotice now={now} timezone={config.event.timezone} />

      {/*
        Phones get one column in reading order: the event, what is on, the
        day, then the actions. From laptop width up, the event, what is on
        and the actions sit on the left and the day runs down the right, so
        a wide screen is not one thin strip.
      */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoFor(config.branding, resolveTheme(config.branding, 'portal'))}
              alt={config.event.name}
              className="mb-5 h-auto w-full max-w-md"
              width={1000}
              height={318}
            />
            <p className="eyebrow">
              {formatShortDate(config.event.startDate, config.event.timezone)} to{' '}
              {formatShortDate(config.event.endDate, config.event.timezone)}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-[1.05] text-ink sm:text-4xl">
              {config.event.name}
            </h1>
            {config.event.tagline ? (
              <p className="mt-3 text-lg leading-snug text-accent">{config.event.tagline}</p>
            ) : null}
            <p className="mt-3 text-sm text-ink-soft">
              {formatLongDate(config.event.startDate, config.event.timezone)} to{' '}
              {formatLongDate(config.event.endDate, config.event.timezone)}
            </p>
            <p className="text-sm text-ink-soft">{config.event.venue}</p>
          </section>

          <NowNextPanel
            nowAndNext={nowAndNext}
            now={now}
            timezone={config.event.timezone}
            linkSuffix={linkSuffix}
          />
        </div>

        {/* Today: after now and next on a phone, the whole right column on a wide screen. */}
        <div className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {focusDay ? (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">
                  {isToday ? 'Today' : focusDay.label}
                  <span className="ml-2 text-sm font-normal text-ink-soft">
                    {formatLongDate(focusDay.date, config.event.timezone)}
                  </span>
                </h2>
                <Link
                  href={`/agenda?day=${focusDay.id}${nowLinkSuffix(now, '&')}`}
                  className="shrink-0 text-sm font-semibold text-primary"
                >
                  Full agenda
                </Link>
              </div>

              {focusDay.subtitle ? (
                <p className="mb-2 text-sm text-ink-soft">{focusDay.subtitle}</p>
              ) : null}

              <SessionList
                sessions={focusDay.sessions}
                statusOf={(session) => sessionStatus(session, now)}
                linkSuffix={linkSuffix}
              />
            </section>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-start-1 lg:row-start-2">
          {pollOpen ? (
            <section className="rounded-xl border-2 border-primary bg-surface p-4">
              <p className="eyebrow">Live now</p>
              <h2 className="mt-1 text-base font-bold text-ink">A poll is open</h2>
              <Link
                href="/poll"
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
              >
                Answer the poll
              </Link>
            </section>
          ) : null}

          {config.features.photoWall ? (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-base font-bold text-ink">Share a photo</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Your photos play on the big screen during breaks and dinner.
              </p>
              <Link
                href="/photos"
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
              >
                Share photos
              </Link>
            </section>
          ) : null}

          {config.features.feedback && eventFeedbackOpen ? (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-base font-bold text-ink">Tell us how it went</h2>
              <p className="mt-1 text-sm text-ink-soft">
                A rating and a sentence is plenty. It takes about a minute.
              </p>
              <Link
                href={`/feedback/${EVENT_FORM_SLUG}${linkSuffix}`}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
              >
                Give feedback on the summit
              </Link>
            </section>
          ) : null}

          {config.features.resources && config.resources.length > 0 ? (
            <section className="rounded-xl border border-line bg-muted p-4">
              <h2 className="text-base font-bold text-ink">Take aways</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Slides, guides and photos from the summit, all in one place.
              </p>
              <Link
                href={`/resources${linkSuffix}`}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
              >
                Open resources
              </Link>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
