import Link from 'next/link';

import { getEventConfig } from '@/lib/config';
import { formatLongDate, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { NowNextPanel } from '@/modules/schedule/components/NowNextPanel';
import { SessionList } from '@/modules/schedule/components/SessionCard';
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
  const focusDay = nowAndNext.focusDay;
  const isToday = nowAndNext.today !== null;

  return (
    <div className="space-y-6">
      {/* Keeps the "happening now" highlight honest as the clock moves on. */}
      <AutoRefresh enabled={!now.isOverride} />

      <DevTimeNotice now={now} timezone={config.event.timezone} />

      <section>
        <h1 className="text-2xl font-bold leading-tight text-ink">{config.event.name}</h1>
        {config.event.tagline ? <p className="mt-1 text-ink-soft">{config.event.tagline}</p> : null}
        <p className="mt-2 text-sm text-ink-soft">
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
  );
}
