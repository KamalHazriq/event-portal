import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { getEventConfig } from '@/lib/config';
import { resolveEventNow } from '@/lib/time';
import { runFeedbackNudges } from '@/modules/announce/nudges';
import { dispatchDueReminders } from '@/modules/reminders/dispatch';
import { secretMatches } from '@/modules/reminders/logic';

export const dynamic = 'force-dynamic';

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Cloud Scheduler calls this every minute with `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: NextRequest) {
  const offered = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || null;
  if (!secretMatches(process.env.CRON_SECRET, offered, equal)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  const sent = await dispatchDueReminders();
  // The feedback reminders ride on the same minute, so they never depend on a screen being open.
  const nudged = await runFeedbackNudges(
    resolveEventNow({ timezone: getEventConfig().event.timezone }),
  ).catch(() => 0);
  return NextResponse.json({ ok: true, sent, nudged });
}
