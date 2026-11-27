'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, type IconName } from './icons';

export type TabItem = { href: string; label: string; icon: IconName };

/**
 * On a phone, the main pages as a bar along the bottom, all in reach of a
 * thumb and none hidden off the side of the screen. Hidden from a laptop up,
 * where the menu in the header has room.
 */
export function BottomTabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem] font-semibold no-underline ${
                  active ? 'text-primary' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon name={item.icon} className="size-5" />
                <span className="line-clamp-2 max-w-full text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
