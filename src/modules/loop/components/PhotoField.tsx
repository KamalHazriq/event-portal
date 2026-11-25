'use client';

import { useState } from 'react';

/**
 * Choose a photo; it is shrunk here to a 640 px JPEG and carried in a hidden
 * field, so a big camera photo never goes over the wire.
 */
export function PhotoField({ label = 'Photo' }: { label?: string }) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState('');

  async function choose(file: File | undefined) {
    setProblem('');
    if (!file) {
      setValue('');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setValue(canvas.toDataURL('image/jpeg', 0.85));
    } catch {
      setProblem('That file could not be read as a photo.');
    }
  }

  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <input type="hidden" name="photo" value={value} />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => void choose(e.target.files?.[0])}
        className="mt-1 block w-full text-sm text-ink file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-line file:bg-canvas file:px-3 file:font-semibold file:text-ink"
      />
      {value ? <span className="mt-1 block text-xs text-success">Photo ready.</span> : null}
      {problem ? <span className="mt-1 block text-xs text-warning">{problem}</span> : null}
    </label>
  );
}
