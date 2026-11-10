import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AutoRefresh } from '@/components/AutoRefresh';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { controlPoll, createPoll, loadPollsFromConfig } from '@/modules/backup/actions';
import { BackupSwitch } from '@/modules/backup/BackupSwitch';
import { readBackupMode } from '@/modules/backup/server';
import { PollResultsView } from '@/modules/polls/components/PollResultsView';
import {
  MAX_OPTIONS,
  MAX_POLL_QUESTION,
  MIN_OPTIONS,
  POLL_KIND_LABEL,
  POLL_KINDS,
  tallyPoll,
} from '@/modules/polls/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Polls' };

const STATUS = {
  draft: 'Ready, not opened yet',
  open: 'Open for answers',
  closed: 'Closed',
} as const;

export default async function PollsAdminPage() {
  await requireAdmin('/admin/polls');
  const config = getEventConfig();
  if (!config.features.polls) notFound();

  const data = getData();
  const [backupOn, polls] = await Promise.all([readBackupMode(), data.polls.list()]);
  const results = await Promise.all(
    polls.map(async (poll) => tallyPoll(poll, await data.polls.votes(poll.id))),
  );
  const loaded = new Set(polls.map((p) => p.id));
  const notLoaded = config.polls.filter((p) => !loaded.has(`config-${p.id}`)).length;
  const anyOpen = polls.some((p) => p.status === 'open');

  const button = (id: string, act: string, label: string, primary = false) => (
    <form action={controlPoll}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="act" value={act} />
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
      {/* Votes arrive while a poll is open. */}
      <AutoRefresh intervalMs={4_000} enabled={anyOpen} />

      <div>
        <h1 className="text-2xl font-bold text-ink">Polls</h1>
        <p className="mt-1 text-ink-soft">
          The portal&apos;s own polls, for when Slido is unavailable. One poll is open at a time,
          and each phone answers once.
        </p>
      </div>

      <BackupSwitch on={backupOn} />

      {notLoaded > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-ink">
            {notLoaded} prepared {notLoaded === 1 ? 'poll' : 'polls'} in the config file{' '}
            {notLoaded === 1 ? 'is' : 'are'} not loaded yet.
          </p>
          <form action={loadPollsFromConfig}>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
            >
              Load prepared polls
            </button>
          </form>
        </section>
      ) : null}

      {polls.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">
          No polls yet. Load the prepared ones or write one below.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {polls.map((poll, i) => {
            const r = results[i];
            return (
              <li
                key={poll.id}
                className={[
                  'flex flex-col rounded-xl bg-surface p-4',
                  poll.status === 'open' ? 'border-2 border-success' : 'border border-line',
                ].join(' ')}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {POLL_KIND_LABEL[poll.kind]}
                </p>
                <h2 className="mt-1 text-lg font-bold leading-tight text-ink">{poll.question}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {STATUS[poll.status]}. {r?.voters ?? 0} answered.{' '}
                  {poll.revealed ? 'Results are showing.' : 'Results are hidden from the room.'}
                </p>

                <div className="mt-3 flex-1">
                  {r ? <PollResultsView kind={poll.kind} results={r} /> : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {poll.status === 'open'
                    ? button(poll.id, 'close', 'Close', true)
                    : button(poll.id, 'open', poll.status === 'closed' ? 'Reopen' : 'Open', true)}
                  {poll.revealed
                    ? button(poll.id, 'conceal', 'Hide results')
                    : button(poll.id, 'reveal', 'Reveal results')}
                  {button(poll.id, 'screen', 'Put on the big screen')}
                </div>

                {poll.status !== 'open' ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
                      Delete this poll
                    </summary>
                    <form action={controlPoll} className="mt-2 flex flex-wrap items-center gap-3">
                      <input type="hidden" name="id" value={poll.id} />
                      <input type="hidden" name="act" value="delete" />
                      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          name="confirm"
                          value="yes"
                          required
                          className="size-5"
                        />
                        Yes, delete it and its {r?.voters ?? 0} answers
                      </label>
                      <button
                        type="submit"
                        className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                      >
                        Delete
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-lg font-bold text-ink">Write a new poll</h2>
        <form action={createPoll} className="mt-3 space-y-3">
          <label className="block text-sm font-semibold text-ink">
            Question
            <input
              name="question"
              type="text"
              required
              maxLength={MAX_POLL_QUESTION}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink"
            />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Type
            <select
              name="kind"
              defaultValue="single"
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 font-normal text-ink sm:w-auto"
            >
              {POLL_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {POLL_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">
            Choices, one per line ({MIN_OPTIONS} to {MAX_OPTIONS}). Leave empty for a word cloud.
            <textarea
              name="options"
              rows={4}
              className="mt-1 block w-full rounded-lg border border-line bg-canvas px-3 py-2 font-normal text-ink"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
          >
            Add the poll
          </button>
        </form>
      </section>
    </div>
  );
}
