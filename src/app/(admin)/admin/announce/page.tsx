import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { InstallApp } from '@/components/InstallApp';
import { getData } from '@/data';
import { requireAdmin } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, readDeviceId } from '@/lib/device';
import {
  clearAnnouncement,
  postAnnouncement,
  sendTestAlert,
  sendTestToTeam,
  setTeamAuto,
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
import { AlertsOptIn } from '@/modules/announce/components/AlertsOptIn';
import { TEAM_AUTO_KEY, teamAutoOn } from '@/modules/announce/team';
import { EVENT_FORM_SLUG } from '@/modules/feedback/logic';
import { deleteReminder } from '@/modules/reminders/actions';
import {
  parseReminders,
  REMINDERS_KEY,
  REMINDERS_PING_KEY,
  reminderStatus,
  sortReminders,
} from '@/modules/reminders/logic';
import { localClock, localDateTime } from '@/modules/reports/logic';
import { ALERT_LOG_KEY, parseAlertLog } from '@/modules/announce/alert-log';
import { localDateTimeToInstant } from '@/lib/time';
import { WhenPicker } from '@/modules/announce/components/WhenPicker';
import { DEFAULT_DURATION, DURATION_CHOICES } from '@/modules/announce/logic';
import { FormPending } from '@/components/FormPending';

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
  sent: { text: 'Test sent. It should arrive on this device within a few seconds.', good: true },
  failed: {
    text: 'The push service did not take the test. Try again in a minute.',
    good: false,
  },
  none: {
    text: 'This device has not turned on alerts yet. Open the portal home on this device, tap Turn on alerts, then try again.',
    good: false,
  },
};

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const testKey = typeof params.test === 'string' ? params.test : '';
  const teamSent = /^team-sent-(\d+)$/.exec(testKey);
  const test = teamSent
    ? {
        text: `Test sent to ${teamSent[1]} team ${teamSent[1] === '1' ? 'phone' : 'phones'}. It should arrive within a few seconds.`,
        good: true,
      }
    : testKey === 'team-none'
      ? {
          text: 'No phone has team alerts on yet. On each secretariat phone, tap Turn on team alerts below.',
          good: false,
        }
      : TEST_RESULT[testKey];
  await requireAdmin('/admin/announce');
  const config = getEventConfig();
  const tz = config.event.timezone;
  const data = getData();
  const deviceId = readDeviceId((await cookies()).get(DEVICE_COOKIE)?.value);
  const [
    currentRaw,
    historyRaw,
    phones,
    nudgeSetting,
    teamAutoSetting,
    allSubs,
    remindersRaw,
    pingRaw,
    deviceLinks,
    people,
    alertLogRaw,
  ] = await Promise.all([
    data.settings.get(ANNOUNCE_KEYS.current),
    data.settings.get(ANNOUNCE_KEYS.history),
    data.push.count(),
    data.settings.get(NUDGE_KEYS.enabled),
    data.settings.get(TEAM_AUTO_KEY),
    data.push.list(),
    data.settings.get(REMINDERS_KEY),
    data.settings.get(REMINDERS_PING_KEY),
    data.players.links(),
    data.attendees.list(),
    data.settings.get(ALERT_LOG_KEY),
  ]);
  const alertLog = parseAlertLog(alertLogRaw);
  // Whose phone is whose: the name a phone signed in as on My points, if any.
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const ownerOf = new Map(deviceLinks.map((l) => [l.deviceId, nameOf.get(l.attendeeId) ?? '']));
  const teamAuto = teamAutoOn(teamAutoSetting);
  const nowDate = new Date();
  const toInstant = (local: string) => localDateTimeToInstant(local, tz);
  const reminders = sortReminders(parseReminders(remindersRaw)).map((r) => ({
    ...r,
    status: reminderStatus(r, nowDate, toInstant),
  }));
  const pingAge = pingRaw ? nowDate.getTime() - new Date(pingRaw).getTime() : null;
  const schedulerOn = pingAge !== null && pingAge < 3 * 60 * 1000;
  const teamPhones = allSubs.filter((p) => p.team).length;
  const mine = deviceId ? allSubs.filter((p) => p.deviceId === deviceId) : [];
  const thisPhoneAlerts = mine.length > 0;
  const thisPhoneTeam = mine.some((p) => p.team);
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
          you remove it. Tick the box to also send it as a notification to the{' '}
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
              Remove announcement
            </button>
          </form>
        </section>
      ) : null}

      {params.schedule === 'saved' ? (
        <p
          role="status"
          className="rounded-lg border border-success bg-success/10 p-3 font-semibold text-ink"
        >
          Scheduled. It goes out at the time you picked: see Scheduled below.
        </p>
      ) : params.schedule === 'bad' ? (
        <p
          role="alert"
          className="rounded-lg border-2 border-warning bg-warning/10 p-3 font-semibold text-ink"
        >
          Pick a date and time for Later.
        </p>
      ) : null}

      <form
        id="compose"
        action={postAnnouncement}
        className="scroll-mt-24 space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <FormPending label="Posting" />
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
        <fieldset>
          <legend className="font-semibold text-ink">Send it to</legend>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
            <label className="flex min-h-11 items-center gap-2 text-ink">
              <input
                type="radio"
                name="audience"
                value="everyone"
                defaultChecked
                className="size-5"
              />
              Everyone (a banner on every page)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-ink">
              <input type="radio" name="audience" value="team" className="size-5" />
              The secretariat team only
              <span className="text-sm text-ink-soft">
                (a notification to the {teamPhones} team {teamPhones === 1 ? 'phone' : 'phones'}{' '}
                with team alerts on; attendees see nothing)
              </span>
            </label>
          </div>
        </fieldset>
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
        <div>
          <label htmlFor="announce-minutes" className="block font-semibold text-ink">
            How long the banner stays up
          </label>
          <select
            id="announce-minutes"
            name="minutes"
            defaultValue={DEFAULT_DURATION}
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
          >
            {DURATION_CHOICES.map((c) => (
              <option key={c.minutes} value={c.minutes}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-ink-soft">
            Then it goes by itself. An hour suits most things; choose &ldquo;Until I take it
            down&rdquo; for something that must stay.
          </p>
        </div>
        <WhenPicker timezone={tz} />
        <label className="flex items-start gap-3 text-ink">
          <input type="checkbox" name="push" defaultChecked className="mt-1 size-5" />
          <span>
            Also send it as a notification to the {phones} {phones === 1 ? 'phone' : 'phones'} that
            turned on alerts
            <span className="block text-sm text-ink-soft">
              Use it for things people need to act on. Too many and they turn alerts off.
            </span>
          </span>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Post or schedule
        </button>
      </form>

      <section
        aria-labelledby="reminders"
        className="space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <div>
          <h2 id="reminders" className="text-lg font-bold text-ink">
            Scheduled
          </h2>
          <p className="text-ink-soft">
            Messages set to go out later: write one above and pick Later. Good for early setup calls
            like “Projector on, desks open” to the team.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {schedulerOn
              ? 'The scheduler is running, so reminders go out on the minute.'
              : 'The scheduler has not called in the last few minutes. Reminders still go out while a big screen page is open, otherwise set up the scheduler (see the deploy notes).'}
          </p>
        </div>
        {reminders.length === 0 ? (
          <p className="text-ink-soft">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-line">
            {reminders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="font-mono text-sm text-ink-soft">{r.at.replace('T', ' ')}</span>
                <span className="min-w-0 flex-1 text-ink">{r.text}</span>
                <span className="text-sm text-ink-soft">
                  {r.audience === 'team' ? 'Team' : 'Everyone'} ·{' '}
                  {r.status === 'sent' ? 'Sent' : r.status === 'missed' ? 'Missed' : 'Waiting'}
                </span>
                <form action={deleteReminder}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="min-h-11 px-2 text-sm font-semibold text-primary underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="test-alerts"
        className="space-y-4 rounded-xl border border-line bg-surface p-4"
      >
        <div>
          <h2 id="test-alerts" className="text-lg font-bold text-ink">
            Test your alerts
          </h2>
          <p className="mt-1 text-ink-soft">
            This device right now:{' '}
            <strong className={thisPhoneAlerts ? 'text-success' : 'text-warning'}>
              event alerts {thisPhoneAlerts ? 'on' : 'off'}
            </strong>
            ,{' '}
            <strong className={thisPhoneTeam ? 'text-success' : 'text-warning'}>
              team alerts {thisPhoneTeam ? 'on' : 'off'}
            </strong>
            .
          </p>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-ink">
          <li>
            On this device, tap <strong>Turn on team alerts</strong> below and allow it. (iPhone:
            add the app to the home screen first, then open it from the icon.)
          </li>
          <li>
            Tap <strong>Send a test to the team</strong>. A notification should arrive within a few
            seconds, and tapping it opens this console.
          </li>
          <li>
            To test what attendees get, open the portal in a <strong>private tab</strong>, tap{' '}
            <strong>Turn on alerts</strong> there, then post an announcement here.
          </li>
        </ol>

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer font-semibold text-ink">
            Alert log: what was sent, and to whom ({alertLog.length})
          </summary>
          {alertLog.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nothing sent yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {alertLog.map((e) => (
                <li key={`${e.at}-${e.tag}`} className="py-2 text-sm">
                  <p className="font-semibold text-ink">
                    {localClock(e.at, tz)} · {e.title}
                    <span className="ml-2 font-normal text-ink-soft">
                      to {e.sent} {e.sent === 1 ? 'phone' : 'phones'}
                      {e.failed > 0 ? `, ${e.failed} failed` : ''}
                    </span>
                  </p>
                  <p className="text-ink-soft">{e.body}</p>
                  <p className="text-ink">
                    {e.names.length > 0 ? e.names.join(', ') : 'No names'}
                    {e.unnamed > 0
                      ? `${e.names.length > 0 ? ', plus ' : ' · '}${e.unnamed} not signed in on My points`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer font-semibold text-ink">
            Devices with alerts on ({allSubs.length}: {teamPhones} team,{' '}
            {allSubs.length - teamPhones} attendee)
          </summary>
          {allSubs.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">None yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {allSubs.map((sub) => (
                <li key={sub.endpoint} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                  <span className="text-ink">
                    {ownerOf.get(sub.deviceId) ||
                      (sub.deviceId === deviceId ? 'This device' : 'Not signed in on My points')}
                  </span>
                  <span className="text-ink-soft">
                    {sub.team ? 'Secretariat team' : 'Attendee'} · since{' '}
                    {localDateTime(sub.createdAt, tz).replace('T', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            A device shows a name once it has picked a name on My points. Signed in secretariat
            desks are listed on the Admins page.
          </p>
        </details>

        <InstallApp laptopSteps />
        <AlertsOptIn team />

        <div className="flex flex-wrap gap-3">
          <form action={sendTestToTeam}>
            <FormPending label="Sending" />
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
            >
              Send a test to the team ({teamPhones})
            </button>
          </form>
          <form action={sendTestAlert}>
            <FormPending label="Sending" />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
            >
              Send a test to this device only
            </button>
          </form>
        </div>
        {test ? (
          <p
            role="status"
            className={`text-sm font-semibold ${test.good ? 'text-success' : 'text-warning'}`}
          >
            {test.text}
          </p>
        ) : null}

        <form
          action={setTeamAuto}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
        >
          <input type="hidden" name="mode" value={teamAuto ? 'off' : 'on'} />
          <p className="min-w-0 flex-1 text-ink">
            <span className="font-bold">
              Tell the team when something is waiting for approval: {teamAuto ? 'on' : 'off'}.
            </span>{' '}
            <span className="text-ink-soft">
              When a photo (or a comment, if comments need approval) arrives, the secretariat phones
              with team alerts on get one notification. After one, the next of the same kind waits
              at least five minutes, so a burst of photos is one buzz, not twenty.
            </span>
          </p>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
          >
            {teamAuto ? 'Turn off' : 'Turn on'}
          </button>
        </form>
      </section>

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
                  {a.audience === 'team' ? ', team only' : ''}
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
