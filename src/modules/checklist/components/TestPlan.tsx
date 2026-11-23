'use client';

import Link from 'next/link';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Part } from '../steps';

// A new name for each round of testing, so every tick starts empty again.
const KEY = 'portal.testplan.round-2';
const EVENT = 'portal:testplan';

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The test plan as a checklist. Ticks are kept in this browser only, so a
 * second person can run their own copy, and nothing is sent anywhere.
 */
export function TestPlan({ parts }: { parts: Part[] }) {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const done = useMemo(() => new Set(parse(raw)), [raw]);

  const write = useCallback((next: Set<string>) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked: ticks only last while the page is open.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(parse(read()));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
  };

  const changed = parts.flatMap((p) => p.groups.flatMap((g) => g.steps)).filter((st) => st.changed);

  return (
    <div className="space-y-10">
      <p className="rounded-xl border border-accent bg-accent/10 p-4 text-ink print:hidden">
        <strong>Round 2.</strong> All ticks start empty, so test everything again. {changed.length}{' '}
        steps are marked <ChangedBadge />: new, or working differently since the last round. Look at
        those closely.
      </p>
      {parts.map((part) => {
        const ids = part.groups.flatMap((g) => g.steps.map((s) => s.id));
        const count = ids.filter((id) => done.has(id)).length;
        return (
          <section key={part.id} aria-labelledby={`part-${part.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`part-${part.id}`} className="text-2xl font-bold text-ink">
                {part.title}
              </h2>
              <p className="font-semibold tabular-nums text-ink-soft" aria-live="polite">
                {count} of {ids.length} done
              </p>
            </div>
            <p className="mt-1 text-ink-soft">{part.intro}</p>

            <div className="mt-4 space-y-6">
              {part.groups.map((group) => (
                <fieldset key={group.id} className="space-y-2">
                  <legend className="mb-1 text-lg font-bold text-ink print:break-after-avoid">
                    {group.title}
                  </legend>
                  {group.steps.map((step) => (
                    <label
                      key={step.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 print:break-inside-avoid"
                    >
                      <input
                        type="checkbox"
                        checked={done.has(step.id)}
                        onChange={() => toggle(step.id)}
                        className="mt-1 size-6 shrink-0"
                      />
                      <span className="min-w-0 text-base leading-relaxed">
                        <span
                          className={`block font-semibold ${done.has(step.id) ? 'text-ink-soft line-through' : 'text-ink'}`}
                        >
                          {step.changed ? (
                            <>
                              <ChangedBadge />{' '}
                            </>
                          ) : null}
                          {step.do}
                        </span>
                        <span className="mt-0.5 block text-ink-soft">
                          <strong className="font-semibold text-ink">You should see: </strong>
                          {step.expect}
                        </span>
                        {step.links && step.links.length > 0 ? (
                          <span className="mt-2 flex flex-wrap gap-2 print:hidden">
                            {step.links.map((link) => {
                              const className =
                                'inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-canvas px-3 text-sm font-semibold text-primary no-underline hover:border-primary';
                              // Anchors stay on this page; everything else opens beside it.
                              if (link.href.startsWith('#')) {
                                return (
                                  <a
                                    key={link.href}
                                    href={link.href}
                                    className={className}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {link.label}
                                  </a>
                                );
                              }
                              const external = link.href.startsWith('http');
                              return external ? (
                                <a
                                  key={link.href}
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={className}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {link.label}
                                  <span aria-hidden="true">↗</span>
                                  <span className="sr-only"> (opens in a new tab)</span>
                                </a>
                              ) : (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  target="_blank"
                                  className={className}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {link.label}
                                  <span aria-hidden="true">↗</span>
                                  <span className="sr-only"> (opens in a new tab)</span>
                                </Link>
                              );
                            })}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </section>
        );
      })}

      <div className="print:hidden">
        <button
          type="button"
          onClick={() => write(new Set())}
          className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          Clear all the ticks
        </button>
      </div>
    </div>
  );
}

function ChangedBadge() {
  return (
    <span className="inline-block rounded-md bg-accent px-1.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide text-canvas no-underline">
      Changed
    </span>
  );
}
