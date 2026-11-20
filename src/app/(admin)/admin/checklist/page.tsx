import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/admin-guard';
import { clearTestData } from '@/modules/checklist/actions';
import { TestPlan } from '@/modules/checklist/components/TestPlan';
import { TEST_PLAN } from '@/modules/checklist/steps';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Test plan' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ChecklistPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/checklist');
  const params = await searchParams;

  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-ink">Test plan</h1>
        <p className="mt-2 text-lg text-ink-soft">
          Everything to check from the first login to the last report, once as an attendee and once
          as the secretariat. Tick each step as you go: the ticks are kept on this device only.
          Print it with Ctrl and P.
        </p>
      </header>

      <TestPlan parts={TEST_PLAN} />

      <section id="clean" aria-labelledby="clean-h" className="scroll-mt-24 print:hidden">
        <h2 id="clean-h" className="text-2xl font-bold text-ink">
          Clear test data
        </h2>
        <p className="mt-1 text-ink-soft">
          When all testing is done, wipe what the testing left behind, so the event starts clean.
        </p>

        {params.cleared ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink"
          >
            Cleared. The event starts from a clean slate.
          </p>
        ) : null}
        {params.error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink"
          >
            Type CLEAR to confirm.
          </p>
        ) : null}

        <form
          action={clearTestData}
          className="mt-3 space-y-4 rounded-xl border border-line bg-surface p-5"
        >
          <div>
            <p className="font-bold text-ink">This clears</p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              <li>every check in (all days)</li>
              <li>comments and their likes, reactions, photos, and feedback answers</li>
              <li>lucky draw winners, poll votes and questions</li>
              <li>which phones joined the leaderboard</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-ink">This keeps</p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              <li>the participant list</li>
              <li>your agenda and event edits, and every setting</li>
              <li>phones that turned on alerts</li>
            </ul>
          </div>
          <p className="font-semibold text-ink">
            It cannot be put back. Do not use it once the event has started.
          </p>
          <label className="block text-sm font-semibold text-ink">
            Type CLEAR to confirm
            <input
              name="confirm"
              autoComplete="off"
              className="mt-1 block min-h-11 w-48 rounded-lg border border-line bg-canvas px-3 text-ink"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-live px-5 font-bold text-white">
            Clear all test data
          </button>
        </form>
      </section>
    </div>
  );
}
