/**
 * Runs before every request. Its one job is the event pass: when EVENT_PASS
 * is set, only phones that have scanned the event QR (or typed its code)
 * get in. See src/lib/event-pass.ts.
 *
 * With no EVENT_PASS, as in local work and the tests, it lets everything
 * through. The admin PIN still guards the secretariat pages either way.
 *
 * It also keeps a tablet locked to the self check in kiosk away from the
 * secretariat pages unless the PIN is entered (src/lib/kiosk.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { isOpenPath, PASS_COOKIE, PASS_COOKIE_MAX_AGE, PASS_PARAM } from '@/lib/event-pass';
import { digestMatches, eventPass, passDigest } from '@/lib/event-pass-server';
import { ADMIN_COOKIE, readSessionValue } from '@/lib/admin-session';
import { KIOSK_COOKIE, kioskBlocks, kioskLockRequested, needsAdmin } from '@/lib/kiosk';
import { isRateLimited, LIMITS, rateLimit } from '@/lib/rate-limit';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A tablet locked to the self check in kiosk has to enter the PIN to reach
  // the secretariat pages: the sign in page says why, and unlocks it.
  if (kioskBlocks(pathname, request.cookies.has(KIOSK_COOKIE))) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // The secretariat pages, checked here before anything is built: the sign
  // in cookie must be genuine and in date. (The page still checks it fully.)
  // Doing it here lets those pages show a loading screen the moment a tab is
  // tapped, while a stranger still gets a plain redirect to the PIN.
  if (needsAdmin(pathname) && !readSessionValue(request.cookies.get(ADMIN_COOKIE)?.value)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/sign-in';
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const response = passGate(request);
  // Only /kiosk?lock=1 locks; plain /kiosk is a preview.
  if (kioskLockRequested(pathname, request.nextUrl.searchParams)) {
    response.cookies.set(KIOSK_COOKIE, '1', {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 4 * 24 * 60 * 60,
    });
  }
  return response;
}

function passGate(request: NextRequest) {
  const pass = eventPass();
  if (!pass) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  if (isOpenPath(pathname)) return NextResponse.next();

  const expected = passDigest(pass);
  const offered = searchParams.get(PASS_PARAM);

  if (offered !== null) {
    // Guessing the code is slowed down. Only wrong guesses count, so a hall of
    // people on one hotel Wi-Fi, all typing it right, never lock each other out.
    const caller =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local';
    const key = `pass:${caller}`;
    if (!isRateLimited(key, LIMITS.passGuess).allowed) {
      return new NextResponse('Too many tries. Wait a few minutes, then try again.', {
        status: 429,
        headers: { 'Retry-After': '300' },
      });
    }
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
    rateLimit(key, LIMITS.passGuess);
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
