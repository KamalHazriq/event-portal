'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { ADMIN_GROUPS } from './admin-pages';

/** Words people look for that are not in a page's name, so they still find it. */
const KEYWORDS: Record<string, string> = {
  '/admin/desk': 'check in register scan business card arrive guest door gift spin',
  '/admin/headcount': 'arrivals count department undo attendance',
  '/admin/live': 'countdown running late now next delay',
  '/admin/big-screen': 'projector screen view calm wipe remote mc',
  '/admin/runbook': 'print plan morning checklist',
  '/admin/comments': 'approve moderate hide',
  '/admin/photos': 'approve reject wall slideshow download zip',
  '/admin/announce': 'message banner notification push alert team reminder schedule',
  '/admin/lucky-draw': 'prize winner draw spin',
  '/admin/name-picker': 'pick speaker random who talks',
  '/admin/door-gifts': 'stock gift massager printer pointer spin collected guest',
  '/admin/agenda': 'session time speaker room slides report link',
  '/admin/event-info': 'venue know before you go resources departments slido footer',
  '/admin/attendees': 'participant list upload excel role edit secretariat ask name',
  '/admin/test-plan': 'ready check test clock participant clear test data',
  '/admin/device-check': 'projector tablet phone test pattern',
  '/admin/name-tags': 'print badge qr',
  '/admin/qr-assets': 'table tent slide qr print',
  '/admin/points': 'leaderboard score breakdown',
  '/admin/insights': 'attention numbers liveliest',
  '/admin/feedback': 'rating stars results form',
  '/admin/qa': 'questions backup slido',
  '/admin/polls': 'vote backup slido',
  '/admin/reports': 'excel pdf summary download export slido import',
  '/admin/admins': 'desk sign out reset clear everything log activity',
};

/**
 * Finds a secretariat page by typing: its name, what it does, or a word such
 * as "stock". Press / anywhere to start typing.
 */
export function AdminSearch({ hidden = [] }: { hidden?: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const pages = useMemo(
    () =>
      ADMIN_GROUPS.flatMap((g) =>
        g.pages
          .filter((p) => !hidden.includes(p.href))
          .map((p) => ({
            ...p,
            group: g.name,
            text: `${p.label} ${p.title} ${p.description} ${g.name} ${KEYWORDS[p.href] ?? ''}`.toLowerCase(),
          })),
      ),
    [hidden],
  );

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found =
    words.length === 0
      ? []
      : pages
          .filter((p) => words.every((w) => p.text.includes(w)))
          .sort(
            (a, b) =>
              Number(b.label.toLowerCase().startsWith(words[0]!)) -
              Number(a.label.toLowerCase().startsWith(words[0]!)),
          )
          .slice(0, 7);

  // "/" jumps to the search from anywhere, unless typing in a field already.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setQuery('');
    input.current?.blur();
    router.push(href);
  };

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search the secretariat pages
      </label>
      <input
        id={`${listId}-input`}
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={found.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, found.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && found[active]) {
            e.preventDefault();
            go(found[active].href);
          } else if (e.key === 'Escape') {
            setQuery('');
          }
        }}
        placeholder="Search pages (e.g. stock)"
        className="min-h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-soft focus:border-primary"
      />
      {words.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Pages that match"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-surface shadow-xl"
        >
          {found.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-soft">No page matches.</li>
          ) : (
            found.map((p, i) => (
              <li
                key={p.href}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(p.href);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-primary/15' : ''}`}
              >
                <span className="font-semibold text-ink">{p.label}</span>
                <span className="ml-2 text-xs text-ink-soft">{p.group}</span>
                <span className="block truncate text-xs text-ink-soft">{p.description}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
