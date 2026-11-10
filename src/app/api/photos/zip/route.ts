/**
 * Every approved photo as one zip, for after the event. Admin only.
 */
import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { writeZip } from '@/lib/xlsx/zip';
import { zipName } from '@/modules/photos/logic';
import { localDateTime } from '@/modules/reports/logic';
import { recordActivity } from '@/modules/admins/record';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  await recordActivity('Downloaded the approved photos', auth.session.operator);
  const config = getEventConfig();
  const data = getData();
  // Oldest first, so the numbering follows the event.
  const approved = (await data.photos.list('approved')).reverse();

  const entries = [];
  const captions = ['file,caption,sent'];
  for (const [i, photo] of approved.entries()) {
    const found = await data.photos.image(photo.id, 'full');
    if (!found) continue;
    entries.push({ name: zipName(i), data: Buffer.from(found.bytes), store: true });
    // A leading = + - or @ would run as a formula when the CSV opens in Excel.
    const safe = /^[=+\-@]/.test(photo.caption) ? `'${photo.caption}` : photo.caption;
    const quoted = `"${safe.replace(/"/g, '""')}"`;
    captions.push(
      `${zipName(i)},${quoted},${localDateTime(photo.createdAt, config.event.timezone)}`,
    );
  }
  entries.push({ name: 'captions.csv', data: Buffer.from(captions.join('\n'), 'utf8') });

  const slug = config.event.shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'event';
  return new Response(new Uint8Array(writeZip(entries)), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}-photos.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
