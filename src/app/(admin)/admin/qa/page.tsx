import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import type { QuestionStatus } from '@/data/types';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import {
  moderateQuestion,
  setPremoderation,
  showQuestionsOnScreen,
} from '@/modules/backup/actions';
import { BackupSwitch } from '@/modules/backup/BackupSwitch';
import { readBackupMode } from '@/modules/backup/server';
import {
  countByStatus,
  premoderationOn,
  QA_KEYS,
  QUESTION_STATUS_LABEL,
  rankQuestions,
} from '@/modules/qa/logic';
import { localClock } from '@/modules/reports/logic';
import { buildAgenda, findNowAndNext } from '@/modules/schedule/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Q&A queue' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null);

const TABS: (QuestionStatus | 'all')[] = ['pending', 'approved', 'answered', 'hidden', 'all'];

export default async function QaQueuePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/qa');
  const config = getEventConfig();
  if (!config.features.qa) notFound();

  const params = await searchParams;
  const agenda = buildAgenda(config);
  const qaSessions = agenda.sessions.filter((s) => s.qaEnabled);

  // The asked for session, else the one running now, else the first.
  const live = findNowAndNext(agenda, resolveEventNow({ timezone: config.event.timezone })).live;
  const session =
    qaSessions.find((s) => s.id === one(params.session)) ??
    qaSessions.find((s) => live.some((l) => l.id === s.id)) ??
    qaSessions[0];

  const rawTab = one(params.status);
  const tab = (TABS as string[]).includes(rawTab ?? '')
    ? (rawTab as QuestionStatus | 'all')
    : 'pending';

  const data = getData();
  const [backupOn, all, premod] = await Promise.all([
    readBackupMode(),
    session ? data.questions.listBySession(session.id) : Promise.resolve([]),
    session
      ? data.settings.get(QA_KEYS.premoderation(session.id)).then(premoderationOn)
      : Promise.resolve(true),
  ]);
  const counts = countByStatus(all);
  const shown = rankQuestions(all.filter((q) => tab === 'all' || q.status === tab));
  const link = (status: string) => `/admin/qa?session=${session?.id ?? ''}&status=${status}`;

  const act = (id: string, name: string, label: string, primary = false) => (
    <form action={moderateQuestion}>
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
        <h1 className="text-2xl font-bold text-ink">Q&A queue</h1>
        <p className="mt-1 text-ink-soft">
          The portal&apos;s own Q&A, for when Slido is unavailable. Questions stay hidden until
          someone approves them.
        </p>
      </div>

      <BackupSwitch on={backupOn} />

      {!session ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          No session has qaEnabled set in config/event.json.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-surface p-4">
            <form method="get" action="/admin/qa" className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
                Session
                <select
                  name="session"
                  defaultValue={session.id}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
                >
                  {qaSessions.map((s) => (
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

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={showQuestionsOnScreen}>
                <input type="hidden" name="sessionId" value={session.id} />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary"
                >
                  Show top questions on the big screen
                </button>
              </form>
              <form action={setPremoderation}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="mode" value={premod ? 'off' : 'on'} />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                >
                  {premod ? 'Approval first: on' : 'Approval first: off'}
                </button>
              </form>
              {backupOn ? (
                <Link
                  href={`/qa/${session.id}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-primary no-underline"
                >
                  What attendees see
                </Link>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {premod
                ? 'New questions wait here until approved.'
                : 'New questions for this session go straight on screen. Hide any that should not be there.'}
            </p>
          </section>

          <nav aria-label="Question status" className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <Link
                key={t}
                href={link(t)}
                aria-current={t === tab ? 'page' : undefined}
                className={[
                  'inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold no-underline',
                  t === tab
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line bg-surface text-ink',
                ].join(' ')}
              >
                {t === 'all' ? 'All' : QUESTION_STATUS_LABEL[t]} (
                {t === 'all' ? all.length : counts[t]})
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
              {tab === 'pending'
                ? 'Nothing waiting. New questions appear here by themselves.'
                : 'Nothing here.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {shown.map((q) => (
                <li
                  key={q.id}
                  className={[
                    'rounded-xl border bg-surface p-4',
                    q.pinned ? 'border-2 border-primary' : 'border-line',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-ink">{q.text}</p>
                    <span className="shrink-0 text-lg font-bold tabular-nums text-ink">
                      {q.votes}
                      <span className="sr-only"> votes</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {q.name || 'Anonymous'}, {localClock(q.createdAt, config.event.timezone)}.{' '}
                    {QUESTION_STATUS_LABEL[q.status]}
                    {q.pinned ? ', pinned' : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.status !== 'approved' ? act(q.id, 'approve', 'Approve', true) : null}
                    {q.status === 'approved'
                      ? act(q.id, q.pinned ? 'unpin' : 'pin', q.pinned ? 'Unpin' : 'Pin', !q.pinned)
                      : null}
                    {q.status !== 'answered' ? act(q.id, 'answered', 'Answered') : null}
                    {q.status !== 'hidden'
                      ? act(q.id, 'hide', 'Hide')
                      : act(q.id, 'delete', 'Delete')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
