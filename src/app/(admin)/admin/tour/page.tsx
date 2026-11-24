import type { Metadata } from 'next';
import Link from 'next/link';

import { QrCode } from '@/components/QrCode';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { displayUrl } from '@/lib/event-pass';
import { passLink } from '@/lib/event-pass-server';
import { testClockMoment, testClockOn } from '@/lib/test-clock-server';
import { timeOverrideAllowed } from '@/lib/time';
import { TEST_STAFF_NO } from '@/modules/checklist/test-participant';
import { buildAgenda } from '@/modules/schedule/logic';
import { tourAddTester, tourClockOff, tourSetClock } from '@/modules/tour/actions';
import { GuideBody } from '@/modules/tour/components/GuideBody';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tour' };

const BUTTON =
  'min-h-11 rounded-lg border border-line bg-surface px-4 font-semibold text-ink hover:border-primary';
const PRIMARY = 'min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary';
const LINK =
  'inline-flex min-h-9 items-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold text-primary no-underline hover:border-primary';

const plus = (clock: string, minutes: number): string => {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * The tour: one page to demo the whole portal from, top to bottom. What to
 * bring, two clicks of setup (a test person and a pretend time), then the
 * demo in the order the day happens, each step with a link and a line to say.
 * Below it, the reference tour: what each screen is and the questions the team
 * will ask.
 */
export default async function TourPage() {
  await requireAdmin('/admin/tour');
  const config = getEventConfig();
  const { features } = config;
  const data = getData();
  const tester = await data.attendees.findByStaffNo(TEST_STAFF_NO);
  const clockOn = await testClockOn();
  const clockMoment = clockOn ? await testClockMoment() : null;
  const canFakeTime = timeOverrideAllowed();

  const agenda = buildAgenda(config);
  const firstDay = agenda.days[0];
  const lastDay = agenda.days[agenda.days.length - 1];
  const talk = firstDay?.sessions.find((s) => s.type === 'talk' && !s.hidden);
  const lunch = firstDay?.sessions.find((s) => s.type === 'meal' && !s.hidden);
  const presets: { label: string; moment: string }[] = [];
  if (firstDay && talk) {
    presets.push({
      label: `A talk is on (${firstDay.label})`,
      moment: `${firstDay.date}T${plus(talk.start, 5)}`,
    });
  }
  if (firstDay && lunch) {
    presets.push({
      label: `Lunch (${firstDay.label})`,
      moment: `${firstDay.date}T${plus(lunch.start, 5)}`,
    });
  }
  if (lastDay) {
    const last = lastDay.sessions
      .filter((s) => !s.hidden)
      .map((s) => s.end)
      .sort()
      .at(-1);
    if (last) {
      presets.push({ label: 'The event is over', moment: `${lastDay.date}T${plus(last, 10)}` });
    }
  }

  const portal = config.event.portalUrl.replace(/\/$/, '');
  const address = displayUrl(config.event.portalUrl);

  const demo: {
    title: string;
    say: string;
    links: { href: string; label: string; on?: boolean }[];
  }[] = [
    {
      title: 'The attendee phone: scan, land on Home',
      say: 'Everyone scans one portal QR (on a table tent, a slide or the projector). No app, no login code. Home shows what is on now and what is next.',
      links: [
        { href: '/', label: 'Home (phone view)' },
        { href: '/agenda', label: 'Agenda' },
      ],
    },
    {
      title: 'Check in and the door gift spin',
      say: 'The desk scans the business card or finds the name. First check in brings up the mystery box: one spin, one gift, stock is tracked.',
      links: [
        { href: '/admin/desk', label: 'Desk', on: features.checkIn },
        { href: '/kiosk', label: 'Self check in kiosk', on: features.checkIn },
        { href: '/admin/door-gifts', label: 'Door gifts' },
      ],
    },
    {
      title: 'The big screen',
      say: 'The projector laptop stays on one page. The MC picks what it shows from a phone, and a suggestion card says what fits the time of day.',
      links: [
        { href: '/screen', label: 'Open the projector screen', on: features.bigScreen },
        { href: '/admin/big-screen', label: 'Big screen control', on: features.bigScreen },
        { href: '/admin/live', label: 'Live control' },
      ],
    },
    {
      title: 'During a talk: reactions, comments, questions, polls',
      say: 'Set the pretend time to "A talk is on". Tap a reaction on the phone and it floats up on the big screen. Comments carry the signed in name and can wait for approval or go straight up, as a list or as bubbles.',
      links: [
        { href: '/admin/comments', label: 'Comments', on: features.comments },
        { href: '/admin/qa', label: 'Questions', on: features.qa },
        { href: '/admin/polls', label: 'Polls (who voted what)', on: features.polls },
        { href: '/admin/insights', label: 'Insights' },
      ],
    },
    {
      title: 'Announcements and alerts',
      say: 'A short message shows at the top of every phone for the time you choose (10, 15, 30 minutes or 1 hour) and can buzz phones that turned alerts on. The alert log shows who received it.',
      links: [{ href: '/admin/announce', label: 'Announce' }],
    },
    {
      title: 'Breaks: photos, then the shows',
      say: 'Set the pretend time to lunch. The photo wall is the suggestion. Then the lucky draw, the name picker, and the podium reveal for the winners.',
      links: [
        { href: '/admin/photos', label: 'Photos', on: features.photoWall },
        { href: '/admin/lucky-draw', label: 'Lucky draw', on: features.luckyDraw },
        { href: '/admin/name-picker', label: 'Name picker' },
        { href: '/leaderboard', label: 'Leaderboard', on: features.leaderboard === true },
      ],
    },
    {
      title: 'Feedback, then the report',
      say: 'Set the pretend time to "The event is over": the banner appears on every page. Feedback results are live, and the report is one Excel file plus a one page PDF with the most liked comments and the leaderboard.',
      links: [
        { href: '/admin/feedback', label: 'Feedback results', on: features.feedback },
        { href: '/admin/reports', label: 'Reports' },
        { href: '/admin/reports/summary', label: 'PDF summary' },
      ],
    },
    {
      title: 'Reset for the real thing',
      say: 'Turn the pretend time off, then clear everything except the photos. The participant list and your settings stay.',
      links: [
        { href: '/admin/test-plan#clean', label: 'Clear everything except photos' },
        { href: '/admin/test-plan', label: 'Test plan' },
      ],
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Tour</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight text-ink">
          Demo the portal from this page
        </h1>
        <p className="mt-2 max-w-3xl text-ink-soft">
          Get ready in two clicks, then go down the page: each step has a link and what to say. For
          the full pass-fail check before the event, use the{' '}
          <Link href="/admin/test-plan" className="font-semibold text-primary">
            Test plan
          </Link>
          .
        </p>
      </header>

      <section aria-labelledby="bring">
        <h2 id="bring" className="text-xl font-bold text-ink">
          1. What to bring
        </h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          <li className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">Your laptop</p>
            <p className="text-sm font-semibold text-accent">This page, signed in</p>
            <p className="mt-2 text-sm text-ink-soft">
              Runs the demo and stands in for the MC. Keep this page open in one tab and open the
              links below in new tabs.
            </p>
          </li>
          <li className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">The projector</p>
            <p className="text-sm font-semibold text-accent">A second window, full screen</p>
            <p className="mt-2 text-sm text-ink-soft">
              Plug in the projector, open <code>{address}/screen</code> and drag the window onto it,
              then press F11. Click the screen once so the browser allows sound. No projector? The
              preview on Big screen control shows the same thing.
            </p>
            <p className="mt-3">
              <Link href="/screen" target="_blank" className={LINK}>
                Open the projector screen
              </Link>
            </p>
          </li>
          <li className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">One phone, as an attendee</p>
            <p className="text-sm font-semibold text-accent">Scan this, in a private tab</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="rounded-lg bg-white p-1.5">
                <QrCode
                  value={passLink(portal)}
                  label="QR code that opens the portal on a phone"
                  className="block size-28"
                />
              </div>
              <p className="text-sm text-ink-soft">
                Then on the phone, sign in as Test Participant (staff number {TEST_STAFF_NO}) on My
                points. A second phone or tablet is only needed to show the kiosk.
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section id="get-ready" aria-labelledby="ready" className="scroll-mt-24">
        <h2 id="ready" className="text-xl font-bold text-ink">
          2. Get ready
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">Someone to demo as</p>
            <p className="mt-1 text-sm text-ink-soft">
              {tester
                ? 'Test Participant is on the list.'
                : 'Add a test person so the phone has a name to sign in as.'}
            </p>
            {tester ? null : (
              <form action={tourAddTester} className="mt-3">
                <button type="submit" className={PRIMARY}>
                  Add the test participant
                </button>
              </form>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">
              Pretend time: {clockOn ? `ON (${clockMoment?.replace('T', ' ') ?? ''})` : 'OFF'}
            </p>
            {canFakeTime ? (
              <>
                <p className="mt-1 text-sm text-ink-soft">
                  Applies to this device only: Home, Agenda, sessions, the big screen preview and
                  the suggestion card.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <form key={p.label} action={tourSetClock}>
                      <input type="hidden" name="moment" value={p.moment} />
                      <button type="submit" className={BUTTON}>
                        {p.label}
                      </button>
                    </form>
                  ))}
                  {clockOn ? (
                    <form action={tourClockOff}>
                      <button type="submit" className={PRIMARY}>
                        Back to real time
                      </button>
                    </form>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">
                Pretend time is switched off on this server, so the demo runs on the real clock.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="demo">
        <h2 id="demo" className="text-xl font-bold text-ink">
          3. The demo, in the order of the day
        </h2>
        <ol className="mt-3 space-y-3">
          {demo.map((step, i) => {
            const links = step.links.filter((l) => l.on !== false);
            return (
              <li
                key={step.title}
                className="flex gap-4 rounded-xl border border-line bg-surface p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary font-mono font-bold text-primary"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    <strong className="font-semibold text-ink">Say: </strong>
                    {step.say}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    {links.map((l) => (
                      <Link key={l.href} href={l.href} target="_blank" className={LINK}>
                        {l.label}
                        <span aria-hidden="true" className="ml-1">
                          ↗
                        </span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </Link>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-xl font-bold text-ink">
          4. How it all fits together
        </h2>
        <div className="mt-3">
          <GuideBody />
        </div>
      </section>
    </div>
  );
}
