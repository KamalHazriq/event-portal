/**
 * A light "technology" backdrop for a projector view, in the event colours:
 * a grid floor drifting towards the room, circuit traces with pulses running
 * along them, and a slow scan line. Pure CSS and SVG, nothing to download,
 * and it stops for anyone who prefers reduced motion.
 */
export function TechBackdrop() {
  return (
    <div aria-hidden="true" className="tech-backdrop pointer-events-none absolute inset-0">
      <div className="tech-sky" />
      <div className="tech-floor" />
      <svg className="tech-traces" viewBox="0 0 1600 900" preserveAspectRatio="none">
        {TRACES.map((d, i) => (
          <g key={i}>
            <path d={d} className="tech-trace" />
            <path
              d={d}
              className="tech-pulse"
              style={{ animationDelay: `${i * 1.3}s`, animationDuration: `${5 + (i % 3)}s` }}
            />
          </g>
        ))}
        {NODES.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            className="tech-node"
            style={{ animationDelay: `${i * 0.7}s` }}
          />
        ))}
      </svg>
      <div className="tech-scan" />
    </div>
  );
}

/* Circuit-style lines hugging the edges, away from the content. */
const TRACES = [
  'M0 120 H180 L240 60 H520',
  'M1600 90 H1380 L1320 150 H1080',
  'M0 780 H260 L320 840 H700',
  'M1600 820 H1420 L1360 760 H1150 L1110 720',
  'M60 0 V220 L120 280 V420',
  'M1540 900 V700 L1480 640 V520',
];

const NODES: [number, number][] = [
  [520, 60],
  [1080, 150],
  [700, 840],
  [1110, 720],
  [120, 420],
  [1480, 520],
];
