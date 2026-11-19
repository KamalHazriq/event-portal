'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_GROUPS, ADMIN_PAGES, EVERYDAY_PAGES, type AdminPage } from './admin-pages';
import { Icon } from './icons';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The phone tab row: the everyday pages, the page you are on if it lives
 * under More, and More itself (the full list on the overview).
 */
function tabPages(pathname: string): AdminPage[] {
  const current = ADMIN_PAGES.find(
    (page) => isActive(pathname, page.href) && !EVERYDAY_PAGES.includes(page),
  );
  const more: AdminPage = {
    href: '/admin#more',
    label: 'More',
    title: 'More',
    description: '',
    icon: 'folder',
  };
  return [...EVERYDAY_PAGES, ...(current ? [current] : []), more];
}

/** Phones and tablets: one swipeable row of tabs under the header. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secretariat" className="px-2 lg:hidden">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto">
        {tabPages(pathname).map((page) => {
          const active = isActive(pathname, page.href);
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
export function AdminSidebarNav() {
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
        const links = (
          <ul className="space-y-0.5">
            {group.pages.map((page) => {
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
        );
        return group.folded ? (
          // Folded until needed; open by itself when you are on one of its pages.
          <details
            key={group.name}
            className="group/more mt-4"
            open={group.pages.some((page) => isActive(pathname, page.href))}
          >
            <summary className="cursor-pointer list-none px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
              {group.name} <span aria-hidden="true">▾</span>
            </summary>
            {links}
          </details>
        ) : (
          <div key={group.name} className="mt-4">
            <p className="px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
              {group.name}
            </p>
            {links}
          </div>
        );
      })}
    </nav>
  );
}
