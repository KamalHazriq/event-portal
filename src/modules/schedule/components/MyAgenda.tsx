'use client';

import type { ResolvedSession, SessionStatus } from '../logic';
import { useFavourites } from './FavouriteStar';
import { SessionCard } from './SessionCard';

/**
 * The starred sessions from every day, in agenda order. The list lives in
 * this device's browser, so it is filtered here rather than on the server.
 */
export function MyAgenda({
  days,
  statuses,
  linkSuffix = '',
}: {
  days: { id: string; label: string; dateLabel: string; sessions: ResolvedSession[] }[];
  statuses: Record<string, SessionStatus>;
  linkSuffix?: string;
}) {
  const [list, , ready] = useFavourites();
  if (!ready) return null;
  const picked = days
    .map((d) => ({ ...d, sessions: d.sessions.filter((s) => list.includes(s.id)) }))
    .filter((d) => d.sessions.length > 0);

  if (picked.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-ink-soft">
        Nothing here yet. Tap the <span aria-hidden="true">☆</span> star on any session to add it to
        your agenda. It is saved on this device only.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {picked.map((day) => (
        <section key={day.id} aria-labelledby={`mine-${day.id}`}>
          <h2 id={`mine-${day.id}`} className="mb-2 text-lg font-bold text-ink">
            {day.label}
            <span className="ml-2 text-sm font-normal text-ink-soft">{day.dateLabel}</span>
          </h2>
          <ul className="grid gap-2 lg:grid-cols-2 lg:gap-3">
            {day.sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                status={statuses[s.id] ?? 'upcoming'}
                linkSuffix={linkSuffix}
              />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-ink-soft">Saved on this device only.</p>
    </div>
  );
}
