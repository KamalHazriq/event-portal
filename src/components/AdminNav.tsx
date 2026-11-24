'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { ADMIN_GROUPS, ADMIN_PAGES, groupHref, type AdminPage } from './admin-pages';
import { Icon } from './icons';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The group the current page belongs to, if any (its own page counts). */
function activeGroup(pathname: string) {
  return ADMIN_GROUPS.find(
    (g) => isActive(pathname, groupHref(g)) || g.pages.some((p) => isActive(pathname, p.href)),
  );
}

/**
 * The phone tab row: Overview, one tab per section (each opens a page that
 * lists its pages), and the page you are on when it is inside a section.
 */
function tabPages(pathname: string, hidden: string[]): AdminPage[] {
  const overview: AdminPage = {
    href: '/admin',
    label: 'Overview',
    title: 'Overview',
    description: '',
    icon: 'home',
  };
  const sections: AdminPage[] = ADMIN_GROUPS.map((g) => ({
    href: groupHref(g),
    label: g.name,
    title: g.name,
    description: '',
    icon: g.slug === 'more' ? 'folder' : g.pages[0]!.icon,
  }));
  const current = ADMIN_PAGES.find(
    (page) => !hidden.includes(page.href) && isActive(pathname, page.href),
  );
  return [overview, ...sections, ...(current ? [current] : [])];
}

/** Phones and tablets: one swipeable row of tabs under the header. */
export function AdminTabs({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  const row = useRef<HTMLUListElement>(null);

  // Bring the tab you are on into view, so a section far along the row is not hidden.
  useEffect(() => {
    const list = row.current;
    const tab = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && tab) {
      list.scrollTo({ left: tab.offsetLeft - list.clientWidth / 2 + tab.clientWidth / 2 });
    }
  }, [pathname]);

  return (
    <nav aria-label="Secretariat" className="px-2 lg:hidden">
      <ul ref={row} className="no-scrollbar relative flex gap-1 overflow-x-auto">
        {tabPages(pathname, hidden).map((page) => {
          const active =
            page.href === '/admin' ? pathname === '/admin' : isActive(pathname, page.href);
          return (
            <li key={page.href} className="shrink-0">
              <Link
                href={page.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold no-underline transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                <Icon name={page.icon} className="size-4" />
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Laptops and up: a sidebar with the pages grouped by when they are used. */
export function AdminSidebarNav({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secretariat" className="flex-1 overflow-y-auto px-3 pb-4">
      <Link
        href="/admin"
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className={[
          'side-link mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold no-underline',
          pathname === '/admin' ? 'is-active' : '',
        ].join(' ')}
      >
        <Icon name="home" />
        Overview
      </Link>
      {ADMIN_GROUPS.map((group) => {
        const here = activeGroup(pathname)?.slug === group.slug;
        const onHub = pathname === groupHref(group);
        return (
          <div key={group.slug} className="mt-2">
            <Link
              href={groupHref(group)}
              aria-current={onHub ? 'page' : undefined}
              aria-expanded={here}
              className={[
                'side-link flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold no-underline',
                onHub ? 'is-active' : '',
              ].join(' ')}
            >
              {group.name}
              <span aria-hidden="true" className="text-xs text-ink-soft">
                {here ? '▾' : '▸'}
              </span>
            </Link>
            {here ? (
              <ul className="mt-0.5 space-y-0.5 border-l border-line pl-2 ml-3">
                {group.pages
                  .filter((page) => !hidden.includes(page.href))
                  .map((page) => {
                    const active = isActive(pathname, page.href);
                    return (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'side-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold no-underline',
                            active ? 'is-active' : '',
                          ].join(' ')}
                        >
                          <Icon name={page.icon} />
                          {page.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
