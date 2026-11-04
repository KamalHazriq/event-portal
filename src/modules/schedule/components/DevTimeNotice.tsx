import type { EventNow } from '@/lib/time';
import { formatClock, formatLongDate } from '@/lib/time';

/**
 * A visible reminder that the portal is pretending about the time.
 *
 * Without this it is far too easy to stare at a wrong "happening now" and
 * think the logic is broken.
 */
export function DevTimeNotice({ now, timezone }: { now: EventNow; timezone: string }) {
  if (!now.isOverride) return null;

  const clock = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(
    now.minutes % 60,
  ).padStart(2, '0')}`;

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border-2 border-dashed border-warning bg-warning/10 p-3 text-sm"
    >
      <p className="font-bold text-ink">Test mode: pretending it is now</p>
      <p className="text-ink">
        {formatLongDate(now.date, timezone)}, {formatClock(clock)}
      </p>
      <p className="mt-1 text-ink-soft">
        Remove the <span className="font-mono">now</span> part of the web address, or clear
        DEV_FAKE_NOW in .env.local, to go back to the real time.
      </p>
    </div>
  );
}
