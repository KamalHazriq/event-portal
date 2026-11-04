import type { SessionStatus } from '../logic';

const LABELS: Record<SessionStatus, string> = {
  live: 'Happening now',
  upcoming: 'Coming up',
  past: 'Finished',
};

/**
 * The status is never shown by colour alone: it always carries words too, so
 * it works for someone who cannot tell the colours apart.
 */
export function StatusBadge({ status }: { status: SessionStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
        <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-white" />
        {LABELS.live}
      </span>
    );
  }

  if (status === 'past') {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">
        {LABELS.past}
      </span>
    );
  }

  return null;
}

export function sessionStatusLabel(status: SessionStatus): string {
  return LABELS[status];
}
