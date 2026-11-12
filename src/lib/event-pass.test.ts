import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

import { displayUrl, isOpenPath, PASS_COOKIE, withPass } from './event-pass';
import { digestMatches, passDigest } from './event-pass-server';

const PASS = 'SUMMIT27';
const request = (path: string, cookie?: string) =>
  new NextRequest(`https://portal.example.com${path}`, {
    headers: cookie ? { cookie: `${PASS_COOKIE}=${cookie}` } : {},
  });

afterEach(() => {
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
    expect(response.status).toBe(401);
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
    expect(response.status).toBe(401);
    expect(response.headers.get('x-middleware-rewrite')).toContain('/pass?wrong=1');
  });

  it('lets a phone with the cookie in', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    const response = proxy(request('/agenda', passDigest(PASS)));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('signs everyone out when the pass changes', () => {
    vi.stubEnv('EVENT_PASS', 'NEWCODE');
    expect(proxy(request('/agenda', passDigest(PASS))).status).toBe(401);
  });

  it('never blocks the logo and the page scripts', () => {
    vi.stubEnv('EVENT_PASS', PASS);
    for (const path of ['/branding/d-logo.webp', '/_next/static/chunk.js', '/favicon.ico']) {
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
