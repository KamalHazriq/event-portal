/** A lead's photo for the screensaver. Small, and already on the projector. */
import { getData } from '@/data';
import { plainText } from '@/lib/text';
import { LOOP_PHOTO_PREFIX, safePhoto } from '@/modules/loop/logic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const raw = await getData().settings.get(`${LOOP_PHOTO_PREFIX}${plainText(id, 40)}`);
  const photo = safePhoto(raw);
  if (!photo) return new Response('Not found', { status: 404 });
  const bytes = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
