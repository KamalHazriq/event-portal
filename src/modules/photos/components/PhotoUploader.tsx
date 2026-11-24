'use client';

import { useRef, useState } from 'react';

import { shrinkPhoto } from '../compress';
import { PHOTO_LIMITS } from '../logic';

type Sent = { url: string; caption: string; state: 'sent' | 'failed'; note?: string };

/**
 * One photo at a time: choose it, see it, add a caption if you like, then
 * press Share. Shrunk on the phone first, so it goes quickly on hotel Wi-Fi.
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [history, setHistory] = useState<Sent[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const choose = (picked: File | undefined) => {
    setProblem('');
    if (preview) URL.revokeObjectURL(preview);
    setFile(picked ?? null);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption('');
    if (input.current) input.current.value = '';
  };

  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    setProblem('');
    try {
      const { image, thumbnail } = await shrinkPhoto(file);
      const body = new FormData();
      body.set('image', image, 'photo.jpg');
      body.set('thumbnail', thumbnail, 'thumb.jpg');
      body.set('caption', caption);
      const response = await fetch('/api/photos', { method: 'POST', body });
      const result = (await response.json().catch(() => null)) as
        { ok: true; sent: number } | { ok: false; message: string } | null;
      if (result?.ok) {
        setSent(result.sent);
        setHistory((h) =>
          [{ url: URL.createObjectURL(thumbnail), caption, state: 'sent' as const }, ...h].slice(
            0,
            8,
          ),
        );
        if (preview) URL.revokeObjectURL(preview);
        reset();
      } else {
        setProblem(result?.message ?? 'It did not arrive. Try again.');
      }
    } catch {
      setProblem('This device could not read that photo. Try another one.');
    } finally {
      setBusy(false);
    }
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
        {!file ? (
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 font-bold text-on-primary">
            Choose or take a photo
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
        ) : (
          <>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="The photo you chose"
                className="max-h-80 w-full rounded-lg bg-canvas object-contain"
              />
            ) : null}
            <label className="block text-sm font-semibold text-ink">
              Caption (optional)
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
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void share()}
                disabled={busy}
                className="min-h-12 w-full rounded-lg bg-primary px-5 font-bold text-on-primary disabled:opacity-60"
              >
                {busy ? 'Sharing…' : 'Share this photo'}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="min-h-12 rounded-lg border border-line px-4 font-semibold text-ink disabled:opacity-60"
              >
                Choose a different one
              </button>
            </div>
          </>
        )}
        {problem ? (
          <p role="alert" className="text-sm font-semibold text-warning">
            {problem}
          </p>
        ) : null}
        <p className="text-sm text-ink-soft">
          By sharing a photo, you agree it may be shown on the big screen and kept by the organisers.
        </p>
      </div>

      {history.length > 0 ? (
        <ul aria-live="polite" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
