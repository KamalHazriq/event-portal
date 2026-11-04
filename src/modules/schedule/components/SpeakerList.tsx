import type { Speaker } from '@/lib/event-schema';
import { initials } from '@/lib/text';

/** Names only, for a card in a list. */
export function SpeakerNames({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) return null;
  return <span className="text-sm text-ink-soft">{speakers.map((s) => s.name).join(', ')}</span>;
}

/** Full cards with titles and bios, for a session page. */
export function SpeakerList({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) return null;

  return (
    <ul className="space-y-3">
      {speakers.map((speaker) => (
        <li key={speaker.id} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
          >
            {initials(speaker.name)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink">{speaker.name}</p>
            {speaker.title ? <p className="text-sm text-ink-soft">{speaker.title}</p> : null}
            {speaker.organisation ? (
              <p className="text-sm text-ink-soft">{speaker.organisation}</p>
            ) : null}
            {speaker.bio ? <p className="mt-1.5 text-sm text-ink">{speaker.bio}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
