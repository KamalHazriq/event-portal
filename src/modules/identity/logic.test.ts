import { describe, expect, it } from 'vitest';

import { asksName, safeNext } from './logic';

describe('who are you first', () => {
  it('asks on the attendee pages, never on the welcome or gift pages', () => {
    expect(asksName('/')).toBe(true);
    expect(asksName('/agenda')).toBe(true);
    expect(asksName('/session/d1-opening')).toBe(true);
    expect(asksName('/welcome')).toBe(false);
    expect(asksName('/door-gift')).toBe(false);
    expect(asksName('/c/abc')).toBe(false);
    expect(asksName('/me')).toBe(false);
  });

  it('only goes on to our own pages', () => {
    expect(safeNext('/agenda?day=day-1')).toBe('/agenda?day=day-1');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/welcome?next=/x')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
