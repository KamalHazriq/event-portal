'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  GRID_PAGE,
  gridShape,
  MOSAIC_MIN,
  MOSAIC_PAGE,
  NEW_PHOTO_MS,
  WALL_PAGE_MS,
  wallPage,
  type PhotoLayout,
} from '../logic';
import { PhotoSlideshow } from './PhotoSlideshow';

type Slide = { id: string; caption: string; width?: number; height?: number };

/**
 * The big screen photo wall, in the layout the secretariat picked. The screen
 * refreshes every few seconds; any photo not seen before pops up large for a
 * few seconds ("New on the wall"), then takes its place in the layout. What
 * is already on the wall when the screen opens does not pop up.
 */
export function PhotoWall({
  slides,
  layout,
  empty,
}: {
  slides: Slide[];
  layout: PhotoLayout;
  /** Shown while nothing is on the wall yet. Kept inside, so the first photo pops up too. */
  empty?: ReactNode;
}) {
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<Slide[]>([]);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(slides.map((s) => s.id));
      return;
    }
    const known = seen.current;
    // Oldest of the new ones first, so a burst plays in the order it was sent.
    const fresh = slides.filter((s) => !known.has(s.id)).reverse();
    if (fresh.length === 0) return;
    for (const s of fresh) known.add(s.id);
    setQueue((q) => [...q, ...fresh]);
  }, [slides]);

  // A new photo is loaded and decoded in the background first, and only then pops up, so
  // the room never watches a photo load. One that cannot load is skipped.
  const next = queue[0];
  const [readyId, setReadyId] = useState<string | null>(null);
  useEffect(() => {
    if (!next) return;
    let cancelled = false;
    const image = new Image();
    image.src = `/api/photos/${next.id}`;
    image
      .decode()
      .then(() => {
        if (!cancelled) setReadyId(next.id);
      })
      .catch(() => {
        if (!cancelled) setQueue((q) => q.slice(1));
      });
    return () => {
      cancelled = true;
    };
  }, [next]);

  const showing = next && readyId === next.id ? next : undefined;
  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => setQueue((q) => q.slice(1)), NEW_PHOTO_MS);
    return () => window.clearTimeout(timer);
  }, [showing]);

  return (
    <div className="relative h-full">
      {slides.length === 0 ? (
        empty
      ) : layout === 'slideshow' ? (
        <PhotoSlideshow slides={slides} />
      ) : layout === 'grid' ? (
        slides.length <= SCROLL_FROM ? (
          <GridWall slides={slides} />
        ) : (
          <ScrollingWall slides={slides} />
        )
      ) : slides.length < MOSAIC_MIN ? (
        <GridWall slides={slides} />
      ) : (
        <MosaicWall slides={slides} />
      )}
      {showing ? <NewPhoto key={showing.id} slide={showing} waiting={queue.length - 1} /> : null}
    </div>
  );
}

