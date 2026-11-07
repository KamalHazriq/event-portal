'use client';

import { useState } from 'react';

import type { MockQuestion, MockQuestionStatus } from '../mock-data';

const FILTERS: { id: MockQuestionStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'On screen' },
  { id: 'answered', label: 'Answered' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'all', label: 'All' },
];

const STATUS_LABEL: Record<MockQuestionStatus, string> = {
  pending: 'Waiting',
  approved: 'On screen',
  answered: 'Answered',
  hidden: 'Hidden',
};

/**
 * The moderator queue for the backup Q&A, working in this tab only.
 * Pre-moderation is on, so new questions land in "Waiting".
 */
export function QaPreview({
  questions,
  sessions,
}: {
  questions: MockQuestion[];
  sessions: { id: string; title: string }[];
}) {
  const [items, setItems] = useState(questions);
  const [filter, setFilter] = useState<MockQuestionStatus | 'all'>('pending');
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');

  const update = (id: string, patch: Partial<MockQuestion>) =>
    setItems((prev) =>
      prev.map((q) => {
        if (patch.pinned && q.sessionId === sessionId) {
          // One pin per session: pinning one unpins the others.
          return q.id === id ? { ...q, ...patch } : { ...q, pinned: false };
        }
        return q.id === id ? { ...q, ...patch } : q;
      }),
    );

  const inSession = items.filter((q) => q.sessionId === sessionId);
  const shown = inSession
    .filter((q) => filter === 'all' || q.status === filter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.votes - a.votes);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [
      f.id,
      f.id === 'all' ? inSession.length : inSession.filter((q) => q.status === f.id).length,
    ]),
  );

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-ink">
        Session
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>

      <div role="tablist" aria-label="Question status" className="flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            type="button"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={[
              'min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold',
              filter === f.id
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-surface text-ink',
            ].join(' ')}
          >
            {f.label} <span className="tabular-nums">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <li
              key={q.id}
              className={[
                'rounded-xl border bg-surface p-4',
                q.pinned ? 'border-2 border-accent' : 'border-line',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-ink">{q.text}</p>
                <span className="shrink-0 text-lg font-bold tabular-nums text-ink">
                  {q.votes}
                  <span className="sr-only"> votes</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {q.name}, {q.minutesAgo} min ago. {STATUS_LABEL[q.status]}
                {q.pinned ? ', pinned' : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.status !== 'approved' ? (
                  <Action onClick={() => update(q.id, { status: 'approved' })} primary>
                    Approve
                  </Action>
                ) : null}
                {q.status !== 'answered' ? (
                  <Action onClick={() => update(q.id, { status: 'answered', pinned: false })}>
                    Answered
                  </Action>
                ) : null}
                {q.status === 'approved' ? (
                  <Action onClick={() => update(q.id, { pinned: !q.pinned })}>
                    {q.pinned ? 'Unpin' : 'Pin'}
                  </Action>
                ) : null}
                {q.status !== 'hidden' ? (
                  <Action onClick={() => update(q.id, { status: 'hidden', pinned: false })}>
                    Hide
                  </Action>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Action({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary'
          : 'min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink'
      }
    >
      {children}
    </button>
  );
}
