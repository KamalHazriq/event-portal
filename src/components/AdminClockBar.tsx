import { testClockMoment } from '@/lib/test-clock-server';
import { clearTestClock } from '@/modules/checklist/actions';

/**
 * On every secretariat page while this device has the test clock on, so it is
 * never forgotten: what it is pretending, and one button to turn it off.
 * (The secretariat pages themselves keep the real time.)
 */
export async function AdminClockBar() {
  const moment = await testClockMoment();
  if (!moment) return null;
  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-warning bg-warning/10 p-3 text-sm print:hidden"
    >
      <p className="text-ink">
        <strong>Test clock is ON for this device</strong>: attendee pages here pretend it is{' '}
        <span className="font-mono">{moment.replace('T', ' ')}</span>. Secretariat pages keep the
        real time.
      </p>
      <form action={clearTestClock}>
        <input type="hidden" name="back" value="here" />
        <button type="submit" className="min-h-11 rounded-lg bg-warning px-4 font-bold text-canvas">
          Turn the test clock off
        </button>
      </form>
    </div>
  );
}
