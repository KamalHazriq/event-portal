/**
 * Runs once when the server starts, before it takes requests. Loads the
 * secretariat's saved edits to the agenda and event details, so the very
 * first page already shows them.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { refreshConfigOverlay } = await import('./lib/config-sync');
  await refreshConfigOverlay(true);
}
