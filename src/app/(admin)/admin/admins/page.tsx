import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { PreviewBanner } from '@/modules/previews/components/PreviewBanner';
import { mockActivity, mockOperators } from '@/modules/previews/mock-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admins' };

function ago(minutes: number): string {
  if (minutes === 0) return 'now';
  return `${minutes} min ago`;
}

export default async function AdminsPage() {
  const session = await requireAdmin('/admin/admins');
  const operators = mockOperators(session.operator);
  const activity = mockActivity(session.operator);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Admins</h1>
        <p className="mt-1 text-ink-soft">
          Up to three desks can work at once, each signed in with the PIN and its own label.
        </p>
      </header>

      <PreviewBanner module="Module 6, who else is signed in">
        Signing in several desks at once already works. What is invented here is the list of who
        else is signed in and what they did, which needs a small activity log in the database.
      </PreviewBanner>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Signed in</h2>
        <ul className="mt-2 divide-y divide-line">
          {operators.map((op) => (
            <li key={op.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full ${op.lastSeenMinutes <= 1 ? 'bg-success' : 'bg-warning'}`}
              />
              <span className="font-mono font-semibold text-ink">{op.label}</span>
              {op.isYou ? (
                <span className="rounded bg-muted px-1.5 text-xs font-semibold text-ink">You</span>
              ) : null}
              <span className="text-sm text-ink-soft">{op.device}</span>
              <span className="ml-auto text-sm text-ink-soft">
                {op.page}, {ago(op.lastSeenMinutes)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Recent changes</h2>
        <ul className="mt-2 space-y-2">
          {activity.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 tabular-nums text-ink-soft">
                {ago(item.minutesAgo)}
              </span>
              <span className="w-16 shrink-0 font-mono font-semibold text-ink">
                {item.operator}
              </span>
              <span className="text-ink">{item.action}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-muted p-3 text-sm">
        <p className="font-semibold text-ink">How to add a desk</p>
        <p className="mt-1 text-ink-soft">
          On the new phone or laptop, open /admin, enter the PIN and a label such as desk-2. Labels
          only, never a person&apos;s name, so the log holds no personal data.
        </p>
      </section>
    </div>
  );
}
