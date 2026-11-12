import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import type { CommentStatus } from '@/data/types';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { localClock } from '@/modules/reports/logic';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';
import {
  approveAllComments,
  moderateComment,
  setScreenReactions,
  showCommentsOnScreen,
} from '@/modules/talk/actions';
import { COMMENT_KEYS, COMMENT_STATUS_LABEL, rankComments, REACTIONS } from '@/modules/talk/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Comments' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

const TABS: (CommentStatus | 'all')[] = ['pending', 'approved', 'hidden', 'all'];

export default async function CommentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/comments');
  const config = getEventConfig();
  if (!config.features.comments && !config.features.reactions) notFound();

  const params = await searchParams;
  const agenda = buildAgenda(config);
  const sessions = agenda.sessions;

  // The asked for talk, else the one running now, else the first.
  const live = findNowAndNext(agenda, resolveEventNow({ timezone: config.event.timezone })).live;
  const session =
    sessions.find((s) => s.id === one(params.session)) ??
    sessions.find((s) => live.some((l) => l.id === s.id)) ??
    sessions[0];

  const rawTab = one(params.status);
  const tab = (TABS as string[]).includes(rawTab ?? '')
    ? (rawTab as CommentStatus | 'all')
    : 'pending';

  const data = getData();
  const [all, totals, screenReactions] = await Promise.all([
    session && config.features.comments
      ? data.comments.listBySession(session.id)
      : Promise.resolve([]),
    session && config.features.reactions ? data.reactions.totals(session.id) : null,
    data.settings.get(COMMENT_KEYS.screenReactions),
  ]);
  const reactionsOnScreen = screenReactions !== 'off';
  const counts = { pending: 0, approved: 0, hidden: 0 };
  for (const c of all) counts[c.status] += 1;
  const shown = rankComments(all.filter((c) => tab === 'all' || c.status === tab));
  const link = (status: string) => `/admin/comments?session=${session?.id ?? ''}&status=${status}`;

  const act = (id: string, name: string, label: string, primary = false) => (
    <form action={moderateComment}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={name} />
      <button
        type="submit"
        className={
          primary
            ? 'min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary'
            : 'min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink'
        }
      >
        {label}
      </button>
    </form>
  );

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={5_000} />

      <div>
        <h1 className="text-2xl font-bold text-ink">Comments and reactions</h1>
        <p className="mt-1 text-ink-soft">
          Comments on each talk wait here for approval before anyone sees them. Reactions need no
          approval.
        </p>
      </div>

      {!session ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          The agenda has no sessions.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-surface p-4">
            <form method="get" action="/admin/comments" className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
                Talk
                <select
                  name="session"
                  defaultValue={session.id}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.dayLabel}: {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
              >
                Show
              </button>
            </form>

            {totals ? (
              <p className="mt-3 flex flex-wrap gap-3 text-ink" aria-label="Reactions so far">
                {REACTIONS.map((r) => (
                  <span key={r.kind} className="rounded-full bg-muted px-3 py-1 font-semibold">
                    <span aria-hidden="true">{r.emoji}</span>{' '}
                    <span className="tabular-nums">{totals[r.kind]}</span>
                    <span className="sr-only"> {r.label}</span>
                  </span>
                ))}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {config.features.comments ? (
                <form action={showCommentsOnScreen}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary"
                  >
                    Show comments on the big screen
                  </button>
                </form>
              ) : null}
              {config.features.reactions ? (
                <form action={setScreenReactions}>
                  <input type="hidden" name="mode" value={reactionsOnScreen ? 'off' : 'on'} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                  >
                    {reactionsOnScreen
                      ? 'Reactions on the big screen: on'
                      : 'Reactions on the big screen: off'}
                  </button>
                </form>
              ) : null}
              {counts.pending > 0 ? (
                <form action={approveAllComments}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                  >
                    Approve all {counts.pending} waiting
                  </button>
                </form>
              ) : null}
            </div>
          </section>

          {config.features.comments ? (
            <>
              <nav aria-label="Filter comments" className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <Link
                    key={t}
                    href={link(t)}
                    aria-current={t === tab ? 'page' : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-semibold no-underline ${
                      t === tab ? 'bg-primary text-on-primary' : 'border border-line text-ink'
                    }`}
                  >
                    {t === 'all'
                      ? `All (${all.length})`
                      : `${COMMENT_STATUS_LABEL[t]} (${counts[t]})`}
                  </Link>
                ))}
              </nav>

              {shown.length === 0 ? (
                <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
                  Nothing here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {shown.map((c) => (
                    <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
                      <p className="text-ink">{c.text}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {c.name || 'Anonymous'} · {localClock(c.createdAt, config.event.timezone)} ·{' '}
                        {c.likes} likes · {COMMENT_STATUS_LABEL[c.status]}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.status !== 'approved' ? act(c.id, 'approve', 'Approve', true) : null}
                        {c.status !== 'hidden' ? act(c.id, 'hide', 'Hide') : null}
                        {act(c.id, 'delete', 'Delete')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
