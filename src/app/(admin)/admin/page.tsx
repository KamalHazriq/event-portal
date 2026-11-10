import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatShortDate, resolveEventNow } from '@/lib/time';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { PREVIEW_PAGES } from '@/modules/previews/pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Secretariat' };

const PAGES = [
  {
    href: '/admin/live',
    title: 'Live control',
    description: 'What is on now, what is next, the room count and the countdown.',
  },
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
    href: '/admin/feedback',
    title: 'Feedback',
    description: 'What people thought of each session, and the settings for names.',
  },
  {
    href: '/admin/big-screen',
    title: 'Big screen',
    description: 'Choose what the ballroom projector shows.',
  },
  {
    href: '/admin/reports',
    title: 'Reports',
    description: 'The whole event in Excel, a summary to save as PDF, and the Slido import.',
  },
  {
    href: '/admin/lucky-draw',
    title: 'Lucky draw',
    description: 'Draw winners from whoever has checked in. Nobody wins twice.',
  },
  {
    href: '/admin/photos',
    title: 'Photo wall',
    description: 'Approve photos before they reach the big screen slideshow.',
  },
  {
    href: '/admin/committees',
    title: 'Committee summary',
    description: 'Upload a committee Excel and choose who can see its summary.',
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

      <section aria-labelledby="previews-heading">
        <h2 id="previews-heading" className="text-lg font-bold text-ink">
          Previews with dummy data
        </h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Pages for modules not built yet, so you can try the whole console. Nothing on them is
          saved.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {PREVIEW_PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="block h-full rounded-xl border border-dashed border-line bg-surface p-4 no-underline hover:border-primary focus-visible:border-primary"
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
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="eyebrow">New to this?</p>
        <p className="mt-1 text-ink">
          A one page tour of the whole portal, written for showing the team.
        </p>
        <Link href="/guide" className="mt-2 inline-block font-bold text-primary">
          How the portal works
        </Link>
      </section>

      <section className="rounded-lg border border-line bg-muted p-3 text-sm">
        <p className="font-semibold text-ink">Storage</p>
        <p className={health.ok ? 'text-ink-soft' : 'font-semibold text-warning'}>
          {health.detail}
        </p>
      </section>
    </div>
  );
}
