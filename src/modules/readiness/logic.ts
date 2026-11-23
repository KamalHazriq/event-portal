/**
 * "Ready check": what the portal can verify about itself before the event.
 * Pure: the page gathers the facts, this turns them into plain lines.
 */
export type ReadyFacts = {
  attendees: number;
  pinLength: number;
  /** The PIN is short, common or a simple pattern. */
  pinWeak: boolean;
  passSet: boolean;
  /** The event code is short or made of obvious words and years. */
  passWeak: boolean;
  /** The portal address from the event config, and the host this page was opened on. */
  portalHost: string;
  requestHost: string | null;
  teamPhones: number;
  eventPhones: number;
  remindersWaiting: number;
  schedulerRecent: boolean;
  /** The pretend attendee for testing is still on the list. */
  testParticipant?: boolean;
  /** ?now= works on this server, so anyone can pretend it is another time. */
  testClock?: boolean;
};

export type ReadyItem = { id: string; ok: boolean; label: string; fix: string };

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function readyItems(f: ReadyFacts): ReadyItem[] {
  const local = !!f.requestHost && /^(localhost|127\.|\[::1\])/.test(f.requestHost);
  return [
    {
      id: 'attendees',
      ok: f.attendees > 0,
      label:
        f.attendees > 0
          ? `${f.attendees} people on the participant list`
          : 'No participant list yet',
      fix: 'Upload the master list on the Attendees page.',
    },
    {
      id: 'pin',
      ok: f.pinLength >= 6 && !f.pinWeak,
      label:
        f.pinLength < 6
          ? 'Secretariat PIN is short or missing'
          : f.pinWeak
            ? 'Secretariat PIN is easy to guess'
            : 'Secretariat PIN is set and hard to guess',
      fix: 'Use a PIN of 8 or more letters and numbers that is not a pattern, in the portal-admin-pin secret, then roll out. Everyone signs in again.',
    },
    {
      id: 'pass',
      ok: f.passSet && !f.passWeak,
      label: !f.passSet
        ? 'No event code: the portal is open to anyone with the link'
        : f.passWeak
          ? 'Event code is easy to guess'
          : 'Event code is on, and hard to guess',
      fix: 'Set the portal-event-pass secret to a random code of 10 or more characters and roll out, BEFORE printing name tags (the QR carries it). Nobody types it.',
    },
    {
      id: 'address',
      ok: local || !f.requestHost || f.portalHost === f.requestHost,
      label:
        local || !f.requestHost || f.portalHost === f.requestHost
          ? 'QR codes point at this address'
          : `QR codes point at ${f.portalHost}, not ${f.requestHost}`,
      fix: 'Set the portalUrl on the Event info page (or PORTAL_URL) to the address people use, then reprint.',
    },
    {
      id: 'team',
      ok: f.teamPhones > 0,
      label:
        f.teamPhones > 0
          ? `${f.teamPhones} team ${f.teamPhones === 1 ? 'phone has' : 'phones have'} team alerts on`
          : 'No team phone has team alerts on',
      fix: 'On each secretariat phone open Announce and tap Turn on team alerts (iPhone: install to the Home Screen first).',
    },
    {
      id: 'scheduler',
      ok: f.remindersWaiting === 0 || f.schedulerRecent,
      label:
        f.remindersWaiting === 0
          ? 'No scheduled reminders waiting'
          : f.schedulerRecent
            ? `${f.remindersWaiting} reminders waiting, scheduler is running`
            : `${f.remindersWaiting} reminders waiting but the scheduler is not calling`,
      fix: 'Set up Cloud Scheduler (docs/DEPLOYING.md, Scheduled reminders), or keep a big screen page open.',
    },
    {
      id: 'test-participant',
      ok: !f.testParticipant,
      label: f.testParticipant
        ? 'Test Participant is still on the list'
        : 'No test participant on the list',
      fix: 'Remove it in "Test as an attendee" on this page before the event.',
    },
    {
      id: 'test-clock',
      ok: !f.testClock,
      label: f.testClock ? 'The test clock is on' : 'The test clock is off',
      fix: 'Before 14 December, remove the ALLOW_TIME_OVERRIDE lines from apphosting.yaml (or ask the developer) and roll out, so nobody can pretend it is another time.',
    },
  ];
}
