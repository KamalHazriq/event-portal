import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { displayUrl } from '@/lib/event-pass';
import { eventPass } from '@/lib/event-pass-server';
import { formatLongDate } from '@/lib/time';
import { SCREEN_VIEW_INFO } from '@/modules/big-screen/logic';
import { planDay } from '@/modules/runbook/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Event-day runbook' };

/** A section heading with a bar, so the page has clear landmarks. */
function Heading({ id, children, hint }: { id: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 print:mb-2">
      <h2
        id={id}
        className="flex items-center gap-3 text-2xl font-bold text-ink print:break-after-avoid"
      >
        <span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-primary print:bg-black" />
        {children}
      </h2>
      {hint ? <p className="mt-1 pl-[1.125rem] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** A numbered step: a big number, a bold first line, and the detail under it. */
function Steps({ steps }: { steps: { title: React.ReactNode; body?: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li
          key={i}
          className="flex gap-4 rounded-xl border border-line bg-surface p-4 print:break-inside-avoid"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-on-primary print:border print:border-black print:bg-white print:text-black"
          >
            {i + 1}
          </span>
          <div className="min-w-0 text-base leading-relaxed">
            <p className="font-bold text-ink">{step.title}</p>
            {step.body ? <p className="mt-0.5 text-ink-soft">{step.body}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * One printable page for the secretariat: the key facts, the morning
 * checklist, who does what, a session by session plan for each day worked
 * out from the agenda, and what to do when something goes wrong.
 */
export default async function RunbookPage() {
  await requireAdmin('/admin/runbook');
  const config = getEventConfig();
  const { features } = config;
  const code = eventPass();
  const address = displayUrl(config.event.portalUrl);

  const surprise = config.surprise?.enabled ? config.surprise.targetAt : null;
  const lastDayId = config.days[config.days.length - 1]?.id;

  const moderation = [
    features.comments ? 'approve comments' : null,
    features.photoWall ? 'approve photos' : null,
    features.qa ? 'the backup Q&A if Slido fails' : null,
  ].filter(Boolean);

  const morning = [
    {
      title: 'Projector laptop',
      body: (
        <>
          Open <code>{address}/screen</code> (or the installed Big screen app), sign in as{' '}
          <code>screen</code>, press F11 for full screen. It follows the view chosen on the Big
          screen page. If it stutters, switch on calm mode there.
        </>
      ),
    },
    ...(features.checkIn
      ? [
          {
            title: 'Desk phones or laptops',
            body: (
              <>
                Sign in at <code>/admin</code> as <code>desk-1</code>, <code>desk-2</code> and so
                on, then open On the day, then Desk. Test one business card scan and one name
                search. Keep the Desk page open all day: it keeps working if the Wi-Fi drops.
              </>
            ),
          },
        ]
      : []),
    {
      title: 'MC phone',
      body: (
        <>
          Sign in as <code>mc</code>, keep Live and Big screen open.
        </>
      ),
    },
    {
      title: 'Open the Test plan',
      body: 'Set up, then Test plan: every line of the Ready check should have a tick.',
    },
    {
      title: 'Check the Wi-Fi and the mobile data',
      body: 'Open the portal on one phone on the hotel Wi-Fi and one on mobile data, and check the agenda loads.',
    },
    {
      title: 'Day 1 only: the dress rehearsal',
      body: 'Run it (docs/DEPLOYING.md) and check the dashboard Storage card says ready.',
    },
  ];

  const roles = [
    {
      who: 'MC / live control',
      does: 'Live page and Stage control (countdown, lucky draw, cues).',
    },
    ...(features.checkIn
      ? [
          {
            who: 'Registration desks',
            does: 'Desk page. Scan the business card in the TNB app; if it will not scan, search by name or pick from the whole list. A wrong check in is undone on Headcount.',
          },
        ]
      : []),
    {
      who: 'Moderator',
      does: `${moderation.join(', ')}. Check every 15 minutes or so.`,
    },
    {
      who: 'Everyone',
      does: 'Never share the admin PIN outside the secretariat.',
    },
  ];

  const trouble = [
    {
      problem: 'The hotel Wi-Fi drops',
      fix: 'Phones carry on over mobile data; the portal is on the internet, not the hotel network. The projector keeps its last view: reconnect the laptop and it catches up within seconds.',
    },
    {
      problem: 'The Wi-Fi drops at the desk',
      fix: 'Keep scanning and checking in. An amber bar says how many check ins are saved on that device, and they go through by themselves when the connection is back (or press Send now). Do not reload the Desk page while offline. The big counter catches up afterwards.',
    },
    {
      problem: 'A business card will not scan',
      fix: 'Screen brightness up and closer to the camera; otherwise search by name or pick from the whole list on the Desk page. Nobody waits more than a few seconds.',
    },
    {
      problem: 'Someone is not on the list',
      fix: 'Add them on the Attendees page (or note them on paper), then check them in by name.',
    },
    {
      problem: 'Someone cannot open the portal',
      fix: 'They need the event code: scan a table tent or the welcome slide, or type the code above on the page that asks for it.',
    },
    ...(features.qa || features.polls
      ? [
          {
            problem: 'Slido is down',
            fix: 'Polls page: “Slido is down, switch to the portal”. Session pages then show the portal’s own Q&A and polls. Switch back the same way.',
          },
        ]
      : []),
    {
      problem: 'The portal is slow or will not load',
      fix: 'Check the dashboard Storage card. In the Firebase console, App Hosting shows whether the latest rollout is healthy; roll back to the previous one if a new one broke something.',
    },
    {
      problem: 'The big screen stutters',
      fix: 'Stage control, Effects: Calm mode turns off the moving background and the hexagon wipe. Close other programs on the laptop and keep it plugged in.',
    },
    {
      problem: 'Alerts are not arriving on a phone',
      fix: 'iPhone: the portal must be added to the Home Screen first, then opened from the icon. Android: allow notifications. On Announce, under Test your alerts, send a test to check.',
    },
    {
      problem: 'A phone was lost, or the PIN got out',
      fix: 'Admins page, Resets: Sign everyone out, then change the PIN (the portal-admin-pin secret) and roll out. Everyone signs in again with the new one.',
    },
    {
      problem: 'The self check in tablet is stuck or locked',
      fix: 'Open the Secretariat link at its foot (or /admin) and enter the PIN: that unlocks it. To use it again, open /kiosk?lock=1 from the Desk page.',
    },
    {
      problem: 'Something wrong is on the big screen',
      fix: 'Stage control: pick Welcome. To stop reactions floating up, Comments page: “Reactions on the big screen”. Hide a comment or photo from its page.',
    },
    {
      problem: 'A message for everyone, fast',
      fix: 'Announce page: type it and tick the notification box. It shows at the top of every phone and buzzes the phones with alerts on.',
    },
  ];

  return (
    <article className="max-w-4xl text-ink">
      {/* A div, not a header: the print styles hide headers (site chrome). */}
      <div>
        <p className="eyebrow">Secretariat</p>
        <h1 className="mt-1 text-3xl font-bold">Event-day runbook</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {config.event.name}, {config.event.venue}. Print it with Ctrl and P, one copy per desk.
          The plan follows the agenda, so it stays right when the agenda changes.
        </p>
      </div>

      {/* The three things people ask for most, big enough to read across a desk. */}
      <dl className="mt-6 grid gap-3 sm:grid-cols-3 print:break-inside-avoid">
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm font-semibold text-ink-soft">Portal address</dt>
          <dd className="mt-1 break-all font-mono text-sm font-semibold">{address}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm font-semibold text-ink-soft">Event code</dt>
          <dd className="mt-1 font-mono text-2xl font-bold tracking-widest">
            {code ?? <span className="text-base font-normal">not set on this copy</span>}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-sm font-semibold text-ink-soft">Secretariat sign in</dt>
          <dd className="mt-1 font-semibold">
            <code>/admin</code> with the PIN
            <span className="block text-sm font-normal text-ink-soft">
              Signed in until the event ends. Never share the PIN.
            </span>
          </dd>
        </div>
      </dl>

      <nav aria-label="Jump to" className="mt-6 flex flex-wrap gap-2 print:hidden">
        {[
          ['#morning', 'Morning'],
          ['#roles', 'Who does what'],
          ...config.days.map((d): [string, string] => [`#plan-${d.id}`, d.label]),
          ['#trouble', 'If something goes wrong'],
          ['#after', 'After'],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-primary"
          >
            {label}
          </a>
        ))}
      </nav>

      <section aria-labelledby="morning" className="mt-12 scroll-mt-24 print:mt-6">
        <Heading id="morning" hint="Before doors open, in this order.">
          Every morning
        </Heading>
        <Steps steps={morning} />
        <p className="mt-3 text-ink-soft">
          If a phone with the console is lost, change the admin PIN (the portal-admin-pin secret):
          every device is signed out at once.
        </p>
      </section>

      <section aria-labelledby="roles" className="mt-12 scroll-mt-24 print:mt-6">
        <Heading id="roles">Who does what</Heading>
        <dl className="grid gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.who}
              className="rounded-xl border border-line bg-surface p-4 print:break-inside-avoid"
            >
              <dt className="text-lg font-bold">{role.who}</dt>
              <dd className="mt-1 text-ink-soft">{role.does}</dd>
            </div>
          ))}
        </dl>
      </section>

      {config.days.map((day) => {
        const plan = planDay(
          day.sessions
            .filter((s) => !s.hidden)
            .map((s) => ({
              id: s.id,
              title: s.title,
              type: s.type,
              start: s.start,
              end: s.end,
              qaEnabled: s.qaEnabled,
              feedbackEnabled: s.feedbackEnabled,
            })),
          features,
          {
            isLastDay: day.id === lastDayId,
            surpriseAt:
              surprise && surprise.startsWith(day.date) ? surprise.slice(11, 16) : undefined,
          },
        );
        return (
          <section
            key={day.id}
            aria-labelledby={`plan-${day.id}`}
            className="mt-12 scroll-mt-24 print:mt-0 print:break-before-page"
          >
            <Heading
              id={`plan-${day.id}`}
              hint="What the projector shows, and what to do, for each session."
            >
              {day.label}, {formatLongDate(day.date, config.event.timezone)}
            </Heading>
            <ol className="space-y-2">
              {plan.map((step) => (
                <li
                  key={step.sessionId}
                  className="grid gap-x-5 gap-y-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[9.5rem_1fr_auto] print:break-inside-avoid"
                >
                  <span className="whitespace-nowrap font-mono text-base font-bold tabular-nums">
                    {step.time}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-snug">{step.title}</p>
                    {step.actions.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
                        {step.actions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <span
                    className={`h-fit w-fit rounded-full px-3 py-1 text-sm font-bold ${
                      step.view
                        ? 'bg-primary/15 text-ink print:border print:border-black'
                        : 'border border-line text-ink-soft'
                    }`}
                  >
                    {step.view ? `Screen: ${SCREEN_VIEW_INFO[step.view].title}` : 'Slides'}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section
        aria-labelledby="trouble"
        className="mt-12 scroll-mt-24 print:mt-0 print:break-before-page"
      >
        <Heading id="trouble" hint="The problem in bold, what to do under it.">
          If something goes wrong
        </Heading>
        <dl className="grid gap-3 md:grid-cols-2">
          {trouble.map((item) => (
            <div
              key={item.problem}
              className="rounded-xl border border-line bg-surface p-4 print:break-inside-avoid"
            >
              <dt className="flex items-start gap-2 text-lg font-bold">
                <span aria-hidden="true" className="text-warning">
                  ⚠
                </span>
                {item.problem}
              </dt>
              <dd className="mt-1 text-ink-soft">{item.fix}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="after" className="mt-12 scroll-mt-24 print:mt-6">
        <Heading id="after">After the event</Heading>
        <Steps
          steps={[
            {
              title: 'Reports page',
              body: 'Download the Excel report, and upload the Slido export into it.',
            },
            ...(features.photoWall
              ? [{ title: 'Photos page', body: 'Download the approved photos as a zip.' }]
              : []),
            {
              title: 'Close the portal',
              body: 'Change the event code (the portal-event-pass secret) and the PIN so the portal closes to everyone.',
            },
            {
              title: 'Clean up',
              body: (
                <>
                  When the reports are safe, delete the Neon project and the Firebase backend. See{' '}
                  <Link href="/admin/tour">the tour</Link> for what each page did.
                </>
              ),
            },
          ]}
        />
      </section>
    </article>
  );
}
