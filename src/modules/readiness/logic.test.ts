import { describe, expect, it } from 'vitest';

import { hostOf, readyItems, type ReadyFacts } from './logic';

const good: ReadyFacts = {
  attendees: 300,
  pinLength: 8,
  passSet: true,
  portalHost: 'portal.example.com',
  requestHost: 'portal.example.com',
  teamPhones: 3,
  eventPhones: 50,
  remindersWaiting: 0,
  schedulerRecent: false,
};
const bad = (over: Partial<ReadyFacts>, id: string) =>
  readyItems({ ...good, ...over }).find((i) => i.id === id)!.ok;

describe('ready check', () => {
  it('passes when everything is set', () => {
    expect(readyItems(good).every((i) => i.ok)).toBe(true);
  });

  it('flags each gap', () => {
    expect(bad({ attendees: 0 }, 'attendees')).toBe(false);
    expect(bad({ pinLength: 4 }, 'pin')).toBe(false);
    expect(bad({ passSet: false }, 'pass')).toBe(false);
    expect(bad({ requestHost: 'other.example.com' }, 'address')).toBe(false);
    expect(bad({ teamPhones: 0 }, 'team')).toBe(false);
    expect(bad({ remindersWaiting: 2 }, 'scheduler')).toBe(false);
    expect(bad({ remindersWaiting: 2, schedulerRecent: true }, 'scheduler')).toBe(true);
  });

  it('does not fuss about the address on a laptop', () => {
    expect(bad({ requestHost: 'localhost:3000' }, 'address')).toBe(true);
    expect(hostOf('https://a.b/c')).toBe('a.b');
    expect(hostOf('nope')).toBe('');
  });
});
