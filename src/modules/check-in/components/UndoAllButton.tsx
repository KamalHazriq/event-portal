'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Undo every check in, for testing before the event. Hidden away and asks
 * for the word UNDO, so a stray tap during the event cannot wipe the day.
 */
export function UndoAllButton({
  days,
  currentDayId,
}: {
  days: { id: string; label: string }[];
  currentDayId: string;
}) {
  const router = useRouter();
  const [dayId, setDayId] = useState(currentDayId);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/check-in/undo-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayId, confirm: word }),
      });
      const body = (await response.json()) as { message?: string };
      setMessage(body.message ?? 'Done.');
      if (response.ok) {
        setWord('');
        router.refresh();
      }
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-line bg-surface p-3">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-live px-4 font-bold text-ink">
        Undo all attendance (for testing)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink-soft">
          Undo every check in, so the counters start from zero again. For testing before the event
          only: it cannot be put back.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold text-ink">
            Which days
            <select
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
              className="mt-1 block min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} only
                </option>
              ))}
              <option value="all">All days</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-ink">
            Type UNDO to confirm
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              className="mt-1 block min-h-11 w-40 rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
          <button
            type="button"
            disabled={busy || word.trim().toUpperCase() !== 'UNDO'}
            onClick={() => void run()}
            className="min-h-11 rounded-lg bg-live px-4 font-bold text-canvas disabled:opacity-50"
          >
            Undo all check ins
          </button>
        </div>
        {message ? (
          <p role="status" className="text-sm font-semibold text-ink">
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
