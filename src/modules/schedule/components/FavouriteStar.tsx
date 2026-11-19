'use client';

import { useMemo, useSyncExternalStore } from 'react';

import {
  FAVOURITES_EVENT,
  parseFavourites,
  readFavourites,
  toggleFavourite,
  writeFavourites,
} from '../favourites';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(FAVOURITES_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(FAVOURITES_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The stored list as text, so React can compare snapshots cheaply. */
function snapshot(): string {
  return JSON.stringify(readFavourites());
}

/**
 * Keeps a component in step with the stored favourites, across tabs too.
 * The third value is false while rendering on the server, where there is no
 * storage to read.
 */
export function useFavourites(): [string[], (id: string) => void, boolean] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const list = useMemo(() => parseFavourites(raw), [raw]);
  const toggle = (id: string) => writeFavourites(toggleFavourite(readFavourites(), id));
  return [list, toggle, raw !== null];
}

/** The star on a session card. Sits beside the card's link, not inside it. */
export function FavouriteStar({ sessionId, title }: { sessionId: string; title: string }) {
  const [list, toggle] = useFavourites();
  const on = list.includes(sessionId);
  return (
    <button
      type="button"
      onClick={() => toggle(sessionId)}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from my agenda` : `Add ${title} to my agenda`}
      className={`grid size-11 place-items-center rounded-full text-xl leading-none ${
        on ? 'text-warning' : 'text-ink-soft hover:text-ink'
      }`}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}
