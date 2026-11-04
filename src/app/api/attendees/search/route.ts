/**
 * Manual name search, the fallback at the registration desk when a QR code
 * will not scan or someone has lost their tag.
 */
import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';

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

  if (query.length < 2) {
    return Response.json({ results: [], message: 'Type at least two letters.' });
  }

  const data = getData();
  const people = await data.attendees.search(query, 25);

  // Say who is already in, so the desk does not scan someone twice.
  const results = await Promise.all(
    people.map(async (person) => {
      const existing = dayId ? await data.checkIns.get(person.id, dayId) : null;
      return {
        id: person.id,
        name: person.name,
        title: person.title,
        department: person.department,
        remark: person.remark,
        staffNo: person.staffNo,
        checkedIn: existing !== null,
        checkedInAt: existing?.at ?? null,
      };
    }),
  );

  return Response.json({ results, message: results.length === 0 ? 'Nobody matches that.' : '' });
}
