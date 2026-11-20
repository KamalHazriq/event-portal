import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-guard';
import { KIOSK_COOKIE } from '@/lib/kiosk';
import { getAdminPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Secretariat sign in' };

const ERRORS: Record<string, string> = {
  'wrong-pin': 'That PIN is not right. Try again.',
  'too-many': 'Too many tries. Wait ten minutes, or restart the portal.',
  'no-pin': 'No PIN is set up. Add ADMIN_PIN to .env.local and restart the portal.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = first(params.next) ?? '/admin';
  const error = first(params.error);

  // A kiosk tablet must type the PIN to leave the kiosk, even though it is
  // signed in, so the form shows instead of skipping ahead.
  const kioskLocked = (await cookies()).has(KIOSK_COOKIE);

  // Already signed in, so go where they were heading.
  if (!kioskLocked && (await getAdminSession())) {
    redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/admin');
  }

  const pinConfigured = getAdminPin() !== null;

  return (
    <div className="mx-auto max-w-sm space-y-5 py-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Secretariat sign in</h1>
        {kioskLocked ? (
          <p className="mt-1 font-semibold text-ink">
            This device is locked to the self check in kiosk. Sign in with the PIN to unlock it.
          </p>
        ) : null}
        {first(params.out) === 'all' ? (
          <p role="status" className="mt-1 font-semibold text-ink">
            Every desk was signed out. Enter the PIN to sign in again.
          </p>
        ) : null}
        <p className="mt-1 text-ink-soft">
          For the registration desk and the admin screens. Attendees do not need this.
        </p>
      </header>

      {error && ERRORS[error] ? (
        <p
          role="alert"
          className="rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink"
        >
          {ERRORS[error]}
        </p>
      ) : null}

      {!pinConfigured ? (
        <p className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-ink">
          No PIN is set up yet. Add <span className="font-mono">ADMIN_PIN</span> to your
          <span className="font-mono"> .env.local</span> file and restart the portal.
        </p>
      ) : null}

      <form
        method="post"
        action="/api/admin/sign-in"
        data-loader="Signing in"
        className="space-y-4"
      >
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="operator" className="block font-semibold text-ink">
            Which desk is this?
          </label>
          <p id="operator-hint" className="text-sm text-ink-soft">
            A label like desk-1. It goes in the records so you can see which desk checked someone
            in. Do not use a person&apos;s name.
          </p>
          <input
            id="operator"
            name="operator"
            type="text"
            defaultValue="desk-1"
            maxLength={24}
            autoComplete="off"
            aria-describedby="operator-hint"
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label htmlFor="pin" className="block font-semibold text-ink">
            Admin PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={40}
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-lg text-ink"
          />
        </div>

        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-lg font-bold text-on-primary"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-ink-soft">
        You stay signed in on this device for about fourteen hours, which covers one event day.
      </p>
    </div>
  );
}
