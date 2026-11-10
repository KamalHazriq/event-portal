import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { currentDeviceId, readBackupMode } from '@/modules/backup/server';
import {
  isPublic,
  MAX_QUESTION,
  MAX_QUESTION_NAME,
  MAX_QUESTIONS_PER_DEVICE,
  questionProblemMessage,
  rankQuestions,
  type QuestionProblem,
} from '@/modules/qa/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Questions' };

type Params = Promise<{ sessionId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PROBLEMS: readonly string[] = ['empty', 'too-long', 'too-many', 'closed'];

function notice(state: string | null): { ok: boolean; text: string } | null {
  if (!state) return null;
  if (state === 'waiting')
    return { ok: true, text: 'Thank you. Your question appears once a moderator has approved it.' };
  if (state === 'asked') return { ok: true, text: 'Thank you. Your question is in.' };
  if (state === 'voted') return { ok: true, text: 'Vote counted.' };
  if (state === 'already') return { ok: true, text: 'You have already voted for that one.' };
  if (state === 'slow-down')
    return { ok: false, text: 'That was a lot at once. Wait a minute and try again.' };
  if (state === 'gone') return { ok: false, text: 'That question is no longer on the list.' };
  if (PROBLEMS.includes(state))
    return { ok: false, text: questionProblemMessage(state as QuestionProblem) };
  return null;
}

/** Attendees ask and upvote questions for one session (Module 2). */
export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const config = getEventConfig();
  const session = config.days.flatMap((d) => d.sessions).find((s) => s.id === sessionId);

  if (!config.features.qa || !session?.qaEnabled || !(await readBackupMode())) notFound();

  const data = getData();
  const deviceId = await currentDeviceId();
  const [all, voted] = await Promise.all([
    data.questions.listBySession(session.id),
    deviceId ? data.questions.votedIds(session.id, deviceId) : Promise.resolve([]),
  ]);
  const shown = rankQuestions(all.filter(isPublic));
  const mine = deviceId ? all.filter((q) => q.deviceId === deviceId) : [];
  const waiting = mine.filter((q) => q.status === 'pending').length;
  const left = Math.max(0, MAX_QUESTIONS_PER_DEVICE - mine.length);
  const votedSet = new Set(voted);
  const message = notice(typeof query.state === 'string' ? query.state : null);

  return (
    <div className="space-y-5 py-2">
      <AutoRefresh intervalMs={5_000} />

      <div>
        <p className="eyebrow">Questions</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {session.title}
        </h1>
        <p className="mt-3 text-sm">
          <Link href={`/session/${session.id}`} className="font-semibold text-primary">
            Back to the session
          </Link>
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm font-semibold ${message.ok ? 'border-success text-success' : 'border-warning text-warning'}`}
        >
          {message.text}
        </p>
      ) : null}

      {left > 0 ? (
        <form
          method="post"
          action="/api/qa/ask"
          className="space-y-3 rounded-xl border border-line bg-surface p-4"
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <label className="block font-semibold text-ink">
            Your question
            <textarea
              name="text"
              required
              maxLength={MAX_QUESTION}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-line bg-canvas px-3 py-2 font-normal text-ink"
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Your name (optional, leave blank to stay anonymous)
            <input
              name="name"
              type="text"
              maxLength={MAX_QUESTION_NAME}
              autoComplete="name"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
            >
              Ask
            </button>
            <p className="text-sm text-ink-soft">
              Up to {MAX_QUESTION} characters. {left} of {MAX_QUESTIONS_PER_DEVICE} left for this
              session.
            </p>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink">
          {questionProblemMessage('too-many')}
        </p>
      )}

      {waiting > 0 ? (
        <p className="text-sm text-ink-soft">
          {waiting} of your questions {waiting === 1 ? 'is' : 'are'} waiting for a moderator.
        </p>
      ) : null}

      <section aria-labelledby="asked">
        <h2 id="asked" className="text-lg font-bold text-ink">
          Asked so far <span className="font-normal text-ink-soft">({shown.length})</span>
        </h2>
        <p className="text-sm text-ink-soft">Tap the arrow to vote a question up.</p>

        {shown.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-surface p-4 text-ink-soft">
            No questions yet. Be the first.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {shown.map((q) => {
              const hasVoted = votedSet.has(q.id);
              return (
                <li
                  key={q.id}
                  className={[
                    'flex gap-3 rounded-xl border bg-surface p-3',
                    q.pinned ? 'border-2 border-primary' : 'border-line',
                  ].join(' ')}
                >
                  <form method="post" action="/api/qa/vote" className="shrink-0">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="questionId" value={q.id} />
                    <button
                      type="submit"
                      disabled={hasVoted}
                      aria-label={
                        hasVoted ? `You voted. ${q.votes} votes` : `Vote up. ${q.votes} votes`
                      }
                      className={[
                        'flex size-14 flex-col items-center justify-center rounded-lg border font-bold leading-none',
                        hasVoted
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-line bg-canvas text-ink',
                      ].join(' ')}
                    >
                      <span aria-hidden="true">&#9650;</span>
                      <span className="mt-1 tabular-nums">{q.votes}</span>
                    </button>
                  </form>
                  <div className="min-w-0">
                    <p className="break-words text-ink">{q.text}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {q.name || 'Anonymous'}
                      {q.pinned ? ' / Being answered now' : ''}
                      {q.status === 'answered' ? ' / Answered' : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
