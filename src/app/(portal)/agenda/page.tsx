import { pageNowParam } from '@/lib/test-clock-server';
import type { Metadata } from 'next';

import { getEventConfig } from '@/lib/config';
import { formatLongDate, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { AgendaSwitcher } from '@/modules/schedule/components/AgendaSwitcher';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { MyAgenda } from '@/modules/schedule/components/MyAgenda';
import { SessionList } from '@/modules/schedule/components/SessionCard';
import {
  buildAgenda,
  nowLinkSuffix,
  readNowParam,
  resolveSelectedDay,
  sessionStatus,
  type ResolvedDay,
} from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Agenda' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const config = getEventConfig();
  const params = await searchParams;

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: await pageNowParam(readNowParam(params.now)),
  });

  const agenda = buildAgenda(config);
  const requestedDay = readNowParam(params.day);
  const mine = requestedDay === 'mine';
  const selectedDay = mine ? null : resolveSelectedDay(agenda, requestedDay, now);
  const tz = config.event.timezone;
  const linkSuffix = nowLinkSuffix(now);

  /** One day's sessions. On that very day, two or more finished ones fold away. */
  const dayPanel = (day: ResolvedDay) => {
    const finished =
      day.date === now.date ? day.sessions.filter((s) => sessionStatus(s, now) === 'past') : [];
    const earlier = finished.length >= 2 ? finished : [];
    const upcoming = day.sessions.filter((s) => !earlier.includes(s));
    return (
      <section>
        <h2 className="text-lg font-bold text-ink">
          {day.label}
          <span className="ml-2 text-sm font-normal text-ink-soft">
            {formatLongDate(day.date, tz)}
          </span>
        </h2>
        {day.subtitle ? (
          <p className="mb-3 text-sm text-ink-soft">{day.subtitle}</p>
        ) : (
          <div className="mb-3" />
        )}

        {earlier.length > 0 ? (
          <details className="mb-2 rounded-lg border border-line bg-surface">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink-soft">
              Earlier today ({earlier.length} finished)
            </summary>
            <div className="px-2 pb-2">
              <SessionList
                columns={2}
                sessions={earlier}
                statusOf={(session) => sessionStatus(session, now)}
                linkSuffix={linkSuffix}
              />
            </div>
          </details>
        ) : null}

        <SessionList
          columns={2}
          sessions={upcoming}
          statusOf={(session) => sessionStatus(session, now)}
          linkSuffix={linkSuffix}
          emptyMessage={
            earlier.length > 0 ? 'That is everything for today.' : 'No sessions on this day yet.'
          }
        />
      </section>
    );
  };

  const panels = {
    ...Object.fromEntries(agenda.days.map((day) => [day.id, dayPanel(day)])),
    mine: (
      <MyAgenda
        days={agenda.days.map((d) => ({
          id: d.id,
          label: d.label,
          dateLabel: formatLongDate(d.date, tz),
          sessions: d.sessions,
        }))}
        statuses={Object.fromEntries(
          agenda.days.flatMap((d) => d.sessions).map((s) => [s.id, sessionStatus(s, now)]),
        )}
        linkSuffix={linkSuffix}
      />
    ),
  };

  return (
    <div className="space-y-4 lg:!max-w-6xl">
      <AutoRefresh enabled={!now.isOverride} />
      <DevTimeNotice now={now} timezone={config.event.timezone} />

      <h1 className="text-2xl font-bold text-ink">Agenda</h1>

      {agenda.days.length > 0 ? (
        <AgendaSwitcher
          days={agenda.days}
          initial={mine ? 'mine' : (selectedDay?.id ?? agenda.days[0]?.id ?? '')}
          panels={panels}
          timezone={tz}
          extraParams={nowLinkSuffix(now, '&')}
        />
      ) : (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          No days are set up in the event config yet.
        </p>
      )}
    </div>
  );
}
