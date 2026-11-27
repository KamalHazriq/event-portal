import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { resolveEventNow } from '@/lib/time';
import { resolveCheckInDay } from '@/modules/check-in/logic';
import { drawLucky, removeWinner } from '@/modules/lucky-draw/actions';
import { DrawButton } from '@/modules/lucky-draw/components/DrawButton';
import {
  DRAW_COUNTS,
  eligibleEntrants,
  groupDraws,
  LUCKY_KEYS,
  MAX_PRIZE,
  resolveExclusions,
} from '@/modules/lucky-draw/logic';

/** The lucky draw, run from the stage console: draw, see the winners, mark "Not here". */
export async function DrawPanel() {
  const config = getEventConfig();
  const data = getData();
  const day = resolveCheckInDay(config.days, resolveEventNow({ timezone: config.event.timezone }));
  const [checkedIn, everyone, winners, stored] = await Promise.all([
    day ? data.checkIns.listByDay(day.id) : Promise.resolve([]),
    data.attendees.list(),
    data.luckyDraw.list(),
    data.settings.get(LUCKY_KEYS.excluded),
  ]);
  const excluded = resolveExclusions(stored, everyone);
  const pool = checkedIn.map((c) => ({
    id: c.attendee.id,
    name: c.attendee.name,
    department: shortDepartment(config, c.attendee.department),
  }));
  const inHat = eligibleEntrants(pool, excluded, new Set(winners.map((w) => w.attendeeId)));
  const latest = groupDraws(winners).at(-1);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Lucky draw</h2>
      <p className="text-ink">
        <span className="text-2xl font-bold tabular-nums">{inHat.length}</span> in the hat
        <span className="text-sm text-ink-soft">
          {' '}
          ({pool.length} checked in, {winners.length} already won)
        </span>
      </p>

      <form action={drawLucky} className="space-y-3">
        <input type="hidden" name="showOnScreen" value="on" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm font-semibold text-ink">
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
              maxLength={MAX_PRIZE}
              placeholder="For example, dinner door prize"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
        </div>
        <DrawButton disabled={inHat.length === 0} />
        {inHat.length === 0 ? (
          <p className="text-sm text-warning">Nobody is left in the hat.</p>
        ) : null}
      </form>

      {latest ? (
        <div className="rounded-lg border border-line bg-canvas p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Latest draw{latest.prize ? `: ${latest.prize}` : ''}
          </p>
          <ul className="mt-1 divide-y divide-line">
            {latest.winners.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1 font-semibold text-ink">
                  {w.attendee.name}
                  <span className="ml-2 text-sm font-normal text-ink-soft">
                    {shortDepartment(config, w.attendee.department)}
                  </span>
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
        </div>
      ) : null}
    </section>
  );
}
