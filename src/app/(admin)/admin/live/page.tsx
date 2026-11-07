import type { Metadata } from 'next';
import Link from 'next/link';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatClock, formatTimeRange, resolveEventNow } from '@/lib/time';
import { updateCountdown, updateCountdownLabel } from '@/modules/admin/actions';
import { CountdownClock } from '@/modules/admin/components/CountdownClock';
import {
  minutesLeftInSession,
  QUICK_COUNTDOWNS,
  resolveSurprise,
  runningState,
  runningStateLabel,
  SURPRISE_KEYS,
  surpriseInstant,
} from '@/modules/admin/logic';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Live control' };

/**
 * The page the MC keeps open during a session.
 *
 * One screen with what is on now, what is next, how full the room is, and
 * the countdown control. Polls and Q&A are on Slido for this event, so this
 * hands over the link rather than pretending to run them.
 */
export default async function LiveControlPage() {
  await requireAdmin('/admin/live');

  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const agenda = buildAgenda(config);
  const nowAndNext = findNowAndNext(agenda, now);

  const data = getData();
  const day = resolveCheckInDay(config.days, now);

  const [headcount, enabled, targetAt, label] = await Promise.all([
    day ? data.checkIns.headcount(day.id) : Promise.resolve(null),
    data.settings.get(SURPRISE_KEYS.enabled),
    data.settings.get(SURPRISE_KEYS.targetAt),
    data.settings.get(SURPRISE_KEYS.label),
  ]);

  const surprise = resolveSurprise(config, { enabled, targetAt, label });
  const instant = surpriseInstant(surprise, config.event.timezone);
  const rate = headcount ? arrivalRate(headcount.arrived, headcount.expected) : null;

  const live = nowAndNext.live[0];
  const minutesLeft = live ? minutesLeftInSession(live, now) : null;
  const state = live ? runningState(minutesLeft, live.endMinutes - live.startMinutes) : null;

  const slido = live?.slidoLink ?? null;

  return (
    <div className="space-y-5">
      {/* The clock moves, so this page must not go stale behind the MC. */}
      <AutoRefresh intervalMs={20_000} />

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Live control</h1>
        <p className="text-sm text-ink-soft">
          Event time{' '}
          {formatClock(
            `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`,
          )}
        </p>
      </header>

      {/* ---------------------------------------------------------- now */}
      <section
        className={[
          'rounded-xl border-2 p-4',
          state === 'wrapping-up' || state === 'over'
            ? 'border-live bg-live/10'
            : live
              ? 'border-success bg-surface'
              : 'border-line bg-surface',
        ].join(' ')}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">On now</h2>

        {live ? (
          <>
            <p className="mt-1 text-2xl font-bold leading-tight text-ink">{live.title}</p>
            <p className="mt-0.5 font-mono text-sm text-ink-soft">
              {formatTimeRange(live.start, live.end)}
              {live.room ? ` / ${live.room}` : ''}
            </p>

            <p className="mt-2 text-lg font-bold text-ink">
              {state ? runningStateLabel(state) : ''}
              {minutesLeft !== null ? (
                <span className="ml-2 font-normal text-ink-soft">
                  {minutesLeft} {minutesLeft === 1 ? 'minute' : 'minutes'} left
                </span>
              ) : null}
            </p>

            {nowAndNext.live.length > 1 ? (
              <p className="mt-2 text-sm text-ink-soft">
                Also running:{' '}
                {nowAndNext.live
                  .slice(1)
                  .map((s) => s.title)
                  .join(', ')}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-ink-soft">Nothing is running right now.</p>
        )}
      </section>

      {/* --------------------------------------------------------- next */}
      {nowAndNext.next ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Next</h2>
          <p className="mt-1 text-lg font-bold leading-tight text-ink">{nowAndNext.next.title}</p>
          <p className="mt-0.5 font-mono text-sm text-ink-soft">
            {formatTimeRange(nowAndNext.next.start, nowAndNext.next.end)}
            {nowAndNext.next.room ? ` / ${nowAndNext.next.room}` : ''}
          </p>
          {nowAndNext.minutesUntilNext !== null ? (
            <p className="mt-1 text-sm font-semibold text-ink">
              Starts in {nowAndNext.minutesUntilNext}{' '}
              {nowAndNext.minutesUntilNext === 1 ? 'minute' : 'minutes'}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ----------------------------------------------------- headcount */}
      {rate && day ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                In the room, {day.label}
              </h2>
              <p className="text-3xl font-bold tabular-nums leading-none text-ink">
                {rate.arrived}
                <span className="text-xl font-normal text-ink-soft"> / {rate.expected}</span>
              </p>
            </div>
            <Link href="/admin/headcount" className="shrink-0 text-sm font-semibold text-primary">
              Full headcount
            </Link>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={rate.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Arrivals so far"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${rate.percent}%` }} />
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------- polls and questions */}
      {slido ? (
        <section className="rounded-xl border border-line bg-muted p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Polls and questions
          </h2>
          <p className="mt-1 text-sm text-ink">
            This session runs on Slido. Open it on the laptop driving the screen.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {slido.eventUrl ? (
              <a
                href={slido.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-bold text-on-primary no-underline"
              >
                {slido.label}
              </a>
            ) : null}
            {slido.eventCode ? (
              <span className="font-mono font-bold text-ink">{slido.eventCode}</span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            If Slido is down:{' '}
            <Link href="/admin/qa" className="font-semibold text-primary">
              backup Q&A queue
            </Link>{' '}
            and{' '}
            <Link href="/admin/polls" className="font-semibold text-primary">
              backup polls
            </Link>
            , both previews for now.
          </p>
        </section>
      ) : null}

      {/* -------------------------------------------------- the countdown */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Surprise countdown
        </h2>

        {surprise.enabled && instant ? (
          <div className="mt-1">
            <p className="text-ink">{surprise.label}</p>
            <p className="text-3xl font-bold leading-tight text-ink">
              <CountdownClock targetMs={instant.getTime()} />
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Set for {surprise.targetAt?.replace('T', ' at ')}
              {surprise.overridden ? ', changed from the config file' : ', from the config file'}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-ink-soft">
            Off.{' '}
            {surprise.targetAt
              ? `The config file has it at ${surprise.targetAt.replace('T', ' at ')}.`
              : 'No time is set.'}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-ink">Start it in</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_COUNTDOWNS.map((minutes) => (
                <form key={minutes} action={updateCountdown}>
                  <input type="hidden" name="intent" value="quick" />
                  <input type="hidden" name="minutes" value={minutes} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-bold text-ink"
                  >
                    {minutes} min
                  </button>
                </form>
              ))}
            </div>
          </div>

          <form action={updateCountdown} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="exact" />
            <div>
              <label htmlFor="targetAt" className="block text-sm font-semibold text-ink">
                Or an exact time
              </label>
              <input
                id="targetAt"
                name="targetAt"
                type="datetime-local"
                defaultValue={surprise.targetAt ?? ''}
                className="mt-1 min-h-11 rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary"
            >
              Set
            </button>
          </form>

          <form action={updateCountdownLabel} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="label" className="block text-sm font-semibold text-ink">
                What the screen says above the numbers
              </label>
              <input
                id="label"
                name="label"
                type="text"
                maxLength={80}
                defaultValue={surprise.label}
                className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 py-2 font-semibold text-ink"
            >
              Save
            </button>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <form action={updateCountdown}>
              <input type="hidden" name="intent" value="off" />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"
              >
                Switch it off
              </button>
            </form>
            <form action={updateCountdown}>
              <input type="hidden" name="intent" value="reset" />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft"
              >
                Back to the config file
              </button>
            </form>
          </div>
        </div>

        <p className="mt-3 text-sm text-ink-soft">
          The big screen reads this, so it will show the countdown once Module 8 is built. You can
          already see where it will sit on the{' '}
          <Link href="/admin/big-screen" className="font-semibold text-primary">
            big screen preview
          </Link>
          .
        </p>
      </section>

      <nav aria-label="Other admin pages" className="flex flex-wrap gap-2">
        {[
          { href: '/admin/desk', label: 'Desk' },
          { href: '/admin/headcount', label: 'Headcount' },
          { href: '/admin/feedback', label: 'Feedback' },
          { href: '/admin/big-screen', label: 'Big screen' },
          { href: '/admin/lucky-draw', label: 'Lucky draw' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink no-underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
