import { HexLoader } from './HexLoader';

/**
 * What a page shows for the moment the server is still building it, so a tap
 * moves you at once. It fades in after a beat, so a fast page shows nothing.
 */
export function PageLoading() {
  return (
    <div className="page-loading flex min-h-[50vh] items-center justify-center">
      <HexLoader label="Loading" />
    </div>
  );
}
