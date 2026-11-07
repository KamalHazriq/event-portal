'use client';

import { useEffect, useState } from 'react';

import { formatCountdownDigits } from '../logic';

/**
 * The ticking digits on the countdown view. The server hands over the target
 * instant, so a page refresh never makes the numbers jump.
 */
export function CountdownDigits({ targetMs, className }: { targetMs: number; className?: string }) {
  const [left, setLeft] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const tick = () => setLeft(targetMs - Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  const text = formatCountdownDigits(left);

  // Shrink as the text grows, so "1:04:59" or a test target days away still
  // fits across the projector.
  const size =
    text.length <= 5
      ? 'clamp(6rem, 24vw, 30rem)'
      : text.length <= 7
        ? 'clamp(5rem, 18vw, 24rem)'
        : 'clamp(3rem, 10vw, 14rem)';

  return (
    <span className={className} style={{ fontSize: size }} suppressHydrationWarning>
      {text}
    </span>
  );
}
