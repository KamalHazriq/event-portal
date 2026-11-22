'use client';

import { useFormStatus } from 'react-dom';

import { HexLoader } from './HexLoader';

/**
 * The hexagon loader for a form whose action runs on the server (a Server
 * Action). Put it anywhere inside the form. It shows while the form is being
 * saved and goes away the moment the save is done, whether the page moves or
 * not, so it can never get stuck. It fades in after a beat, so a quick save
 * shows nothing at all.
 */
export function FormPending({ label = 'Saving' }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="hex-overlay fixed inset-0 z-[100] flex items-center justify-center bg-canvas/95">
      <HexLoader label={label} />
    </div>
  );
}
