import { NotFoundPanel } from '@/components/NotFoundPanel';

/**
 * For a web address that matches no route at all. It renders in the root
 * layout, which has no navigation of its own, so it brings its own frame.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <NotFoundPanel />
    </div>
  );
}
