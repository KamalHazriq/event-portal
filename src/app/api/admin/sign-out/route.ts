import { NextResponse } from 'next/server';

import { ADMIN_COOKIE, cookieOptions } from '@/lib/admin-session';

/** Relative Location, for the same reason as sign-in. */
export async function POST(): Promise<NextResponse> {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/admin/sign-in' },
  });
  response.cookies.set(ADMIN_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
