/**
 * Receives one photo from an attendee's phone, already shrunk in the browser.
 * Every photo waits for an organiser's approval before it is shown anywhere.
 */
import { cookies } from 'next/headers';

import { getData } from '@/data';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, deviceCookieOptions, newDeviceId, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { plainText } from '@/lib/text';
import {
  checkUpload,
  PHOTO_LIMITS,
  uploadMessage,
  type UploadProblem,
} from '@/modules/photos/logic';

function refuse(problem: UploadProblem, status: number): Response {
  return Response.json({ ok: false, problem, message: uploadMessage(problem) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!getEventConfig().features.photoWall) return refuse('switched-off', 403);

  // The body is two small JPEGs; anything far bigger is not from our page.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > PHOTO_LIMITS.maxImageBytes + PHOTO_LIMITS.maxThumbBytes + 64 * 1024) {
    return refuse('too-big', 413);
  }

  const store = await cookies();
  const existing = readDeviceId(store.get(DEVICE_COOKIE)?.value);
  const deviceId = existing ?? newDeviceId();

  const caller =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  if (!rateLimit(`photo:${deviceId}:${caller}`, LIMITS.photoUpload).allowed) {
    return refuse('rate-limited', 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse('failed', 400);
  }
  const image = form.get('image');
  const thumbnail = form.get('thumbnail');
  if (!(image instanceof File) || !(thumbnail instanceof File)) return refuse('not-a-photo', 400);

  const data = getData();
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const thumbBytes = new Uint8Array(await thumbnail.arrayBuffer());
  const alreadySent = await data.photos.countByDevice(deviceId);

  const checked = checkUpload({ image: imageBytes, thumbnail: thumbBytes, alreadySent });
  if (!checked.ok) {
    return refuse(checked.problem, checked.problem === 'too-many' ? 403 : 400);
  }

  await data.photos.add({
    deviceId,
    caption: plainText(form.get('caption'), PHOTO_LIMITS.maxCaption),
    width: checked.width,
    height: checked.height,
    image: imageBytes,
    thumbnail: thumbBytes,
  });

  if (!existing) store.set(DEVICE_COOKIE, deviceId, deviceCookieOptions);
  return Response.json({ ok: true, sent: alreadySent + 1 });
}
