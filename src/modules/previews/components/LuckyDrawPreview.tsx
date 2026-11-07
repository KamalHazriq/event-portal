'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { drawWinners, eligibleEntrants, type DrawEntrant } from '../lucky-draw';

const SPIN_MS = 2200;
const TICK_MS = 70;

/**
 * The lucky draw, working in this tab only.
 *
 * The real module will save winners through the data adapter and drive the
 * big screen. Here the spin, exclusions and "no one wins twice" all work, so
 * the MC can rehearse the flow.
 */
export function LuckyDrawPreview({
  pool,
  defaultExcludedIds,
}: {
  pool: DrawEntrant[];
  defaultExcludedIds: string[];
}) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(defaultExcludedIds));
  const [winners, setWinners] = useState<DrawEntrant[]>([]);
  const [count, setCount] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const winnerIds = useMemo(() => new Set(winners.map((w) => w.id)), [winners]);
  const eligible = eligibleEntrants(pool, excluded, winnerIds);

  const draw = () => {
    if (spinning || eligible.length === 0) return;
    const picked = drawWinners(pool, excluded, winnerIds, count);
    setSpinning(true);

    const start = Date.now();
    const tick = () => {
      if (Date.now() - start >= SPIN_MS) {
        setFlash(null);
        setSpinning(false);
        setWinners((prev) => [...prev, ...picked]);
        return;
      }
      const any = eligible[Math.floor(Math.random() * eligible.length)];
      setFlash(any ? any.name : null);
      timers.current.push(window.setTimeout(tick, TICK_MS));
    };
    tick();
  };

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const shown = pool.filter((p) =>
    `${p.name} ${p.department}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border-2 border-primary bg-surface p-4 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          {spinning ? 'Drawing' : winners.length > 0 ? 'Latest winner' : 'Ready'}
        </p>
        <p
          className="mt-1 min-h-[2.5rem] text-3xl font-bold leading-tight text-ink"
          aria-live="polite"
        >
          {spinning ? flash : (winners.at(-1)?.name ?? '...')}
        </p>
        {!spinning && winners.at(-1) ? (
          <p className="text-ink-soft">{winners.at(-1)?.department}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end justify-center gap-2">
          <label className="text-sm font-semibold text-ink">
            Winners this draw
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="ml-2 min-h-11 rounded-lg border border-line bg-canvas px-2 text-ink"
              disabled={spinning}
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={draw}
            disabled={spinning || eligible.length === 0}
            className="min-h-11 rounded-lg bg-primary px-6 py-2 font-bold text-on-primary disabled:opacity-50"
          >
            Draw
          </button>
          <button
            type="button"
            onClick={() => setWinners([])}
            disabled={spinning || winners.length === 0}
            className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Clear winners
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {eligible.length} in the hat. {excluded.size} excluded.
        </p>
      </section>

      {winners.length > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Winners, in draw order
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            {winners.map((w) => (
              <li key={w.id} className="text-ink">
                <span className="font-semibold">{w.name}</span>{' '}
                <span className="text-ink-soft">{w.department}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Who is in the hat
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Untick anyone who should not win. The secretariat start unticked.
        </p>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or department"
          aria-label="Filter by name or department"
          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
        />
        <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={!excluded.has(p.id)}
                  onChange={() => toggle(p.id)}
                  disabled={spinning}
                  className="size-5"
                />
                <span className={winnerIds.has(p.id) ? 'text-ink-soft line-through' : 'text-ink'}>
                  {p.name}
                </span>
                <span className="ml-auto truncate text-sm text-ink-soft">{p.department}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
