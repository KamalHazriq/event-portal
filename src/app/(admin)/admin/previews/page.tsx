import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-guard';
import { PREVIEW_PAGES } from '@/modules/previews/pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Previews' };

/** Every admin page that is still a preview, in one place. */
export default async function PreviewsPage() {
  await requireAdmin('/admin/previews');

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Previews</h1>
        <p className="mt-1 text-ink-soft">
          These pages run on dummy data so you can see the whole console before the modules behind
          them are built. Nothing on them is saved. Try them, and say what you would change.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {PREVIEW_PAGES.map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="block h-full rounded-xl border border-dashed border-line bg-surface p-4 no-underline hover:border-primary"
            >
              <span className="block font-bold text-ink">{page.title}</span>
              <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-warning">
                {page.module}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{page.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
