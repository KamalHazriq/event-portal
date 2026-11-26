/**
 * Receives one photo from an attendee's phone, already shrunk in the browser.
 * Every photo waits for an organiser's approval before it is shown anywhere.
 */
import { cookies } from 'next/headers';
import { after } from 'next/server';

import { getData } from '@/data';
import { objectStoreFromEnv } from '@/data/object-storage';
import { getEventConfig } from '@/lib/config';
import { DEVICE_COOKIE, deviceCookieOptions, newDeviceId, readDeviceId } from '@/lib/device';
import { LIMITS, rateLimit } from '@/lib/rate-limit';
import { notifyTeamWaiting } from '@/modules/announce/team';
import { plainText } from '@/lib/text';
import {
  checkUpload,
  moderationOn,
  PHOTO_KEYS,
  HIGH_QUALITY,
  PHOTO_LIMITS,
  type UploadProblem,
  uploadMessage,
} from '@/modules/photos/logic';

function refuse(problem: UploadProblem, status: number): Response {
  return Response.json({ ok: false, problem, message: uploadMessage(problem) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!getEventConfig().features.photoWall) return refuse('switched-off', 403);

  // The body is two small JPEGs; anything far bigger is not from our page.
  const declared = Number(request.headers.get('content-length') ?? 0);
  // Larger and sharper when photos go to object storage; the database keeps the small size.
  const high = objectStoreFromEnv() !== null;
  const imageCeiling = high ? HIGH_QUALITY.maxImageBytes : PHOTO_LIMITS.maxImageBytes;
  if (declared > imageCeiling + PHOTO_LIMITS.maxThumbBytes + 64 * 1024) {
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

  const checked = checkUpload({ image: imageBytes, thumbnail: thumbBytes }, high);
  if (!checked.ok) {
    return refuse(checked.problem, checked.problem === 'too-many' ? 403 : 400);
  }

  // Every photo needs a few words about it.
  const caption = plainText(form.get('caption'), PHOTO_LIMITS.maxCaption).trim();
  if (caption.length < 2) return refuse('caption-needed', 400);

  // Straight onto the wall when the secretariat has switched approval off.
  const approved = !moderationOn(await data.settings.get(PHOTO_KEYS.moderation));
  await data.photos.add({
    deviceId,
    status: approved ? 'approved' : 'pending',
    caption,
    width: checked.width,
    height: checked.height,
    image: imageBytes,
    thumbnail: thumbBytes,
  });

  if (!existing) store.set(DEVICE_COOKIE, deviceId, deviceCookieOptions);
  // Tell the team's phones something is waiting (after this answer is sent).
  if (!approved) after(() => notifyTeamWaiting('photo').catch(() => undefined));
  return Response.json({ ok: true, sent: alreadySent + 1, approved });
}
