# Security notes

Who can reach what, what protects it, and what to do before the event.

## What protects what

| What | Protection |
|---|---|
| Attendee pages | The event code (carried by the QR on the name tag). Wrong guesses are slowed down: 30 wrong tries in 10 minutes from one address, then a short wait. |
| Secretariat pages, the desk, the big screen, the kiosk, the guide | The secretariat PIN. 10 wrong tries in 10 minutes from one address, then a wait. The sign in is a signed, HTTP-only cookie. |
| Every secretariat API (check in, search, reports, photos zip, uploads) | The same sign in, checked on each request. `tests/e2e/admin-shut.spec.ts` proves each one refuses a visitor. |
| The database | Only the server talks to it. Nothing in the browser can, so there are no database rules to forget. |
| Secrets (database, PIN, event code, alert keys) | Only on the server (Secret Manager). Nothing is sent to the browser except the public alert key. No `NEXT_PUBLIC_` values exist. |
| Every page | Security headers: no framing, no type guessing, a tight referrer, camera for this site only, HTTPS only, forms post back here only. |
| Lost phone | Admins page, Resets, Sign everyone out. |

## Do these before the event

1. **Make the GitHub repository private** (Settings, General, Danger zone, Change visibility). It holds the
   code, the agenda and settings. Nothing secret is meant to be in it, but there is no reason for it to be public.
2. **Use a random event code, BEFORE printing the name tags.** The QR carries the code, so nobody types it, and a
   long random one costs nothing. Make it 10 or more characters with no event words or years, for example
   `k7Rm2xQp9vLd`. Set it as the `portal-event-pass` secret and roll out. The Ready check on the Test plan page
   warns while it is easy to guess.
3. **Use a strong PIN**: 8 or more letters and numbers, not a pattern (`portal-admin-pin`). The Ready check warns
   about a weak one. The tests use a simple PIN of their own, which is not the real one.
4. **Change the database password** (Neon, then the two database secrets) if its connection string was ever shown
   or pasted anywhere, such as a chat. It costs a few minutes.
5. **Set the uptime alert** (docs/DEPLOYING.md, "Know if the site goes down").
6. After the event: change the event code and the PIN, download the reports, then delete the Neon project.

## Known and accepted

- The sign in cookie is signed with the PIN. Someone who got hold of a cookie could guess a weak PIN offline, so
  keep the PIN strong. A lost phone is handled by Sign everyone out.
- The rate limits are kept in memory on each server copy, so a determined attacker gets a few more tries
  than the number shown. With an 8 character PIN or a random code that is still hopeless.
- `npm audit` reports three high findings in a build-time tool (Prisma's command line, a slow regular
  expression). It never runs while the site is serving, and fixing it means an older Prisma, so it is left.
