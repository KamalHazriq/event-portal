'use client';

import { useState } from 'react';

import type { MockPoll, MockPollStatus } from '../mock-data';

const STATUS_LABEL: Record<MockPollStatus, string> = {
  draft: 'Ready, not opened',
  open: 'Open for votes',
  closed: 'Closed',
};

const KIND_LABEL: Record<MockPoll['kind'], string> = {
  single: 'Single choice',
  multiple: 'Multiple choice',
  wordcloud: 'Word cloud',
};

/**
 * Backup polls, working in this tab only. Only one poll can be open at a
 * time, which is how the real module will behave.
 */
export function PollsPreview({ polls }: { polls: MockPoll[] }) {
  const [items, setItems] = useState(polls);
  const [revealed, setRevealed] = useState<Set<string>>(
    () => new Set(polls.filter((p) => p.status === 'closed').map((p) => p.id)),
  );

  const setStatus = (id: string, status: MockPollStatus) =>
    setItems((prev) =>
      prev.map((p) => {
        if (p.id === id) return { ...p, status };
        // Opening one closes whichever was open.
        if (status === 'open' && p.status === 'open') return { ...p, status: 'closed' };
        return p;
      }),
    );

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="space-y-4">
      {items.map((poll) => {
        const total = poll.options.reduce((sum, o) => sum + o.votes, 0);
        const top = Math.max(1, ...poll.options.map((o) => o.votes));
        return (
          <li
            key={poll.id}
            className={[
              'rounded-xl bg-surface p-4',
              poll.status === 'open' ? 'border-2 border-success' : 'border border-line',
            ].join(' ')}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {KIND_LABEL[poll.kind]} / {poll.usedFor}
            </p>
            <p className="mt-1 text-lg font-bold leading-tight text-ink">{poll.question}</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {STATUS_LABEL[poll.status]}. {poll.voters} voted.{' '}
              {revealed.has(poll.id) ? 'Results on the big screen.' : 'Results hidden.'}
            </p>

            {poll.kind === 'wordcloud' ? (
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {poll.options.map((o) => (
                  <span
                    key={o.label}
                    className="font-bold text-primary"
                    style={{ fontSize: `${0.9 + (o.votes / top) * 1.3}rem` }}
                  >
                    {o.label}
                  </span>
                ))}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {poll.options.map((o) => {
                  const percent = total === 0 ? 0 : Math.round((o.votes / total) * 100);
                  return (
                    <li key={o.label}>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink">{o.label}</span>
                        <span className="tabular-nums text-ink-soft">
                          {o.votes} ({percent}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {poll.status !== 'open' ? (
                <button
                  type="button"
                  onClick={() => setStatus(poll.id, 'open')}
                  className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary"
                >
                  {poll.status === 'closed' ? 'Reopen' : 'Open'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStatus(poll.id, 'closed')}
                  className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary"
                >
                  Close
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleReveal(poll.id)}
                className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
              >
                {revealed.has(poll.id) ? 'Hide results' : 'Reveal results'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
