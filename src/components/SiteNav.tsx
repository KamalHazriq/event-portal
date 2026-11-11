'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string };

/**
 * The only client component in Module 1, and it is here just to underline the
 * page you are on. Everything else renders on the server, which keeps the
 * JavaScript small for slow hotel Wi-Fi (brief hard rule 6).
 */
export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav aria-label="Main" className="px-2 sm:px-4 md:px-0">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto md:gap-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  // 44 px tall, so it is an easy tap target on a phone. An
                  // underline on a phone, a soft pill from tablet width.
                  'block whitespace-nowrap px-3 py-2.5 text-sm font-semibold no-underline transition-colors',
                  'border-b-2 md:rounded-full md:border-b-0 md:px-4 md:py-2',
                  active
                    ? 'border-primary text-primary md:bg-primary/15'
                    : 'border-transparent text-ink-soft hover:text-ink md:hover:bg-ink/5',
                ].join(' ')}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
