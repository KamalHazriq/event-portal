import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { getData } from '@/data';
import { addBonus, removeBonus, saveEarlyCutoffs } from '@/modules/points/actions';
import {
  BONUS_KEY,
  CAPS,
  MAX_BONUS,
  parseBonus,
  POINT_LABELS,
  POINTS,
  type PointKind,
} from '@/modules/points/logic';
import { attendanceRules, loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Points' };

const KINDS = Object.keys(POINTS) as PointKind[];

/**
 * Where everyone's points came from: one row per person on the leaderboard,
 * one column per way of earning, so a surprising total can be explained.
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PointsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/points');
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const params = await searchParams;
  const data = getData();
  const [board, attendees, bonusRaw] = await Promise.all([
    loadScoreboard(),
    data.attendees.list(),
    data.settings.get(BONUS_KEY),
  ]);
  const bonuses = parseBonus(bonusRaw).reverse();
  const rules = await attendanceRules();
  const nameOf = new Map(attendees.map((a) => [a.id, a]));
  const who = typeof params.who === 'string' ? params.who : '';
  const notice =
    params.bonus === 'added'
      ? { good: true, text: `Gave bonus points to ${who}.` }
      : params.bonus === 'removed'
        ? { good: true, text: 'Took that bonus back.' }
        : params.bonus === 'person'
          ? { good: false, text: 'Pick a person from the list, or type their staff number.' }
          : params.bonus === 'points'
            ? { good: false, text: `Points must be a whole number from 1 to ${MAX_BONUS}.` }
            : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Points</h1>
        <p className="mt-1 text-ink-soft">
          Where each person&apos;s points come from. Points are worked out from what people do in
          the portal, so an undone check in or a rejected photo loses its points by itself. The
          secretariat are left out.
        </p>
      </header>

      <section
        id="bonus"
        aria-labelledby="bonus-h"
        className="scroll-mt-24 rounded-xl border border-line bg-surface p-4"
      >
        <h2 id="bonus-h" className="text-lg font-bold text-ink">
          Bonus points
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          For people who take part beyond the portal: helping on the day, a great question on stage.
          They add to the total at once and count on the leaderboard and the podium.
        </p>
        {notice ? (
          <p
            role="status"
            className={`mt-3 rounded-lg border p-3 text-sm font-semibold ${
              notice.good ? 'border-success text-success' : 'border-warning text-warning'
            }`}
          >
            {notice.text}
          </p>
        ) : null}
        <form
          action={addBonus}
          className="mt-3 grid gap-3 md:grid-cols-[2fr_8rem_2fr_auto] md:items-end"
        >
          <label className="block text-sm font-semibold text-ink">
            Who
            <input
              name="person"
              list="bonus-people"
              required
              autoComplete="off"
              placeholder="Start typing a name"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
            />
            <datalist id="bonus-people">
              {attendees.map((a) => (
                <option key={a.id} value={`${a.name} (${a.staffNo})`} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-semibold text-ink">
            Points
            <input
              name="points"
              type="number"
              min={1}
              max={MAX_BONUS}
              step={1}
              defaultValue={10}
              required
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Why (optional)
            <input
              name="reason"
              list="bonus-reasons"
              maxLength={120}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
            />
            <datalist id="bonus-reasons">
              <option value="Helped on the day" />
              <option value="Great question on stage" />
              <option value="Shared in the sharing round" />
              <option value="Won an activity" />
            </datalist>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Give bonus
          </button>
        </form>

        {bonuses.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {bonuses.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0 text-sm">
                  <strong className="text-ink">
                    {nameOf.get(b.attendeeId)?.name ?? 'Someone no longer on the list'}
                  </strong>
                  <span className="ml-2 font-bold tabular-nums text-primary">+{b.points}</span>
                  {b.reason ? <span className="ml-2 text-ink-soft">{b.reason}</span> : null}
                  <span className="ml-2 text-xs text-ink-soft">by {b.by}</span>
                </span>
                <form action={removeBonus}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="min-h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-primary"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        id="attendance"
        aria-labelledby="attendance-h"
        className="scroll-mt-24 rounded-xl border border-line bg-surface p-4"
      >
        <h2 id="attendance-h" className="text-lg font-bold text-ink">
          Attendance points, each day
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Each day is scanned on its own date: the desk and the kiosk use the day that matches today
          (before the event they use Day 1, and the desk can pick another day at the top of the Desk
          page). A scan on a day earns {POINTS.checkIn} points. A scan before the early time below
          earns {POINTS.onTime} more. Scan later that day: just the {POINTS.checkIn}. No scan that
          day: nothing. Participants see these rules on My points.
        </p>
        {params.early === 'saved' ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-success p-3 text-sm font-semibold text-success"
          >
            Saved. Points update at once.
          </p>
        ) : null}
        <form action={saveEarlyCutoffs} className="mt-3 space-y-3">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {rules.map((rule) => (
              <li
                key={rule.dayId}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <span className="text-sm">
                  <strong className="text-ink">{rule.label}</strong>
                  <span className="ml-2 text-ink-soft">{rule.date}</span>
                </span>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  Early means before
                  <input
                    type="time"
                    name={`early-${rule.dayId}`}
                    defaultValue={rule.earlyBy}
                    required
                    className="min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
                  />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Save the early times
          </button>
          <p className="text-xs text-ink-soft">
            Left alone, early means before the day&apos;s first session starts.
          </p>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          How points are earned
        </h2>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map((kind) => (
            <li key={kind} className="flex justify-between gap-3 text-ink">
              <span>{POINT_LABELS[kind]}</span>
              <span className="tabular-nums text-ink-soft">
                +{POINTS[kind]}
                {CAPS[kind] ? `, up to ${CAPS[kind]}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {board.people.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          Nobody has points yet.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Dept</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-right font-semibold">Bonus</th>
                {KINDS.map((kind) => (
                  <th
                    key={kind}
                    className="px-2 py-2 text-right font-semibold"
                    title={POINT_LABELS[kind]}
                  >
                    {POINT_LABELS[kind]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.people.map((row) => {
                const score = board.scores.get(row.attendeeId);
                return (
                  <tr key={row.attendeeId} className="border-t border-line bg-surface">
                    <td className="px-3 py-2 tabular-nums text-ink-soft">{row.rank}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{row.name}</td>
                    <td className="px-3 py-2 text-ink">
                      {shortDepartment(config, row.department)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">
                      {row.points}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-soft">
                      {score?.bonus ? `+${score.bonus}` : '·'}
                    </td>
                    {KINDS.map((kind) => {
                      const count = score?.counts[kind] ?? 0;
                      return (
                        <td key={kind} className="px-2 py-2 text-right tabular-nums text-ink-soft">
                          {count ? (
                            <>
                              {count}
                              <span className="text-xs"> (+{count * POINTS[kind]})</span>
                            </>
                          ) : (
                            '·'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
