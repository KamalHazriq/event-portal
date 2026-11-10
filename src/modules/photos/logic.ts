/**
 * The photo wall (an extra from the brief). Pure functions, see logic.test.ts.
 *
 * Attendees' phones shrink each photo before it is sent (see compress.ts),
 * so the server only has to check what arrives: that it really is a JPEG,
 * of a sensible size, and that the phone has not passed its allowance.
 */

export const PHOTO_LIMITS = {
  perDevice: 10,
  /** Longest side after shrinking in the browser. */
  longestSide: 1600,
  thumbLongestSide: 480,
  /** Generous ceilings, well above what the browser produces. */
  maxImageBytes: 1_500_000,
  maxThumbBytes: 250_000,
  maxDimension: 2000,
  maxCaption: 120,
} as const;

/** How long each photo stays up in the big screen slideshow. */
export const SLIDE_MS = 8_000;

/**
 * Reads the width and height out of a JPEG's header, or null if the bytes are
 * not a JPEG. Checking the bytes, not the file name or the type the browser
 * claims, is what stops anything else being stored and served as a photo.
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return null;
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1] as number;
    // Padding bytes between segments.
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Markers with no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number);
    if (length < 2) return null;
    // Start of frame: baseline, extended, progressive (C0 to CF, except the
    // three that are not frames).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((bytes[i + 5] as number) << 8) | (bytes[i + 6] as number);
      const width = ((bytes[i + 7] as number) << 8) | (bytes[i + 8] as number);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    // Start of scan without a frame first means a broken file.
    if (marker === 0xda) return null;
    i += 2 + length;
  }
  return null;
}

export type UploadProblem =
  'not-a-photo' | 'too-big' | 'too-many' | 'switched-off' | 'rate-limited' | 'failed';

/** Checks one upload. Returns the photo's size, or the reason it is refused. */
export function checkUpload(input: {
  image: Uint8Array;
  thumbnail: Uint8Array;
  alreadySent: number;
}): { ok: true; width: number; height: number } | { ok: false; problem: UploadProblem } {
  if (input.alreadySent >= PHOTO_LIMITS.perDevice) return { ok: false, problem: 'too-many' };
  if (
    input.image.byteLength > PHOTO_LIMITS.maxImageBytes ||
    input.thumbnail.byteLength > PHOTO_LIMITS.maxThumbBytes
  ) {
    return { ok: false, problem: 'too-big' };
  }
  const size = jpegSize(input.image);
  if (!size || !jpegSize(input.thumbnail)) return { ok: false, problem: 'not-a-photo' };
  if (size.width > PHOTO_LIMITS.maxDimension || size.height > PHOTO_LIMITS.maxDimension) {
    return { ok: false, problem: 'too-big' };
  }
  return { ok: true, ...size };
}

export function uploadMessage(problem: UploadProblem): string {
  switch (problem) {
    case 'not-a-photo':
      return 'That file is not a photo the portal can use. Try another one.';
    case 'too-big':
      return 'That photo is too large, even after shrinking. Try another one.';
    case 'too-many':
      return `You have shared ${PHOTO_LIMITS.perDevice} photos, which is the most one phone can send. Thank you!`;
    case 'switched-off':
      return 'The photo wall is not open right now.';
    case 'rate-limited':
      return 'That was a lot of photos at once. Wait a minute and try again.';
    case 'failed':
      return 'The photo did not arrive. Check your connection and try again.';
    default: {
      const unreachable: never = problem;
      return String(unreachable);
    }
  }
}

/** The fitted size for a longest side, keeping the shape. Never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  longest: number,
): { width: number; height: number } {
  const scale = Math.min(1, longest / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** File names inside the zip of approved photos: photo-001.jpg and so on. */
export function zipName(index: number): string {
  return `photo-${String(index + 1).padStart(3, '0')}.jpg`;
}
