/**
 * "My agenda": the sessions someone starred, kept only in this phone's
 * browser storage. No sign in and nothing sent to the server, so nothing
 * personal is collected. If storage is blocked (a private window), starring
 * still works until the page is closed.
 */
export const FAVOURITES_KEY = 'portal.favourites';
export const FAVOURITES_EVENT = 'portal:favourites';

/** Reads the stored list, ignoring anything that is not a list of short ids. */
export function parseFavourites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(value.filter((v): v is string => typeof v === 'string' && v.length <= 80)),
    ].slice(0, 200);
  } catch {
    return [];
  }
}

export function toggleFavourite(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

let memory: string[] = [];

export function readFavourites(): string[] {
  try {
    return parseFavourites(window.localStorage.getItem(FAVOURITES_KEY));
  } catch {
    return memory;
  }
}

export function writeFavourites(list: string[]): void {
  memory = list;
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: keep it in memory for this visit.
  }
  window.dispatchEvent(new Event(FAVOURITES_EVENT));
}
