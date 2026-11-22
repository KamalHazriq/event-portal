import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { getData } from '@/data';
import { joinAsPerson, joinLeaderboard, leaveLeaderboard } from '@/modules/points/actions';
import { cookies, headers } from 'next/headers';

import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { findByName } from '@/modules/points/logic';
import { CAPS, POINT_LABELS, POINTS, type PointKind } from '@/modules/points/logic';
import { currentPlayer, loadScoreboard } from '@/modules/points/server';
import { AlertsOptIn } from '@/modules/announce/components/AlertsOptIn';
import { InstallApp } from '@/components/InstallApp';
import { FormPending } from '@/components/FormPending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My points' };

const MESSAGES: Record<string, { text: string; good: boolean }> = {
  joined: { text: 'You are in. Everything this phone does now counts for you.', good: true },
  left: { text: 'Signed out. This phone no longer collects points for anyone.', good: true },
  'no-match': {
    text: 'That staff number and name do not go together. Check both, or ask the secretariat.',
    good: false,
  },
  'taken-wrong': {
    text: 'That staff number is not theirs. Try again, or ask the registration desk.',
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
  'reaction',
  'comment',
];

export default async function MyPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; find?: string; who?: string; wrong?: string }>;
}) {
  const config = getEventConfig();
  if (!config.features.leaderboard) notFound();

  const { state, find, who, wrong } = await searchParams;
  const message = wrong ? MESSAGES['taken-wrong'] : state ? MESSAGES[state] : undefined;
  const me = await currentPlayer();
  const board = me ? await loadScoreboard() : null;
  const score = me ? board?.scores.get(me.id) : undefined;
  const row = me ? board?.people.find((p) => p.attendeeId === me.id) : undefined;

  // Not signed in yet: the names that match what was typed, and, when someone
  // has already joined as the person picked, who it is.
  const typed = (find ?? '').slice(0, 60);
  const data = getData();
  const searching = !me && typed.trim().length >= 3;
  // Slowed down per phone and per address, so the names cannot be read out in bulk.
  let tooManyFinds = false;
  if (searching) {
    const device = readDeviceId((await cookies()).get(DEVICE_COOKIE)?.value) ?? 'none';
    const address = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    tooManyFinds =
      !rateLimit(`find:${device}`, LIMITS.nameFind).allowed ||
      !rateLimit(`find-ip:${address}`, LIMITS.nameFindAddress).allowed;
  }
  const choices = searching && !tooManyFinds ? findByName(await data.attendees.list(), typed) : [];
  const taken = !me && state === 'taken' && who ? await data.attendees.get(who.slice(0, 64)) : null;

  // Only what is switched on is worth offering.
  const offered = EARN_ORDER.filter(
    (kind) =>
      (kind !== 'feedback' || config.features.feedback) &&
      (kind !== 'poll' || config.features.polls) &&
      (kind !== 'photo' || config.features.photoWall) &&
      (kind !== 'question' || config.features.qa) &&
      (kind !== 'reaction' || config.features.reactions) &&
      (kind !== 'comment' || config.features.comments),
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
              <p className="text-sm text-ink-soft">{shortDepartment(config, me.department)}</p>
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
            {config.features.luckyDraw
              ? ' If you win the lucky draw, this phone tells you too.'
              : ''}
          </p>

          {taken ? (
            <form action={joinAsPerson} className="mt-4 space-y-3">
              <FormPending label="Signing you in" />
              <input type="hidden" name="attendeeId" value={taken.id} />
              <p className="font-semibold text-ink">
                {taken.name} is already signed in on another phone.
              </p>
              <p className="text-ink-soft">
                If that is you (a new phone, or you cleared your browser), type your staff number to
                use this phone too.
              </p>
              <div>
                <label htmlFor="proof-staff-no" className="block text-sm font-semibold text-ink">
                  Your staff number
                </label>
                <input
                  id="proof-staff-no"
                  name="staffNo"
                  required
                  autoComplete="off"
                  className="mt-1 block min-h-12 w-full rounded-lg border border-line bg-background px-4 text-lg text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="btn-primary min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary"
              >
                This is me
              </button>
              <Link href="/me">Not you? Find your own name</Link>
            </form>
          ) : (
            <>
              {/* A plain form that reloads the page with matches, so it needs no JavaScript. */}
              <form method="get" action="/me" data-loader="Finding you" className="mt-4 space-y-3">
                <div>
                  <label htmlFor="find-name" className="block text-sm font-semibold text-ink">
                    Type your name
                  </label>
                  <input
                    id="find-name"
                    name="find"
                    defaultValue={typed}
                    autoComplete="off"
                    placeholder="For example Aisyah"
                    minLength={3}
                    className="mt-1 block min-h-12 w-full rounded-lg border border-line bg-background px-4 text-lg text-ink focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary"
                >
                  Find me
                </button>
              </form>

              {typed.trim().length > 0 && typed.trim().length < 3 ? (
                <p className="mt-4 text-ink-soft">Type at least three letters of your name.</p>
              ) : null}
              {searching ? (
                tooManyFinds ? (
                  <p role="alert" className="mt-4 font-semibold text-ink">
                    Too many searches from this phone. Wait a few minutes, or ask the registration
                    desk.
                  </p>
                ) : choices.length === 0 ? (
                  <p className="mt-4 text-ink-soft">
                    Nobody on the list has that name. Type the start of your first or last name, or
                    ask the registration desk.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2" aria-label="Names that match">
                    {choices.map((person) => (
                      <li key={person.id}>
                        <form action={joinAsPerson}>
                          <FormPending label="Signing you in" />
                          <input type="hidden" name="attendeeId" value={person.id} />
                          <button
                            type="submit"
                            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-line bg-background px-4 py-2 text-left hover:border-primary"
                          >
                            <span className="min-w-0">
                              <span className="block font-bold text-ink">{person.name}</span>
                              <span className="block text-sm text-ink-soft">
                                {[person.title, shortDepartment(config, person.department)]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </span>
                            <span className="shrink-0 font-bold text-primary">That is me</span>
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
                  Or sign in with your staff number
                </summary>
                <form
                  action={joinLeaderboard}

                  className="mt-3 space-y-3"
                >
                  <FormPending label="Signing you in" />
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
              </details>
            </>
          )}
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

      <InstallApp />
      <AlertsOptIn />
    </div>
  );
}
