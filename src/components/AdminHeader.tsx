import Link from 'next/link';

import { AdminNav } from './AdminNav';

/** Top of every secretariat page. Shows which desk is signed in. */
export function AdminHeader({
  shortName,
  operator,
  mark = null,
}: {
  shortName: string;
  operator: string | null;
  mark?: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-2 pt-3">
        <Link href="/admin" className="no-underline">
          <span className="flex items-center gap-2 text-base font-bold leading-tight text-ink">
            {mark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mark} alt="" className="h-6 w-auto shrink-0" />
            ) : (
              <span aria-hidden="true" className="h-4 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
            {shortName} secretariat
          </span>
        </Link>

        {operator ? (
          <form method="post" action="/api/admin/sign-out" className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">
              Signed in as <span className="font-mono font-semibold">{operator}</span>
            </span>
            <button type="submit" className="text-xs font-semibold text-primary underline">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/" className="text-xs font-semibold text-primary">
            Back to the portal
          </Link>
        )}
      </div>

      {operator ? <AdminNav /> : null}
    </header>
  );
}
