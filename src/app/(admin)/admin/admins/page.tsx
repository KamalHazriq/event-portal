import type { Metadata } from 'next';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import {
  agoLabel,
  collapseActivity,
  pageLabel,
  presenceRows,
  SHOWN_MS,
} from '@/modules/admins/logic';
import { resetLeaderboardSignIns, signEveryoneOut } from '@/modules/admins/actions';
import { localClock } from '@/modules/reports/logic';
import { FormPending } from '@/components/FormPending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admins' };

/** Reads the clock and the store once, outside the component's render. */
async function loadAdmins(operator: string) {
  const data = getData();
  const now = Date.now();
  const [seen, recent] = await Promise.all([
    data.activity.seenSince(new Date(now - SHOWN_MS).toISOString()),
    data.activity.recent(120),
  ]);
  return {
    now,
    desks: presenceRows(seen, operator, now),
    log: collapseActivity(recent).slice(0, 40),
  };
}

/**
 * Who is signed in and what the desks have done (Module 6: two or three
 * admins at once). Desk labels only, never a person's name, and the log
 * never names an attendee.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await requireAdmin('/admin/admins');
  const config = getEventConfig();
  const { desks, log, now } = await loadAdmins(session.operator);
  const here = desks.filter((d) => d.active).length;

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={15_000} />

      <div>
        <h1 className="text-2xl font-bold text-ink">Admins</h1>
        <p className="mt-1 text-ink-soft">
          Every desk signs in with the PIN and its own label, and they all work on the same numbers
          at once.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Signed in now: {here}
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {desks.map((desk) => (
            <li key={desk.operator} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${desk.active ? 'bg-success' : 'bg-line'}`}
              />
              <span className="font-mono font-semibold text-ink">{desk.operator}</span>
              {desk.isYou ? (
                <span className="rounded bg-primary px-1.5 text-xs font-bold text-on-primary">
                  You
                </span>
              ) : null}
              <span className="ml-auto text-right text-sm text-ink-soft">
                {pageLabel(desk.page)}, {desk.active ? 'here now' : desk.ago}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">
          A desk shows as here while it has a page open, and for half an hour after it goes quiet.
        </p>
      </section>

      <section id="resets" aria-labelledby="resets-h" className="scroll-mt-24 space-y-3">
        <h2 id="resets-h" className="text-lg font-bold text-ink">
          Resets
        </h2>
        {params.reset !== undefined ? (
          <p
            role="status"
            className="rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink"
          >
            Done. {String(params.reset)} {params.reset === '1' ? 'phone was' : 'phones were'} signed
            out of the leaderboard.
          </p>
        ) : null}
        {params.error ? (
          <p
            role="alert"
            className="rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink"
          >
            Tick the box to confirm.
          </p>
        ) : null}

        <form
          action={signEveryoneOut}
          className="space-y-3 rounded-xl border border-line bg-surface p-4"
        >
          <FormPending label="Signing everyone out" />
          <p className="font-bold text-ink">Sign every desk out</p>
          <p className="text-ink-soft">
            Everyone on the secretariat side, you included, has to enter the PIN again. Use it for a
            lost phone or a clean start. The PIN itself does not change.
          </p>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input type="checkbox" name="confirm" value="yes" className="size-5" />
            Yes, sign every desk out
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-live px-5 font-bold text-canvas">
            Sign everyone out
          </button>
        </form>

        {config.features.leaderboard ? (
          <form
            action={resetLeaderboardSignIns}
            className="space-y-3 rounded-xl border border-line bg-surface p-4"
          >
            <FormPending label="Resetting" />
            <p className="font-bold text-ink">Reset the leaderboard sign ins</p>
            <p className="text-ink-soft">
              Every attendee phone that joined the leaderboard is signed out, so people pick their
              name again. Their points come back when they join. Use it after testing.
            </p>
            <label className="flex min-h-11 items-center gap-3 text-ink">
              <input type="checkbox" name="confirm" value="yes" className="size-5" />
              Yes, sign every phone out of the leaderboard
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-live px-5 font-bold text-canvas"
            >
              Reset the leaderboard sign ins
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">What was done</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-ink-soft">Nothing yet. Changes made by any desk appear here.</p>
        ) : (
          <ol className="mt-2 divide-y divide-line">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[4.5rem_1fr] gap-x-3 py-2 text-sm sm:grid-cols-[4.5rem_6rem_1fr]"
              >
                <span
                  className="tabular-nums text-ink-soft"
                  title={agoLabel(now - new Date(entry.at).getTime())}
                >
                  {localClock(entry.at, config.event.timezone)}
                </span>
                <span className="font-mono font-semibold text-ink max-sm:order-3 max-sm:col-start-2 max-sm:text-xs max-sm:font-normal max-sm:text-ink-soft">
                  {entry.operator}
                </span>
                <span className="text-ink">
                  {entry.action}
                  {entry.count > 1 ? (
                    <span className="ml-2 rounded bg-muted px-1.5 text-xs font-bold tabular-nums text-ink">
                      {entry.count} times
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-line bg-muted p-3 text-sm">
        <p className="font-semibold text-ink">Adding a desk</p>
        <p className="mt-1 text-ink-soft">
          On the new phone or laptop, open /admin, enter the PIN and a label such as desk-2. Use
          labels, never a person&apos;s name, so this log holds no personal data. The log never
          names an attendee either.
        </p>
      </section>
    </div>
  );
}
