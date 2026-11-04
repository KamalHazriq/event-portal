import type { SessionType } from '@/lib/event-schema';

import { sessionTypeLabel } from '../logic';

/** Breaks and meals are dimmed so the working sessions stand out in a list. */
const QUIET_TYPES: SessionType[] = ['break', 'meal', 'logistics'];

export function TypeBadge({ type }: { type: SessionType }) {
  const quiet = QUIET_TYPES.includes(type);
  return (
    <span
      className={[
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        // Tinted primary rather than the accent pair: the accent text token is
        // meant for use on a solid accent fill, and on a translucent one it
        // comes out nearly invisible in the dark theme.
        quiet ? 'bg-muted text-ink-soft' : 'bg-primary/10 text-primary',
      ].join(' ')}
    >
      {sessionTypeLabel(type)}
    </span>
  );
}
