/**
 * Serves one photo. Approved photos are public, since they are on the big
 * screen anyway. Anything still waiting, or rejected, is for the secretariat
 * only.
 */
import { getData } from '@/data';
import { getAdminSession } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const size = new URL(request.url).searchParams.get('size') === 'thumb' ? 'thumb' : 'full';
  const found = await getData().photos.image(plainText(id, 64), size);
  if (!found) return new Response('Not found', { status: 404 });

  const approved = found.photo.status === 'approved';
  if (!approved && !(await getAdminSession())) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(found.bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      // Short, so a photo rejected after approval disappears within minutes.
      'Cache-Control': approved ? 'public, max-age=300' : 'private, no-store',
    },
  });
}
