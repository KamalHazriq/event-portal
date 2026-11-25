/**
 * Likes and comments on the photo wall. A comment is an ordinary comment
 * stored against the id "photo:<photo id>", so it follows the same approval
 * switch and shows in the secretariat's Comments list. A like is one phone,
 * once, kept as a list of phone ids in a settings row.
 *
 * Server only.
 */
import { getData } from '@/data';

export const PHOTO_SESSION_PREFIX = 'photo:';
export const PHOTO_LIKE_PREFIX = 'photolike.';
const MAX_LIKERS = 5000;

export const photoSessionId = (photoId: string): string => `${PHOTO_SESSION_PREFIX}${photoId}`;
export const isPhotoSession = (sessionId: string): boolean =>
  sessionId.startsWith(PHOTO_SESSION_PREFIX);

function parseLikers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** One like per phone. Returns false when this phone had already liked it. */
export async function likePhoto(
  photoId: string,
  deviceId: string,
): Promise<{ counted: boolean; likes: number }> {
  const data = getData();
  const key = `${PHOTO_LIKE_PREFIX}${photoId}`;
  const likers = parseLikers(await data.settings.get(key));
  if (likers.includes(deviceId)) return { counted: false, likes: likers.length };
  if (likers.length >= MAX_LIKERS) return { counted: false, likes: likers.length };
  likers.push(deviceId);
  await data.settings.set(key, JSON.stringify(likers));
  return { counted: true, likes: likers.length };
}

/** Likes per photo, and which of them this phone has liked. */
export async function photoLikes(
  deviceId: string | null,
): Promise<{ counts: Map<string, number>; mine: Set<string> }> {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const row of await getData().settings.getAll()) {
    if (!row.key.startsWith(PHOTO_LIKE_PREFIX)) continue;
    const id = row.key.slice(PHOTO_LIKE_PREFIX.length);
    const likers = parseLikers(row.value);
    counts.set(id, likers.length);
    if (deviceId && likers.includes(deviceId)) mine.add(id);
  }
  return { counts, mine };
}
