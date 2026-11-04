/**
 * The login switch.
 *
 * Brief hard rule 5: login sits behind AUTH_MODE=none | microsoft. Build
 * "none" now, leave a clean place for Microsoft Entra ID later, do not
 * implement it yet.
 *
 * Nothing in this file talks to a network. "microsoft" is accepted by the
 * type but refused at runtime, loudly, so it cannot be switched on by
 * accident and look like it works.
 */

export const AUTH_MODES = ['none', 'microsoft'] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export type Viewer =
  /** AUTH_MODE=none. Everyone who has the portal link. */
  | { kind: 'guest' }
  /** Someone who entered the admin PIN (Module 6). */
  | { kind: 'admin'; label: string }
  /** Reserved for Entra ID later: a real signed in person. */
  | { kind: 'staff'; label: string; email: string };

export function getAuthMode(): AuthMode {
  const raw = (process.env.AUTH_MODE ?? 'none').trim().toLowerCase();
  if (raw === 'none') return 'none';
  if (raw === 'microsoft') {
    throw new Error(
      'AUTH_MODE=microsoft is not implemented yet. Set AUTH_MODE=none in .env.local. ' +
        'When Entra ID is approved, implement it in src/lib/auth.ts and nothing else needs to change.',
    );
  }
  throw new Error(`AUTH_MODE must be one of: ${AUTH_MODES.join(', ')}. Got "${raw}".`);
}

/**
 * Who is looking at an attendee page.
 *
 * With AUTH_MODE=none this is always a guest. The attendee side of the portal
 * is deliberately open: people reach it by scanning a QR code in the room.
 */
export function getViewer(): Viewer {
  getAuthMode();
  return { kind: 'guest' };
}

/**
 * The admin PIN, for Module 6. Read here so the rest of the app never
 * touches process.env for secrets.
 *
 * Returns null when no PIN is set, which means the admin console must refuse
 * to open rather than fall open.
 */
export function getAdminPin(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  return pin && pin.length > 0 ? pin : null;
}

/**
 * Constant time compare, so a wrong PIN cannot be found one digit at a time.
 */
export function pinMatches(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
