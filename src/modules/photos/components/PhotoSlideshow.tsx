'use client';

import { useEffect, useState } from 'react';

import { SLIDE_MS } from '../logic';

type Slide = { id: string; caption: string };

/**
 * The big screen slideshow: one approved photo at a time, cross fading. The
 * page refreshes every few seconds, so newly approved photos join the loop
 * without a reload, and the current photo is kept across refreshes.
 */
export function PhotoSlideshow({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const current = slides[index % Math.max(1, slides.length)];
  if (!current) return null;

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {/* Keyed by photo, so each new one fades in over the last. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={`/api/photos/${current.id}`}
          alt={current.caption || 'A photo from the event'}
          className="screen-fade absolute inset-0 h-full w-full rounded-[1vw] object-contain"
        />
      </div>
      <div className="mt-[2vh] flex items-baseline justify-between gap-[2vw]">
        <p className="min-w-0 truncate text-[clamp(1rem,2vw,2.8rem)] font-bold text-ink">
          {current.caption}
        </p>
        <p className="shrink-0 text-[clamp(0.9rem,1.4vw,2rem)] tabular-nums text-ink-soft">
          {(index % slides.length) + 1} / {slides.length}
        </p>
      </div>
    </div>
  );
}
