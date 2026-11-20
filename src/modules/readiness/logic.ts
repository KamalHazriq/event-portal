/**
 * "Ready check": what the portal can verify about itself before the event.
 * Pure: the page gathers the facts, this turns them into plain lines.
 */
export type ReadyFacts = {
  attendees: number;
  pinLength: number;
  passSet: boolean;
  /** The portal address from the event config, and the host this page was opened on. */
  portalHost: string;
  requestHost: string | null;
  teamPhones: number;
  eventPhones: number;
  remindersWaiting: number;
  schedulerRecent: boolean;
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
      ok: f.pinLength >= 6,
      label:
        f.pinLength >= 6
          ? 'Secretariat PIN is set and long enough'
          : 'Secretariat PIN is short or missing',
      fix: 'Use a PIN of at least 6 characters in the portal-admin-pin secret, then roll out.',
    },
    {
      id: 'pass',
      ok: f.passSet,
      label: f.passSet
        ? 'Event code is on, so only participants get in'
        : 'No event code: the portal is open to anyone with the link',
      fix: 'Set the portal-event-pass secret and roll out.',
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
  ];
}