function Tile({ slide, large = false }: { slide: Slide; large?: boolean }) {
  return (
    <figure className="screen-fade relative min-h-0 overflow-hidden rounded-[0.8vw] bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${slide.id}${large ? '' : '?size=thumb'}`}
        alt={slide.caption || 'A photo from the event'}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {slide.caption ? (
        <figcaption
          className={`absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-[1vw] pt-[3vh] pb-[1vh] font-semibold text-white ${
            large ? 'text-[clamp(1rem,1.8vw,2.6rem)]' : 'text-[clamp(0.8rem,1.2vw,1.8rem)]'
          }`}
        >
          {slide.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Turns the page every few seconds while there are more photos than fit. */
function usePage<T>(items: T[], size: number) {
  const [tick, setTick] = useState(0);
  const many = items.length > size;
  useEffect(() => {
    if (!many) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), WALL_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [many]);
  return wallPage(items, size, tick);
}

function PageCount({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <p className="absolute right-[0.6vw] bottom-[0.6vw] z-10 rounded-full bg-black/60 px-[0.8vw] py-[0.3vh] text-[clamp(0.8rem,1.2vw,1.8rem)] tabular-nums text-white">
      {page + 1} / {pages}
    </p>
  );
}

/** Even tiles, a page of twelve at a time, sized so a few photos fill the screen. */
function GridWall({ slides }: { slides: Slide[] }) {
  const { items: shown, page, pages } = usePage(slides, GRID_PAGE);
  const { columns, rows } = gridShape(shown.length);
  return (
    <div
      data-layout="grid"
      className="relative grid h-full gap-[0.8vw]"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {shown.map((s) => (
        <Tile key={`${page}-${s.id}`} slide={s} large={shown.length <= 4} />
      ))}
      <PageCount page={page} pages={pages} />
    </div>
  );
}

/** Below this many photos the wall stands still in even tiles; above, it scrolls. */
const SCROLL_FROM = 8;
const COLUMNS = 4;

/**
 * Every photo in four columns drifting slowly down, each photo in its own
 * shape (no cropping). Each column holds its photos twice over and moves by
 * exactly one set, so the loop never jumps. Columns move at slightly
 * different speeds, which keeps it from looking like one sheet.
 */
function ScrollingWall({ slides }: { slides: Slide[] }) {
  const columns = Array.from({ length: COLUMNS }, (_, c) =>
    slides.filter((_, i) => i % COLUMNS === c),
  );
  return (
    <div
      data-layout="grid"
      className="keep-motion grid h-full grid-cols-4 gap-[0.8vw] overflow-hidden"
    >
      {columns.map((column, c) => {
        // Enough photos in a set to be taller than the screen.
        const repeat = Math.max(1, Math.ceil(5 / Math.max(1, column.length)));
        const set = Array.from({ length: repeat }).flatMap(() => column);
        const seconds = Math.max(40, set.length * 9) * (1 + c * 0.09);
        return (
          <div key={c} className="min-h-0 overflow-hidden">
            <div className="wall-column" style={{ animationDuration: `${seconds}s` }}>
              {[...set, ...set].map((slide, i) => (
                <WallPhoto key={`${i}-${slide.id}`} slide={slide} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WallPhoto({ slide }: { slide: Slide }) {
  const ratio = slide.width && slide.height ? `${slide.width} / ${slide.height}` : '4 / 3';
  return (
    <figure
      className="relative mb-[0.8vw] overflow-hidden rounded-[0.8vw] bg-surface"
      style={{ aspectRatio: ratio }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${slide.id}?size=thumb`}
        alt={slide.caption || 'A photo from the event'}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {slide.caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-[1vw] pt-[3vh] pb-[1vh] text-[clamp(0.8rem,1.2vw,1.8rem)] font-semibold text-white">
          {slide.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** One photo large on the left, eight around it, a page at a time. */
function MosaicWall({ slides }: { slides: Slide[] }) {
  const { items, page, pages } = usePage(slides, MOSAIC_PAGE);
  const [first, ...rest] = items;
  return (
    <div data-layout="mosaic" className="relative grid h-full grid-cols-4 grid-rows-3 gap-[0.8vw]">
      {first ? (
        <div className="col-span-2 row-span-2 grid">
          <Tile key={`${page}-${first.id}`} slide={first} large />
        </div>
      ) : null}
      {rest.map((s) => (
        <Tile key={`${page}-${s.id}`} slide={s} />
      ))}
      <PageCount page={page} pages={pages} />
    </div>
  );
}

function NewPhoto({ slide, waiting }: { slide: Slide; waiting: number }) {
  return (
    <div
      role="status"
      aria-label="New photo on the wall"
      className="screen-fade absolute inset-0 z-10 flex flex-col items-center justify-center gap-[2vh] rounded-[1vw] bg-bg/90 p-[2vw] backdrop-blur-sm"
    >
      <p className="rounded-full bg-primary px-[1.4vw] py-[0.6vh] text-[clamp(0.9rem,1.6vw,2.2rem)] font-bold tracking-wide text-on-primary uppercase">
        New on the wall
      </p>
      <div className="relative min-h-0 w-full flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${slide.id}`}
          alt={slide.caption || 'A new photo from the event'}
          className="photo-pop absolute inset-0 m-auto max-h-full max-w-full rounded-[1vw] object-contain shadow-2xl ring-[0.4vw] ring-primary"
        />
      </div>
      <p className="max-w-full truncate text-[clamp(1.1rem,2.4vw,3.2rem)] font-bold text-ink">
        {slide.caption || ' '}
      </p>
      {waiting > 0 ? (
        <p className="text-[clamp(0.8rem,1.2vw,1.8rem)] text-ink-soft">{waiting} more coming up</p>
      ) : null}
    </div>
  );
}
