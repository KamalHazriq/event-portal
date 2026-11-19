import Link from 'next/link';

import { getData } from '@/data';

import { ANNOUNCE_KEYS, isLive, parseAnnouncement } from '../logic';

/** The secretariat's current message, at the top of every attendee page. */
export async function AnnouncementBanner() {
  const raw = await getData()
    .settings.get(ANNOUNCE_KEYS.current)
    .catch(() => null);
  const a = parseAnnouncement(raw);
  if (!isLive(a, new Date())) return null;

  const body = (
    <>
      <span aria-hidden="true" className="mr-1">
        📣
      </span>
      <span className="font-semibold">{a.text}</span>
      {a.href ? (
        <span className="ml-2 whitespace-nowrap underline underline-offset-2">Open</span>
      ) : null}
    </>
  );
  return (
    <aside
      role="status"
      aria-label="Announcement"
      className="mb-6 rounded-xl border-2 border-primary bg-primary/10 p-3 text-ink"
    >
      {a.href ? (
        <Link href={a.href} className="block text-ink no-underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </aside>
  );
}
