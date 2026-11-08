/**
 * The one click Excel report (Module 7). Admin only.
 *
 * Built fresh on every download, so it is always up to date. For about 90
 * people it takes milliseconds.
 */
import { requireAdminApi } from '@/lib/admin-guard';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { writeXlsx } from '@/lib/xlsx/write';
import { buildReportWorkbook, reportFileName } from '@/modules/reports/logic';
import { loadReportInput } from '@/modules/reports/load';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`report:${auth.session.operator}`, LIMITS.report);
  if (!limit.allowed) {
    return new Response('Too many downloads in a row. Wait a minute and try again.', {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfter) },
    });
  }

  const input = await loadReportInput();
  const file = writeXlsx(buildReportWorkbook(input));
  const name = reportFileName(
    input.config.event.shortName,
    input.generatedAt,
    input.config.event.timezone,
  );

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      // It holds names: never let a proxy or the browser keep a copy.
      'Cache-Control': 'no-store',
    },
  });
}
