import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Secretariat' };

const PAGES = [
  {
    href: '/admin/desk',
    title: 'Registration desk',
    description: 'Scan name tags or search by name to check people in.',
  },
  {
    href: '/admin/headcount',
    title: 'Headcount',
    description: 'Who has arrived, by department, and who is still missing.',
  },
  {
    href: '/admin/name-tags',
    title: 'Name tags',
    description: 'Print the tags, with a personal QR on the front and the portal QR on the back.',
  },
  {
    href: '/admin/qr-assets',
    title: 'QR assets',
    description: 'Table tents to print and a portal QR to drop into a slide.',
  },
];

export default async function AdminHomePage() {
  await requireAdmin('/admin');

  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const day = resolveCheckInDay(config.days, now);

  const data = getData();
  const health = await data.healthCheck();
  const headcount = day ? await data.checkIns.headcount(day.id) : null;
  const rate = headcount ? arrivalRate(headcount.arrived, headcount.expected) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Secretariat</h1>
        {day ? (
          <p className="mt-1 text-ink-soft">
            Working on {day.label}, {formatShortDate(day.date, config.event.timezone)}
          </p>
        ) : null}
      </header>

      {rate ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Arrived</p>
          <p className="text-4xl font-bold tabular-nums text-ink">
            {rate.arrived}
            <span className="text-2xl font-normal text-ink-soft"> / {rate.expected}</span>
          </p>
          <p className="mt-1 text-ink-soft">{rate.remaining} still to arrive</p>
        </section>
      ) : null}

      <nav aria-label="Secretariat pages">
        <ul className="grid gap-3 sm:grid-cols-2">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="block h-full rounded-xl border border-line bg-surface p-4 no-underline hover:border-primary focus-visible:border-primary"
              >
                <span className="block font-bold text-ink">{page.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{page.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="rounded-lg border border-line bg-muted p-3 text-sm">
        <p className="font-semibold text-ink">Storage</p>
        <p className={health.ok ? 'text-ink-soft' : 'font-semibold text-warning'}>
          {health.detail}
        </p>
      </section>
    </div>
  );
}
