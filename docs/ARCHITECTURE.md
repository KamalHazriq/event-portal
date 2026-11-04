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
