import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { currentPlayer, loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Leaderboard' };

export default async function LeaderboardPage() {
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const [board, me] = await Promise.all([loadScoreboard(), currentPlayer()]);
  // Everyone with points, in order. Ties share a rank.
  const top = board.people;
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
          Everyone, by points
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
                  <span className="block truncate font-bold text-ink">
                    {row.name}
                    {board.people.filter((r) => r.rank === row.rank).length > 1 ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-xs font-semibold text-ink-soft">
                        tied
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {shortDepartment(config, row.department)}
                  </span>
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
    </div>
  );
}
