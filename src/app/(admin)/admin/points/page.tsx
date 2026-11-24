import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { CAPS, POINT_LABELS, POINTS, type PointKind } from '@/modules/points/logic';
import { loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Points' };

const KINDS = Object.keys(POINTS) as PointKind[];

/**
 * Where everyone's points came from: one row per person on the leaderboard,
 * one column per way of earning, so a surprising total can be explained.
 */
export default async function PointsPage() {
  await requireAdmin('/admin/points');
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const board = await loadScoreboard();

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
