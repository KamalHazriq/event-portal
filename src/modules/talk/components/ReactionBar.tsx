'use client';

import { useRef, useState } from 'react';

import type { ReactionKind } from '@/data/types';

import { REACTIONS } from '../logic';

type Float = { id: number; emoji: string; left: number };

/**
 * Four big buttons. A tap counts at once on the phone and floats a little
 * emoji up; the server is told in the background, and the projector shows
 * it within a few seconds.
 */
export function ReactionBar({
  sessionId,
  open,
  initialTotals,
  nowParam,
}: {
  sessionId: string;
  open: boolean;
  initialTotals: Record<ReactionKind, number>;
  /** The test clock, if one is in use, so the server agrees the talk is on. */
  nowParam: string | null;
}) {
  const [totals, setTotals] = useState(initialTotals);
  const [floats, setFloats] = useState<Float[]>([]);
  const [message, setMessage] = useState('');
  const counter = useRef(0);

  const react = (kind: ReactionKind, emoji: string) => {
    counter.current += 1;
    const id = counter.current;
    setTotals((t) => ({ ...t, [kind]: t[kind] + 1 }));
    setFloats((f) => [...f.slice(-11), { id, emoji, left: 10 + Math.random() * 80 }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1600);
    try {
      navigator.vibrate?.(15);
    } catch {
      // A nicety only.
    }

    void fetch('/api/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, kind, now: nowParam }),
    })
      .then((response) => {
        if (response.status === 429) setMessage('Easy there. Try again in a moment.');
        else if (response.status === 409) setMessage('Reactions are open while the talk is on.');
        else if (response.ok) setMessage('');
      })
      .catch(() => setMessage('That one did not get through. Check the Wi-Fi.'));
  };

  return (
    <section
      aria-labelledby="react-heading"
      className="relative overflow-hidden rounded-xl border border-line bg-surface p-4"
    >
      <h2 id="react-heading" className="text-base font-bold text-ink">
        React live
      </h2>
      <p className="text-sm text-ink-soft">
        {open
          ? 'Tap as often as you like. It shows up on the big screen.'
          : 'Opens when the talk starts.'}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.kind}
            type="button"
            disabled={!open}
            onClick={() => react(r.kind, r.emoji)}
            aria-label={`${r.label}, ${totals[r.kind]} so far`}
            className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-line bg-background text-2xl transition-transform active:scale-90 disabled:opacity-50"
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span className="text-xs font-semibold tabular-nums text-ink-soft">
              {totals[r.kind]}
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <p role="status" className="mt-2 text-sm font-semibold text-ink">
          {message}
        </p>
      ) : null}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {floats.map((f) => (
          <span
            key={f.id}
            className="reaction-float absolute bottom-4 text-3xl"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
    </section>
  );
}
