'use client';

import { useRef, useState } from 'react';

import { shrinkPhoto } from '../compress';
import { PHOTO_LIMITS } from '../logic';

type Sent = { url: string; caption: string };
type Picked = { id: number; file: File; preview: string; caption: string };

const MAX_AT_ONCE = 3;

/**
 * Choose up to three photos, see them, write a caption for each (required),
 * then press Share. Shrunk on the phone first, so it goes quickly on hotel
 * Wi-Fi, and the hidden location details never leave the phone.
 */
export function PhotoUploader({
  alreadySent,
  moderated = true,
}: {
  alreadySent: number;
  /** False when the secretariat has switched approval off. */
  moderated?: boolean;
}) {
  const [sent, setSent] = useState(alreadySent);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [history, setHistory] = useState<Sent[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const choose = (files: FileList | null) => {
    setProblem('');
    if (!files) return;
    const room = MAX_AT_ONCE - picked.length;
    const next = [...files].slice(0, Math.max(0, room)).map((file) => ({
      id: ++counter.current,
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));
    if (files.length > room) setProblem(`Up to ${MAX_AT_ONCE} photos at a time.`);
    setPicked((p) => [...p, ...next]);
    if (input.current) input.current.value = '';
  };

  const remove = (id: number) => {
    setPicked((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.id !== id);
    });
  };

  const setCaption = (id: number, caption: string) =>
    setPicked((p) => p.map((x) => (x.id === id ? { ...x, caption } : x)));

  const missing = picked.filter((x) => x.caption.trim().length < 2).length;

  const share = async () => {
    if (picked.length === 0 || busy) return;
    if (missing > 0) {
      setProblem('Every photo needs a caption. Write a few words about each one.');
      return;
    }
    setBusy(true);
    setProblem('');
    const failed: Picked[] = [];
    let total = sent;
    for (const item of picked) {
      try {
        const { image, thumbnail } = await shrinkPhoto(item.file);
        const body = new FormData();
        body.set('image', image, 'photo.jpg');
        body.set('thumbnail', thumbnail, 'thumb.jpg');
        body.set('caption', item.caption.trim());
        const response = await fetch('/api/photos', { method: 'POST', body });
        const result = (await response.json().catch(() => null)) as
          { ok: true; sent: number } | { ok: false; message: string } | null;
        if (result?.ok) {
          total = result.sent;
          setHistory((h) =>
            [{ url: URL.createObjectURL(thumbnail), caption: item.caption.trim() }, ...h].slice(
              0,
              9,
            ),
          );
          URL.revokeObjectURL(item.preview);
        } else {
          failed.push(item);
          setProblem(result?.message ?? 'It did not arrive. Try again.');
        }
      } catch {
        failed.push(item);
        setProblem('This device could not read that photo. Try another one.');
      }
    }
    setSent(total);
    setPicked(failed);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {sent > 0 ? (
        <p className="text-ink">
          <span className="text-2xl font-bold tabular-nums">{sent}</span>{' '}
          {sent === 1 ? 'photo' : 'photos'} shared from this device. Thank you, keep them coming.
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        {picked.length < MAX_AT_ONCE ? (
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 font-bold text-on-primary">
            {picked.length === 0 ? 'Choose or take photos (up to 3)' : 'Add another photo'}
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => choose(e.target.files)}
            />
          </label>
        ) : null}

        {picked.map((item, i) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-line bg-canvas p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.preview}
              alt={`Photo ${i + 1} you chose`}
              className="max-h-64 w-full rounded-lg bg-canvas object-contain"
            />
            <label className="block text-sm font-semibold text-ink">
              Caption for photo {i + 1} (required)
              <input
                type="text"
                value={item.caption}
                onChange={(e) => setCaption(item.id, e.target.value)}
                maxLength={PHOTO_LIMITS.maxCaption}
                placeholder="For example, our table at the gala"
                disabled={busy}
                className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
              />
            </label>
            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={busy}
              className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink disabled:opacity-60"
            >
              Take this one out
            </button>
          </div>
        ))}

        {picked.length > 0 ? (
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy}
            className="min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary disabled:opacity-60"
          >
            {busy
              ? 'Sharing…'
              : picked.length === 1
                ? 'Share this photo'
                : `Share these ${picked.length} photos`}
          </button>
        ) : null}

        {problem ? (
          <p role="alert" className="text-sm font-semibold text-warning">
            {problem}
          </p>
        ) : null}
        <p className="text-sm text-ink-soft">
          By sharing a photo, you agree it may be shown on the big screen and kept by the
          organisers.
        </p>
      </div>

      {history.length > 0 ? (
        <ul aria-live="polite" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {history.map((item, i) => (
            <li key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption || 'Your photo'}
                className="aspect-square w-full object-cover"
              />
              <p className="truncate px-2 py-1 text-xs text-ink">
                <span className="font-semibold text-success">
                  {moderated ? 'Sent, waiting for approval' : 'On the wall'}
                </span>
                {item.caption ? ` · ${item.caption}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
