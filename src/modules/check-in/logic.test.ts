import { describe, expect, it } from 'vitest';

import type { Day } from '@/lib/event-schema';
import type { EventNow } from '@/lib/time';

import {
  arrivalRate,
  buildCheckInUrl,
  parseScanPayload,
  resolveCheckInDay,
  scanOutcomeMessage,
  sortByOutstanding,
} from './logic';

const at = (date: string): EventNow => ({ date, minutes: 600, isOverride: false });

const days = [
  { id: 'day-1', date: '2026-12-14', label: 'Day 1', subtitle: '', sessions: [] },
  { id: 'day-2', date: '2026-12-15', label: 'Day 2', subtitle: '', sessions: [] },
  { id: 'day-3', date: '2026-12-16', label: 'Day 3', subtitle: '', sessions: [] },
] as unknown as Day[];

describe('buildCheckInUrl', () => {
  it('builds the address printed in a name tag QR code', () => {
    expect(buildCheckInUrl('https://events.example.com/portal', 'AbCd1234EfGh5678')).toBe(
      'https://events.example.com/portal/c/AbCd1234EfGh5678',
    );
  });

  it('does not double up the slash', () => {
    expect(buildCheckInUrl('https://events.example.com/', 'AbCd1234EfGh5678')).toBe(
      'https://events.example.com/c/AbCd1234EfGh5678',
    );
  });
});

describe('parseScanPayload', () => {
  const token = 'AbCd1234EfGh5678_-xy';

  it('reads a bare token', () => {
    expect(parseScanPayload(token)).toBe(token);
  });

  it('reads our own URL', () => {
    expect(parseScanPayload(`https://events.example.com/c/${token}`)).toBe(token);
  });

  it('reads the URL with a trailing slash', () => {
    expect(parseScanPayload(`https://events.example.com/c/${token}/`)).toBe(token);
  });

  it('ignores the newline a hardware scanner sends', () => {
    expect(parseScanPayload(`${token}\r\n`)).toBe(token);
  });

  it('ignores surrounding spaces', () => {
    expect(parseScanPayload(`  ${token}  `)).toBe(token);
  });

  it('refuses someone else QR code', () => {
    expect(parseScanPayload('https://example.com/promo/scan-me')).toBeNull();
    expect(parseScanPayload('WIFI:S:HotelGuest;T:WPA;P:password;;')).toBeNull();
    expect(parseScanPayload('https://app.sli.do/event/abc123')).toBeNull();
  });

  it('refuses something too short to be a token', () => {
    expect(parseScanPayload('abc')).toBeNull();
    expect(parseScanPayload('')).toBeNull();
    expect(parseScanPayload('   ')).toBeNull();
  });

  it('refuses a token with characters a token cannot contain', () => {
    expect(parseScanPayload('AbCd1234EfGh5678!!')).toBeNull();
    expect(parseScanPayload('AbCd 1234 EfGh 5678')).toBeNull();
  });

  it('refuses a malformed URL', () => {
    expect(parseScanPayload('https://')).toBeNull();
  });
});

describe('resolveCheckInDay', () => {
  it('picks today during the event', () => {
    expect(resolveCheckInDay(days, at('2026-12-15'))?.id).toBe('day-2');
  });

  it('picks Day 1 before the event, so a rehearsal works', () => {
    expect(resolveCheckInDay(days, at('2026-11-05'))?.id).toBe('day-1');
  });

  it('picks the last day after the event', () => {
    expect(resolveCheckInDay(days, at('2027-01-10'))?.id).toBe('day-3');
  });

  it('honours a day the operator picked', () => {
    expect(resolveCheckInDay(days, at('2026-12-14'), 'day-3')?.id).toBe('day-3');
  });

  it('falls back to today when the requested day is not real', () => {
    expect(resolveCheckInDay(days, at('2026-12-14'), 'day-9')?.id).toBe('day-1');
  });

  it('returns null when the event has no days', () => {
    expect(resolveCheckInDay([], at('2026-12-14'))).toBeNull();
  });
});

describe('arrivalRate', () => {
  it('counts the room', () => {
    expect(arrivalRate(42, 78)).toEqual({
      arrived: 42,
      expected: 78,
      percent: 54,
      remaining: 36,
    });
  });

  it('handles nobody having arrived', () => {
    expect(arrivalRate(0, 78)).toMatchObject({ percent: 0, remaining: 78 });
  });

  it('handles everyone having arrived', () => {
    expect(arrivalRate(78, 78)).toMatchObject({ percent: 100, remaining: 0 });
  });

  it('does not divide by zero when no one is expected', () => {
    expect(arrivalRate(0, 0)).toMatchObject({ percent: 0, remaining: 0 });
  });
});

describe('sortByOutstanding', () => {
  it('puts the department with the most still to arrive first', () => {
    const rows = [
      { department: 'Retail', expected: 10, arrived: 9 },
      { department: 'Grid', expected: 20, arrived: 5 },
      { department: 'Digital', expected: 8, arrived: 8 },
    ];
    expect(sortByOutstanding(rows).map((row) => row.department)).toEqual([
      'Grid',
      'Retail',
      'Digital',
    ]);
  });

  it('does not change the array it was given', () => {
    const rows = [
      { expected: 1, arrived: 0 },
      { expected: 5, arrived: 0 },
    ];
    const copy = [...rows];
    sortByOutstanding(rows);
    expect(rows).toEqual(copy);
  });
});

describe('scanOutcomeMessage', () => {
  it('says something a person at a desk can act on', () => {
    expect(scanOutcomeMessage('checked-in')).toBe('Checked in');
    expect(scanOutcomeMessage('already-checked-in')).toBe('Already checked in');
    expect(scanOutcomeMessage('not-found')).toBe('Tag not recognised');
  });

  it('uses no em dashes, per the brief', () => {
    const all = (
      [
        'checked-in',
        'already-checked-in',
        'not-found',
        'unreadable',
        'rate-limited',
        'error',
      ] as const
    )
      .map(scanOutcomeMessage)
      .join(' ');
    expect(all).not.toMatch(/[—–]/);
  });
});
