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
  // Confetti only after a spin this screen actually showed.
  const [celebrate, setCelebrate] = useState(false);

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
        if (!reduce) setCelebrate(true);
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
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-center">
      {celebrate ? <Confetti /> : null}

      <p className="text-[clamp(1.2rem,2.6vw,3.5rem)] font-bold text-accent">
        {prize || 'Lucky draw'}
      </p>

      {spinning ? (
        <div className="draw-drum mt-[3vh] w-full max-w-[80vw] rounded-[2vw] border-2 border-accent px-[3vw] py-[4vh]">
          <p className="text-[clamp(0.9rem,1.6vw,2.2rem)] font-semibold tracking-[0.2em] text-ink-soft uppercase">
            Drawing…
          </p>
          <p
            // Keyed by the name, so each one flicks in from above.
            key={shown}
            className="draw-tick mt-[1.5vh] truncate text-[clamp(3rem,8vw,11rem)] font-bold leading-none text-ink"
            aria-live="off"
            suppressHydrationWarning
          >
            {shown}
          </p>
        </div>
      ) : (
        <ol
          aria-live="polite"
          className={
            big
              ? 'relative mt-[3vh]'
              : 'relative mt-[3vh] grid w-full max-w-[85vw] grid-cols-2 gap-x-[4vw] gap-y-[2.5vh] text-left'
          }
        >
          {winners.map((w, i) => (
            <li
              key={w.key}
              className={celebrate ? 'winner-reveal' : 'screen-arrive'}
              style={{ animationDelay: `${i * 350}ms` }}
            >
              <p
                className={
                  big
                    ? 'winner-name text-[clamp(3rem,8vw,11rem)] font-bold leading-none'
                    : 'winner-name text-[clamp(1.4rem,3.2vw,4.4rem)] font-bold leading-tight'
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

/** Pieces of confetti falling across the screen, in the theme colours. */
const PIECES = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 53) % 1400,
  duration: 2600 + ((i * 97) % 1800),
  drift: ((i * 29) % 21) - 10,
  spin: ((i * 61) % 720) - 360,
  colour: [
    'var(--color-accent)',
    'var(--color-primary)',
    'var(--color-live)',
    'var(--color-warning)',
  ][i % 4],
  wide: i % 3 === 0,
}));

function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.wide ? '1.4vw' : '0.7vw',
              background: p.colour,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              '--drift': `${p.drift}vw`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
