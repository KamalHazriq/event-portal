/**
 * Shrinks a photo on the phone before it is sent, per the brief: a 12 MB
 * camera photo becomes a JPEG of about 1600 px on its longest side, a few
 * hundred KB, so it uploads quickly on hotel Wi-Fi.
 *
 * Browser only. createImageBitmap applies the camera's rotation tag, so
 * portrait photos stay upright. Re-encoding through a canvas also drops the
 * photo's hidden details (location, camera, time), which never reach the
 * server.
 */
import { fitWithin, PHOTO_LIMITS } from './logic';

async function encode(
  bitmap: ImageBitmap,
  longest: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const size = fitWithin(bitmap.width, bitmap.height, longest);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot shrink photos.');
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('This browser cannot shrink photos.');
  return { blob, ...size };
}

export async function shrinkPhoto(file: File): Promise<{ image: Blob; thumbnail: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const image = await encode(bitmap, PHOTO_LIMITS.longestSide, 0.82);
    const thumbnail = await encode(bitmap, PHOTO_LIMITS.thumbLongestSide, 0.72);
    return { image: image.blob, thumbnail: thumbnail.blob };
  } finally {
    bitmap.close();
  }
}
