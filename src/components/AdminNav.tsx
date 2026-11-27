'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

/** Short names for the phone tabs, so all five fit side by side. */
const SHORT: Record<string, string> = { 'Engage the room': 'Engage' };

/**
 * Phones and tablets: the five sections side by side, all on screen, and
 * the page you are on underneath, so nothing hides off the edge.
 */
export function AdminTabs({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  const pages = tabPages(pathname, hidden);
  const sections = pages.slice(0, ADMIN_GROUPS.length + 1);
  const current = pages[ADMIN_GROUPS.length + 1];
  const group = activeGroup(pathname);

  return (
    <nav aria-label="Secretariat" className="px-2 lg:hidden">
      <ul className="grid grid-cols-5">
        {sections.map((page) => {
          const active =
            page.href === '/admin'
              ? pathname === '/admin'
              : isActive(pathname, page.href) ||
                ADMIN_GROUPS.some((g) => groupHref(g) === page.href && g.slug === group?.slug);
          return (
            <li key={page.href} className="min-w-0">
              <Link
                href={page.href}
                aria-current={
                  page.href === '/admin'
                    ? pathname === '/admin'
                      ? 'page'
                      : undefined
                    : isActive(pathname, page.href)
                      ? 'page'
                      : undefined
                }
                className={[
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 border-b-2 px-1 py-1.5 text-[0.72rem] font-semibold no-underline transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                <Icon name={page.icon} className="size-4" />
                <span className="max-w-full truncate">{SHORT[page.label] ?? page.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {current ? (
        <p className="flex items-center gap-1.5 px-2 pt-2 text-sm font-semibold text-ink">
          <Icon name={current.icon} className="size-4 text-primary" />
          <span className="text-ink-soft">{group?.name ?? ''}</span>
          <span aria-hidden="true" className="text-ink-soft">
            ›
          </span>
          <Link href={current.href} aria-current="page" className="text-primary no-underline">
            {current.label}
          </Link>
        </p>
      ) : null}
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
