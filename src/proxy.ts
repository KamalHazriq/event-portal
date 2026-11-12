/**
 * Runs before every request. Its one job is the event pass: when EVENT_PASS
 * is set, only phones that have scanned the event QR (or typed its code)
 * get in. See src/lib/event-pass.ts.
 *
 * With no EVENT_PASS, as in local work and the tests, it lets everything
 * through. The admin PIN still guards the secretariat pages either way.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { isOpenPath, PASS_COOKIE, PASS_COOKIE_MAX_AGE, PASS_PARAM } from '@/lib/event-pass';
import { digestMatches, eventPass, passDigest } from '@/lib/event-pass-server';

export function proxy(request: NextRequest) {
  const pass = eventPass();
  if (!pass) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();

  const expected = passDigest(pass);
  const offered = searchParams.get(PASS_PARAM);

  if (offered !== null) {
    if (digestMatches(passDigest(offered.trim()), expected)) {
      // Into the page they asked for, with the code out of the address bar
      // so it is not shared by accident with a screenshot.
      const clean = request.nextUrl.clone();
      clean.searchParams.delete(PASS_PARAM);
      const response = NextResponse.redirect(clean);
      response.cookies.set(PASS_COOKIE, expected, {
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: PASS_COOKIE_MAX_AGE,
      });
      return response;
    }
    return gate(request, true);
  }

  if (digestMatches(request.cookies.get(PASS_COOKIE)?.value, expected)) {
    return NextResponse.next();
  }
  return gate(request, false);
}

function gate(request: NextRequest, wrong: boolean) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'This portal is for event participants only.' },
      { status: 401 },
    );
  }
  // A rewrite, not a redirect: the address stays the one they asked for, so
  // typing the code on the gate page brings them back to it.
  const url = request.nextUrl.clone();
  url.pathname = '/pass';
  url.search = wrong ? '?wrong=1' : '';
  return NextResponse.rewrite(url, { status: 401 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
