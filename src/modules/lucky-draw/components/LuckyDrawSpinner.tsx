'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { shouldSpin, spinSchedule } from '../logic';
import { playFanfare, playTick, soundReady, subscribeSound } from '../sound';

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
  heading = 'Lucky draw',
  calm = false,
}: {
  prize: string;
  drawnAtMs: number;
  winners: Winner[];
  spinNames: string[];
  /** The title when no prize is named: "Lucky draw", or the name picker's. */
  heading?: string;
  /** The name picker: no confetti or fanfare, just the names. */
  calm?: boolean;
}) {
  // Server and browser both ask the clock, so they agree on the first frame
  // and a fresh draw never flashes its result before the spin.
  const [spinning, setSpinning] = useState(
    () => spinNames.length > 1 && shouldSpin(drawnAtMs, Date.now()),
  );
  // Which step of the spin is showing; each drum picks its own name from it.
  const [step, setStep] = useState(0);
  // Confetti only after a spin this screen actually showed.
  const [celebrate, setCelebrate] = useState(false);
  // True on the server, so the hint never flashes before the page knows.
  const sound = useSyncExternalStore(subscribeSound, soundReady, () => true);

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
        if (!reduce && !calm) setCelebrate(true);
        if (!calm) playFanfare();
        return;
      }
      setStep(i);
      playTick();
      timer = window.setTimeout(tick, gaps[i]);
      i += 1;
    };
    let timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
    // Runs once per mounted draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One drum per winner, so ten winners spin ten names at once.
  const count = Math.max(1, winners.length);
  const layout = drumLayout(count);
  const nameAt = (drum: number) =>
    spinNames[(step * 7 + 3 + drum * 11) % Math.max(1, spinNames.length)] ?? '';

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-[2vw] text-center">
      {celebrate ? <Confetti /> : null}
      {sound || calm ? null : (
        <p className="absolute bottom-[1vh] right-[1vw] text-[clamp(0.7rem,1vw,1.2rem)] text-ink-soft opacity-70">
          Click this screen once to turn the sound on
        </p>
      )}

      <p className="text-[clamp(1.2rem,2.6vw,3.5rem)] font-bold text-accent">{prize || heading}</p>

      <ol
        aria-live={spinning ? 'off' : 'polite'}
        className={`mt-[3vh] grid w-full gap-[1.5vw] ${layout.grid}`}
      >
        {(spinning ? Array.from({ length: count }, () => null) : winners).map((w, d) => (
          <li
            key={w ? w.key : d}
            className={`draw-drum flex min-w-0 flex-col justify-center rounded-[1.5vw] border-2 ${
              spinning ? 'border-accent' : 'border-success'
            } ${layout.pad} ${!spinning ? (celebrate ? 'winner-reveal' : 'screen-arrive') : ''}`}
            style={!spinning ? { animationDelay: `${d * 180}ms` } : undefined}
          >
            {spinning ? (
              <>
                <p
                  className={`${layout.label} font-semibold tracking-[0.2em] text-ink-soft uppercase`}
                >
                  {calm ? 'Picking…' : 'Drawing…'}
                </p>
                <p
                  // Keyed by the name, so each one flicks in from above.
                  key={nameAt(d)}
                  className={`draw-tick mt-[1vh] truncate font-bold leading-tight text-ink ${layout.name}`}
                  suppressHydrationWarning
                >
                  {nameAt(d)}
                </p>
              </>
            ) : w ? (
              <>
                {count > 1 ? (
                  <p className={`${layout.label} font-bold text-ink-soft tabular-nums`}>{d + 1}</p>
                ) : null}
                <p className={`winner-name font-bold leading-tight ${layout.name} break-words`}>
                  {w.name}
                </p>
                <p className={`mt-[0.5vh] ${layout.label} text-ink-soft`}>{w.department}</p>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Columns and type sizes, so 1 to 10 drums all fit a 16:9 screen. */
function drumLayout(n: number): { grid: string; pad: string; name: string; label: string } {
  if (n === 1)
    return {
      grid: 'max-w-[80vw] grid-cols-1',
      pad: 'px-[3vw] py-[5vh]',
      name: 'text-[clamp(3rem,8vw,11rem)]',
      label: 'text-[clamp(0.9rem,1.8vw,2.4rem)]',
    };
  if (n <= 3)
    return {
      grid: `max-w-[92vw] ${n === 2 ? 'grid-cols-2' : 'grid-cols-3'}`,
      pad: 'px-[2vw] py-[4vh]',
      name: 'text-[clamp(1.6rem,3.6vw,5rem)]',
      label: 'text-[clamp(0.8rem,1.4vw,2rem)]',
    };
  if (n <= 6)
    return {
      grid: `max-w-[94vw] ${n === 4 ? 'grid-cols-2' : 'grid-cols-3'}`,
      pad: 'px-[1.5vw] py-[2.5vh]',
      name: 'text-[clamp(1.3rem,2.8vw,4rem)]',
      label: 'text-[clamp(0.7rem,1.2vw,1.6rem)]',
    };
  return {
    grid: 'max-w-[96vw] grid-cols-5',
    pad: 'px-[1vw] py-[2vh]',
    name: 'text-[clamp(1rem,2vw,3rem)]',
    label: 'text-[clamp(0.6rem,1vw,1.3rem)]',
  };
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
