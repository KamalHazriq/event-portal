'use client';

import { useEffect, useRef, useState } from 'react';

const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * A live, shrunk copy of what the projector shows. The page inside is laid
 * out at a real 1920 x 1080 and scaled down to fit, so what the MC sees on a
 * phone is exactly what the room sees.
 *
 * Can be switched off, because it polls like the projector does and a phone
 * on hotel Wi-Fi may not want to.
 */
export function ScaledPreview({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [on, setOn] = useState(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [on]);

  return (
    <div>
      {on ? (
        <div
          ref={box}
          className="relative w-full overflow-hidden rounded-xl border border-line bg-muted"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        >
          {scale > 0 ? (
            <iframe
              src={src}
              title="Live preview of the big screen"
              tabIndex={-1}
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
              style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }}
            />
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className="mt-2 text-sm font-semibold text-primary underline"
      >
        {on ? 'Hide the live preview' : 'Show the live preview'}
      </button>
    </div>
  );
}
