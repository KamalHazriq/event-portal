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
import {
  addTestParticipant,
  clearTestData,
  removeTestParticipant,
} from '@/modules/checklist/actions';
import { TestClock } from '@/modules/checklist/components/TestClock';
import { TEST_STAFF_NO } from '@/modules/checklist/test-participant';
import { buildAgenda } from '@/modules/schedule/logic';
import { timeOverrideAllowed } from '@/lib/time';
import { TestPlan } from '@/modules/checklist/components/TestPlan';
import { TEST_PLAN } from '@/modules/checklist/steps';
import { FormPending } from '@/components/FormPending';

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
  const tester = await data.attendees.findByStaffNo(TEST_STAFF_NO);
  const agenda = buildAgenda(getEventConfig());
  const clockSessions = agenda.days.flatMap((d) =>
    d.sessions
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: s.id,
        title: s.title,
        dayLabel: d.label,
        date: d.date,
        start: s.start,
        end: s.end,
        feedback: s.feedbackEnabled,
      })),
  );
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
    testParticipant: tester !== null,
    testClock: timeOverrideAllowed(),
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

      <section
        id="tester"
        aria-labelledby="tester-h"
        className="scroll-mt-24 space-y-5 rounded-xl border border-line bg-surface p-4 print:hidden"
      >
        <div>
          <h2 id="tester-h" className="text-xl font-bold text-ink">
            Test as an attendee
          </h2>
          <p className="text-ink-soft">
            Two aids for testing before the event: a pretend attendee to sign in as, and a test
            clock that makes the portal think a session is on.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-ink">1. The test participant</h3>
          {params.tester === 'added' ? (
            <p role="status" className="font-semibold text-ink">
              Test Participant is on the list.
            </p>
          ) : params.tester === 'removed' ? (
            <p role="status" className="font-semibold text-ink">
              Test Participant is off the list, with their check ins and points.
            </p>
          ) : null}
          {tester ? (
            <>
              <p className="text-ink-soft">
                On a phone in a private window, open{' '}
                <a href="/me" target="_blank" rel="noopener">
                  My points
                </a>
                , type <strong className="text-ink">Test</strong>, tap Find me, then Test
                Participant. Check them in on the Desk (search Test) to see check in points. Points
                show on My points and the leaderboard.
              </p>
              <form action={removeTestParticipant}>
                <FormPending label="Removing" />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border-2 border-live px-4 font-semibold text-ink"
                >
                  Remove the test participant
                </button>
              </form>
            </>
          ) : (
            <form action={addTestParticipant}>
              <FormPending label="Adding" />
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
              >
                Add a test participant
              </button>
            </form>
          )}
        </div>

        <div id="test-clock" className="scroll-mt-24 space-y-2">
          <h3 className="font-bold text-ink">2. The test clock</h3>
          <p className="text-ink-soft">
            Reactions only open while a talk is on, and feedback after it ends. Pick a session and
            open the links: those tabs pretend it is that moment. Use them on the attendee phone,
            and open the big screen link on the laptop to see reactions float up.
          </p>
          <TestClock sessions={clockSessions} allowed={timeOverrideAllowed()} />
        </div>
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
          <FormPending label="Clearing" />
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
