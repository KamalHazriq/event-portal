'use client';

import { useState } from 'react';

/** Longest side of a gift photo once shrunk: sharp on a desk screen, small to store. */
const LONGEST = 640;
/** Kept small, so several new photos still fit in one save (the form limit is 1 MB). */
const MAX_CHARS = 280_000;

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  // A white backing, so a transparent PNG does not turn black as a JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.6]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.5);
}

/**
 * The picture of one gift on the Door gifts page: what it is now, and a
 * button to choose a photo from the phone or laptop. The photo is shrunk
 * here, then saved with the form.
 */
export function GiftPhotoInput({
  name,
  current,
  label,
}: {
  /** The form field the shrunk photo goes in, such as g0.upload. */
  name: string;
  current: string;
  label: string;
}) {
  const [preview, setPreview] = useState(current);
  const [data, setData] = useState('');
  const [problem, setProblem] = useState('');

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="size-16 shrink-0 rounded-lg border border-line bg-white object-contain"
        />
      ) : (
        <span className="size-16 shrink-0 rounded-lg border border-dashed border-line" />
      )}
      <div className="min-w-0 text-sm">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 font-semibold text-ink hover:border-primary">
          {data ? 'Choose another photo' : 'Upload a photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            className="sr-only"
            aria-label={`Photo of ${label}`}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setProblem('');
              try {
                const shrunk = await shrink(file);
                setData(shrunk);
                setPreview(shrunk);
              } catch {
                setProblem('That photo could not be read. Try a JPEG or PNG.');
              }
            }}
          />
        </label>
        <input type="hidden" name={name} value={data} />
        <p className="mt-1 text-xs text-ink-soft">
          {data ? 'New photo ready. Press Save to keep it.' : 'A square photo on white looks best.'}
        </p>
        {problem ? (
          <p role="alert" className="text-xs font-semibold text-warning">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}
