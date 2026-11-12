'use client';

import { useEffect, useRef, useState } from 'react';

type Incoming = { id: string; emoji: string };
type Floating = Incoming & { left: number; delay: number };

/**
 * Reactions from phones, floating up over whatever the projector shows.
 *
 * The page re-reads the server every few seconds and passes the last few
 * seconds of taps. Each one floats up once: ids already shown are skipped,
 * and a burst is spread out a little so it reads as a stream, not a blob.
 */
export function ReactionOverlay({ reactions }: { reactions: Incoming[] }) {
  const seen = useRef(new Set<string>());
  const [floating, setFloating] = useState<Floating[]>([]);

  useEffect(() => {
    const fresh = reactions.filter((r) => !seen.current.has(r.id)).slice(-40);
    if (fresh.length === 0) return;
    for (const r of fresh) seen.current.add(r.id);
    const added = fresh.map((r, i) => ({
      ...r,
      left: 6 + Math.random() * 88,
      delay: Math.min(i * 120, 3000),
    }));
    setFloating((current) => [...current.slice(-60), ...added]);
    const ids = new Set(added.map((a) => a.id));
    const timer = window.setTimeout(
      () => setFloating((current) => current.filter((f) => !ids.has(f.id))),
      8000,
    );
    return () => window.clearTimeout(timer);
  }, [reactions]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {floating.map((f) => (
        <span
          key={f.id}
          className="screen-reaction absolute bottom-[2vh] text-[clamp(2rem,4vw,5.5rem)] opacity-0"
          style={{ left: `${f.left}%`, animationDelay: `${f.delay}ms` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
