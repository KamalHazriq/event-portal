import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ADMIN_GROUPS, findGroup, hiddenAdminPages } from '@/components/admin-pages';
import { getEventConfig } from '@/lib/config';
import { Icon } from '@/components/icons';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ group: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = findGroup((await params).group);
  return { title: group?.name ?? 'Secretariat' };
}

const INTRO: Record<string, string> = {
  'on-the-day': 'What you use while the event is running.',
  'engage-the-room': 'Messages, photos, comments and the lucky draw.',
  'set-up': 'Get the content, people, printing and testing ready before the day.',
  more: 'Tools for after a session, or when something goes wrong.',
};

/**
 * One page per menu group, listing everything in it with a line about what it
 * is for. The group addresses are /admin/on-the-day, /admin/engage-the-room,
 * /admin/set-up and /admin/more. Pages with their own address win over this.
 */
export default async function AdminGroupPage({ params }: Props) {
  const { group: slug } = await params;
  const group = findGroup(slug);
  if (!group) notFound();
  await requireAdmin(`/admin/${group.slug}`);

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-ink">{group.name}</h1>
        <p className="mt-2 text-lg text-ink-soft">{INTRO[group.slug] ?? ''}</p>
      </header>
      <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.pages
          .filter((page) => !hiddenAdminPages(getEventConfig().features).includes(page.href))
          .map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="card-hover group flex h-full gap-4 rounded-xl border border-line bg-surface p-4 no-underline"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <Icon name={page.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{page.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{page.description}</span>
                </span>
              </Link>
            </li>
          ))}
      </ul>
      <p className="text-sm text-ink-soft">
        Other sections:{' '}
        {ADMIN_GROUPS.filter((g) => g.slug !== group.slug).map((g, i) => (
          <span key={g.slug}>
            {i > 0 ? ', ' : ''}
            <Link href={`/admin/${g.slug}`}>{g.name}</Link>
          </span>
        ))}
        .
      </p>
    </div>
  );
}
