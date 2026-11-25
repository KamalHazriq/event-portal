/**
 * The photo wall (an extra from the brief). Pure functions, see logic.test.ts.
 *
 * Attendees' phones shrink each photo before it is sent (see compress.ts),
 * so the server only has to check what arrives: that it really is a JPEG,
 * and of a sensible size. There is no limit per phone: share as many as you
 * like (a rate limit in the upload route still stops a runaway script).
 */

export const PHOTO_LIMITS = {
  /** Longest side after shrinking in the browser. */
  /** Sharp on a 1080p projector, with room to spare. */
  longestSide: 2048,
  /** Tiles on the wall are up to a quarter of the screen wide. */
  thumbLongestSide: 900,
  /** Generous ceilings, well above what the browser produces. */
  maxImageBytes: 3_500_000,
  maxThumbBytes: 700_000,
  maxDimension: 2100,
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
  | 'not-a-photo'
  | 'too-big'
  | 'too-many'
  | 'switched-off'
  | 'rate-limited'
  | 'caption-needed'
  | 'failed';

/** Checks one upload. Returns the photo's size, or the reason it is refused. */
export function checkUpload(input: {
  image: Uint8Array;
  thumbnail: Uint8Array;
}): { ok: true; width: number; height: number } | { ok: false; problem: UploadProblem } {
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
      return 'You have shared a lot of photos in a short time. Wait a moment, then try again.';
    case 'switched-off':
      return 'The photo wall is not open right now.';
    case 'rate-limited':
      return 'That was a lot of photos at once. Wait a minute and try again.';
    case 'caption-needed':
      return 'Every photo needs a caption. Write a few words about it, then share.';
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

/* ---------------------------------------------------- the wall's settings */

export const PHOTO_KEYS = {
  /** "off" puts new photos straight on the wall, without approval. */
  moderation: 'photos.moderation',
  /** How the big screen lays the photos out. */
  layout: 'photos.layout',
} as const;

export function moderationOn(stored: string | null): boolean {
  return stored !== 'off';
}

export const PHOTO_LAYOUTS = ['slideshow', 'grid', 'mosaic'] as const;
export type PhotoLayout = (typeof PHOTO_LAYOUTS)[number];

export const PHOTO_LAYOUT_INFO: Record<PhotoLayout, { title: string; description: string }> = {
  slideshow: {
    title: 'Slideshow',
    description: 'One photo at a time, full screen, a new one every 8 seconds.',
  },
  grid: {
    title: 'Scrolling wall',
    description:
      'Every photo in four columns drifting slowly down, each in its own shape, round and round.',
  },
  mosaic: {
    title: 'Mosaic',
    description:
      'One photo large with eight smaller around it, turning to the next nine every 12 seconds.',
  },
};

export function resolvePhotoLayout(stored: string | null): PhotoLayout {
  return (PHOTO_LAYOUTS as readonly string[]).includes(stored ?? '')
    ? (stored as PhotoLayout)
    : 'slideshow';
}

/** How many photos each layout shows at once. */
/**
 * How many photos the wall loads. The grid and mosaic show a page at a time
 * and turn the page every few seconds, so every photo gets its turn.
 */
export const LAYOUT_COUNT: Record<PhotoLayout, number> = {
  slideshow: 300,
  grid: 300,
  mosaic: 300,
};

/** Photos on one page of the grid, and of the mosaic (one large and eight). */
export const GRID_PAGE = 12;
export const MOSAIC_PAGE = 9;
/** How long each page of the wall stays up. */
export const WALL_PAGE_MS = 12_000;

/** The photos on one page, turning over every page in order. */
export function wallPage<T>(
  items: T[],
  size: number,
  tick: number,
): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = ((tick % pages) + pages) % pages;
  return { items: items.slice(page * size, page * size + size), page, pages };
}

/** How long a newly arrived photo stays up large before it joins the wall. */
export const NEW_PHOTO_MS = 6_000;

/**
 * Columns and rows for the projector grid, so a few photos fill the screen
 * instead of sitting small in one corner. Up to twelve, four across.
 */
export function gridShape(count: number): { columns: number; rows: number } {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 3, rows: 2 };
  if (count <= 9) return { columns: 3, rows: 3 };
  return { columns: 4, rows: 3 };
}

/** Mosaic needs a few photos around the big one; below this it shows the grid. */
export const MOSAIC_MIN = 5;
