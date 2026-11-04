import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSessionValue,
  normaliseOperator,
  readSessionValue,
  SESSION_HOURS,
} from './admin-session';
import { isRateLimited, LIMITS, rateLimit, resetRateLimits } from './rate-limit';

const PIN = '481920';

beforeEach(() => {
  process.env.ADMIN_PIN = PIN;
});

afterEach(() => {
  delete process.env.ADMIN_PIN;
  resetRateLimits();
});

describe('the desk sign in cookie', () => {
  it('round trips the operator label', () => {
    const value = createSessionValue('desk-1', PIN);
    expect(readSessionValue(value)?.operator).toBe('desk-1');
  });

  it('refuses a cookie signed with a different PIN', () => {
    const value = createSessionValue('desk-1', 'a-different-pin');
    expect(readSessionValue(value)).toBeNull();
  });

  it('refuses a cookie whose label has been edited', () => {
    const value = createSessionValue('desk-1', PIN);
    const [, signature] = value.split('.');
    const forged = `${Buffer.from('admin:99999999999999', 'utf8').toString('base64url')}.${signature}`;
    expect(readSessionValue(forged)).toBeNull();
  });

  it('refuses an expired cookie', () => {
    const issued = Date.now();
    const value = createSessionValue('desk-1', PIN, issued);
    const afterExpiry = issued + (SESSION_HOURS + 1) * 60 * 60 * 1000;
    expect(readSessionValue(value, afterExpiry)).toBeNull();
  });

  it('accepts a cookie that has not expired yet', () => {
    const issued = Date.now();
    const value = createSessionValue('desk-1', PIN, issued);
    const stillValid = issued + (SESSION_HOURS - 1) * 60 * 60 * 1000;
    expect(readSessionValue(value, stillValid)?.operator).toBe('desk-1');
  });

  it('refuses nonsense instead of throwing', () => {
    expect(readSessionValue(undefined)).toBeNull();
    expect(readSessionValue('')).toBeNull();
    expect(readSessionValue('not-a-cookie')).toBeNull();
    expect(readSessionValue('....')).toBeNull();
    expect(readSessionValue('a.b')).toBeNull();
  });

  it('keeps the console shut when no PIN is configured', () => {
    const value = createSessionValue('desk-1', PIN);
    delete process.env.ADMIN_PIN;
    expect(readSessionValue(value)).toBeNull();
  });
});

describe('operator labels', () => {
  it('reduces a label to something safe to log', () => {
    expect(normaliseOperator('Desk 1')).toBe('desk-1');
    expect(normaliseOperator('  Main Desk  ')).toBe('main-desk');
    // Slashes and dots are stripped entirely, so a label can never be a path.
    expect(normaliseOperator('desk/../../etc')).toBe('desketc');
  });

  it('never returns an empty label', () => {
    expect(normaliseOperator('')).toBe('desk');
    expect(normaliseOperator('!!!')).toBe('desk');
  });

  it('cannot contain the colon the cookie uses as a separator', () => {
    expect(normaliseOperator('desk:1')).not.toContain(':');
  });
});

describe('rate limiting', () => {
  it('allows up to the limit then refuses', () => {
    for (let i = 0; i < LIMITS.adminPin.limit; i += 1) {
      expect(rateLimit('pin:test', LIMITS.adminPin).allowed).toBe(true);
    }
    const blocked = rateLimit('pin:test', LIMITS.adminPin);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('counts each key on its own', () => {
    for (let i = 0; i < LIMITS.adminPin.limit; i += 1) rateLimit('pin:a', LIMITS.adminPin);
    expect(rateLimit('pin:a', LIMITS.adminPin).allowed).toBe(false);
    expect(rateLimit('pin:b', LIMITS.adminPin).allowed).toBe(true);
  });

  it('starts again once the window has passed', () => {
    const start = Date.now();
    for (let i = 0; i < LIMITS.adminPin.limit + 2; i += 1) {
      rateLimit('pin:window', LIMITS.adminPin, start);
    }
    expect(rateLimit('pin:window', LIMITS.adminPin, start).allowed).toBe(false);

    const later = start + LIMITS.adminPin.windowMs + 1;
    expect(rateLimit('pin:window', LIMITS.adminPin, later).allowed).toBe(true);
  });

  it('lets a busy desk scan quickly without being blocked', () => {
    // 80 people in 15 minutes is the target. 80 scans in one minute must pass.
    const start = Date.now();
    for (let i = 0; i < 80; i += 1) {
      expect(rateLimit('checkin:desk-1', LIMITS.checkIn, start).allowed).toBe(true);
    }
  });
});

describe('the PIN limiter counts failures only', () => {
  it('does not lock out desks that keep signing in correctly', () => {
    // Several people at one event share the hotel's public address.
    for (let i = 0; i < 50; i += 1) {
      expect(isRateLimited('pin:shared', LIMITS.adminPin).allowed).toBe(true);
    }
  });

  it('blocks after enough wrong PINs from the same place', () => {
    for (let i = 0; i < LIMITS.adminPin.limit; i += 1) {
      expect(isRateLimited('pin:guesser', LIMITS.adminPin).allowed).toBe(true);
      rateLimit('pin:guesser', LIMITS.adminPin);
    }
    expect(isRateLimited('pin:guesser', LIMITS.adminPin).allowed).toBe(false);
  });
});
