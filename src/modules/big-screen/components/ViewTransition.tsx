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
const ROWS = 9;
/** One hexagon in vw: width, height, and the vertical step between rows. */
const W = 100 / (COLS - 1);
const H = W * 1.1547;
const STEP = H * 0.75;
/** The longest wait, so the wave reaches the corners. */
const SPREAD_MS = 300;

type Cell = { left: number; top: number; delay: number };

/** Built once: cells in a honeycomb, each delayed by its distance from the centre. */
const CELLS: Cell[] = (() => {
  const cells: Cell[] = [];
  const cx = 50;
  const cy = (ROWS - 2) * STEP * 0.5;
  let farthest = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const left = (col + (row % 2 ? 0.5 : 0) - 0.5) * W;
      const top = (row - 1) * STEP;
      const dx = left + W / 2 - cx;
      const dy = top + H / 2 - cy;
      const dist = Math.hypot(dx, dy * 1.2);
      farthest = Math.max(farthest, dist);
      cells.push({ left, top, delay: dist });
    }
  }
  return cells.map((c) => ({ ...c, delay: Math.round((c.delay / farthest) * SPREAD_MS) }));
})();

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
  return (
    <div
      aria-hidden="true"
      className={`hex-wipe keep-motion pointer-events-none fixed inset-0 z-[60] overflow-hidden ${
        phase === 'cover' ? 'hex-wipe-cover' : 'hex-wipe-reveal'
      }`}
      style={{ '--cw': `${W}vw`, '--ch': `${H}vw`, '--hex-img': picture } as React.CSSProperties}
    >
      {CELLS.map((cell, i) => (
        <span
          key={i}
          className="hex-cell"
          style={{
            left: `${cell.left}vw`,
            top: `${cell.top}vw`,
            animationDelay: `${cell.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function ViewTransition({
  viewKey,
  children,
}: {
  viewKey: string;
  children: React.ReactNode;
}) {
  // What is on screen: the old view until the cells cover it.
  const [shown, setShown] = useState({ key: viewKey, node: children });
  const [revealing, setRevealing] = useState(false);
  const latest = useRef(children);
  useEffect(() => {
    latest.current = children;
  });

  const covering = viewKey !== shown.key;

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
      {covering || revealing ? <HexCells phase={covering ? 'cover' : 'reveal'} /> : null}
    </>
  );
}
