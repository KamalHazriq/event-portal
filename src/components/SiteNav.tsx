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
    <nav aria-label="Main" className="px-2">
      <ul className="flex gap-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  // 44 px tall, so it is an easy tap target on a phone.
                  'block px-3 py-2.5 text-sm font-semibold no-underline',
                  'border-b-2 transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-soft hover:text-ink',
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
