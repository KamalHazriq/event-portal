import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { joinLeaderboard, leaveLeaderboard } from '@/modules/points/actions';
import { CAPS, POINT_LABELS, POINTS, type PointKind } from '@/modules/points/logic';
import { currentPlayer, loadScoreboard } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My points' };

const MESSAGES: Record<string, { text: string; good: boolean }> = {
  joined: { text: 'You are in. Everything this phone does now counts for you.', good: true },
  left: { text: 'Signed out. This phone no longer collects points for anyone.', good: true },
  'no-match': {
    text: 'That staff number and name do not go together. Check both, or ask the secretariat.',
    good: false,
  },
  missing: { text: 'Fill in both boxes.', good: false },
  'too-many': { text: 'Too many tries. Wait a few minutes, or ask the secretariat.', good: false },
};

/** Which activities count, in the order people will meet them. */
const EARN_ORDER: PointKind[] = [
  'joined',
  'checkIn',
  'onTime',
  'feedback',
  'poll',
  'photo',
  'question',
];

export default async function MyPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const { state } = await searchParams;
  const message = state ? MESSAGES[state] : undefined;
  const me = await currentPlayer();
  const board = me ? await loadScoreboard() : null;
  const score = me ? board?.scores.get(me.id) : undefined;
  const row = me ? board?.people.find((p) => p.attendeeId === me.id) : undefined;

  // Only what is switched on is worth offering.
  const offered = EARN_ORDER.filter(
    (kind) =>
      (kind !== 'feedback' || config.features.feedback) &&
      (kind !== 'poll' || config.features.polls) &&
      (kind !== 'photo' || config.features.photoWall) &&
      (kind !== 'question' || config.features.qa),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Leaderboard</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">My points</h1>
      </header>

      {message ? (
        <p
          role={message.good ? 'status' : 'alert'}
          className={`rounded-lg border p-3 font-semibold ${
            message.good
              ? 'border-success bg-success/10 text-ink'
              : 'border-warning bg-warning/10 text-ink'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {me ? (
        <section className="rise overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">Signed in as</p>
              <p className="text-xl font-bold text-ink">{me.name}</p>
              <p className="text-sm text-ink-soft">{me.department}</p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-bold tabular-nums leading-none text-gradient">
                {score?.total ?? 0}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-soft">
                points
                {me.isSecretariat
                  ? ', secretariat are not ranked'
                  : row
                    ? `, number ${row.rank} of ${board?.people.length ?? 0}`
                    : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line bg-muted p-3">
            <Link
              href="/leaderboard"
              className="btn-primary inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-on-primary no-underline"
            >
              See the leaderboard
            </Link>
            <form action={leaveLeaderboard}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
              >
                Not you? Sign out
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="rise rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-bold text-ink">Join the leaderboard</h2>
          <p className="mt-1 text-ink-soft">
            Once, on your own phone. Then taking part earns points for you and your department.
          </p>
          <form action={joinLeaderboard} className="mt-4 space-y-3">
            <div>
              <label htmlFor="staff-no" className="block text-sm font-semibold text-ink">
                Staff number
              </label>
              <input
                id="staff-no"
                name="staffNo"
                required
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 block min-h-12 w-full rounded-lg border border-line bg-background px-4 text-lg text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="your-name" className="block text-sm font-semibold text-ink">
                Your first name
              </label>
              <input
                id="your-name"
                name="name"
                required
                autoComplete="given-name"
                className="mt-1 block min-h-12 w-full rounded-lg border border-line bg-background px-4 text-lg text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="btn-primary min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary"
            >
              Join
            </button>
          </form>
        </section>
      )}

      <section aria-labelledby="earn">
        <h2 id="earn" className="text-lg font-bold text-ink">
          How to earn points
        </h2>
        <ul className="stagger mt-3 grid gap-2 sm:grid-cols-2">
          {offered.map((kind) => {
            const done = score?.counts[kind] ?? 0;
            const cap = CAPS[kind];
            return (
              <li
                key={kind}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{POINT_LABELS[kind]}</span>
                  <span className="block text-sm text-ink-soft">
                    {me ? `Done ${done}${cap ? ` of ${cap}` : ''}` : cap ? `Up to ${cap}` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 font-bold tabular-nums text-primary">
                  +{POINTS[kind]}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-ink-soft">
          Your feedback answers stay as they were: points only count that you sent a form, never
          what you wrote.
        </p>
      </section>
    </div>
  );
}
