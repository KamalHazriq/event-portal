import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** The server's clock, for the Device check page. Nothing else in it. */
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
