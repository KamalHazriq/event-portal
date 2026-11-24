'use client';

import { setTestClock } from '../actions';
import { useMemo, useState } from 'react';

type ClockSession = {
  id: string;
  title: string;
  dayLabel: string;
  date: string;
  start: string;
  end: string;
  feedback: boolean;
};

function shift(clock: string, minutes: number): string {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The test clock: pick a session and open the portal as if it were that
 * moment, to try reactions, the live highlight and feedback before the
 * event. Works through the ?now= part of the address, so only the tabs you
 * open this way pretend; everyone else sees the real time.
 */
export function TestClock({ sessions, allowed }: { sessions: ClockSession[]; allowed: boolean }) {
  const [id, setId] = useState(sessions.find((s) => s.feedback)?.id ?? sessions[0]?.id ?? '');
  const [when, setWhen] = useState<'during' | 'after'>('during');
  const session = sessions.find((s) => s.id === id);
  const days = useMemo(() => [...new Set(sessions.map((s) => s.dayLabel))], [sessions]);

  if (!session) return null;
  // Before each day starts, and after it ends: the whole day as past or future.
  const jumps = days.flatMap((day) => {
    const ofDay = sessions.filter((s) => s.dayLabel === day);
    const first = ofDay.reduce((a, b) => (b.start < a.start ? b : a), ofDay[0]!);
    const last = ofDay.reduce((a, b) => (b.end > a.end ? b : a), ofDay[0]!);
    return [
      { label: `${day}, before it starts`, moment: `${first.date}T${shift(first.start, -15)}` },
      { label: `${day}, after it ends`, moment: `${last.date}T${shift(last.end, 30)}` },
    ];
  });
  const moment = `${session.date}T${when === 'during' ? shift(session.start, 5) : shift(session.end, 2)}`;
  const q = `now=${moment}`;
  const links = [
    { href: `/session/${session.id}?${q}`, label: 'This session' },
    { href: `/?${q}`, label: 'Home' },
    { href: `/agenda?${q}`, label: 'Agenda' },
    ...(when === 'after' && session.feedback
      ? [{ href: `/feedback/${session.id}?${q}`, label: 'Its feedback form' }]
      : []),
    { href: `/screen?${q}`, label: 'Big screen (secretariat)' },
  ];

  return (
    <div className="space-y-3">
      {!allowed ? (
        <p role="alert" className="rounded-lg border-2 border-warning bg-warning/10 p-3 text-ink">
          The test clock is off on this server, so these links show the real time. It is switched on
          with ALLOW_TIME_OVERRIDE in apphosting.yaml.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-ink">
          Session
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="mt-1 block min-h-11 max-w-full rounded-lg border border-line bg-canvas px-3 text-ink"
          >
            {days.map((day) => (
              <optgroup key={day} label={day}>
                {sessions
                  .filter((s) => s.dayLabel === day)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.start} {s.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <fieldset className="flex gap-2">
          <legend className="sr-only">When</legend>
          {(
            [
              ['during', 'While it is on'],
              ['after', 'Just after it ends'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold ${
                when === value
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-line text-ink'
              }`}
            >
              <input
                type="radio"
                name="when"
                value={value}
                checked={when === value}
                onChange={() => setWhen(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      <p className="text-sm text-ink-soft">
        Pretending it is{' '}
        <span className="font-mono font-semibold text-ink">{moment.replace('T', ' ')}</span>.
        {when === 'during'
          ? ' Reactions are open and the session shows as happening now.'
          : session.feedback
            ? ' The session has just finished, so its feedback form is open.'
            : ' This session does not ask for feedback; pick a talk for that.'}
      </p>
      <form action={setTestClock} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="moment" value={moment} />
        <button
          type="submit"
          disabled={!allowed}
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary disabled:opacity-50"
        >
          Use this time on this device
        </button>
        <span className="text-sm text-ink-soft">
          Every attendee page on this phone or laptop then pretends, wherever you tap: Home, Agenda,
          sessions and the big screen. Nobody else is affected.
        </span>
      </form>
      <div>
        <p className="text-sm font-semibold text-ink">Or jump to a moment on this device</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {jumps.map((jump) => (
            <form key={jump.moment} action={setTestClock}>
              <input type="hidden" name="moment" value={jump.moment} />
              <button
                type="submit"
                disabled={!allowed}
                className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-primary disabled:opacity-50"
              >
                {jump.label}
              </button>
            </form>
          ))}
        </div>
      </div>
      <p className="text-sm font-semibold text-ink">Or open one tab at that time</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-canvas px-3 text-sm font-semibold text-primary no-underline hover:border-primary"
          >
            {link.label}
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
