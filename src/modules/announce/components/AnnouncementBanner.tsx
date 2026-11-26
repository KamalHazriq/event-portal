import Link from 'next/link';

import { Icon } from '@/components/icons';

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
        className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-2xl text-on-primary"
      >
        <Icon name="megaphone" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.7rem] font-bold uppercase tracking-[0.18em] text-primary">
          Announcement
        </span>
        <span className="mt-0.5 block text-lg font-bold leading-snug text-ink">{a.text}</span>
      </span>
      {a.href ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-on-primary">
          Open <span aria-hidden="true">›</span>
        </span>
      ) : null}
    </>
  );
  const frame =
    'announce-card flex w-full items-center gap-4 rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4 text-ink no-underline shadow-lg sm:p-5';
  return (
    <aside role="status" aria-label="Announcement" className="mb-6 w-full !max-w-none last:mb-0">
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
