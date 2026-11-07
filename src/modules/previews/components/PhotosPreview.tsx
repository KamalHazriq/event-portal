'use client';

import { useState } from 'react';

import type { MockPhoto, MockPhotoStatus } from '../mock-data';

const FILTERS: { id: MockPhotoStatus; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

/**
 * Photo approval, working in this tab only. The tiles are coloured blocks,
 * not pictures, so the preview needs no image files and holds no faces.
 */
export function PhotosPreview({ photos }: { photos: MockPhoto[] }) {
  const [items, setItems] = useState(photos);
  const [filter, setFilter] = useState<MockPhotoStatus>('pending');

  const setStatus = (id: string, status: MockPhotoStatus) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));

  const approveAll = () =>
    setItems((prev) =>
      prev.map((p) => (p.status === 'pending' ? { ...p, status: 'approved' } : p)),
    );

  const shown = items.filter((p) => p.status === filter);
  const pending = items.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={[
              'min-h-11 rounded-lg border px-3 text-sm font-semibold',
              filter === f.id
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line bg-surface text-ink',
            ].join(' ')}
          >
            {f.label} ({items.filter((p) => p.status === f.id).length})
          </button>
        ))}
        {filter === 'pending' && pending > 0 ? (
          <button
            type="button"
            onClick={approveAll}
            className="ml-auto min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
          >
            Approve all {pending}
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">Nothing here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div
                aria-hidden="true"
                className="flex aspect-[4/3] items-end p-2"
                style={{
                  background: `linear-gradient(135deg, hsl(${p.hue} 55% 45%), hsl(${(p.hue + 50) % 360} 60% 30%))`,
                }}
              >
                <span className="rounded bg-black/40 px-1.5 text-xs text-white">{p.sizeKb} KB</span>
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {p.caption || 'No caption'}
                </p>
                <p className="text-xs text-ink-soft">
                  {p.device}, {p.minutesAgo} min ago
                </p>
                <div className="mt-2 flex gap-1">
                  {p.status !== 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(p.id, 'approved')}
                      className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-bold text-on-primary"
                    >
                      Approve
                    </button>
                  ) : null}
                  {p.status !== 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(p.id, 'rejected')}
                      className="min-h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink"
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
