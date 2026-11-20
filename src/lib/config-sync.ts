/**
 * Keeps this server's copy of the saved edits (config-overlay.ts) up to
 * date with the database. Server only.
 *
 * Reading the config is synchronous all over the app, so the edits cannot be
 * fetched at the moment of use. Instead they are loaded when the server
 * starts (instrumentation.ts), re-checked at most every two seconds as pages
 * are served, and updated at once on the server that saves a change. Another
 * server copy sees a change within a few seconds.
 */
import { getData } from '@/data';

import { OVERLAY_KEY, overlayRaw, overlayState, setOverlayRaw } from './config-overlay';

const RECHECK_MS = 2_000;

export async function refreshConfigOverlay(force = false): Promise<void> {
  const state = overlayState();
  if (!force && Date.now() - state.checkedAt < RECHECK_MS) return;
  if (state.inflight) return state.inflight;

  state.inflight = (async () => {
    try {
      const raw = await getData().settings.get(OVERLAY_KEY);
      if (raw !== overlayRaw()) setOverlayRaw(raw);
      else state.checkedAt = Date.now();
    } catch {
      // The database is not reachable (or not set up yet): keep what we have,
      // and try again on the next request.
    } finally {
      state.inflight = null;
    }
  })();
  return state.inflight;
}

/** Stores the edits and uses them straight away on this server. */
export async function storeOverlay(raw: string | null): Promise<void> {
  const settings = getData().settings;
  if (raw === null) await settings.remove(OVERLAY_KEY);
  else await settings.set(OVERLAY_KEY, raw);
  setOverlayRaw(raw);
}
