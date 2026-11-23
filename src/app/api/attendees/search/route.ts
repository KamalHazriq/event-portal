/**
 * Manual name search, the fallback at the registration desk when a QR code
 * will not scan or someone has lost their tag.
 */
import { getData } from '@/data';
import { shortDepartment } from '@/lib/departments';
import { getEventConfig } from '@/lib/config';
import { requireAdminApi } from '@/lib/admin-guard';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import { findByName } from '@/modules/points/logic';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`search:${auth.session.operator}`, LIMITS.search);
  if (!limit.allowed) {
    return Response.json(
      { results: [], message: 'Too many searches, wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const query = plainText(url.searchParams.get('q') ?? '', 80);
  const dayId = plainText(url.searchParams.get('dayId') ?? '', 64);
  const everyone = url.searchParams.get('all') === '1';

  // The self check in kiosk: the person types their own name, so it shows
  // only names that start the way they typed (three letters or more), a few
  // at a time, and nothing but the name and department.
  if (url.searchParams.get('kiosk') === '1') {
    const config = getEventConfig();
    const found = findByName(await getData().attendees.list(), query, 5);
    return Response.json({
      results: found.map((p) => ({
        id: p.id,
        name: p.name,
        department: shortDepartment(config, p.department),
      })),
    });
  }

  if (!everyone && query.length < 2) {
    return Response.json({ results: [], message: 'Type at least two letters.' });
  }

  const config = getEventConfig();
  const data = getData();
  const [people, arrivals] = await Promise.all([
    data.attendees.list(),
    dayId ? data.checkIns.listByDay(dayId) : Promise.resolve([]),
  ]);
  const arrivedAt = new Map(arrivals.map((c) => [c.attendeeId, c.at]));

  // The whole list is about a hundred people, so matching is done here:
  // a name, a staff number or a department (in full or the short name).
  const q = query.toLowerCase();
  const matches = everyone
    ? people
    : people.filter((p) =>
        [p.name, p.staffNo, p.department, shortDepartment(config, p.department)].some((field) =>
          field.toLowerCase().includes(q),
        ),
      );
  const sorted = [...matches].sort((a, b) =>
    everyone
      ? a.department.localeCompare(b.department) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name),
  );
  const limited = everyone ? sorted : sorted.slice(0, 60);

  const results = limited.map((person) => ({
    id: person.id,
    name: person.name,
    title: person.title,
    department: shortDepartment(config, person.department),
    remark: person.remark,
    staffNo: person.staffNo,
    checkedIn: arrivedAt.has(person.id),
    checkedInAt: arrivedAt.get(person.id) ?? null,
  }));

  return Response.json({
    results,
    truncated: !everyone && sorted.length > limited.length,
    message: results.length === 0 ? 'Nobody matches that.' : '',
  });
}
