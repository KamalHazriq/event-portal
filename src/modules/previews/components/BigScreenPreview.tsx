'use client';

import { useState } from 'react';

import type { BigScreenView } from '../mock-data';

/**
 * Picking what the projector shows, working in this tab only. The real
 * module stores the choice, and the projector page polls for it every few
 * seconds, so a phone in the MC's hand can switch the screen.
 */
export function BigScreenPreview({
  views,
  samples,
  palette,
}: {
  views: readonly BigScreenView[];
  /** A line of sample content per view, worked out on the server. */
  samples: Record<string, { big: string; small: string }>;
  /** The big screen theme from config, so the mock matches the projector. */
  palette: { background: string; text: string; textMuted: string };
}) {
  const [live, setLive] = useState(views[0]?.id ?? '');
  const [hideNames, setHideNames] = useState(false);
  const current = views.find((v) => v.id === live);
  const sample = samples[live];

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          On the projector now
        </h2>
        {/* 16:9, like the 1920 x 1080 projector. */}
        <div
          className="flex aspect-video flex-col items-center justify-center rounded-xl p-4 text-center"
          style={{ background: palette.background, color: palette.text }}
        >
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: palette.textMuted }}>
            {current?.title}
          </p>
          <p className="mt-2 text-3xl font-bold leading-tight sm:text-5xl">
            {live === 'arrivals' && hideNames ? '42 / 78 arrived' : sample?.big}
          </p>
          <p className="mt-2 text-sm sm:text-base" style={{ color: palette.textMuted }}>
            {live === 'arrivals' && hideNames ? 'Names hidden' : sample?.small}
          </p>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {views.map((view) => {
          const active = view.id === live;
          return (
            <li key={view.id}>
              <button
                type="button"
                onClick={() => setLive(view.id)}
                aria-pressed={active}
                className={[
                  'block h-full w-full rounded-xl bg-surface p-4 text-left',
                  active ? 'border-2 border-success' : 'border border-line',
                ].join(' ')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">{view.title}</span>
                  {active ? (
                    <span className="rounded bg-success px-2 py-0.5 text-xs font-bold text-canvas">
                      Live
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">{view.description}</span>
                <span className="mt-2 block text-xs text-ink-soft">
                  {view.whenToUse}
                  {view.refreshSeconds ? `. Updates every ${view.refreshSeconds} s` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          checked={hideNames}
          onChange={(e) => setHideNames(e.target.checked)}
          className="size-5"
        />
        <span className="text-ink">Arrival wall: hide names and show only the counter</span>
      </label>
    </div>
  );
}
