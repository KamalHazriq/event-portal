/**
 * A short-lived cache in front of the reads every page makes, so a hundred
 * phones opening the portal at once do not each ask the database the same
 * small questions.
 *
 *  - Settings: all of them in one query, reused for SETTINGS_TTL_MS.
 *  - The department list: reused for DEPARTMENTS_TTL_MS.
 *
 * A write through this server copy clears the cache straight away, so the
 * person who made a change sees it at once. Other server copies (there are
 * at most a few) catch up within the TTL, quicker than the screens poll.
 */
import type { DataAdapter } from './adapter';
import type { Setting } from './types';

export const SETTINGS_TTL_MS = 2_000;
export const DEPARTMENTS_TTL_MS = 10_000;

type Entry<T> = { value: Promise<T>; at: number };

type State = {
  settings: Entry<Map<string, Setting>> | null;
  departments: Entry<string[]> | null;
};

/**
 * Next.js loads this module more than once in one server (route handlers
 * and pages are bundled apart), so the cache lives on the process: a save
 * through the API clears it for the pages too.
 */
const SHARED = Symbol.for('event-portal.read-cache');

function sharedState(): State {
  const holder = globalThis as unknown as Record<symbol, State | undefined>;
  return (holder[SHARED] ??= { settings: null, departments: null });
}

export function withReadCache(
  inner: DataAdapter,
  now: () => number = () => Date.now(),
  state: State = sharedState(),
): DataAdapter {
  const allSettings = (): Promise<Map<string, Setting>> => {
    if (state.settings && now() - state.settings.at < SETTINGS_TTL_MS) return state.settings.value;
    const value = inner.settings.getAll().then((rows) => new Map(rows.map((r) => [r.key, r])));
    // A failed read is not kept, so the next request tries again.
    value.catch(() => {
      if (state.settings?.value === value) state.settings = null;
    });
    state.settings = { value, at: now() };
    return value;
  };

  const clearSettings = () => {
    state.settings = null;
  };
  const clearDepartments = () => {
    state.departments = null;
  };

  return {
    ...inner,
    settings: {
      ...inner.settings,
      async get(key) {
        return (await allSettings()).get(key)?.value ?? null;
      },
      async getAll() {
        return [...(await allSettings()).values()];
      },
      async set(key, value) {
        clearSettings();
        const saved = await inner.settings.set(key, value);
        clearSettings();
        return saved;
      },
      async remove(key) {
        clearSettings();
        const removed = await inner.settings.remove(key);
        clearSettings();
        return removed;
      },
    },
    attendees: {
      ...inner.attendees,
      departments() {
        if (state.departments && now() - state.departments.at < DEPARTMENTS_TTL_MS)
          return state.departments.value;
        const value = inner.attendees.departments();
        value.catch(() => {
          if (state.departments?.value === value) state.departments = null;
        });
        state.departments = { value, at: now() };
        return value;
      },
      async importRows(rows) {
        clearDepartments();
        const result = await inner.attendees.importRows(rows);
        clearDepartments();
        return result;
      },
      async removeAll() {
        clearDepartments();
        const n = await inner.attendees.removeAll();
        clearDepartments();
        return n;
      },
    },
    async reset() {
      clearSettings();
      clearDepartments();
      await inner.reset();
    },
  };
}
