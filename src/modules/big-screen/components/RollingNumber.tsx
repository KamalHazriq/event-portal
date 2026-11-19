'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that rolls up to its new value, with a short pop. The screen
 * refreshes every few seconds without remounting this, so it remembers
 * where it was and only animates real changes.
 */
export function RollingNumber({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, durationMs]);

  // Keyed by the target, so the pop plays once per change.
  return (
    <span key={value} className="count-pop">
      {shown}
    </span>
  );
}
