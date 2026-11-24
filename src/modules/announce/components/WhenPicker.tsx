'use client';

import { useRef, useState } from 'react';

const QUICK = [
  { minutes: 10, label: 'In 10 min' },
  { minutes: 15, label: 'In 15 min' },
  { minutes: 30, label: 'In 30 min' },
  { minutes: 60, label: 'In 1 hour' },
] as const;

/** The event's wall clock N minutes from now, as a datetime-local value. */
function localIn(minutes: number, timezone: string): string {
  const at = new Date(Date.now() + minutes * 60_000);
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return text.replace(' ', 'T');
}

/** Now or later, with one tap for the usual delays. */
export function WhenPicker({ timezone }: { timezone: string }) {
  const [later, setLater] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <fieldset>
      <legend className="font-semibold text-ink">When</legend>
      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex min-h-11 items-center gap-2 text-ink">
          <input
            type="radio"
            name="when"
            value="now"
            checked={!later}
            onChange={() => setLater(false)}
            className="size-5"
          />
          Now
        </label>
        <label className="flex min-h-11 items-center gap-2 text-ink">
          <input
            type="radio"
            name="when"
            value="later"
            checked={later}
            onChange={() => setLater(true)}
            className="size-5"
          />
          Later, at
        </label>
        <input
          ref={input}
          type="datetime-local"
          name="at"
          aria-label="Send it at"
          onChange={() => setLater(true)}
          className="min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick times">
        {QUICK.map((q) => (
          <button
            key={q.minutes}
            type="button"
            onClick={() => {
              if (input.current) input.current.value = localIn(q.minutes, timezone);
              setLater(true);
            }}
            className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink hover:border-primary"
          >
            {q.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Later: it is posted at that time (event time, {timezone}), with everything set above.
      </p>
    </fieldset>
  );
}
