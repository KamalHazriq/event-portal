import Link from 'next/link';

/** The one back button: always at the top left of the page, the same everywhere. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="nav-pill print:hidden">
      <span aria-hidden="true" className="nav-arrow nav-arrow-back">
        ←
      </span>
      {children}
    </Link>
  );
}
