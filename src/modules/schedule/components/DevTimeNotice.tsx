import type { EventNow } from '@/lib/time';
import { formatClock, formatLongDate } from '@/lib/time';
import { testClockOn } from '@/lib/test-clock-server';
import { clearTestClock } from '@/modules/checklist/actions';

/**
 * A visible reminder that the portal is pretending about the time.
 *
 * Without this it is far too easy to stare at a wrong "happening now" and
 * think the logic is broken.
 */
export async function DevTimeNotice({ now, timezone }: { now: EventNow; timezone: string }) {
  if (!now.isOverride) return null;
  const onThisDevice = await testClockOn();

  const clock = `${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(
    now.minutes % 60,
  ).padStart(2, '0')}`;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed border-warning bg-warning/10 p-3 text-sm"
    >
      <div className="min-w-0">
        <p className="font-bold text-ink">Test clock: pretending it is now</p>
        <p className="text-ink">
          {formatLongDate(now.date, timezone)}, {formatClock(clock)}
        </p>
        <p className="mt-1 text-ink-soft">
          {onThisDevice
            ? 'Only this device pretends. Everyone else sees the real time.'
            : 'Remove the now part of the web address to go back to the real time.'}
        </p>
      </div>
      {onThisDevice ? (
        <form action={clearTestClock}>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-warning px-4 font-semibold text-ink"
          >
            Back to real time
          </button>
        </form>
      ) : null}
    </div>
  );
}
