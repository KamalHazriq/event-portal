import type { Metadata } from 'next';
import Link from 'next/link';

import { getEventConfig } from '@/lib/config';
import { PASS_PARAM } from '@/lib/event-pass';
import { logoFor, resolveTheme } from '@/lib/theme';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Participants only' };

/**
 * The event pass gate. The proxy shows this, at the address the person asked
 * for, to anyone without the pass. See src/lib/event-pass.ts.
 *
 * The form submits to the same address with ?pass=..., so the proxy checks
 * the code and, if it is right, carries on to the page they wanted.
 */
export default async function PassPage({
  searchParams,
}: {
  searchParams: Promise<{ wrong?: string }>;
}) {
  const { wrong } = await searchParams;
  const config = getEventConfig();
  const logo = logoFor(config.branding, resolveTheme(config.branding, 'portal'));

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="rise w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={config.event.shortName} className="h-12 w-auto" />

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
          For {config.event.shortName} participants
        </h1>
        <p className="mt-2 text-ink-soft">
          Scan the event QR code on the screen, a poster or your table to come in. Or type the event
          code below.
        </p>

        <form method="get" className="mt-6 space-y-3">
          <label htmlFor="event-code" className="block text-sm font-semibold text-ink">
            Event code
          </label>
          <input
            id="event-code"
            name={PASS_PARAM}
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={wrong ? true : undefined}
            aria-describedby={wrong ? 'event-code-error' : undefined}
            className="block min-h-12 w-full rounded-lg border border-line bg-background px-4 font-mono text-lg tracking-widest text-ink focus:border-primary focus:outline-none"
          />
          {wrong ? (
            <p id="event-code-error" role="alert" className="text-sm font-semibold text-warning">
              That code is not right. Check it with the secretariat.
            </p>
          ) : null}
          <button
            type="submit"
            className="btn-primary min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary"
          >
            Come in
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-soft">
          Already in?{' '}
          <Link href="/" className="font-semibold text-primary">
            Go to the agenda
          </Link>
        </p>
      </div>
    </main>
  );
}
