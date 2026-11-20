'use client';

import Link from 'next/link';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Part } from '../steps';

const KEY = 'portal.testplan';
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

  return (
    <div className="space-y-10">
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
                          {step.do}
                        </span>
                        <span className="mt-0.5 block text-ink-soft">
                          <strong className="font-semibold text-ink">You should see: </strong>
                          {step.expect}
                        </span>
                        {step.href ? (
                          <Link
                            href={step.href}
                            className="mt-1 inline-block text-sm"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open {step.href}
                          </Link>
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
