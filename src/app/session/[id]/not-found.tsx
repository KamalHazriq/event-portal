import { NotFoundPanel } from '@/components/NotFoundPanel';

/**
 * A not-found boundary inside this segment.
 *
 * Without it, a notFound() thrown by the session page has no boundary in its
 * own part of the tree and the page renders blank instead of this.
 */
export default function SessionNotFound() {
  return (
    <NotFoundPanel
      heading="We cannot find that session"
      message="The link may be out of date, or the session may have been renamed. The full agenda has everything that is on."
    />
  );
}
