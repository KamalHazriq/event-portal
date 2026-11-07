# How the portal is put together

Short version: the event lives in a JSON file, the pages render on the server,
and anything that gets stored goes through one interface so the database can
be swapped later.

## The folders

```
config/
  event.json              the whole event: days, sessions, speakers, theme
  attendees.sample.csv    90 invented people, safe to commit
  attendees.csv           the real list, git-ignored, never committed
src/
  app/                    the pages
  components/             shared pieces used by every page (header, nav)
  modules/<module>/       one folder per module from the brief
    schedule/             Module 1: logic.ts, logic.test.ts, components/
  data/
    adapter.ts            the interface every storage back end implements
    types.ts              what gets stored, with no database in sight
    sqlite/               the only implementation today
  lib/                    shared helpers: config, time, auth switch, ids, csv
prisma/schema.prisma      the local database shape
scripts/                  seed and dummy data generation
tests/e2e/                Playwright flows
docs/                     this
```

## The rules from the brief, and where they live

**Everything event-specific is in config.** `config/event.json` is validated by
`src/lib/event-schema.ts` on startup. No component has a colour, a time or a
name written into it. A broken config file produces a plain English error page,
not a stack trace.

**All reads and writes go through one interface.** `src/data/adapter.ts`
defines it. `src/data/sqlite/` implements it. Pages call `getData()` from
`@/data` and never see Prisma. This is enforced by a lint rule, not just by
convention: importing `@prisma/client` anywhere outside `src/data/sqlite`
fails `npm run lint`.

**Login is behind a switch.** `src/lib/auth.ts` reads `AUTH_MODE`. Only `none`
is implemented. Setting it to `microsoft` throws a clear error rather than
silently letting everyone in. When Entra ID is approved, that file is the only
one that changes.

**No external calls.** There is no analytics, no tracking, no AI and no font or
icon loaded from another domain. A Playwright test watches every network
request on every page and fails if anything leaves the machine.

**Light pages.** Every page renders on the server. The only client side
component in Module 1 is the navigation underline and the timer that refreshes
the "happening now" highlight. Measured on the production build: about 6 KB of
HTML and 174 KB of JavaScript transferred for a first visit, almost all of it
the framework.

**Real time without websockets.** Pages that show live information re-request
themselves on a timer. Phones use 60 seconds, because the only thing that
changes for them is which session is highlighted. The big screen pages in
Module 8 will use 3 to 5 seconds, which is what a live counter needs.

## Time

The portal always thinks in the event's time zone, not the server's, so it
behaves the same on a laptop in Kuala Lumpur and a host running on UTC.

`src/lib/time.ts` does this with the Intl API and no date library. A moment is
`{ date: '2026-12-15', minutes: 870 }`, which makes comparing against an agenda
written as `"start": "14:30"` straightforward and easy to test.

The `?now=` override is handled in the same place, so it works everywhere at
once rather than being bolted onto each page.

## The data adapter

`DataAdapter` currently covers attendees, check ins, feedback and a small
settings store. Those are the confirmed must-have modules.

Q&A, polls, the photo wall and the lucky draw are deliberately **not** in the
interface yet. Q&A and polls are backup only because the event runs on Slido,
and photo storage still needs a GRC answer. Each gets its own repository on the
interface when its module is built, rather than guessing the shape now and
reworking it later.

Their admin pages exist already as **previews**, under `src/modules/previews/`.
They read dummy data from `mock-data.ts` and keep any clicks in the browser tab,
so they never touch the adapter for something it does not have. When a module
is built, its page is rewritten against a real repository at the same address
and its slice of the mock file is deleted.

To add a storage back end, for example Supabase:

1. Create `src/data/supabase/index.ts` exporting a `createSupabaseAdapter()`
   that returns a `DataAdapter`.
2. Add `'supabase'` to `DATA_ADAPTERS` in `src/data/adapter.ts`.
3. Add the case to the switch in `src/data/index.ts`.

No page changes. TypeScript will point at the switch if you forget step 3.

## Theme

`config/event.json` holds a light theme and a dark theme as colour tokens.
`src/lib/theme.ts` turns them into CSS variables that are written into the page
at render time, and `globals.css` maps those to Tailwind utilities with
`@theme inline`.

The upshot: changing the theme is editing JSON. No rebuild, no component edits.
A page picks its theme with the `data-theme` attribute, which is how the
projector will run dark while phones run light.

## Choices worth knowing about

**Sessions are nested under days** in `event.json` rather than carrying a `day`
field, because that makes it impossible for a session to claim a day that does
not exist. The day id and date are attached to each session when the config is
loaded, so code still sees `session.dayId`.

**Three session types were added** beyond the four in the brief: `panel`,
`meal` and `logistics`. A real three day agenda has dinners and a registration
desk, and bending `break` to cover them would have made the big screen harder
to design later. Adding a type is a config change.

