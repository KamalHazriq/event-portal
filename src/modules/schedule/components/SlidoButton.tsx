import type { SlidoRef } from '@/lib/event-schema';

/**
 * Live polls and Q&A run on Slido under the company licence, so the portal
 * only has to hand people the link. The link comes from config, per event or
 * per session, never from code.
 */
export function SlidoButton({ slido }: { slido: SlidoRef }) {
  const href = slido.eventUrl;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-muted px-3 py-2.5">
      <p className="min-w-0 flex-1 text-sm text-ink-soft">
        <strong className="font-semibold text-ink">Polls and questions</strong> run on Slido.
        {slido.eventCode ? (
          <>
            {' '}
            Code <span className="font-mono font-bold text-ink">{slido.eventCode}</span>
          </>
        ) : null}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-sm font-bold text-on-primary no-underline"
        >
          {slido.label}
        </a>
      ) : null}
    </div>
  );
}
