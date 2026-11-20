/**
 * A small honeycomb of seven hexagons that light up one after another in a
 * ring. Pure CSS: only opacity and scale change, so it stays smooth on a
 * phone. Used on the loading overlay (FormLoader) and anywhere a wait needs
 * a face. See .hex-* in globals.css.
 */
const RING: [number, number][] = [
  [1.732, 0],
  [0.866, 1.5],
  [-0.866, 1.5],
  [-1.732, 0],
  [-0.866, -1.5],
  [0.866, -1.5],
];

export function HexLoader({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`hex-loader flex flex-col items-center gap-5 ${className}`}>
      <div className="hex-cluster" aria-hidden="true">
        <span className="hex hex-core" />
        {RING.map(([x, y], i) => (
          <span
            key={i}
            className="hex hex-ring"
            style={{ '--x': x, '--y': y, '--i': i } as React.CSSProperties}
          />
        ))}
      </div>
      <p className="hex-label text-base font-semibold tracking-wide text-ink">
        {label ?? 'Loading'}
        <span aria-hidden="true" className="hex-dots" />
      </p>
    </div>
  );
}
