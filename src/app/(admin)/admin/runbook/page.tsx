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

/**
 * One printable page for the secretariat: the morning checklist, who does
 * what, a session by session plan for each day worked out from the agenda,
 * and what to do when something goes wrong.
 */
export default async function RunbookPage() {
  await requireAdmin('/admin/runbook');
  const config = getEventConfig();
  const { features } = config;
  const code = eventPass();
  const address = displayUrl(config.event.portalUrl);

  const surprise = config.surprise?.enabled ? config.surprise.targetAt : null;
  const lastDayId = config.days[config.days.length - 1]?.id;

  const h2 = 'mt-8 text-lg font-bold text-ink print:mt-5 print:break-after-avoid';
  const box = 'mt-3 rounded-xl border border-line bg-surface p-4 print:break-inside-avoid';

  return (
    <article className="max-w-4xl text-ink">
      {/* A div, not a header: the print styles hide headers (site chrome). */}
      <div>
        <p className="eyebrow">Secretariat</p>
        <h1 className="mt-1 text-2xl font-bold">Event-day runbook</h1>
        <p className="mt-1 text-ink-soft">
          {config.event.name}, {config.event.venue}. Print it with Ctrl and P, one copy per desk.
          The plan below follows the agenda in the config, so it stays right when the agenda
          changes.
        </p>
      </div>

      <section aria-labelledby="morning">
        <h2 id="morning" className={h2}>
          Every morning, before doors open
        </h2>
        <ol className={`${box} list-decimal space-y-2 pl-9`}>
          <li>
            <strong>Projector laptop:</strong> open <code>{address}/screen</code>, sign in as{' '}
            <code>screen</code>, press F11 for full screen. It follows the view chosen on the Big
            screen page.
          </li>
          {features.checkIn ? (
            <li>
              <strong>Desk phones or laptops:</strong> sign in at <code>/admin</code> as{' '}
              <code>desk-1</code>, <code>desk-2</code> and so on, then open Desk. Test one business
              card scan and one name search.
            </li>
          ) : null}
          <li>
            <strong>MC phone:</strong> sign in as <code>mc</code>, keep Live and Big screen open.
          </li>
          <li>
            A sign in lasts until the end of the event, so each device signs in once. If a phone
            with the console is lost, change the admin PIN (the portal-admin-pin secret): every
            device is signed out at once.
          </li>
          <li>
            <strong>Event code</strong> for anyone whose camera will not scan:{' '}
            {code ? (
              <strong className="font-mono tracking-widest">{code}</strong>
            ) : (
              <em>not set on this copy</em>
            )}
            . It is on the QR assets page too.
          </li>
          <li>
            Open the portal on the hotel Wi-Fi and on mobile data, on one phone each, and check the
            agenda loads.
          </li>
          <li>
            Day 1 only: run the dress rehearsal (docs/DEPLOYING.md) and check the dashboard&apos;s
            Storage card says ready.
          </li>
        </ol>
      </section>

      <section aria-labelledby="roles">
        <h2 id="roles" className={h2}>
          Who does what
        </h2>
        <div className={box}>
          <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <dt className="font-bold">MC / live control</dt>
            <dd>Live page, Big screen page, countdown, lucky draw.</dd>
            {features.checkIn ? (
              <>
                <dt className="font-bold">Registration desks</dt>
                <dd>
                  Desk page. Scan the business card in the TNB app; if it will not scan, search by
                  name. A wrong check in is undone on Headcount.
                </dd>
              </>
            ) : null}
            <dt className="font-bold">Moderator</dt>
            <dd>
              {[
                features.comments ? 'approve comments' : null,
                features.photoWall ? 'approve photos' : null,
                features.qa ? 'the backup Q&A if Slido fails' : null,
              ]
                .filter(Boolean)
                .join(', ')}
              . Check every 15 minutes or so.
            </dd>
            <dt className="font-bold">Everyone</dt>
            <dd>Never share the admin PIN outside the secretariat.</dd>
          </dl>
        </div>
      </section>

      {config.days.map((day) => {
        const plan = planDay(
          day.sessions.map((s) => ({
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
            className="print:break-before-page"
          >
            <h2 id={`plan-${day.id}`} className={h2}>
              {day.label}, {formatLongDate(day.date, config.event.timezone)}
            </h2>
            <ol className="mt-3 space-y-2">
              {plan.map((step) => (
                <li
                  key={step.sessionId}
                  className="grid gap-x-4 gap-y-1 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[7.5rem_1fr_11rem] print:break-inside-avoid"
                >
                  <span className="font-mono text-sm font-semibold tabular-nums">{step.time}</span>
                  <span>
                    <span className="block font-semibold">{step.title}</span>
                    {step.actions.length > 0 ? (
                      <span className="block text-sm text-ink-soft">
                        {step.actions.join('. ')}.
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold sm:text-right">
                    {step.view ? `Screen: ${SCREEN_VIEW_INFO[step.view].title}` : 'Slides'}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section aria-labelledby="trouble" className="print:break-before-page">
        <h2 id="trouble" className={h2}>
          If something goes wrong
        </h2>
        <dl className={`${box} space-y-3`}>
          <div>
            <dt className="font-bold">The hotel Wi-Fi drops</dt>
            <dd>
              Phones carry on over mobile data; the portal is on the internet, not the hotel
              network. The projector keeps its last view: reconnect the laptop and it catches up by
              itself within seconds.
            </dd>
          </div>
          <div>
            <dt className="font-bold">A business card will not scan</dt>
            <dd>
              Screen brightness up and closer to the camera; otherwise search by name on the Desk
              page. Nobody waits more than a few seconds.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Someone is not on the list</dt>
            <dd>
              Add them on the Attendees page (or note them on paper), then check them in by name.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Someone cannot open the portal</dt>
            <dd>
              They need the event code: scan a table tent or the welcome slide, or type the code
              above on the page that asks for it.
            </dd>
          </div>
          {features.qa || features.polls ? (
            <div>
              <dt className="font-bold">Slido is down</dt>
              <dd>
                Polls page: &quot;Slido is down, switch to the portal&quot;. Session pages then show
                the portal&apos;s own Q&amp;A and polls. Switch back the same way.
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-bold">The portal is slow or will not load</dt>
            <dd>
              Check the dashboard Storage card. In the Firebase console, App Hosting shows whether
              the latest rollout is healthy; roll back to the previous one if a new one broke
              something.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Something wrong is on the big screen</dt>
            <dd>
              Big screen page: pick Welcome. To stop reactions floating up, Comments page:
              &quot;Reactions on the big screen&quot;. Hide a comment or photo from its page.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="after">
        <h2 id="after" className={h2}>
          After the event
        </h2>
        <ol className={`${box} list-decimal space-y-2 pl-9`}>
          <li>Reports page: download the Excel report, and upload the Slido export into it.</li>
          {features.photoWall ? <li>Photos page: download the approved photos as a zip.</li> : null}
          <li>
            Change the event code (the portal-event-pass secret) so the portal closes to everyone.
          </li>
          <li>
            When the reports are safe, delete the Neon project and the Firebase backend. See{' '}
            <Link href="/guide">the guide</Link> for what each page did.
          </li>
        </ol>
      </section>
    </article>
  );
}
