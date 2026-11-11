import Link from 'next/link';

import { AdminSidebarNav, AdminTabs } from './AdminNav';
import { Icon } from './icons';

type Props = { shortName: string; operator: string | null; mark?: string | null };

function Brand({ shortName, mark }: { shortName: string; mark: string | null }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 no-underline">
      {mark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt="" className="h-7 w-auto shrink-0" />
      ) : (
        <span aria-hidden="true" className="h-5 w-1.5 shrink-0 rounded-full bg-primary" />
      )}
      <span className="leading-tight">
        <span className="block text-base font-bold text-ink">{shortName}</span>
        <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Secretariat
        </span>
      </span>
    </Link>
  );
}

function SignOut({ operator }: { operator: string }) {
  return (
    <form method="post" action="/api/admin/sign-out" className="flex items-center gap-2">
      <span className="text-xs text-ink-soft">
        Signed in as <span className="font-mono font-semibold text-ink">{operator}</span>
      </span>
      <button
        type="submit"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <Icon name="logout" className="size-3.5" />
        Sign out
      </button>
    </form>
  );
}

/** Phones and tablets: a sticky header with the tab row. Hidden from laptop width. */
export function AdminHeader({ shortName, operator, mark = null }: Props) {
  return (
    <header
      className={[
        'sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl',
        operator ? 'lg:hidden' : '',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-3">
        <Brand shortName={shortName} mark={mark} />
        {operator ? (
          <SignOut operator={operator} />
        ) : (
          <Link href="/" className="text-xs font-semibold text-primary">
            Back to the portal
          </Link>
        )}
      </div>
      {operator ? <AdminTabs /> : null}
    </header>
  );
}

/** Laptops and up: a fixed sidebar with the brand, the pages and the desk. */
export function AdminSidebar({ shortName, operator, mark = null }: Props & { operator: string }) {
  return (
    <aside className="admin-sidebar sticky top-0 hidden h-dvh flex-col border-r border-line lg:flex print:hidden">
      <div className="px-6 pb-5 pt-6">
        <Brand shortName={shortName} mark={mark} />
      </div>
      <AdminSidebarNav />
      <div className="space-y-3 border-t border-line px-6 py-4">
        <Link
          href="/guide"
          className="flex items-center gap-2 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <Icon name="book" className="size-4" />
          How the portal works
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <Icon name="external" className="size-4" />
          Attendee view
        </Link>
        <SignOut operator={operator} />
      </div>
    </aside>
  );
}
