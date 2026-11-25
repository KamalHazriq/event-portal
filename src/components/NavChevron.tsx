/** A thin rounded chevron for the back and next buttons. Decorative: the link carries the label. */
export function NavChevron({ dir }: { dir: 'back' | 'next' }) {
  return (
    <span aria-hidden="true" className={`nav-arrow ${dir === 'back' ? 'nav-arrow-back' : ''}`}>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={dir === 'back' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </span>
  );
}