**Counting happens in JavaScript, not SQL.** For 90 people the whole table is a
few kilobytes, so a readable loop beats a clever query, and the same code moves
to any other store without rewriting.

## Module 4 decisions

**Route handlers, not Server Actions, for the desk.** The Next.js docs say the
client dispatches Server Actions one at a time and each one re-renders the
page. That is the wrong shape for a desk working through a queue. The check
in, undo, search and headcount endpoints are plain route handlers returning
small JSON payloads, so a scan does not wait on a page render, and the
simulated run can drive the same endpoints the desk uses.

**The PIN check sits in every page and every endpoint.** The docs are explicit
that a proxy, which is what middleware became in Next 16, is not a security
boundary on its own: a matcher change or a moved route can silently remove its
cover. So there is no `proxy.ts`. Each admin page calls `requireAdmin` and each
endpoint calls `requireAdminApi`.

**The session cookie is signed with the PIN.** It carries a desk label and an
expiry, and nothing else. It cannot be forged without the PIN, it holds no
personal data, and it expires after about one event day.

**Only wrong PINs count towards the limit.** Two or three people at one event
share the hotel's single public address. Counting their successful sign ins as
well would let them lock each other out, which at a registration desk would be
worse than the thing being prevented.

**Redirects after sign in are relative.** Building an absolute URL from
`request.url` can answer with a different host from the one the browser asked
for, for example `localhost` when the desk typed an IP address. The cookie is
then set on one origin and the redirect lands on another, so the desk appears
to sign in and is immediately sent back. A relative `Location` keeps whatever
origin the browser is already using. This was a real bug, caught by the
browser tests.

**What a name tag QR contains.** The full address
`https://<portal>/c/<token>`, not a bare token. That means any phone camera
can open it, so the desk is never stuck if our scanner misbehaves. The page it
opens only checks someone in when a secretariat session is signed in on that
device, so an attendee scanning their own tag is told to show it at the desk
instead, and an arrival always means someone really turned up.

**Check in tokens survive a re-import.** They are generated once per person and
kept when the attendee list is loaded again, so correcting a typo in someone's
title does not invalidate a tag that has already been printed.

**QR codes are drawn as SVG on the server** from the module grid, never as raw
markup, so there is nothing the value could escape into. They stay black on
white in both themes, because a themed QR code does not scan reliably in a
hotel's lighting.

**Printing rather than generating PDFs.** Name tags and table tents are HTML
with a print stylesheet in millimetres. "Save as PDF" in the print dialog
produces the same file, a layout change is a CSS edit, and it keeps a PDF
library out of the project. The trade is that margins must be set to None in
the print dialog, which the page says on screen.

**Rate limiting is in memory.** That is the right size for one server behind
one URL, which is what this event is. Nothing outside `src/lib/rate-limit.ts`
knows how it is stored, so it can move to the data adapter if the portal ever
runs on more than one instance.

## Module 5 decisions

**A Server Action, not a route handler, and the opposite of the desk.** The
desk needed small JSON answers for rapid scanning. A feedback form is
submitted once, so the idiomatic `<form action={serverAction}>` is the better
fit, and it brings progressive enhancement with it: the form is real HTML and
submits without JavaScript. That was verified by posting it with no scripts
running, not just assumed.

**The result comes back in the web address.** `useActionState` would turn the
page into a Client Component and lose the no-JavaScript path, so the action
redirects to `?state=thanks` or `?state=invalid&problems=...` instead. The
page reads those and says what happened.

**The rating is five radio buttons** with `required`, so the browser itself
blocks a submission with no rating. Without that, a validation round trip
would throw away a comment somebody had just typed. The input covers the whole
label rather than being hidden off screen, so what a thumb lands on is the
control.

**A cookie, not localStorage, for the device id.** The brief mentions
localStorage for Q&A voting, which is fine there because that module needs
JavaScript anyway. Feedback does not, and a device id that only exists in
JavaScript would force the form to need it. The cookie is random, holds no
personal data, and identifies a browser rather than a person.

**Anonymity is a setting, not config.** It lives in the data adapter's
settings store because an admin changes it during the event, while
`config/event.json` is version controlled and should not change mid event. An
anonymous form drops a posted name on the server, so switching a form to
anonymous cannot be worked around by an old page still open on a phone.

**A name is what someone typed.** With no login the portal cannot know that a
submission came from a particular person on the attendee list, so
`attendeeId` stays null and only the typed name is stored. Claiming more would
make the report look more certain than it is.

**Reserved form ids.** The config schema refuses a session with the id `event`
or `event-final`, because the whole event form uses them. Catching that in the
schema is better than discovering it when two forms collide during the event.
