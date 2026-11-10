'use client';

import { useFormStatus } from 'react-dom';

/** Says "Drawing" while the server works, so nobody presses it twice. */
export function DrawButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-11 rounded-lg bg-primary px-6 py-2 font-bold text-on-primary disabled:opacity-50"
    >
      {pending ? 'Drawing...' : 'Draw'}
    </button>
  );
}
