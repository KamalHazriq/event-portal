import type { Metadata } from 'next';

import { headers } from 'next/headers';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getAdminPin } from '@/lib/auth';
import { weakEventCode, weakPin } from '@/lib/secret-strength';
import { getEventConfig } from '@/lib/config';
import { eventPass } from '@/lib/event-pass-server';
import { REMINDERS_KEY, REMINDERS_PING_KEY, parseReminders } from '@/modules/reminders/logic';
import { hostOf, readyItems } from '@/modules/readiness/logic';
import { checkInDays } from '@/modules/check-in/logic';
import { UndoAllButton } from '@/modules/check-in/components/UndoAllButton';
import { clearTestData } from '@/modules/checklist/actions';
import { TestPlan } from '@/modules/checklist/components/TestPlan';
import { TEST_PLAN } from '@/modules/checklist/steps';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Test plan' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ChecklistPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin('/admin/test-plan');
  const params = await searchParams;
  const data = getData();
  const [attendees, subs, remindersRaw, pingRaw] = await Promise.all([
    data.attendees.count(),
    data.push.list(),
    data.settings.get(REMINDERS_KEY),
    data.settings.get(REMINDERS_PING_KEY),
  ]);
  const ready = readyItems({
    attendees,
    pinLength: getAdminPin()?.length ?? 0,
    pinWeak: weakPin(getAdminPin() ?? ''),
    passSet: eventPass() !== null,
    passWeak: weakEventCode(eventPass() ?? ''),
    portalHost: hostOf(getEventConfig().event.portalUrl),
    requestHost: (await headers()).get('x-forwarded-host') ?? (await headers()).get('host'),
    teamPhones: subs.filter((p) => p.team).length,
    eventPhones: subs.length,
    remindersWaiting: parseReminders(remindersRaw).filter((r) => !r.sentAt).length,
    schedulerRecent:
      !!pingRaw && new Date().getTime() - new Date(pingRaw).getTime() < 3 * 60 * 1000,
  });

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

      <section
        aria-labelledby="ready-h"
        className="rounded-xl border border-line bg-surface p-4 print:hidden"
      >
        <h2 id="ready-h" className="text-xl font-bold text-ink">
          Ready check
        </h2>
        <p className="text-ink-soft">What the portal can check by itself, right now.</p>
        <ul className="mt-3 space-y-2">
          {ready.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span aria-hidden className={item.ok ? 'text-success' : 'text-warning'}>
                {item.ok ? '✓' : '!'}
              </span>
              <span className="text-ink">
                <span className="sr-only">{item.ok ? 'OK: ' : 'Needs attention: '}</span>
                {item.label}
                {item.ok ? null : <span className="block text-sm text-ink-soft">{item.fix}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

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

        <div className="mt-3">
          <UndoAllButton
            days={checkInDays(getEventConfig()).map((d) => ({ id: d.id, label: d.label }))}
            currentDayId={checkInDays(getEventConfig())[0]?.id ?? ''}
          />
        </div>

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
          <button type="submit" className="min-h-11 rounded-lg bg-live px-5 font-bold text-canvas">
            Clear all test data
          </button>
        </form>
      </section>
    </div>
  );
}
