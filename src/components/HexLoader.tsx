/**
 * The loading mark, as drawn by the secretariat: the event's D in the middle,
 * with a ring of eight outlined hexagons around it (three above, one each
 * side, three below) that light up one after another. Pure CSS animation of
 * opacity only, so it stays smooth on a phone. The D comes from the
 * --brand-mark CSS variable the root layout sets. See .hex-* in globals.css.
 */

/** Pointy-top hexagons of radius 10, clockwise from the top left. */
const RING: [number, number][] = [
  [-17.32, -18],
  [0, -18],
  [17.32, -18],
  [27, 0],
  [17.32, 18],
  [0, 18],
  [-17.32, 18],
  [-27, 0],
];

function hexPoints(cx: number, cy: number, r = 9): string {
  const w = r * 0.866;
  const corners: [number, number][] = [
    [cx, cy - r],
    [cx + w, cy - r / 2],
    [cx + w, cy + r / 2],
    [cx, cy + r],
    [cx - w, cy + r / 2],
    [cx - w, cy - r / 2],
  ];
  return corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/** The ring and the D, without any words: also used in the big screen wipe. */
export function HexEmblem({ className = '' }: { className?: string }) {
  return (
    <span className={`hex-emblem ${className}`} aria-hidden="true">
      <svg viewBox="-37 -28 74 56" className="hex-emblem-ring">
        {RING.map(([x, y], i) => (
          <polygon
            key={i}
            points={hexPoints(x, y)}
            className="hex-cell-ring"
            style={{ '--i': i } as React.CSSProperties}
          />
        ))}
      </svg>
      <span className="hex-mark" />
    </span>
  );
}

export function HexLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`hex-loader flex flex-col items-center gap-4 ${className}`}>
      <HexEmblem className="hex-emblem-loader" />
      <p className="hex-label text-base font-semibold tracking-wide text-ink">
        {label ?? 'Loading'}
        <span aria-hidden="true" className="hex-dots" />
      </p>
    </div>
  );
}
