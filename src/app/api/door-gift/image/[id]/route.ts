/**
 * An uploaded door gift photo. Not secret (it is on the desk screen and
 * phones), so it may be kept for a day: a new upload changes the address.
 */
import { getData } from '@/data';
import { plainText } from '@/lib/text';
import { GIFT_IMAGE_PREFIX, giftImageData } from '@/modules/door-gift/logic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = plainText((await params).id, 40);
  const stored = giftImageData(await getData().settings.get(`${GIFT_IMAGE_PREFIX}${id}`));
  if (!stored) return new Response('Not found', { status: 404 });
  const [head, base64] = stored.split(',', 2);
  const type = head!.slice(5, head!.indexOf(';'));
  return new Response(Buffer.from(base64!, 'base64'), {
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
