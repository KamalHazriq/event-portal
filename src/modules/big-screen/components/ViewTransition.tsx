'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A hexagon wipe between projector views. When the view changes, hexagons
 * grow from the centre until they cover the screen, the new view is put in
 * behind them, and they shrink away from the centre to reveal it. Only
 * transform changes, so it stays smooth. The cells exist only while the
 * wipe runs. See .hex-wipe in globals.css.
 */

/** How long the covering part runs before the view is swapped behind it. */
const COVER_MS = 680;
/** How long the revealing part runs before the cells are removed. */
const REVEAL_MS = 700;

const COLS = 10;
/** One hexagon in vw: width, height, and the vertical step between rows. */
const W = 100 / (COLS - 1);
const H = W * 1.1547;
const STEP = H * 0.75;
/** The longest wait, so the wave reaches the corners. */
const SPREAD_MS = 300;

type Cell = { left: number; top: number; delay: number };

/**
 * A honeycomb big enough for this screen, whatever its shape: enough rows
 * for its height (measured in vw, like the cells), plus one above and below.
 * Each cell waits by its distance from the centre.
 */
function buildCells(heightInVw: number): Cell[] {
  const rows = Math.ceil(heightInVw / STEP) + 3;
  const cells: Cell[] = [];
  const cx = 50;
  const cy = heightInVw / 2;
  let farthest = 1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < COLS + 1; col += 1) {
      const left = (col + (row % 2 ? 0.5 : 0) - 1) * W;
      const top = (row - 1) * STEP - H / 4;
      const dist = Math.hypot(left + W / 2 - cx, (top + H / 2 - cy) * 1.2);
      farthest = Math.max(farthest, dist);
      cells.push({ left, top, delay: dist });
    }
  }
  return cells.map((c) => ({ ...c, delay: Math.round((c.delay / farthest) * SPREAD_MS) }));
}

/** The screen's height in widths, without any scrollbar. */
function screenHeightInVw(): number {
  const width = document.documentElement.clientWidth || window.innerWidth || 1;
  const height = document.documentElement.clientHeight || window.innerHeight;
  return (height / width) * 100;
}

/**
 * One hexagon as a picture, in the event's own colours, read from the page.
 * A picture is far cheaper to scale around than a clipped shape.
 */
function hexPicture(): string {
  const style = getComputedStyle(document.getElementById('main') ?? document.body);
  const fill = style.getPropertyValue('--c-background').trim() || '#05101f';
  const line = style.getPropertyValue('--c-accent').trim() || '#26b6d4';
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 115.47'>` +
    `<polygon points='50,1.5 98.5,29.2 98.5,86.3 50,114 1.5,86.3 1.5,29.2' ` +
    `fill='${fill}' stroke='${line}' stroke-width='2.4'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function HexCells({ phase }: { phase: 'cover' | 'reveal' }) {
  const [picture] = useState(hexPicture);
  const [cells] = useState(() => buildCells(screenHeightInVw()));
  return (
    <div
      aria-hidden="true"
      className={`hex-wipe keep-motion pointer-events-none fixed inset-0 z-[60] overflow-hidden [container-type:size] ${
        phase === 'cover' ? 'hex-wipe-cover' : 'hex-wipe-reveal'
      }`}
      style={{ '--cw': `${W}cqw`, '--ch': `${H}cqw`, '--hex-img': picture } as React.CSSProperties}
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          className="hex-cell"
          style={{
            left: `${cell.left}cqw`,
            top: `${cell.top}cqw`,
            animationDelay: `${cell.delay}ms`,
          }}
        />
      ))}
      {/* The logo, in the middle of the honeycomb while it covers the screen. */}
      <span className="hex-wipe-logo" />
    </div>
  );
}

export function ViewTransition({
  viewKey,
  enabled = true,
  children,
}: {
  viewKey: string;
  /** Off in calm mode: the view just changes. */
  enabled?: boolean;
  children: React.ReactNode;
}) {
  // What is on screen: the old view until the cells cover it.
  const [shown, setShown] = useState({ key: viewKey, node: children });
  const [revealing, setRevealing] = useState(false);
  const latest = useRef(children);
  useEffect(() => {
    latest.current = children;
  });

  const covering = enabled && viewKey !== shown.key;

  useEffect(() => {
    if (!covering) return;
    const timer = window.setTimeout(() => {
      setShown({ key: viewKey, node: latest.current });
      setRevealing(true);
    }, COVER_MS);
    return () => window.clearTimeout(timer);
  }, [covering, viewKey]);

  useEffect(() => {
    if (!revealing) return;
    const timer = window.setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealing]);

  return (
    <>
      {/* The live view keeps updating while it is the one on screen. */}
      {covering ? shown.node : children}
      {enabled && (covering || revealing) ? (
        <HexCells phase={covering ? 'cover' : 'reveal'} />
      ) : null}
    </>
  );
}
