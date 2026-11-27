import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { FormPending } from '@/components/FormPending';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { shortDepartment } from '@/lib/departments';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { safeNext } from '@/modules/identity/logic';
import { joinAsPerson } from '@/modules/points/actions';
import { findByName } from '@/modules/points/logic';
import { currentPlayer } from '@/modules/points/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Welcome' };

type Params = { find?: string; who?: string; state?: string; wrong?: string; next?: string };

const field =
  'mt-1 block min-h-12 w-full rounded-lg border border-line bg-background px-4 text-lg text-ink focus:border-primary';
const primary =
  'btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 font-bold text-on-primary no-underline';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => !/^(bin|binti|bt|b|a\/l|a\/p)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * The first page on a new phone or laptop: type your name, pick it, and
 * confirm it is you. From then on everything this device does (points,
 * photos, feedback, the door gift) is linked to that person.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Params> }) {
  const config = getEventConfig();
  const params = await searchParams;
  const next = safeNext(params.next);
  if (!config.features.leaderboard) redirect(next);

  const me = await currentPlayer();
  const keep = `next=${encodeURIComponent(next)}`;
  const data = getData();

  if (me) {
    return (
      <section className="rise rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{me.name}</h1>
        <p className="mt-1 text-ink-soft">This device is yours. Everything counts for you.</p>
        <Link href={next} className={`${primary} mt-5`}>
          Continue <span aria-hidden="true">→</span>
        </Link>
        <p className="mt-4 text-sm text-ink-soft">
          Not you? <Link href="/me">Sign out on My points</Link>
        </p>
      </section>
    );
  }

  const who = params.who ? await data.attendees.get(params.who.slice(0, 64)) : null;
  const typed = (params.find ?? '').slice(0, 60);
  const searching = !who && typed.trim().length >= 3;
  let tooMany = false;
  if (searching) {
    const device = readDeviceId((await cookies()).get(DEVICE_COOKIE)?.value) ?? 'none';
    const address = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    tooMany =
      !rateLimit(`find:${device}`, LIMITS.nameFind).allowed ||
      !rateLimit(`find-ip:${address}`, LIMITS.nameFindAddress).allowed;
  }
  const choices = searching && !tooMany ? findByName(await data.attendees.list(), typed) : [];

  return (
    <div className="space-y-5">
      <header className="text-center">
        <p className="eyebrow">{config.event.shortName}</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Welcome! Who are you?</h1>
        <p className="mt-2 text-ink-soft">
          Type your name once on this device. After that everything you do is yours.
        </p>
      </header>

      {params.state === 'too-many' ? (
        <p role="alert" className="rounded-lg border border-warning bg-warning/10 p-3 text-ink">
          Too many tries. Wait a few minutes, or ask the registration desk.
        </p>
      ) : null}

      {who ? (
        // Step 2: are you sure this is you?
        <section className="rise rounded-2xl border-2 border-primary bg-surface p-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-2xl font-bold text-on-primary"
          >
            {initials(who.name)}
          </span>
          <h2 className="mt-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Are you
          </h2>
          <p className="text-2xl font-bold text-ink">{who.name}?</p>
          <p className="mt-1 text-ink-soft">
            {[who.title, shortDepartment(config, who.department)].filter(Boolean).join(', ')}
          </p>

          <form action={joinAsPerson} className="mt-5 space-y-3 text-left">
            <FormPending label="Signing you in" />
            <input type="hidden" name="attendeeId" value={who.id} />
            <input type="hidden" name="from" value="welcome" />
            <input type="hidden" name="next" value={next} />
            {params.state === 'taken' ? (
              <div className="space-y-2">
                <p className="font-semibold text-ink">
                  {who.name} is already signed in on another device.
                </p>
                <p className="text-ink-soft">
                  If that is you (a second device, or you cleared your browser), type your staff
                  number to use this one too.
                </p>
                {params.wrong ? (
                  <p role="alert" className="font-semibold text-warning">
                    That staff number is not theirs. Try again, or ask the registration desk.
                  </p>
                ) : null}
                <label className="block text-sm font-semibold text-ink">
                  Your staff number
                  <input name="staffNo" required autoComplete="off" className={field} />
                </label>
              </div>
            ) : null}
            <button type="submit" className={primary}>
              Yes, that is me
            </button>
          </form>
          <Link
            href={`/welcome?${keep}`}
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-ink-soft"
          >
            No, that is not me
          </Link>
        </section>
      ) : (
        // Step 1: type a name and pick it.
        <section className="rise rounded-2xl border border-line bg-surface p-5">
          <form method="get" action="/welcome" data-loader="Finding you" className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="welcome-name" className="block text-sm font-semibold text-ink">
              Type your name
            </label>
            <input
              id="welcome-name"
              name="find"
              defaultValue={typed}
              autoComplete="off"
              autoFocus
              minLength={3}
              placeholder="e.g. Aisyah Rahman"
              className={field}
            />
            <button type="submit" className={primary}>
              Find me
            </button>
          </form>

          {typed.trim().length > 0 && typed.trim().length < 3 ? (
            <p className="mt-4 text-ink-soft">Type at least three letters of your name.</p>
          ) : null}
          {searching ? (
            tooMany ? (
              <p role="alert" className="mt-4 font-semibold text-ink">
                Too many searches from this device. Wait a few minutes, or ask the registration
                desk.
              </p>
            ) : choices.length === 0 ? (
              <p
                role="status"
                className="mt-4 rounded-lg border border-warning bg-warning/10 p-3 font-semibold text-ink"
              >
                Nobody on the list has that name. Try the start of your first or last name.
              </p>
            ) : (
              <ul className="mt-4 space-y-2" aria-label="Names that match">
                {choices.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/welcome?who=${encodeURIComponent(person.id)}&${keep}`}
                      className="pick-me group no-underline"
                      aria-label={`That is me: ${person.name}`}
                    >
                      <span aria-hidden="true" className="pick-me-initials">
                        {initials(person.name)}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-bold text-ink">{person.name}</span>
                        <span className="block text-sm text-ink-soft">
                          {[person.title, shortDepartment(config, person.department)]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                      <span className="pick-me-cta">
                        That is me <span aria-hidden="true">→</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      )}

      <p className="text-center text-sm text-ink-soft">
        Cannot find your name? Ask at the registration desk: they will add you to the list, then you
        can try again.
      </p>
    </div>
  );
}
