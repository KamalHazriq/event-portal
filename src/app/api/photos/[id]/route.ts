/**
 * Serves one photo. Approved photos are public, since they are on the big
 * screen anyway. Anything still waiting, or rejected, is for the secretariat
 * only.
 */
import { getData } from '@/data';
import { getAdminSession } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';
import { cachedImage, keepImage } from '@/modules/photos/image-cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: raw } = await params;
  const id = plainText(raw, 64);
  const size = new URL(request.url).searchParams.get('size') === 'thumb' ? 'thumb' : 'full';

  // An approved photo many phones are looking at: from memory, not the database.
  const kept = cachedImage(id, size);
  if (kept) return send(kept, true);

  const found = await getData().photos.image(id, size);
  if (!found) return new Response('Not found', { status: 404 });

  const approved = found.photo.status === 'approved';
  if (!approved && !(await getAdminSession())) return new Response('Not found', { status: 404 });
  const bytes = new Uint8Array(found.bytes);
  if (approved) keepImage(id, size, bytes);
  return send(bytes, approved);
}

function send(bytes: Uint8Array, approved: boolean): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      // Short, so a photo rejected after approval disappears within minutes.
      'Cache-Control': approved ? 'public, max-age=300' : 'private, no-store',
    },
  });
}
