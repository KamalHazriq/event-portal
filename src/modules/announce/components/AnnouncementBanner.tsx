import Link from 'next/link';

import { getData } from '@/data';

import { ANNOUNCE_KEYS, isLive, parseAnnouncement } from '../logic';

/**
 * The secretariat's current message, at the top of every attendee page: a
 * calm card with an accent edge, a megaphone, and one clear tap to open.
 */
export async function AnnouncementBanner() {
  const raw = await getData()
    .settings.get(ANNOUNCE_KEYS.current)
    .catch(() => null);
  const a = parseAnnouncement(raw);
  if (!isLive(a, new Date())) return null;

  const inner = (
    <>
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xl text-on-primary"
      >
        📣
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
          Announcement
        </span>
        <span className="block text-base font-semibold leading-snug text-ink">{a.text}</span>
      </span>
      {a.href ? (
        <span className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-sm font-bold text-on-primary">
          Open
        </span>
      ) : null}
    </>
  );
  const frame =
    'announce-card mb-6 flex items-center gap-3 overflow-hidden rounded-xl border border-line border-l-4 border-l-primary bg-surface p-3 pr-4 text-ink no-underline shadow-sm';
  return (
    <aside role="status" aria-label="Announcement">
      {a.href ? (
        <Link href={a.href} className={frame}>
          {inner}
        </Link>
      ) : (
        <div className={frame}>{inner}</div>
      )}
    </aside>
  );
}
