import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getEventConfig } from '@/lib/config';
import { MIN_DEPARTMENT_SIZE } from '@/modules/points/logic';
import { currentPlayer, loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Leaderboard' };

const TOP = 10;

export default async function LeaderboardPage() {
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const [board, me] = await Promise.all([loadScoreboard(), currentPlayer()]);
  const top = board.people.filter((row) => row.rank <= TOP);
  const mine = me ? board.people.find((row) => row.attendeeId === me.id) : undefined;
  const mineShownAlready = mine ? top.some((row) => row.attendeeId === mine.attendeeId) : false;

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={20_000} enabled />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Taking part</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Leaderboard</h1>
          <p className="mt-1 text-ink-soft">
            Points for arriving, feedback, polls and photos. Updates as you go.
          </p>
        </div>
        <Link
          href="/me"
          className="btn-primary inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-on-primary no-underline"
        >
          {me ? 'My points' : 'Join the leaderboard'}
        </Link>
      </header>

      <section aria-labelledby="people">
        <h2
          id="people"
          className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft"
        >
          Top people
        </h2>
        {top.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
            No points yet. Be the first: join, then send a feedback form or answer a poll.
          </p>
        ) : (
          <ol className="stagger space-y-2">
            {top.map((row) => (
              <li
                key={row.attendeeId}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  row.attendeeId === me?.id
                    ? 'border-primary bg-primary/10'
                    : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${
                    row.rank <= 3 ? 'bg-primary text-on-primary' : 'bg-muted text-ink'
                  }`}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{row.name}</span>
                  <span className="block text-sm text-ink-soft">{row.department}</span>
                </span>
                <span className="shrink-0 text-lg font-bold tabular-nums text-ink">
                  {row.points}
                </span>
              </li>
            ))}
          </ol>
        )}
        {mine && !mineShownAlready ? (
          <p className="mt-3 rounded-xl border border-primary bg-primary/10 p-3 text-ink">
            You are number <span className="font-bold">{mine.rank}</span> with{' '}
            <span className="font-bold">{mine.points}</span> points.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="teams">
        <h2 id="teams" className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          Departments
        </h2>
        {board.departments.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
            No departments to show yet.
          </p>
        ) : (
          <ol className="stagger space-y-2">
            {board.departments.map((row) => {
              const best = board.departments[0]?.average || 1;
              return (
                <li key={row.department} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-ink">
                      {row.rank}. {row.department}
                    </span>
                    <span className="text-sm text-ink-soft">
                      <span className="font-bold tabular-nums text-ink">{row.average}</span> per
                      person
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((row.average / best) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-sm text-ink-soft">
          Averaged over everyone on the department&apos;s list, so a big team does not win by size.
          Departments of fewer than {MIN_DEPARTMENT_SIZE} people and the secretariat are not ranked.
        </p>
      </section>
    </div>
  );
}
