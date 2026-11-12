import type { Metadata } from 'next';
import Link from 'next/link';

import { getEventConfig } from '@/lib/config';
import { logoFor, resolveTheme } from '@/lib/theme';
import { formatShortDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'How the portal works' };

/**
 * A one page tour of the portal, for walking the team through it.
 *
 * It explains the three kinds of screen, what happens on an event day, what
 * each secretariat page is for and who does what. Parts that are switched
 * off in config/event.json are left out, so the page always matches what is
 * actually running. It holds no personal data and nothing secret, so it can
 * be shared as a link.
 */
export default function GuidePage() {
  const config = getEventConfig();
  const { event, features } = config;
  const dates =
    event.startDate === event.endDate
      ? formatShortDate(event.startDate, event.timezone)
      : `${formatShortDate(event.startDate, event.timezone)} to ${formatShortDate(event.endDate, event.timezone)}`;

  const screens = [
    {
      who: 'Attendees',
      where: 'On their phones',
      what: 'The agenda, what is on now and next, each session with its speakers, the Slido link, feedback forms, take aways and photo sharing. Opened by scanning the QR on the back of the name tag.',
      href: '/',
      link: 'Open the attendee view',
      on: true,
    },
    {
      who: 'The room',
      where: 'On the ballroom projector',
      what: 'Full screen views with no buttons: a welcome with the portal QR, now and next, a live arrivals counter, the surprise countdown, the lucky draw and the photo slideshow.',
      href: '/screen/welcome',
      link: 'See a projector view',
      on: features.bigScreen,
    },
    {
      who: 'The secretariat',
      where: 'On a laptop or a phone, behind a PIN',
      what: 'Everything that runs the day: checking people in, the headcount, what the projector shows, feedback results, the lucky draw and the final report.',
      href: '/admin',
      link: 'Open the secretariat console',
      on: true,
    },
  ].filter((s) => s.on);

  const day = [
    {
      when: 'Before the event',
      title: 'Print and prepare',
      text: 'Print the name tags (a personal QR on the front, the portal QR on the back), the table tents, and drop the portal QR into the welcome slide.',
      links: [
        { href: '/admin/name-tags', label: 'Name tags', on: features.checkIn },
        { href: '/admin/qr-assets', label: 'QR assets', on: features.checkIn },
      ],
    },
    {
      when: 'Arrival',
      title: 'Scan people in',
      text: 'The desk scans the QR on each name tag, or the digital business card in the TNB app, or searches by name if neither is to hand. The projector can show a live "arrived" counter with a welcome card for each person.',
      links: [
        { href: '/admin/desk', label: 'Registration desk', on: features.checkIn },
        { href: '/admin/headcount', label: 'Headcount', on: features.checkIn },
        { href: '/screen/arrivals', label: 'Arrivals on the projector', on: features.bigScreen },
      ],
    },
    {
      when: 'During sessions',
      title: 'Keep the room on time',
      text: 'The MC keeps live control open: what is on, minutes left, what is next and how full the room is. Polls and questions run on Slido, and every session page has the Slido button.',
      links: [
        { href: '/admin/live', label: 'Live control', on: true },
        { href: '/admin/qa', label: 'Backup Q&A', on: features.qa },
        { href: '/admin/polls', label: 'Backup polls', on: features.polls },
        { href: '/agenda', label: 'Agenda', on: features.schedule },
        {
          href: '/screen/now-next',
          label: 'Now and next on the projector',
          on: features.bigScreen,
        },
      ],
    },
    {
      when: 'Breaks and evenings',
      title: 'Put on a show',
      text: 'Switch the projector from a phone. Start the surprise countdown, run the lucky draw (it spins through the names of people who checked in, and nobody can win twice), or play the photo slideshow from the photos attendees shared.',
      links: [
        { href: '/admin/big-screen', label: 'Big screen control', on: features.bigScreen },
        { href: '/admin/lucky-draw', label: 'Lucky draw', on: features.luckyDraw },
        { href: '/admin/photos', label: 'Photo wall', on: features.photoWall },
        { href: '/screen/countdown', label: 'Countdown on the projector', on: features.bigScreen },
      ],
    },
    {
      when: 'After each session, and at the end',
      title: 'Collect feedback',
      text: 'Each session has a one minute form: stars and an optional comment. The final form asks about the whole event. An admin decides per form whether names are collected.',
      links: [
        { href: '/admin/feedback', label: 'Feedback results', on: features.feedback },
        { href: '/feedback/event', label: 'The final form', on: features.feedback },
      ],
    },
    {
      when: 'After the event',
      title: 'One click report',
      text: 'Download everything as one Excel file, and a short summary to save as PDF. Upload the Slido export and its polls and questions join the same report.',
      links: [
        { href: '/admin/reports', label: 'Reports', on: true },
        { href: '/admin/reports/summary', label: 'The PDF summary', on: true },
        { href: '/admin/committees', label: 'Committee summary', on: features.committees },
      ],
    },
  ];

  const roles = [
    {
      role: 'Registration desk',
      device: 'Laptop or phone with a camera',
      does: 'Signs in as desk-1 or desk-2. Scans tags, searches names, undoes a wrong scan.',
    },
    {
      role: 'MC or floor manager',
      device: 'Phone',
      does: 'Signs in as mc. Watches live control, switches the projector, runs the countdown and the lucky draw.',
    },
    {
      role: 'Projector laptop',
      device: 'Laptop on the projector',
      does: 'Signs in once as screen, opens /screen, presses F11 and is left alone all day.',
    },
  ];

  const rules = [
    [
      'No AI and no trackers',
      'Nothing on the portal calls an outside service. Session content stays inside it.',
    ],
    [
      'One config file',
      'The agenda, speakers, colours and switches all live in one file. A new event is a new file, not new code.',
    ],
    [
      'Behind a PIN',
      'Every secretariat and projector page needs the PIN. Up to three desks can work at once.',
    ],
    [
      'Works on hotel Wi-Fi',
      'Pages are light and refresh themselves every few seconds. No app to install.',
    ],
    [
      'Only invented data in the code',
      'The real attendee list is loaded separately and never stored with the code.',
    ],
    [
      'Photos are checked first',
      'Every shared photo waits for an organiser. Phones shrink photos and strip the location before sending.',
    ],
    [
      'Names only where needed',
      'The PDF summary has counts only. The Excel report has names and stays with the secretariat.',
    ],
  ];

  const faq = [
    [
      'What if Slido is down on the day?',
      'One switch on the Q&A or Polls page moves everyone to the portal\'s own Q&A and polls: the Slido button on each session becomes "Ask a question", and the projector can show the top questions and live poll results. Everything else never depended on Slido.',
    ],
    [
      'Can people check in with the business card in the TNB app?',
      'Yes. The desk camera reads it like a name tag. Only the name and email are used: an exact match checks the person in at once, a close one asks the desk to tap the right person, and the email is remembered so the next day is instant. The phone number and address on the card are never kept. Ask people to turn their screen brightness up.',
    ],
    [
      'How do the points and the leaderboard work?',
      'People join once on their phone with their staff number and first name. After that, arriving (a bonus for being early), sending feedback, answering polls, a photo on the wall and asking a question all earn points. Departments are ranked by average points per person, so a big team does not win by size. The secretariat are not ranked. Feedback stays anonymous: only the fact a form was sent counts. The projector has a Leaderboard view.',
    ],
    [
      'What if a name tag will not scan?',
      'Search for the person by name at the desk and check them in from the list. It takes a few seconds.',
    ],
    [
      'Can two people use the console at once?',
      'Yes. Each device signs in with the PIN and its own label, and they all see the same numbers. The Admins page shows which desks are signed in and a log of what each one did.',
    ],
    [
      'How do we change the colours or the logo?',
      'Edit the branding block in the config file. Phones, the console and the projector all follow.',
    ],
    [
      'Can we reuse it for the next event?',
      'Yes. Copy the config file, change the agenda and names, and load the new attendee list.',
    ],
  ];

  return (
    <div className="space-y-12 py-2 lg:!max-w-6xl">
      <section>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoFor(config.branding, resolveTheme(config.branding, 'portal'))}
          alt=""
          className="mb-6 h-auto w-full max-w-sm"
          width={1000}
          height={318}
        />
        <p className="eyebrow">Team guide</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
          How the {event.shortName} portal works
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          One web address runs the whole event: the agenda on every phone, the screens in the
          ballroom, and the tools the secretariat needs. Built for {event.name}, {dates}.
        </p>
      </section>

      <section aria-labelledby="screens">
        <p className="eyebrow">01</p>
        <h2 id="screens" className="mt-1 text-xl font-bold text-ink">
          Three kinds of screen
        </h2>
        <ul className="stagger mt-4 grid gap-3 md:grid-cols-3">
          {screens.map((s) => (
            <li key={s.who} className="flex flex-col rounded-xl border border-line bg-surface p-4">
              <p className="text-lg font-bold text-ink">{s.who}</p>
              <p className="text-sm font-semibold text-accent">{s.where}</p>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{s.what}</p>
              <Link href={s.href} className="mt-3 text-sm font-bold text-primary">
                {s.link}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="day">
        <p className="eyebrow">02</p>
        <h2 id="day" className="mt-1 text-xl font-bold text-ink">
          An event day, start to finish
        </h2>
        <ol className="stagger mt-4 grid gap-3 lg:grid-cols-2">
          {day.map((step, i) => {
            const links = step.links.filter((l) => l.on);
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
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    {step.when}
                  </p>
                  <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{step.text}</p>
                  {links.length > 0 ? (
                    <p className="mt-2 flex flex-wrap gap-2">
                      {links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-full border border-line px-3 py-1 text-sm font-semibold text-primary no-underline hover:border-primary"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="roles">
        <p className="eyebrow">03</p>
        <h2 id="roles" className="mt-1 text-xl font-bold text-ink">
          Who does what on the day
        </h2>
        <ul className="stagger mt-4 grid gap-3 md:grid-cols-3">
          {roles.map((r) => (
            <li key={r.role} className="rounded-xl border border-line bg-surface p-4">
              <p className="font-bold text-ink">{r.role}</p>
              <p className="text-sm font-semibold text-accent">{r.device}</p>
              <p className="mt-2 text-sm text-ink-soft">{r.does}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules">
        <p className="eyebrow">04</p>
        <h2 id="rules" className="mt-1 text-xl font-bold text-ink">
          How it is built to be safe
        </h2>
        <dl className="stagger mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rules.map(([title, text]) => (
            <div key={title} className="rounded-xl border border-line bg-muted p-4">
              <dt className="font-bold text-ink">{title}</dt>
              <dd className="mt-1 text-sm text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="faq">
        <p className="eyebrow">05</p>
        <h2 id="faq" className="mt-1 text-xl font-bold text-ink">
          Questions the team will ask
        </h2>
        <div className="mt-4 space-y-2">
          {faq.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer font-semibold text-ink">{q}</summary>
              <p className="mt-2 text-sm text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
