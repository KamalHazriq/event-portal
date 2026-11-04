/**
 * Signs a desk in with the admin PIN.
 *
 * A plain form POST to a route handler, not a Server Action, so the sign in
 * screen works even with no JavaScript. The desk may be on poor hotel Wi-Fi
 * and this is the one page that must not fail.
 */
import { NextResponse } from 'next/server';

import {
  ADMIN_COOKIE,
  cookieOptions,
  createSessionValue,
  normaliseOperator,
} from '@/lib/admin-session';
import { getAdminPin, pinMatches } from '@/lib/auth';
import { isRateLimited, LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';

/** Only ever used to send someone back inside this portal. */
function safeNext(value: string | null): string {
  if (!value) return '/admin';
  // Must be a path on this site. "//evil.example" is not.
  if (!value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

/**
 * Redirects to a path rather than a full address.
 *
 * Building an absolute URL from request.url can answer with a different host
 * from the one the browser asked for, for example localhost when the desk
 * typed an IP address. The cookie is then set on one origin and the redirect
 * lands on another, so the desk appears to sign in and immediately get sent
 * back. A relative Location keeps whatever origin the browser is using.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

function backToForm(next: string, error: string): NextResponse {
  const query = new URLSearchParams({ next, error });
  return redirectTo(`/admin/sign-in?${query.toString()}`);
}

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const next = safeNext(plainText(String(form.get('next') ?? ''), 200));
  const pin = getAdminPin();

  if (!pin) {
    return backToForm(next, 'no-pin');
  }

  // Keyed on the caller so one desk getting it wrong cannot lock out another.
  const caller =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';

  // Only wrong PINs count towards the limit. Two or three people at one event
  // share the hotel's single public address, so counting their successful
  // sign ins as well would let them lock each other out.
  const key = `pin:${caller}`;
  if (!isRateLimited(key, LIMITS.adminPin).allowed) {
    return backToForm(next, 'too-many');
  }

  const entered = plainText(String(form.get('pin') ?? ''), 40);
  if (!pinMatches(entered, pin)) {
    rateLimit(key, LIMITS.adminPin);
    return backToForm(next, 'wrong-pin');
  }

  const operator = normaliseOperator(String(form.get('operator') ?? 'desk'));
  const response = redirectTo(next);
  response.cookies.set(ADMIN_COOKIE, createSessionValue(operator, pin), cookieOptions);
  return response;
}
