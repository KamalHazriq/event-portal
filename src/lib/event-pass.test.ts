import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

import { displayUrl, isOpenPath, PASS_COOKIE, withPass } from './event-pass';
import { digestMatches, passDigest } from './event-pass-server';
import { resetRateLimits } from './rate-limit';
import { ADMIN_COOKIE, createSessionValue } from './admin-session';

const PASS = 'SUMMIT27';
const request = (path: string, cookie?: string) =>
  new NextRequest(`https://portal.example.com${path}`, {
    headers: cookie ? { cookie: `${PASS_COOKIE}=${cookie}` } : {},
  });

afterEach(() => {
  resetRateLimits();
  vi.unstubAllEnvs();
});

describe('the event pass gate', () => {
  it('lets everything through when no pass is set', () => {
    vi.stubEnv('EVENT_PASS', '');
    const response = proxy(request('/agenda'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('shows the gate page, at the same address, to a phone without the pass', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/agenda'));
    // A normal page status, so an app on an iPhone home screen shows it.
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://portal.example.com/pass');
  });

  it('answers 401 to API calls without the pass', async () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/api/headcount'));
    expect(response.status).toBe(401);
    expect(await response.json()).toHaveProperty('error');
  });

  it('takes the right code, remembers it, and drops it from the address', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/poll?pass=SUMMIT27&x=1'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://portal.example.com/poll?x=1');
    const cookie = response.cookies.get(PASS_COOKIE);
    expect(cookie?.value).toBe(passDigest(PASS));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });

  it('ignores spaces around a typed code', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    expect(proxy(request('/?pass=%20SUMMIT27%20')).status).toBe(307);
  });

  it('says so when the code is wrong', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/?pass=nope'));
    expect(response.headers.get('x-middleware-rewrite')).toContain('/pass?wrong=1');
  });

  it('slows down someone guessing the code, but only that one address', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const from = (ip: string, code: string) =>
      new NextRequest(`https://portal.example.com/agenda?pass=${code}`, {
        headers: { 'x-forwarded-for': ip },
      });
    for (let i = 0; i < 30; i += 1) {
      expect(proxy(from('203.0.113.9', `WRONG${i}`)).headers.get('x-middleware-rewrite')).toContain(
        '/pass?wrong=1',
      );
    }
    // The next try is refused, even with the right code.
    expect(proxy(from('203.0.113.9', PASS)).status).toBe(429);
    // Someone else at another address is not affected.
    expect(proxy(from('198.51.100.4', PASS)).status).toBe(307);
  });

  it('does not count right codes, so one hall on one Wi-Fi never locks itself out', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    for (let i = 0; i < 60; i += 1) {
      const res = proxy(
        new NextRequest(`https://portal.example.com/?pass=${PASS}`, {
          headers: { 'x-forwarded-for': '203.0.113.50' },
        }),
      );
      expect(res.status).toBe(307);
    }
  });

  it('never asks the secretariat for the event code', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    vi.stubEnv('ADMIN_PIN', '739218');
    // The PIN page itself is open.
    expect(proxy(request('/admin/sign-in')).headers.get('x-middleware-next')).toBe('1');
    // A signed in desk gets the attendee pages and the APIs without the code.
    const desk = createSessionValue('desk-1', '739218', Date.now() + 60_000);
    const signedIn = new NextRequest('https://portal.example.com/agenda', {
      headers: { cookie: `${ADMIN_COOKIE}=${desk}` },
    });
    expect(proxy(signedIn).headers.get('x-middleware-next')).toBe('1');
    // A forged cookie does not.
    const forged = new NextRequest('https://portal.example.com/agenda', {
      headers: { cookie: `${ADMIN_COOKIE}=bogus.value` },
    });
    expect(proxy(forged).headers.get('x-middleware-rewrite')).toContain('/pass');
  });

  it('lets a phone with the cookie in', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/agenda', passDigest(PASS)));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('signs everyone out when the pass changes', () => {
    vi.stubEnv('EVENT_PASS', 'NEWCODE');
    expect(
      proxy(request('/agenda', passDigest(PASS))).headers.get('x-middleware-rewrite'),
    ).toContain('/pass');
  });

  it('never blocks the logo and the page scripts', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    for (const path of [
      '/branding/d-logo.webp',
      '/_next/static/chunk.js',
      '/favicon.ico',
      '/admin/app.webmanifest',
    ]) {
      expect(isOpenPath(path)).toBe(true);
      expect(proxy(request(path)).headers.get('x-middleware-next')).toBe('1');
    }
    expect(isOpenPath('/admin')).toBe(false);
  });
});

describe('links with the pass', () => {
  it('adds the pass to QR links only when there is one', () => {
    expect(withPass('https://a.example/poll', 'X1')).toBe('https://a.example/poll?pass=X1');
    expect(withPass('https://a.example/poll', null)).toBe('https://a.example/poll');
  });

  it('prints the address without the pass or https', () => {
    expect(displayUrl('https://a.example/portal?pass=X1')).toBe('a.example/portal');
    expect(displayUrl('https://a.example/')).toBe('a.example');
  });

  it('compares digests safely', () => {
    expect(digestMatches(passDigest('a'), passDigest('a'))).toBe(true);
    expect(digestMatches(passDigest('a'), passDigest('b'))).toBe(false);
    expect(digestMatches(undefined, passDigest('a'))).toBe(false);
    expect(digestMatches('short', passDigest('a'))).toBe(false);
  });
});
