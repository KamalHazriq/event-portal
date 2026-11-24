'use client';

import Link from 'next/link';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { LATEST_REVISION, type Part } from '../steps';

// A new name for each round of testing, so every tick starts empty again.
const KEY = 'portal.testplan.round-2';
const EVENT = 'portal:testplan';
// The log of "I have checked everything", one line per time, newest last.
const LOG_KEY = 'portal.testplan.log';

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

type LogEntry = { at: string; steps: number; latest: number };

function readLog(): string {
  try {
    return window.localStorage.getItem(LOG_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parseLog(raw: string): LogEntry[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v): v is LogEntry =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as LogEntry).at === 'string' &&
        typeof (v as LogEntry).steps === 'number',
    );
  } catch {
    return [];
  }
}

function stamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');
}

/**
 * The test plan as a checklist. Ticks are kept in this browser only, so a
 * second person can run their own copy, and nothing is sent anywhere.
 */
export function TestPlan({ parts }: { parts: Part[] }) {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const done = useMemo(() => new Set(parse(raw)), [raw]);
  const logRaw = useSyncExternalStore(subscribe, readLog, () => '[]');
  const log = useMemo(() => parseLog(logRaw), [logRaw]);

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

  const allSteps = parts.flatMap((p) => p.groups.flatMap((g) => g.steps));
  const latest = allSteps.filter((st) => st.rev === LATEST_REVISION);
  const total = allSteps.length;
  const doneCount = allSteps.filter((st) => done.has(st.id)).length;
  const latestDone = latest.filter((st) => done.has(st.id)).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const complete = total > 0 && doneCount === total;

  const logAll = () => {
    const next = [
      ...parseLog(readLog()),
      { at: new Date().toISOString(), steps: total, latest: latest.length },
    ];
    try {
      window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the line only shows until the page closes.
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="space-y-10">
      <p className="rounded-xl border border-accent bg-accent/10 p-4 text-ink print:hidden">
        {latest.length} steps are marked <ChangedBadge />: new, or working differently in the latest
        changes. Look at those closely. Your ticks stay in this browser; the bar at the bottom shows
        how far you are, and when every step is ticked you can log that you checked all of it.
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
                          {step.rev === LATEST_REVISION ? (
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

      <section className="space-y-3 print:hidden" aria-labelledby="check-log">
        <h2 id="check-log" className="text-2xl font-bold text-ink">
          Checked log
        </h2>
        <p className="text-ink-soft">
          When every step above is ticked, press the button to log that you have checked all of it
          on this day. The log stays in this browser, newest at the bottom.
        </p>
        <button
          type="button"
          onClick={logAll}
          disabled={!complete}
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary disabled:opacity-40"
        >
          I have checked all of this
        </button>
        {!complete ? (
          <p className="text-sm text-ink-soft">
            {total - doneCount} steps left before you can log it.
          </p>
        ) : null}
        {log.length === 0 ? (
          <p className="text-ink-soft">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-1">
            {log.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="rounded-lg border border-line bg-surface p-3">
                <strong className="text-ink">{stamp(entry.at)}</strong>: checked all {entry.steps}{' '}
                steps, {entry.latest} of them marked Latest.
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => write(new Set())}
          className="min-h-11 rounded-lg border border-line px-4 font-semibold text-ink"
        >
          Clear all the ticks
        </button>
      </section>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur print:hidden"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
            {doneCount} of {total}
          </span>
          <span
            className="h-3 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
            aria-label="Test plan progress"
          >
            <span
              className="block h-full rounded-full bg-success transition-all"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="shrink-0 text-sm tabular-nums text-ink-soft">
            {percent}%
            <span className="hidden sm:inline">
              {' '}
              · Latest {latestDone} of {latest.length}
            </span>
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="h-10 print:hidden" />
    </div>
  );
}

function ChangedBadge() {
  return (
    <span className="inline-block rounded-md bg-accent px-1.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide text-canvas no-underline">
      Latest
    </span>
  );
}
