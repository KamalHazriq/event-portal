'use client';

import { useEffect, useState } from 'react';

import { shouldSpin, spinSchedule } from '../logic';

type Winner = { key: string; name: string; department: string };

/**
 * The lucky draw on the projector.
 *
 * The draw has already happened on the server; this only puts on the show.
 * It spins through names, slowing like a wheel, then reveals the winners.
 * Only a fresh draw spins: a projector reloaded later shows the result
 * straight away, and a machine set to reduce motion never spins.
 *
 * Keyed by draw on the page, so each new draw mounts a fresh spinner while
 * the page's regular refresh leaves a running one alone.
 */
export function LuckyDrawSpinner({
  prize,
  drawnAtMs,
  winners,
  spinNames,
}: {
  prize: string;
  drawnAtMs: number;
  winners: Winner[];
  spinNames: string[];
}) {
  // Server and browser both ask the clock, so they agree on the first frame
  // and a fresh draw never flashes its result before the spin.
  const [spinning, setSpinning] = useState(
    () => spinNames.length > 1 && shouldSpin(drawnAtMs, Date.now()),
  );
  const [shown, setShown] = useState(spinNames[0] ?? '');

  useEffect(() => {
    if (!spinning) return;
    // A machine set to reduce motion gets no spin steps, so it goes straight
    // to the result on the first tick.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gaps = reduce ? [] : spinSchedule();
    let i = 0;
    const tick = () => {
      if (i >= gaps.length) {
        setSpinning(false);
        return;
      }
      setShown(spinNames[(i * 7 + 3) % spinNames.length] ?? '');
      timer = window.setTimeout(tick, gaps[i]);
      i += 1;
    };
    let timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
    // Runs once per mounted draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const big = winners.length === 1;

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-[clamp(1.2rem,2.6vw,3.5rem)] font-bold text-accent">
        {prize || 'Lucky draw'}
      </p>

      {spinning ? (
        <p
          className="mt-[3vh] text-[clamp(3rem,8vw,11rem)] font-bold leading-none text-ink"
          aria-live="off"
          suppressHydrationWarning
        >
          {shown}
        </p>
      ) : (
        <ol
          aria-live="polite"
          className={
            big
              ? 'mt-[3vh]'
              : 'mt-[3vh] grid w-full max-w-[85vw] grid-cols-2 gap-x-[4vw] gap-y-[2.5vh] text-left'
          }
        >
          {winners.map((w, i) => (
            <li key={w.key} className="screen-arrive" style={{ animationDelay: `${i * 350}ms` }}>
              <p
                className={
                  big
                    ? 'text-[clamp(3rem,8vw,11rem)] font-bold leading-none text-ink'
                    : 'text-[clamp(1.4rem,3.2vw,4.4rem)] font-bold leading-tight text-ink'
                }
              >
                {big ? '' : `${i + 1}. `}
                {w.name}
              </p>
              <p
                className={
                  big
                    ? 'mt-[2vh] text-[clamp(1.2rem,2.6vw,3.5rem)] text-ink-soft'
                    : 'text-[clamp(0.9rem,1.6vw,2.2rem)] text-ink-soft'
                }
              >
                {w.department}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
