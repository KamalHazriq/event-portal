/**
 * The live headcount, polled by the desk and the admin screens.
 *
 * Short polling rather than websockets, per brief hard rule 7, so it works
 * behind a restricted corporate network.
 */
import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { arrivalRate, sortByOutstanding } from '@/modules/check-in/logic';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const dayId = plainText(url.searchParams.get('dayId') ?? '', 64);

  const config = getEventConfig();
  if (!config.days.some((day) => day.id === dayId)) {
    return Response.json({ message: 'That is not a day of this event.' }, { status: 400 });
  }

  const data = getData();
  const headcount = await data.checkIns.headcount(dayId);
  const recent = await data.checkIns.recent(dayId, 8);

  return Response.json(
    {
      dayId,
      total: arrivalRate(headcount.arrived, headcount.expected),
      byDepartment: sortByOutstanding(headcount.byDepartment),
      recent: recent.map((row) => ({
        attendeeId: row.attendeeId,
        name: row.attendee.name,
        department: row.attendee.department,
        at: row.at,
      })),
    },
    // Never let a proxy or the browser serve a stale count.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
