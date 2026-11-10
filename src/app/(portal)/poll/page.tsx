import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { currentDeviceId, readBackupMode } from '@/modules/backup/server';
import { PollResultsView } from '@/modules/polls/components/PollResultsView';
import {
  MAX_WORD,
  POLL_KIND_LABEL,
  tallyPoll,
  voteProblemMessage,
  type VoteProblem,
} from '@/modules/polls/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Poll' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PROBLEMS: readonly string[] = ['closed', 'nothing-chosen', 'not-an-option', 'word-too-long'];

/** The poll that is open right now (Module 3). One answer per phone. */
export default async function PollPage({ searchParams }: { searchParams: SearchParams }) {
  const config = getEventConfig();
  if (!config.features.polls || !(await readBackupMode())) notFound();

  const query = await searchParams;
  const state = typeof query.state === 'string' ? query.state : null;

  const data = getData();
  const polls = await data.polls.list();
  // The open poll, or failing that the latest one whose results are showing.
  const poll =
    polls.find((p) => p.status === 'open') ??
    [...polls].reverse().find((p) => p.status === 'closed' && p.revealed) ??
    null;

  const deviceId = await currentDeviceId();
  const hasVoted = poll && deviceId ? await data.polls.hasVoted(poll.id, deviceId) : false;
  const results = poll?.revealed ? tallyPoll(poll, await data.polls.votes(poll.id)) : null;
  const canVote = poll?.status === 'open' && !hasVoted;

  return (
    <div className="space-y-5 py-2">
      <AutoRefresh intervalMs={5_000} />

      {!poll ? (
        <div>
          <p className="eyebrow">Poll</p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
            No poll is open right now
          </h1>
          <p className="mt-3 text-ink-soft">
            Keep this page open. The next poll appears here by itself.
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="eyebrow">{POLL_KIND_LABEL[poll.kind]}</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {poll.question}
            </h1>
          </div>

          {state && PROBLEMS.includes(state) ? (
            <p
              role="status"
              className="rounded-lg border border-warning p-3 text-sm font-semibold text-warning"
            >
              {voteProblemMessage(state as VoteProblem)}
            </p>
          ) : null}

          {canVote ? (
            <form method="post" action="/api/polls/vote" className="space-y-3">
              <input type="hidden" name="pollId" value={poll.id} />
              {poll.kind === 'wordcloud' ? (
                <label className="block font-semibold text-ink">
                  Your answer, in a word or two
                  <input
                    name="word"
                    type="text"
                    required
                    maxLength={MAX_WORD}
                    autoComplete="off"
                    className="mt-1 block min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-lg font-normal text-ink"
                  />
                </label>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm text-ink-soft">
                    {poll.kind === 'multiple' ? 'Choose all that apply.' : 'Choose one.'}
                  </legend>
                  {poll.options.map((option, i) => (
                    <label
                      key={option}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink has-[:checked]:border-2 has-[:checked]:border-primary"
                    >
                      <input
                        type={poll.kind === 'multiple' ? 'checkbox' : 'radio'}
                        name="choice"
                        value={i}
                        required={poll.kind === 'single'}
                        className="size-5 shrink-0"
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              )}
              <button
                type="submit"
                className="min-h-14 w-full rounded-xl bg-primary px-5 text-lg font-bold text-on-primary sm:w-auto"
              >
                Send my answer
              </button>
            </form>
          ) : (
            <p
              role="status"
              className="rounded-xl border border-success bg-surface p-4 font-semibold text-ink"
            >
              {hasVoted ? 'Thank you, your answer is in.' : 'This poll is closed.'}
              {!results ? ' Results will show here when they are revealed.' : ''}
            </p>
          )}

          {results ? (
            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Results, {results.voters} {results.voters === 1 ? 'answer' : 'answers'}
              </h2>
              <PollResultsView kind={poll.kind} results={results} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
