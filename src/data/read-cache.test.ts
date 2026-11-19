import { describe, expect, it, vi } from 'vitest';

import type { DataAdapter } from './adapter';
import { DEPARTMENTS_TTL_MS, SETTINGS_TTL_MS, withReadCache } from './read-cache';

function fakeAdapter() {
  const store = new Map<string, string>([['look.style', 'ruled']]);
  const getAll = vi.fn(async () =>
    [...store].map(([key, value]) => ({ key, value, updatedAt: '2026-12-14T00:00:00Z' })),
  );
  const departments = vi.fn(async () => ['CS', 'TNS']);
  const inner = {
    settings: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      getAll,
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return { key, value, updatedAt: '' };
      }),
      remove: vi.fn(async (key: string) => store.delete(key)),
    },
    attendees: {
      departments,
      importRows: vi.fn(async () => ({ created: 0, updated: 0, problems: [] })),
      removeAll: vi.fn(async () => 0),
    },
    reset: vi.fn(async () => undefined),
  } as unknown as DataAdapter;
  return { inner, getAll, departments };
}

describe('withReadCache', () => {
  it('answers many setting reads with one query, until it goes stale', async () => {
    let t = 0;
    const { inner, getAll } = fakeAdapter();
    const data = withReadCache(inner, () => t, { settings: null, departments: null });
    expect(await data.settings.get('look.style')).toBe('ruled');
    expect(await data.settings.get('missing')).toBeNull();
    await Promise.all([data.settings.get('a'), data.settings.get('b')]);
    expect(getAll).toHaveBeenCalledTimes(1);
    t += SETTINGS_TTL_MS;
    await data.settings.get('look.style');
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it('shows a change made here straight away', async () => {
    const { inner } = fakeAdapter();
    const data = withReadCache(inner, () => 0, { settings: null, departments: null });
    expect(await data.settings.get('look.style')).toBe('ruled');
    await data.settings.set('look.style', 'classic');
    expect(await data.settings.get('look.style')).toBe('classic');
    await data.settings.remove('look.style');
    expect(await data.settings.get('look.style')).toBeNull();
  });

  it('keeps the department list briefly, and drops it on a new upload', async () => {
    let t = 0;
    const { inner, departments } = fakeAdapter();
    const data = withReadCache(inner, () => t, { settings: null, departments: null });
    await data.attendees.departments();
    await data.attendees.departments();
    expect(departments).toHaveBeenCalledTimes(1);
    await data.attendees.importRows([]);
    await data.attendees.departments();
    expect(departments).toHaveBeenCalledTimes(2);
    t += DEPARTMENTS_TTL_MS;
    await data.attendees.departments();
    expect(departments).toHaveBeenCalledTimes(3);
  });

  it('does not keep a failed read', async () => {
    const { inner, getAll } = fakeAdapter();
    getAll.mockRejectedValueOnce(new Error('down'));
    const data = withReadCache(inner, () => 0, { settings: null, departments: null });
    await expect(data.settings.get('look.style')).rejects.toThrow('down');
    await Promise.resolve();
    expect(await data.settings.get('look.style')).toBe('ruled');
  });
});

describe('shared across copies of the module', () => {
  it('a write through one copy clears the cache for another', async () => {
    const { inner, getAll } = fakeAdapter();
    const state = { settings: null, departments: null };
    const pages = withReadCache(inner, () => 0, state);
    const api = withReadCache(inner, () => 0, state);
    expect(await pages.settings.get('look.style')).toBe('ruled');
    await api.settings.set('look.style', 'classic');
    expect(await pages.settings.get('look.style')).toBe('classic');
    expect(getAll).toHaveBeenCalledTimes(2);
  });
});
