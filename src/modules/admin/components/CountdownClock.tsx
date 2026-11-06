'use client';

import { useEffect, useState } from 'react';

import { formatCountdown } from '../logic';

/**
 * A ticking countdown.
 *
 * The server works out the target instant and hands it over as a timestamp,
 * so this only has to count down to it. One second is the obvious rate and
 * the wording itself only changes once a minute until the last two minutes,
 * so there is nothing to be gained by being cleverer.
 */
export function CountdownClock({ targetMs, className }: { targetMs: number; className?: string }) {
  const [left, setLeft] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const tick = () => setLeft(targetMs - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  return (
    // The server renders one value and the browser immediately renders
    // another, because a second has passed. That is expected, not a bug.
    <span className={className} suppressHydrationWarning>
      {formatCountdown(left)}
    </span>
  );
}
