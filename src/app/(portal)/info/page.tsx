import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getEventConfig } from '@/lib/config';
import { looksUnconfirmed } from '@/lib/placeholder';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getEventConfig().info?.title ?? 'Know before you go' };
}

/**
 * "Know before you go": practical details from the event config. A line
 * still marked "to confirm" reads "Coming soon", so nobody acts on a guess.
 */
export default function InfoPage() {
  const config = getEventConfig();
  const info = config.info;
  if (!info) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">{info.title}</h1>
        {info.intro ? <p className="mt-1 text-ink-soft">{info.intro}</p> : null}
      </header>
      {info.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`info-${section.id}`}
          className="rounded-xl border border-line bg-surface p-4 sm:p-5"
        >
          <h2 id={`info-${section.id}`} className="text-lg font-bold text-ink">
            {section.heading}
          </h2>
          {section.body
            ? section.body.split(/\n{2,}/).map((para) => (
                <p key={para.slice(0, 40)} className="mt-2 text-ink">
                  {para}
                </p>
              ))
            : null}
          {section.items.length > 0 ? (
            <dl className="mt-3 divide-y divide-line">
              {section.items.map((item) => {
                const pending = looksUnconfirmed(item.text);
                return (
                  <div key={item.label} className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr]">
                    <dt className="font-semibold text-ink">{item.label}</dt>
                    <dd className={pending ? 'text-ink-soft italic' : 'text-ink'}>
                      {pending ? 'Coming soon' : <InfoText text={item.text} />}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/**
 * "Day 1: formal. Day 2: smart casual." reads better as one line per day,
 * with the day in bold. Anything else stays as written.
 */
function InfoText({ text }: { text: string }) {
  const parts = text
    .split(/(?=\bDay \d+\s*:)/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return <>{text}</>;
  return (
    <ul className="space-y-1.5">
      {parts.map((part) => {
        const [day, ...rest] = part.split(':');
        return (
          <li key={part} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <span className="font-semibold">{day!.trim()}</span>
            <span>{rest.join(':').trim().replace(/\.$/, '')}</span>
          </li>
        );
      })}
    </ul>
  );
}
