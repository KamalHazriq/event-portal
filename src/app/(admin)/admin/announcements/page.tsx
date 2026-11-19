import type { Metadata } from 'next';

import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import {
  clearAnnouncement,
  postAnnouncement,
  sendTestAlert,
  setFeedbackNudges,
} from '@/modules/announce/actions';
import {
  ANNOUNCE_HOURS,
  ANNOUNCE_KEYS,
  ANNOUNCE_MAX_CHARS,
  isLive,
  NUDGE_KEYS,
  NUDGE_WINDOW_MINUTES,
  parseAnnouncement,
  parseHistory,
} from '@/modules/announce/logic';
import { EVENT_FORM_SLUG } from '@/modules/feedback/logic';
import { localDateTime } from '@/modules/reports/logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Announcements' };

const EXAMPLES = [
  'Buses to the venue leave the hotel lobby at 7:30 am.',
  'The next session starts in 10 minutes in the Grand Ballroom.',
  'Lunch is served at the Ballroom Foyer.',
  'Lucky draw in 5 minutes. Be in the hall to win.',
  'Tell us how it went: the summit feedback form is open.',
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TEST_RESULT: Record<string, { text: string; good: boolean }> = {
  sent: { text: 'Test sent. It should arrive on this phone within a few seconds.', good: true },
  failed: {
    text: 'The push service did not take the test. Try again in a minute.',
    good: false,
  },
  none: {
    text: 'This phone has not turned on alerts yet. Open the portal home on this phone, tap Turn on alerts, then try again.',
    good: false,
  },
};

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const test = typeof params.test === 'string' ? TEST_RESULT[params.test] : undefined;
  await requireAdmin('/admin/announcements');
  const config = getEventConfig();
  const tz = config.event.timezone;
  const data = getData();
  const [currentRaw, historyRaw, phones, nudgeSetting] = await Promise.all([
    data.settings.get(ANNOUNCE_KEYS.current),
    data.settings.get(ANNOUNCE_KEYS.history),
    data.push.count(),
    data.settings.get(NUDGE_KEYS.enabled),
  ]);
  const nudging = nudgeSetting === 'on';
  const current = parseAnnouncement(currentRaw);
  const live = isLive(current, new Date()) ? current : null;
  const history = parseHistory(historyRaw);

  const links = [
    { href: '', label: 'No link' },
    { href: '/', label: 'Home' },
    ...(config.features.schedule ? [{ href: '/agenda', label: 'Agenda' }] : []),
    ...(config.info ? [{ href: '/info', label: config.info.title }] : []),
    ...(config.features.photoWall ? [{ href: '/photos', label: 'Photos' }] : []),
    ...(config.features.leaderboard ? [{ href: '/leaderboard', label: 'Leaderboard' }] : []),
    ...(config.features.feedback
      ? [{ href: `/feedback/${EVENT_FORM_SLUG}`, label: 'Summit feedback' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Announcements</h1>
        <p className="mt-1 text-ink-soft">
          One short message at the top of every attendee page, for {ANNOUNCE_HOURS} hours or until
          you take it down. Tick the box to also send it as a notification to the{' '}
          <strong className="text-ink">
            {phones} {phones === 1 ? 'phone' : 'phones'}
          </strong>{' '}
          with event alerts on.
        </p>
      </header>

      {live ? (
        <section
          aria-labelledby="now-showing"
          className="rounded-xl border-2 border-primary bg-surface p-4"
        >
          <h2 id="now-showing" className="text-sm font-semibold text-ink-soft">
            Showing now, since {localDateTime(live.at, tz).slice(11)}
            {live.pushed === null ? '' : `, sent to ${live.pushed} phones`}
          </h2>
          <p className="mt-1 text-lg font-bold text-ink">{live.text}</p>
          <form action={clearAnnouncement} className="mt-3">
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
            >
              Take it down
            </button>
          </form>
        </section>
      ) : null}

      <form
        action={postAnnouncement}
        className="space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <div>
          <label htmlFor="announce-text" className="block font-semibold text-ink">
            Message
          </label>
          <textarea
            id="announce-text"
            name="text"
            required
            maxLength={ANNOUNCE_MAX_CHARS}
            rows={3}
            placeholder={EXAMPLES[0]}
            className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />
          <p className="mt-1 text-sm text-ink-soft">
            Up to {ANNOUNCE_MAX_CHARS} characters. It replaces the one showing now.
          </p>
        </div>
        <div>
          <label htmlFor="announce-link" className="block font-semibold text-ink">
            Tapping it opens
          </label>
          <select
            id="announce-link"
            name="href"
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
          >
            {links.map((l) => (
              <option key={l.href} value={l.href}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-3 text-ink">
          <input type="checkbox" name="push" defaultChecked className="mt-1 size-5" />
          <span>
            Also send it as a notification to {phones} {phones === 1 ? 'phone' : 'phones'}
            <span className="block text-sm text-ink-soft">
              Use it for things people need to act on. Too many and they turn alerts off.
            </span>
          </span>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Post announcement
        </button>
      </form>

      <form
        action={sendTestAlert}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
      >
        <p className="min-w-0 flex-1 text-ink">
          <span className="font-bold">Check alerts on your own phone.</span>{' '}
          <span className="text-ink-soft">
            Turn on alerts on the portal home first, in this same browser. Only this phone gets the
            test.
          </span>
        </p>
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          Send a test to this phone
        </button>
        {test ? (
          <p
            role="status"
            className={`w-full text-sm font-semibold ${test.good ? 'text-success' : 'text-warning'}`}
          >
            {test.text}
          </p>
        ) : null}
      </form>

      {config.features.feedback ? (
        <form
          action={setFeedbackNudges}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <input type="hidden" name="mode" value={nudging ? 'off' : 'on'} />
          <p className="min-w-0 flex-1 text-ink">
            <span className="font-bold">
              Automatic feedback reminders: {nudging ? 'on' : 'off'}.
            </span>{' '}
            <span className="text-ink-soft">
              Within {NUDGE_WINDOW_MINUTES} minutes after each talk with a feedback form, phones
              with alerts on get &quot;How was it? Rate it in under a minute&quot;. Sent while the
              big screen is open.
            </span>
          </p>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            {nudging ? 'Turn off' : 'Turn on'}
          </button>
        </form>
      ) : null}

      <section aria-labelledby="examples">
        <h2 id="examples" className="font-bold text-ink">
          Ideas
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          {EXAMPLES.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="history">
          <h2 id="history" className="font-bold text-ink">
            Sent before
          </h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {history.map((a) => (
              <li key={a.id} className="p-3">
                <p className="text-ink">{a.text}</p>
                <p className="text-sm text-ink-soft">
                  {localDateTime(a.at, tz)}
                  {a.pushed === null ? ', page only' : `, sent to ${a.pushed} phones`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
