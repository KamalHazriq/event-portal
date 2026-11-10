'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: { href: string; label: string; also?: string[] }[] = [
  { href: '/admin/live', label: 'Live' },
  { href: '/admin/desk', label: 'Desk' },
  { href: '/admin/headcount', label: 'Headcount' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/big-screen', label: 'Big screen' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/lucky-draw', label: 'Lucky draw' },
  { href: '/admin/name-tags', label: 'Name tags' },
  { href: '/admin/qr-assets', label: 'QR assets' },
  {
    href: '/admin/previews',
    label: 'More',
    // The preview pages that have no tab of their own light up "More".
    also: ['/admin/photos', '/admin/committees', '/admin/qa', '/admin/polls', '/admin/admins'],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secretariat" className="px-2">
      <ul className="flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = [item.href, ...(item.also ?? [])].some((href) =>
            pathname.startsWith(href),
          );
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'block border-b-2 px-3 py-2.5 text-sm font-semibold no-underline transition-colors',
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
