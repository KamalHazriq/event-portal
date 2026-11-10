'use client';

import { useRef, useState } from 'react';

import { shrinkPhoto } from '../compress';
import { PHOTO_LIMITS } from '../logic';

type Item = {
  name: string;
  state: 'waiting' | 'shrinking' | 'sending' | 'sent' | 'failed';
  note?: string;
};

/**
 * Picks photos, shrinks each one on the phone, and sends them one at a time,
 * so a slow connection only ever has one photo in flight.
 */
export function PhotoUploader({ alreadySent }: { alreadySent: number }) {
  const [sent, setSent] = useState(alreadySent);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const left = Math.max(0, PHOTO_LIMITS.perDevice - sent);

  const update = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  const send = async (files: File[]) => {
    const batch = files.slice(0, left);
    if (batch.length === 0) return;
    setBusy(true);
    const start = items.length;
    setItems((prev) => [
      ...prev,
      ...batch.map((f) => ({ name: f.name, state: 'waiting' as const })),
    ]);

    for (let k = 0; k < batch.length; k += 1) {
      const i = start + k;
      try {
        update(i, { state: 'shrinking' });
        const { image, thumbnail } = await shrinkPhoto(batch[k] as File);
        update(i, { state: 'sending' });
        const body = new FormData();
        body.set('image', image, 'photo.jpg');
        body.set('thumbnail', thumbnail, 'thumb.jpg');
        body.set('caption', caption);
        const response = await fetch('/api/photos', { method: 'POST', body });
        const result = (await response.json().catch(() => null)) as
          { ok: true; sent: number } | { ok: false; message: string } | null;
        if (result?.ok) {
          setSent(result.sent);
          update(i, { state: 'sent' });
        } else {
          update(i, { state: 'failed', note: result?.message ?? 'It did not arrive. Try again.' });
          if (response.status === 429 || response.status === 403) break;
        }
      } catch {
        update(i, { state: 'failed', note: 'This phone could not read that photo.' });
      }
    }
    setBusy(false);
    setCaption('');
    if (input.current) input.current.value = '';
  };

  const label: Record<Item['state'], string> = {
    waiting: 'Waiting',
    shrinking: 'Shrinking',
    sending: 'Sending',
    sent: 'Sent, waiting for approval',
    failed: 'Not sent',
  };

  return (
    <div className="space-y-4">
      <p className="text-ink">
        <span className="text-2xl font-bold tabular-nums">{left}</span>{' '}
        {left === 1 ? 'photo' : 'photos'} left to share from this phone
      </p>

      {left > 0 ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <label className="block text-sm font-semibold text-ink">
            A caption for the next photos (optional)
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={PHOTO_LIMITS.maxCaption}
              placeholder="For example, our table at the gala"
              disabled={busy}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
          <label
            className={[
              'flex min-h-14 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 font-bold text-on-primary',
              busy ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            {busy ? 'Sending...' : 'Choose or take photos'}
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => void send(Array.from(e.target.files ?? []))}
            />
          </label>
          <p className="text-sm text-ink-soft">
            Each photo is shrunk on your phone before it is sent, and the location and camera
            details are removed. An organiser checks every photo before it goes on the big screen.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-4 text-ink">
          You have shared the most one phone can send. Thank you!
        </p>
      )}

      {items.length > 0 ? (
        <ul
          className="divide-y divide-line rounded-xl border border-line bg-surface"
          aria-live="polite"
        >
          {items.map((item, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="min-w-0 truncate text-sm text-ink">{item.name}</span>
              <span
                className={[
                  'text-sm font-semibold',
                  item.state === 'sent'
                    ? 'text-success'
                    : item.state === 'failed'
                      ? 'text-warning'
                      : 'text-ink-soft',
                ].join(' ')}
              >
                {label[item.state]}
                {item.note ? `: ${item.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
