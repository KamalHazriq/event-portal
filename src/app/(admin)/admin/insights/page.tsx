import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/AutoRefresh';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatClock, formatShortDate, resolveEventNow } from '@/lib/time';
import { checkInDays, resolveCheckInDay } from '@/modules/check-in/logic';
import { loadInsightsInput } from '@/modules/insights/load';
import {
  arrivalBuckets,
  buildAlerts,
  engagementBySession,
  eventPhase,
  peakBucket,
  phonesTakingPart,
  type AlertTone,
} from '@/modules/insights/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Insights' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TONE: Record<AlertTone, { label: string; mark: string; className: string }> = {
  act: { label: 'To do', mark: '!', className: 'border-warning bg-warning/10' },
  note: { label: 'Worth a look', mark: 'i', className: 'border-line bg-surface' },
  good: { label: 'Going well', mark: '✓', className: 'border-success/60 bg-success/10' },
};

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/insights');
  const config = getEventConfig();
  const tz = config.event.timezone;
  const params = await searchParams;
  const now = resolveEventNow({ timezone: tz });
  const input = await loadInsightsInput(config, now);

  const phase = eventPhase(config, now);
  const alerts = buildAlerts(input);
  const days = checkInDays(config);
  const day = resolveCheckInDay(days, now, typeof params.day === 'string' ? params.day : null);
  const guests = input.attendees.filter((a) => !a.isSecretariat);
  const guestIds = new Set(guests.map((g) => g.id));
  const cameAny = new Set(
    input.checkIns.filter((c) => guestIds.has(c.attendeeId)).map((c) => c.attendeeId),
  ).size;
  const dayCheckIns = day ? input.checkIns.filter((c) => c.dayId === day.id) : [];
  const buckets = arrivalBuckets(dayCheckIns, tz);
  const peak = peakBucket(buckets);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const sessions = engagementBySession(input)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const phaseLabel =
    phase === 'before'
      ? 'Before the event'
      : phase === 'after'
        ? 'After the event'
        : `During the event, ${formatShortDate(now.date, tz)}`;

  const stats = [
    { label: 'Guests on the list', value: guests.length },
    { label: 'Came at least one day', value: cameAny },
    { label: 'Phones taking part', value: phonesTakingPart(input) },
    { label: 'Linked for points', value: input.links.length },
    { label: 'Alerts on', value: input.alertPhones ?? 0 },
    { label: 'Photos shared', value: input.photos.length },
    { label: 'Comments', value: input.comments.length },
    { label: 'Feedback answers', value: input.feedback.length },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <header>
        <h1 className="text-2xl font-bold text-ink">Insights</h1>
        <p className="mt-1 text-ink-soft">
          {phaseLabel}. Worked out from simple rules on the live numbers (no AI), so each line says
          why it is there. Refreshes every minute.
        </p>
      </header>

      <section aria-labelledby="attention">
        <h2 id="attention" className="mb-2 text-lg font-bold text-ink">
          Needs attention
        </h2>
        {alerts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
            Nothing to flag right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const tone = TONE[alert.tone];
              return (
                <li
                  key={alert.text}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${tone.className}`}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-bg text-sm font-bold text-ink"
                  >
                    {tone.mark}
                  </span>
                  <p className="min-w-0 flex-1 text-ink">
                    <span className="font-bold">{tone.label}: </span>
                    {alert.text}
                  </p>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className="min-h-11 shrink-0 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-ink no-underline"
                    >
                      {alert.action ?? 'Open'}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="The numbers">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {stats.map((s) => (
            <li key={s.label} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-3xl font-bold tabular-nums leading-none text-ink">{s.value}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.label}</p>
            </li>
          ))}
        </ul>
      </section>

      {day ? (
        <section
          aria-labelledby="arrivals"
          className="rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="arrivals" className="text-lg font-bold text-ink">
              Arrivals per 15 minutes, {day.label}
            </h2>
            {days.length > 1 ? (
              <nav aria-label="Choose a day" className="flex gap-1">
                {days.map((option) => (
                  <Link
                    key={option.id}
                    href={`/admin/insights?day=${option.id}`}
                    aria-current={option.id === day.id ? 'page' : undefined}
                    className={`rounded-md px-2.5 py-1.5 text-sm font-semibold no-underline ${
                      option.id === day.id ? 'bg-muted text-ink' : 'text-ink-soft'
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          {buckets.length === 0 ? (
            <p className="mt-3 text-ink-soft">Nobody has checked in on this day yet.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                {dayCheckIns.length} check ins.{' '}
                {peak
                  ? `Busiest: ${formatClock(peak.start)} to ${formatClock(peak.end)}, ${peak.count} people.`
                  : null}
              </p>
              <div
                className="mt-4 flex h-40 items-end gap-0.5 border-b border-line"
                role="img"
                aria-label={`Arrivals per 15 minutes on ${day.label}. Busiest window ${peak?.start} to ${peak?.end} with ${peak?.count}.`}
              >
                {buckets.map((b) => {
                  const isPeak = b === peak;
                  return (
                    <div
                      key={b.start}
                      className="group relative flex h-full min-w-0 flex-1 items-end"
                      title={`${formatClock(b.start)} to ${formatClock(b.end)}: ${b.count}`}
                    >
                      {isPeak ? (
                        <span className="absolute inset-x-0 -top-0.5 text-center text-xs font-bold tabular-nums text-ink">
                          {b.count}
                        </span>
                      ) : null}
                      <div
                        className={`w-full max-w-6 rounded-t-[4px] mx-auto ${
                          isPeak ? 'bg-primary' : 'bg-primary/45 group-hover:bg-primary/70'
                        }`}
                        style={{ height: `${(b.count / max) * 85}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-soft">
                <span>{buckets[0] ? formatClock(buckets[0].start) : null}</span>
                <span>
                  {buckets.length > 0 ? formatClock(buckets[buckets.length - 1]!.end) : null}
                </span>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-ink">Show as a table</summary>
                <table className="mt-2 w-full max-w-sm text-left tabular-nums">
                  <thead>
                    <tr className="text-ink-soft">
                      <th className="py-1 font-semibold">Time</th>
                      <th className="py-1 text-right font-semibold">Check ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.start} className="border-t border-line text-ink">
                        <td className="py-1">
                          {formatClock(b.start)} to {formatClock(b.end)}
                        </td>
                        <td className="py-1 text-right">{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </section>
      ) : null}

      <section aria-labelledby="sessions">
        <h2 id="sessions" className="mb-2 text-lg font-bold text-ink">
          Liveliest sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
            No reactions, comments or ratings yet.
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
              <thead className="text-ink-soft">
                <tr>
                  <th className="p-3 font-semibold">Session</th>
                  <th className="p-3 text-right font-semibold">Phones reacted</th>
                  <th className="p-3 text-right font-semibold">Comments</th>
                  <th className="p-3 text-right font-semibold">Ratings</th>
                  <th className="p-3 text-right font-semibold">Average</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId} className="border-t border-line text-ink">
                    <td className="p-3">
                      <span className="font-semibold">{s.title}</span>
                      <span className="block text-ink-soft">
                        {s.dayLabel}, {formatClock(s.start)}
                      </span>
                    </td>
                    <td className="p-3 text-right">{s.reactors}</td>
                    <td className="p-3 text-right">{s.comments}</td>
                    <td className="p-3 text-right">{s.ratings}</td>
                    <td className="p-3 text-right">{s.average === null ? '' : `${s.average} ★`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
