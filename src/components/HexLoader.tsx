/**
 * The loading mark: the event's logo in the middle, with six hexagons around
 * it lighting up one after another. Pure CSS: only opacity and scale change,
 * so it stays smooth on a phone. The logo comes from the --brand-mark CSS
 * variable the root layout sets. See .hex-* in globals.css.
 */
const RING: [number, number][] = [
  [2.2, 0],
  [1.1, 1.9],
  [-1.1, 1.9],
  [-2.2, 0],
  [-1.1, -1.9],
  [1.1, -1.9],
];

export function HexLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`hex-loader flex flex-col items-center gap-5 ${className}`}>
      <div className="hex-cluster" aria-hidden="true">
        {RING.map(([x, y], i) => (
          <span
            key={i}
            className="hex hex-ring"
            style={{ '--x': x, '--y': y, '--i': i } as React.CSSProperties}
          />
        ))}
        <span className="hex-mark" />
      </div>
      <p className="hex-label text-base font-semibold tracking-wide text-ink">
        {label ?? 'Loading'}
        <span aria-hidden="true" className="hex-dots" />
      </p>
    </div>
  );
}
