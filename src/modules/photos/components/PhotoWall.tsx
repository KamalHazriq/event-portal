'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { gridShape, MOSAIC_MIN, NEW_PHOTO_MS, type PhotoLayout } from '../logic';
import { PhotoSlideshow } from './PhotoSlideshow';

type Slide = { id: string; caption: string };

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

  const showing = queue[0];
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
        <GridWall slides={slides} />
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
        className="absolute inset-0 h-full w-full object-cover"
      />
      {slide.caption ? (
        <figcaption
          className={`absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-[1vw] pt-[3vh] pb-[1vh] font-semibold text-white ${
            large ? 'text-[clamp(1rem,1.8vw,2.6rem)]' : 'text-[clamp(0.7rem,1vw,1.4rem)]'
          }`}
        >
          {slide.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** The newest twelve in even tiles, sized so a few photos fill the screen. */
function GridWall({ slides }: { slides: Slide[] }) {
  const shown = slides.slice(0, 12);
  const { columns, rows } = gridShape(shown.length);
  return (
    <div
      data-layout="grid"
      className="grid h-full gap-[0.8vw]"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {shown.map((s) => (
        <Tile key={s.id} slide={s} large={shown.length <= 4} />
      ))}
    </div>
  );
}

/** The newest photo large on the left, the next eight around it. */
function MosaicWall({ slides }: { slides: Slide[] }) {
  const [first, ...rest] = slides;
  return (
    <div data-layout="mosaic" className="grid h-full grid-cols-4 grid-rows-3 gap-[0.8vw]">
      {first ? (
        <div className="col-span-2 row-span-2 grid">
          <Tile slide={first} large />
        </div>
      ) : null}
      {rest.slice(0, 8).map((s) => (
        <Tile key={s.id} slide={s} />
      ))}
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
