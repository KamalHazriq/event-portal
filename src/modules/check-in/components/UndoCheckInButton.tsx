'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Undoes one check in, for when the wrong tag was scanned.
 *
 * Asks first, because this changes the headcount and the person is standing
 * right there. After it succeeds the page refetches itself, so every list on
 * the screen agrees.
 */
export function UndoCheckInButton({
  attendeeId,
  dayId,
  name,
}: {
  attendeeId: string;
  dayId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const undo = async () => {
    setBusy(true);
    try {
      await fetch('/api/check-in/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendeeId, dayId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-9 shrink-0 rounded border border-line px-3 py-1 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Undo
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-ink-soft">Undo {name}?</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void undo()}
        className="min-h-9 rounded bg-live px-3 py-1 text-sm font-bold text-white disabled:opacity-60"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-9 rounded border border-line px-3 py-1 text-sm font-semibold text-ink"
      >
        No
      </button>
    </span>
  );
}
