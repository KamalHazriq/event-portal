'use client';

import { useState } from 'react';

export type GiftRow = {
  id: string;
  name: string;
  department: string;
  item: string;
  by: string;
  collected: boolean;
};

type Filter = 'all' | 'waiting' | 'none';

/** Who got which gift, filtered as you type. Each change saves at once. */
export function DoorGiftTable({
  rows,
  items,
  setGift,
  toggleCollected,
}: {
  rows: GiftRow[];
  items: { id: string; name: string }[];
  setGift: (formData: FormData) => Promise<void>;
  toggleCollected: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (filter === 'all' ||
        (filter === 'none' && !r.item) ||
        (filter === 'waiting' && r.item && !r.collected)) &&
      (!q || `${r.name} ${r.department}`.toLowerCase().includes(q)),
  );
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const chip = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
        filter === value
          ? 'border-primary bg-primary text-on-primary'
          : 'border-line bg-surface text-ink hover:border-primary'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="gift-search" className="sr-only">
          Search people
        </label>
        <input
          id="gift-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name or department…"
          className="min-h-11 w-full flex-1 rounded-lg border border-line bg-canvas px-3 text-ink focus:border-primary focus:outline-none sm:min-w-72"
        />
        {chip('all', `Everyone (${rows.length})`)}
        {chip('waiting', `To collect (${rows.filter((r) => r.item && !r.collected).length})`)}
        {chip('none', `No gift yet (${rows.filter((r) => !r.item).length})`)}
      </div>
      <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-ink">{r.name}</span>{' '}
              <span className="text-sm text-ink-soft">{r.department}</span>
              {r.item && r.by !== 'spin' ? (
                <span className="block text-xs text-ink-soft">Set by {r.by}</span>
              ) : null}
            </span>
            <form action={setGift} className="flex items-center gap-2">
              <input type="hidden" name="attendeeId" value={r.id} />
              <label className="sr-only" htmlFor={`gift-${r.id}`}>
                Gift for {r.name}
              </label>
              <select
                id={`gift-${r.id}`}
                name="item"
                defaultValue={r.item}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="min-h-11 rounded-lg border border-line bg-canvas px-3 text-ink"
              >
                <option value="">No gift yet</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </form>
            {r.item ? (
              <form action={toggleCollected}>
                <input type="hidden" name="attendeeId" value={r.id} />
                <button
                  type="submit"
                  aria-pressed={r.collected}
                  aria-label={`${r.collected ? 'Collected' : 'Mark collected'}: ${nameOf(r.item)} for ${r.name}`}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                    r.collected
                      ? 'border-success bg-success/15 text-ink'
                      : 'border-line text-ink hover:border-primary'
                  }`}
                >
                  {r.collected ? '✓ Collected' : 'Mark collected'}
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="p-4 text-ink-soft">Nobody matches.</li> : null}
      </ul>
    </div>
  );
}
