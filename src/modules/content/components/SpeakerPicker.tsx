'use client';

import { useState } from 'react';

type Option = { id: string; name: string; title: string };

/**
 * Speakers for one session: tick names and the summary changes at once, or
 * type someone new in "Other" (they are added to the speaker list on save).
 */
export function SpeakerPicker({ options, chosen }: { options: Option[]; chosen: string[] }) {
  const [ticked, setTicked] = useState(new Set(chosen));
  const [other, setOther] = useState('');
  const names = [
    ...options.filter((o) => ticked.has(o.id)).map((o) => o.name),
    ...other
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
  ];

  return (
    <details className="group rounded-lg border border-line bg-canvas">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink">
        <span className="font-semibold">Speakers:</span>
        <span className="min-w-0 flex-1 truncate text-ink-soft">
          {names.length === 0 ? 'None, tap to choose' : names.join(', ')}
        </span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-3 border-t border-line p-3">
        <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {options.map((p) => (
            <label key={p.id} className="flex min-h-9 items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="speaker"
                value={p.id}
                checked={ticked.has(p.id)}
                onChange={(e) =>
                  setTicked((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    return next;
                  })
                }
                className="size-5"
              />
              <span>
                {p.name}
                {p.title ? <span className="text-ink-soft">, {p.title}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold text-ink">
          Other (not in the list): type a name, or several with commas
          <input
            name="otherSpeaker"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={200}
            placeholder="For example Dr Aminah Yusof"
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal text-ink"
          />
        </label>
      </div>
    </details>
  );
}
