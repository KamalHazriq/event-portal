import type { Metadata } from 'next';
import Link from 'next/link';

import { ADMIN_GROUPS } from '@/components/admin-pages';
import { AutoRefresh } from '@/components/AutoRefresh';
import { Icon, type IconName } from '@/components/icons';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { formatClock, formatShortDate, resolveEventNow } from '@/lib/time';
import { readBackupMode } from '@/modules/backup/server';
import { arrivalRate, resolveCheckInDay } from '@/modules/check-in/logic';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Secretariat' };

function greeting(minutes: number): string {
  if (minutes < 12 * 60) return 'Good morning';
  if (minutes < 18 * 60) return 'Good afternoon';
  return 'Good evening';
}

type Stat = {
  label: string;
  value: string;
  of?: string;
  note: string;
  href: string;
  icon: IconName;
  /** 0 to 100 for a progress ring, when the number has a total. */
  percent?: number;
  alert?: boolean;
};

/** A number in the stat row, with an optional ring showing how far along it is. */
function StatTile({ stat }: { stat: Stat }) {
  return (
    <Link
      href={stat.href}
      className="card-hover group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface p-4 no-underline sm:min-h-36 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
          {stat.label}
        </p>
        <span
          className={[
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            stat.alert ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary',
          ].join(' ')}
        >
          <Icon name={stat.icon} className="size-[1.1rem]" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold leading-none tabular-nums tracking-tight text-ink sm:text-4xl">
            {stat.value}
            {stat.of ? (
              <span className="text-xl font-semibold text-ink-soft"> / {stat.of}</span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-ink-soft sm:text-sm">{stat.note}</p>
        </div>
        {stat.percent !== undefined ? (
          <svg
            viewBox="0 0 36 36"
            className="hidden size-14 shrink-0 -rotate-90 sm:block"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="3.5"
              className="stroke-muted"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              className="ring-draw stroke-primary"
              pathLength={100}
              strokeDasharray={`${stat.percent} 100`}
            />
          </svg>
        ) : null}
      </div>
    </Link>
  );
}

export default async function AdminHomePage() {
  const session = await requireAdmin('/admin');

  const config = getEventConfig();
  const now = resolveEventNow({ timezone: config.event.timezone });
  const day = resolveCheckInDay(config.days, now);
  const live = findNowAndNext(buildAgenda(config), now);

  const data = getData();
  const qaSessions = config.days.flatMap((d) => d.sessions).filter((s) => s.qaEnabled);
  const [health, headcount, summaries, waitingPhotos, backupOn, questionLists] = await Promise.all([
    data.healthCheck(),
    day ? data.checkIns.headcount(day.id) : Promise.resolve(null),
    data.feedback.summaries(),
    config.features.photoWall ? data.photos.list('pending') : Promise.resolve([]),
    config.features.qa ? readBackupMode() : Promise.resolve(false),
    config.features.qa
      ? Promise.all(qaSessions.map((s) => data.questions.listBySession(s.id)))
      : Promise.resolve([]),
  ]);

  const rate = headcount ? arrivalRate(headcount.arrived, headcount.expected) : null;
  const answers = summaries.reduce((sum, s) => sum + s.responses, 0);
  const rated = summaries.filter((s) => s.averageRating !== null);
  const average =
    rated.length > 0
      ? rated.reduce((sum, s) => sum + (s.averageRating ?? 0) * s.responses, 0) /
        Math.max(
          1,
          rated.reduce((sum, s) => sum + s.responses, 0),
        )
      : null;
  const waitingQuestions = questionLists.flat().filter((q) => q.status === 'pending').length;

  const stats: Stat[] = [
    {
      label: day ? `Arrived, ${day.label}` : 'Arrived',
      value: String(rate?.arrived ?? 0),
      of: String(rate?.expected ?? 0),
      note: rate ? `${rate.remaining} still to arrive` : 'Nobody expected yet',
      href: '/admin/headcount',
      icon: 'users',
      percent: rate?.percent ?? 0,
    },
    {
      label: 'Feedback',
      value: String(answers),
      note: average === null ? 'No ratings yet' : `Average ${average.toFixed(1)} out of 5`,
      href: '/admin/feedback',
      icon: 'star',
    },
    {
      label: 'Photos waiting',
      value: String(waitingPhotos.length),
      note: waitingPhotos.length > 0 ? 'Need a look before the slideshow' : 'All caught up',
      href: '/admin/photos',
      icon: 'image',
      alert: waitingPhotos.length > 0,
    },
    backupOn
      ? {
          label: 'Questions waiting',
          value: String(waitingQuestions),
          note: 'Backup Q&A is on',
          href: '/admin/qa',
          icon: 'message',
          alert: waitingQuestions > 0,
        }
      : {
          label: 'Q&A and polls',
          value: 'Slido',
          note: 'The portal backup is ready if needed',
          href: '/admin/qa',
          icon: 'message',
        },
  ];

  const onNow = live.live[0];
  const clock = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-10">
      <AutoRefresh intervalMs={30_000} enabled={!now.isOverride} />

      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">
            {day
              ? `${day.label}, ${formatShortDate(day.date, config.event.timezone)}`
              : 'Secretariat'}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {greeting(now.minutes)}, <span className="text-gradient">{session.operator}</span>
          </h1>
          <p className="mt-3 text-ink-soft">
            {onNow ? (
              <>
                On now: <span className="font-semibold text-ink">{onNow.title}</span>
              </>
            ) : live.next ? (
              <>
                Next: <span className="font-semibold text-ink">{live.next.title}</span> at{' '}
                {formatClock(live.next.start)}
              </>
            ) : (
              'Nothing scheduled right now.'
            )}
          </p>
        </div>
        <Link
          href="/admin/live"
          className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-bold text-on-primary no-underline"
        >
          <Icon name="live" className="size-4" />
          Open live control
          <span className="font-mono text-sm font-semibold opacity-80">{clock}</span>
        </Link>
      </section>

      <section
        aria-label="At a glance"
        className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatTile key={stat.label} stat={stat} />
        ))}
      </section>

      {ADMIN_GROUPS.map((group) => (
        <section key={group.name} aria-labelledby={`g-${group.name}`}>
          <h2
            id={`g-${group.name}`}
            className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft"
          >
            {group.name}
          </h2>
          <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.pages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="card-hover group flex h-full gap-4 rounded-xl border border-line bg-surface p-4 no-underline"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                    <Icon name={page.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      {page.title}
                      <Icon
                        name="arrow"
                        className="size-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      />
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">{page.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Link
          href="/guide"
          className="card-hover group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 no-underline"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Icon name="book" />
          </span>
          <span>
            <span className="block font-bold text-ink">How the portal works</span>
            <span className="block text-sm text-ink-soft">
              A one page tour of the whole portal, written for showing the team.
            </span>
          </span>
        </Link>
        <div className="rounded-xl border border-line bg-muted p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${health.ok ? 'live-dot bg-success' : 'bg-warning'}`}
            />
            Storage
          </p>
          <p className={`mt-1 ${health.ok ? 'text-ink-soft' : 'font-semibold text-warning'}`}>
            {health.detail}
          </p>
        </div>
      </section>
    </div>
  );
}
