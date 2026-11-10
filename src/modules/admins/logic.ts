/**
 * Who is signed in, and what the desks did (Module 6: two or three admins at
 * once). Pure functions, see logic.test.ts.
 */
import type { OperatorPresence } from '@/data/types';

/** Seen this recently counts as "here now". Live pages refresh well inside it. */
export const ACTIVE_MS = 2 * 60 * 1000;
/** Shown, greyed, for this long after going quiet. */
export const SHOWN_MS = 30 * 60 * 1000;

export type PresenceRow = OperatorPresence & { active: boolean; isYou: boolean; ago: string };

/** "now", "3 min ago", "1 hr 5 min ago". */
export function agoLabel(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr ago` : `${hours} hr ${rest} min ago`;
}

/** The desks to show: you first, then the most recently seen. */
export function presenceRows(seen: OperatorPresence[], you: string, nowMs: number): PresenceRow[] {
  return seen
    .map((p) => {
      const age = nowMs - new Date(p.lastSeenAt).getTime();
      return { ...p, active: age < ACTIVE_MS, isYou: p.operator === you, ago: agoLabel(age) };
    })
    .sort((a, b) => Number(b.isYou) - Number(a.isYou) || (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
}

/** Admin paths as words, for the "on" column. */
export function pageLabel(path: string): string {
  const names: Record<string, string> = {
    '/admin': 'Home',
    '/admin/live': 'Live control',
    '/admin/desk': 'Registration desk',
    '/admin/headcount': 'Headcount',
    '/admin/feedback': 'Feedback',
    '/admin/big-screen': 'Big screen control',
    '/admin/reports': 'Reports',
    '/admin/reports/summary': 'Report summary',
    '/admin/lucky-draw': 'Lucky draw',
    '/admin/photos': 'Photo wall',
    '/admin/qa': 'Q&A queue',
    '/admin/polls': 'Polls',
    '/admin/committees': 'Committees',
    '/admin/name-tags': 'Name tags',
    '/admin/qr-assets': 'QR assets',
    '/admin/admins': 'Admins',
    '/screen': 'The projector',
  };
  if (names[path]) return names[path];
  if (path.startsWith('/screen/')) return 'The projector';
  if (path.startsWith('/admin/feedback/')) return 'Feedback';
  return 'Admin console';
}

/**
 * Folds runs of the same line from the same desk into one, with a count.
 * During registration the log would otherwise be eighty identical "checked
 * in a guest" lines. Input and output are newest first.
 */
export function collapseActivity<T extends { operator: string; action: string; at: string }>(
  entries: T[],
): (T & { count: number })[] {
  const out: (T & { count: number })[] = [];
  for (const entry of entries) {
    const last = out[out.length - 1];
    if (last && last.operator === entry.operator && last.action === entry.action) last.count += 1;
    else out.push({ ...entry, count: 1 });
  }
  return out;
}
