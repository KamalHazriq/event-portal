import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { resolveCheckInDay } from '@/modules/check-in/logic';
import {
  clearWinners,
  drawLucky,
  removeWinner,
  saveExclusions,
} from '@/modules/lucky-draw/actions';
import { DrawButton } from '@/modules/lucky-draw/components/DrawButton';
import {
  DRAW_COUNTS,
  eligibleEntrants,
  groupDraws,
  LUCKY_KEYS,
  MAX_PRIZE,
  resolveExclusions,
} from '@/modules/lucky-draw/logic';
import { localClock } from '@/modules/reports/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lucky draw' };

export default async function LuckyDrawPage() {
  await requireAdmin('/admin/lucky-draw');

  const config = getEventConfig();
  if (!config.features.luckyDraw) notFound();

  const tz = config.event.timezone;
  const day = resolveCheckInDay(config.days, resolveEventNow({ timezone: tz }));
  const data = getData();

  const [checkedIn, everyone, winners, stored] = await Promise.all([
    day ? data.checkIns.listByDay(day.id) : Promise.resolve([]),
    data.attendees.list(),
    data.luckyDraw.list(),
    data.settings.get(LUCKY_KEYS.excluded),
  ]);

  const excluded = resolveExclusions(stored, everyone);
  const wonIds = new Set(winners.map((w) => w.attendeeId));
  const pool = checkedIn.map((c) => ({
    id: c.attendee.id,
    name: c.attendee.name,
    department: c.attendee.department,
  }));
  const inHat = eligibleEntrants(pool, excluded, wonIds);
  const excludedHere = pool.filter((p) => excluded.has(p.id)).length;
  const draws = groupDraws(winners);
  const latest = draws.at(-1);

  const sortedPeople = [...everyone].sort(
    (a, b) =>
      Number(excluded.has(b.id)) - Number(excluded.has(a.id)) || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Lucky draw</h1>
        <p className="mt-1 text-ink-soft">
          Draws from people checked in {day ? `on ${day.label}` : 'today'}. Nobody can win twice,
          across every draw and every day.
        </p>
      </div>

      {latest ? (
        <section className="rounded-xl border-2 border-success bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Latest draw{latest.prize ? `: ${latest.prize}` : ''}
          </h2>
          <ol className="mt-2 space-y-1">
            {latest.winners.map((w) => (
              <li key={w.id} className="text-xl font-bold leading-tight text-ink">
                {latest.winners.length > 1 ? `${w.position}. ` : ''}
                {w.attendee.name}
                <span className="block text-sm font-normal text-ink-soft">
                  {w.attendee.department}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Draw</h2>
        <p className="mt-1 text-ink">
          <span className="text-2xl font-bold tabular-nums">{inHat.length}</span> in the hat
        </p>
        <p className="text-sm text-ink-soft">
          {pool.length} checked in, {excludedHere} left out, {winners.length} already won.
        </p>

        <form action={drawLucky} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-ink">
              Winners
              <select
                name="count"
                defaultValue="1"
                className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
              >
                {DRAW_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Prize (optional)
              <input
                name="prize"
                type="text"
                maxLength={MAX_PRIZE}
                placeholder="For example, dinner door prize"
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
              />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="showOnScreen" defaultChecked className="size-5" />
            Put it on the big screen
          </label>
          <DrawButton disabled={inHat.length === 0} />
          {inHat.length === 0 ? (
            <p className="text-sm text-warning">
              Nobody is left in the hat. People join it when they check in.
            </p>
          ) : null}
        </form>
        <p className="mt-3 text-sm text-ink-soft">
          The big screen spins through the names and stops on the winners.{' '}
          <Link href="/admin/big-screen" className="font-semibold text-primary">
            Big screen control
          </Link>
        </p>
      </section>

      {draws.length > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Every winner, in draw order
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            If someone is not in the room, press Not here. They come off the list and out of the
            hat, and you can draw again.
          </p>
          <ol className="mt-3 space-y-4">
            {[...draws].reverse().map((draw) => (
              <li key={draw.drawId}>
                <p className="text-sm font-semibold text-ink">
                  {draw.prize || 'Draw'}, {localClock(draw.drawnAt, tz)}{' '}
                  <span className="font-mono font-normal text-ink-soft">{draw.byOperator}</span>
                </p>
                <ul className="mt-1 divide-y divide-line">
                  {draw.winners.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-ink">{w.attendee.name}</span>{' '}
                        <span className="text-sm text-ink-soft">{w.attendee.department}</span>
                      </span>
                      <form action={removeWinner}>
                        <input type="hidden" name="winnerId" value={w.id} />
                        <input type="hidden" name="attendeeId" value={w.attendeeId} />
                        <input type="hidden" name="exclude" value="yes" />
                        <button
                          type="submit"
                          className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                        >
                          Not here
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <details className="rounded-xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-semibold text-ink">
          Who can win ({excluded.size} left out)
        </summary>
        <p className="mt-2 text-sm text-ink-soft">
          Untick anyone who should not win, such as the CDIO or the secretariat, then save. The
          secretariat start unticked. Only people checked in that day are ever drawn.
        </p>
        <form action={saveExclusions} className="mt-2">
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {sortedPeople.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    name="include"
                    value={p.id}
                    defaultChecked={!excluded.has(p.id)}
                    className="size-5"
                  />
                  <span className={wonIds.has(p.id) ? 'text-ink-soft line-through' : 'text-ink'}>
                    {p.name}
                  </span>
                  <span className="ml-auto truncate text-sm text-ink-soft">{p.department}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
          >
            Save who can win
          </button>
        </form>
      </details>

      {winners.length > 0 ? (
        <details className="rounded-xl border border-line bg-muted p-4">
          <summary className="cursor-pointer font-semibold text-ink">Start over</summary>
          <p className="mt-2 text-sm text-ink-soft">
            Clears every winner, for example after a rehearsal. Who can win stays as it is.
          </p>
          <form action={clearWinners} className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-ink">
              <input type="checkbox" name="confirm" value="yes" required className="size-5" />
              Yes, clear all {winners.length} winners
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
            >
              Clear
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
