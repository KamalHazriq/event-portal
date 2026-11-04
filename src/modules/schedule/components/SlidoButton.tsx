import type { SlidoRef } from '@/lib/event-schema';

/**
 * Live polls and Q&A run on Slido under the company licence, so the portal
 * only has to hand people the link. The link comes from config, per event or
 * per session, never from code.
 */
export function SlidoButton({ slido }: { slido: SlidoRef }) {
  const href = slido.eventUrl;

  return (
    <div className="rounded-lg border border-line bg-muted p-4">
      <h2 className="text-base font-bold text-ink">Polls and questions</h2>
      <p className="mt-1 text-sm text-ink-soft">
        This session uses Slido. Open it on your phone to vote and to ask a question.
      </p>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 font-bold text-on-primary no-underline"
        >
          {slido.label}
        </a>
      ) : null}

      {slido.eventCode ? (
        <p className="mt-3 text-sm text-ink">
          Or go to slido.com and enter code{' '}
          <span className="font-mono font-bold">{slido.eventCode}</span>
        </p>
      ) : null}
    </div>
  );
}
