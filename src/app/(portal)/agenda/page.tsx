import type { Metadata } from 'next';

import { getEventConfig } from '@/lib/config';
import { formatLongDate, resolveEventNow } from '@/lib/time';
import { AutoRefresh } from '@/components/AutoRefresh';
import { DayTabs } from '@/modules/schedule/components/DayTabs';
import { DevTimeNotice } from '@/modules/schedule/components/DevTimeNotice';
import { SessionList } from '@/modules/schedule/components/SessionCard';
import {
  buildAgenda,
  nowLinkSuffix,
  readNowParam,
  resolveSelectedDay,
  sessionStatus,
} from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Agenda' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const config = getEventConfig();
  const params = await searchParams;

  const now = resolveEventNow({
    timezone: config.event.timezone,
    overrideParam: readNowParam(params.now),
  });

  const agenda = buildAgenda(config);
  const requestedDay = readNowParam(params.day);
  const selectedDay = resolveSelectedDay(agenda, requestedDay, now);
  const linkSuffix = nowLinkSuffix(now);

  return (
    <div className="space-y-4 lg:!max-w-6xl">
      <AutoRefresh enabled={!now.isOverride} />
      <DevTimeNotice now={now} timezone={config.event.timezone} />

      <h1 className="text-2xl font-bold text-ink">Agenda</h1>

      <DayTabs
        days={agenda.days}
        selectedDayId={selectedDay?.id ?? ''}
        timezone={config.event.timezone}
        extraParams={nowLinkSuffix(now, '&')}
      />

      {selectedDay ? (
        <section>
          <h2 className="text-lg font-bold text-ink">
            {selectedDay.label}
            <span className="ml-2 text-sm font-normal text-ink-soft">
              {formatLongDate(selectedDay.date, config.event.timezone)}
            </span>
          </h2>
          {selectedDay.subtitle ? (
            <p className="mb-3 text-sm text-ink-soft">{selectedDay.subtitle}</p>
          ) : (
            <div className="mb-3" />
          )}

          <SessionList
            columns={2}
            sessions={selectedDay.sessions}
            statusOf={(session) => sessionStatus(session, now)}
            linkSuffix={linkSuffix}
            emptyMessage="No sessions on this day yet."
          />
        </section>
      ) : (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
          No days are set up in the event config yet.
        </p>
      )}
    </div>
  );
}
