import { NextResponse } from 'next/server';

import { getData } from '@/data';

export const dynamic = 'force-dynamic';

/**
 * For an uptime check (Google Cloud Monitoring, or any pinger): 200 when the
 * portal and its database both answer, 503 when the database does not.
 * Holds nothing about the event, so it is open.
 */
export async function GET() {
  const started = Date.now();
  try {
    await getData().settings.get('health.ping');
    return NextResponse.json(
      { ok: true, dbMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
