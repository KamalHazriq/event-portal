/**
 * Approved photos kept in this server's memory for a few minutes, so a photo
 * a hundred phones look at is read from the database once, not a hundred
 * times. Phones are already allowed to keep a photo for the same five
 * minutes (the Cache-Control header), so nothing is shown any longer than
 * before. Rejecting or deleting a photo drops it here at once.
 *
 * Kept on globalThis, since the API route and the secretariat actions are
 * bundled apart but run in one process.
 */

export const IMAGE_TTL_MS = 5 * 60 * 1000;
/** About 300 thumbnails or 70 full photos: well inside the server's memory. */
export const IMAGE_CACHE_BYTES = 64 * 1024 * 1024;

type Entry = { bytes: Uint8Array; until: number };
type State = { map: Map<string, Entry>; bytes: number };

const SHARED = Symbol.for('event-portal.photo-cache');

function state(): State {
  const holder = globalThis as unknown as Record<symbol, State | undefined>;
  holder[SHARED] ??= { map: new Map(), bytes: 0 };
  return holder[SHARED];
}

const key = (id: string, size: 'full' | 'thumb') => `${id}:${size}`;

export function cachedImage(
  id: string,
  size: 'full' | 'thumb',
  now = Date.now(),
): Uint8Array | null {
  const s = state();
  const k = key(id, size);
  const hit = s.map.get(k);
  if (!hit) return null;
  if (hit.until <= now) {
    s.map.delete(k);
    s.bytes -= hit.bytes.byteLength;
    return null;
  }
  // Most recently used goes to the back, so the oldest is dropped first.
  s.map.delete(k);
  s.map.set(k, hit);
  return hit.bytes;
}

export function keepImage(
  id: string,
  size: 'full' | 'thumb',
  bytes: Uint8Array,
  now = Date.now(),
): void {
  if (bytes.byteLength > IMAGE_CACHE_BYTES / 8) return;
  const s = state();
  const k = key(id, size);
  const old = s.map.get(k);
  if (old) {
    s.map.delete(k);
    s.bytes -= old.bytes.byteLength;
  }
  s.map.set(k, { bytes, until: now + IMAGE_TTL_MS });
  s.bytes += bytes.byteLength;
  for (const [oldest, entry] of s.map) {
    if (s.bytes <= IMAGE_CACHE_BYTES) break;
    s.map.delete(oldest);
    s.bytes -= entry.bytes.byteLength;
  }
}

/** A photo rejected, deleted or sent back to waiting: never served from here again. */
export function forgetImages(ids?: string[]): void {
  const s = state();
  if (!ids) {
    s.map.clear();
    s.bytes = 0;
    return;
  }
  for (const id of ids) {
    for (const size of ['full', 'thumb'] as const) {
      const entry = s.map.get(key(id, size));
      if (entry) {
        s.map.delete(key(id, size));
        s.bytes -= entry.bytes.byteLength;
      }
    }
  }
}
