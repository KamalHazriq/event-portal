'use client';

import { useLayoutEffect, useRef } from 'react';

import { RollingNumber } from './RollingNumber';

type Person = { id: string; rank: number; name: string; department: string; points: number };

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Slides rows to their new place when the order changes (measure, then
 * animate from the old spot), glows a row that climbed, and floats a "+N"
 * over points that went up. The screen refreshes every few seconds without
 * remounting this, so it compares with what it showed last time.
 */
function useRowMotion(items: { key: string; rank: number; value: number }[]) {
  const rows = useRef(new Map<string, HTMLElement>());
  const last = useRef(new Map<string, { top: number; rank: number; value: number }>());

  useLayoutEffect(() => {
    const reduce = reducedMotion();
    const next = new Map<string, { top: number; rank: number; value: number }>();
    for (const item of items) {
      const el = rows.current.get(item.key);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      const before = last.current.get(item.key);
      if (before && !reduce) {
        if (Math.abs(before.top - top) > 1) {
          el.animate([{ transform: `translateY(${before.top - top}px)` }, { transform: 'none' }], {
            duration: 800,
            easing: EASE,
          });
        }
        if (item.rank < before.rank) {
          el.animate(
            [
              { boxShadow: '0 0 0 0.35vw var(--color-accent)', borderColor: 'var(--color-accent)' },
              { boxShadow: '0 0 0 0 transparent' },
            ],
            { duration: 2200, easing: 'ease-out' },
          );
        }
        if (item.value > before.value) {
          const gain = document.createElement('span');
          gain.className = 'points-gain';
          gain.textContent = `+${Math.round((item.value - before.value) * 10) / 10}`;
          gain.setAttribute('aria-hidden', 'true');
          el.appendChild(gain);
          window.setTimeout(() => gain.remove(), 1800);
        }
      }
      next.set(item.key, { top, rank: item.rank, value: item.value });
    }
    last.current = next;
  }, [items]);

  return (key: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(key, el);
    else rows.current.delete(key);
  };
}

function rankClass(rank: number): string {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  return 'bg-muted text-ink';
}

export function AnimatedPeople({ people }: { people: Person[] }) {
  const ref = useRowMotion(people.map((p) => ({ key: p.id, rank: p.rank, value: p.points })));
  return (
    <ol className="mt-[2vh] space-y-[0.8vh]">
      {people.map((row, i) => (
        <li
          key={row.id}
          ref={ref(row.id)}
          className="board-row relative flex items-center gap-[1.2vw] rounded-[1vw] border border-line bg-surface px-[1.2vw] py-[0.5vh]"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span
            className={`flex size-[clamp(2rem,3vw,4rem)] shrink-0 items-center justify-center rounded-full text-[clamp(1rem,1.8vw,2.4rem)] font-bold tabular-nums ${rankClass(
              row.rank,
            )}`}
          >
            {row.rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[clamp(1rem,1.6vw,2.2rem)] font-bold text-ink">
              {row.name}
            </span>
            <span className="block text-[clamp(0.8rem,1.05vw,1.4rem)] text-ink-soft">
              {row.department}
            </span>
          </span>
          <span className="text-[clamp(1.2rem,2vw,2.8rem)] font-bold tabular-nums text-ink">
            <RollingNumber value={row.points} />
          </span>
        </li>
      ))}
    </ol>
  );
}
