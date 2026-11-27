import { testModeOn } from '@/modules/test-mode/server';
import Link from 'next/link';
import { testClockMoment } from '@/lib/test-clock-server';
import { clearTestClock } from '@/modules/checklist/actions';

/**
 * On every secretariat page while this device has the test clock on, so it is
 * never forgotten: what it is pretending, and one button to turn it off.
 * (The secretariat pages themselves keep the real time.)
 */
export async function AdminClockBar() {
  const moment = await testClockMoment();
  const testMode = await testModeOn();
  const modeBar = testMode ? (
    // One slim line, so it never pushes the page's own controls down on a phone.
    <p className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-muted px-3 text-sm text-ink-soft print:hidden">
      <span className="min-w-0 truncate">
        <strong className="text-ink">Test mode is on.</strong>
        <span className="hidden sm:inline">
          {' '}
          The test tools are showing. Switch it off before the event.
        </span>
      </span>
      <Link
        href="/admin/admins#test-mode"
        className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary"
      >
        Test mode settings
      </Link>
    </p>
  ) : null;
  if (!moment) return modeBar;
  return (
    <>
      {modeBar}
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
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-warning px-4 font-bold text-canvas"
          >
            Turn the test clock off
          </button>
        </form>
      </div>
    </>
  );
}
