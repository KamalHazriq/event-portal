/** Shared server pieces for reactions and comments. */
import { getEventConfig } from '@/lib/config';
import { buildAgenda, type ResolvedSession } from '@/modules/schedule/logic';

/** A talk from the config, or undefined. */
export function findSession(sessionId: string): ResolvedSession | undefined {
  return buildAgenda(getEventConfig()).byId.get(sessionId);
}

/**
 * Back to the talk's comments after a form post, with a short state code,
 * so it works with no JavaScript. Keeps a test clock if one was in use.
 */
export function backToComments(sessionId: string, state: string, now?: string | null): Response {
  const query = new URLSearchParams({ state });
  if (now) query.set('now', now);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/session/${encodeURIComponent(sessionId)}?${query.toString()}#comments`,
    },
  });
}
