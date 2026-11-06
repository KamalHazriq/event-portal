# Running the portal on Windows

Everything here assumes Windows 11 and PowerShell, which is what this project
is built on. Commands are the same in Git Bash unless noted.

## What you need once

- **Node.js 20.9 or newer.** Check with `node --version`. This was built on
  Node 22.14.
- **Git.** Check with `git --version`.

You do not need a database server. The local store is a single SQLite file.

## First time setup

Run these from the project folder, in order.

```powershell
npm install
```

```powershell
Copy-Item .env.example .env.local
```

```powershell
npm run db:push
```

```powershell
npm run db:seed
```

What each one does:

| Command                             | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm install`                       | Downloads the libraries. Takes a couple of minutes the first time.                          |
| `Copy-Item .env.example .env.local` | Creates your local settings file. It is git-ignored, so your settings stay on your machine. |
| `npm run db:push`                   | Creates `prisma/dev.db`, the local database file.                                           |
| `npm run db:seed`                   | Loads the 90 dummy people from `config/attendees.sample.csv`.                               |

## Start it

```powershell
npm run dev
```

Open **http://localhost:3000**.

Press `Ctrl+C` in the terminal to stop it.

### Look at it on your phone

While `npm run dev` is running, find your laptop's address with `ipconfig` and
open `http://<that address>:3000` on a phone on the same Wi-Fi. If nothing
loads, Windows Firewall is probably blocking it; allow Node.js on private
networks when prompted.

## Pretending it is a different time

The event is in December 2026, so most of the year the home page will just say
"First up". To see the portal as it will look on the day, add `?now=` to the
address with a date and a 24 hour time:

- Day 1, during the keynote: <http://localhost:3000/?now=2026-12-14T15:00>
- Day 2, during the breakouts: <http://localhost:3000/?now=2026-12-15T11:00>
- Day 3, during the closing: <http://localhost:3000/?now=2026-12-16T11:30>

A dashed box appears at the top of the page whenever this is in force, so you
never mistake it for the real time. The setting follows you as you tap around.

To pin the time for a whole session instead, set `DEV_FAKE_NOW=2026-12-15T11:00`
in `.env.local` and restart.

This is refused on a real deployment unless `ALLOW_TIME_OVERRIDE=true` is set,
which is there for a rehearsal and should be turned off again afterwards.

## Checking your work

```powershell
npm run test
```

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm run test:e2e
```

- `npm run test` runs the logic tests. Fast, run it often.
- `npm run lint` and `npm run typecheck` catch mistakes before the browser does.
- `npm run test:e2e` builds the site and drives it in a real browser. Slower,
  about a minute. Run it before you commit.
- `npm run test:all` runs all four in order.

The first time you run `npm run test:e2e`, install the browser it uses:

```powershell
npx playwright install chromium
```

To run the browser tests against the dev server instead, which is faster while
you are writing one:

```powershell
$env:PLAYWRIGHT_DEV=1; npx playwright test
```

Note that `next dev` and `next start` do not render a "page not found" the same
way, so the real check is against a production build.

## Editing the event

Everything on the screen comes from `config/event.json`. Change a time, a title
or a colour there, save, and refresh the browser. Nothing needs a restart.

If you get something wrong, the portal shows a plain English page listing each
problem and the field it is in, instead of a stack trace. The rules are in
`src/lib/event-schema.ts`.

## The attendee list

`config/attendees.sample.csv` holds 90 invented people: 78 attendees and 12
secretariat. No one in it is real.

To regenerate it:

```powershell
npm run attendees:generate
```

The real list goes in `config/attendees.csv`, which is git-ignored and must
never be committed. When you have it, point at it in `.env.local`:

```
ATTENDEES_CSV_PATH=config/attendees.csv
```

Then `npm run db:seed` again. People are matched on staff number, so loading a
corrected list updates them rather than creating duplicates, and the QR code
already printed on someone's name tag keeps working.

## Starting the data over

```powershell
npm run db:reset
```

This empties the database and reloads the dummy list. It only touches
`prisma/dev.db` on your machine.

To look inside the database:

```powershell
npm run db:studio
```

## Building it for real

```powershell
npm run build
```

```powershell
npm run start
```

That serves the production build on <http://localhost:3000>. Hosting is not
decided yet, so this is as far as it goes for now. See
[DEPLOYING.md](DEPLOYING.md).

## If something goes wrong

**`npm install` fails.** Check `node --version` is 20.9 or newer.

**"the file could not be found" about event.json.** You are running from the
wrong folder. `cd` into the project folder first.

**The database errors say a table is missing.** Run `npm run db:push`.

**Port 3000 is already in use.** Something else is using it. Either close that,
or run `npm run dev -- --port 3001`.

**The page looks unstyled.** Stop the server, delete the `.next` folder, and
start again.

```powershell
Remove-Item -Recurse -Force .next
```

---

# Module 4: check in and name tags

## The admin PIN

The secretariat pages sit behind a PIN set in `.env.local`:

```
ADMIN_PIN=123456
```

Change it before the event. With no PIN set, the admin pages refuse to open
rather than falling open.

Signing in asks for a **desk label** as well, such as `desk-1`. That label is
stored against each check in so you can see which desk recorded it. It is a
label, never a person's name, so the records hold no extra personal data.

A sign in lasts about fourteen hours, which covers one event day.

## The registration desk

Open <http://localhost:3000/admin/desk> on a phone.

There are three ways to check someone in, so something always works:

1. **The camera.** Tap "Use the camera" and hold the front of the name tag in
   view. It checks people in as it reads them, with a beep and a buzz, and
   ignores the same tag for a few seconds so one tag held up does not count
   twice.
2. **A handheld scanner.** Most USB and Bluetooth barcode scanners type what
   they read and press Enter. Click into the "handheld scanner" box and scan.
3. **By name.** Type part of a name or a staff number and press the Check in
   button. This is the fallback for a lost tag.

The counter at the top updates as you go and catches up with other desks every
five seconds.

## Headcount and undo

<http://localhost:3000/admin/headcount> shows who has arrived, the split by
department with whoever is furthest behind at the top, and who is still
missing. Every arrival has an Undo button for when the wrong tag is scanned.
The page refreshes itself every ten seconds.

## Printing name tags

<http://localhost:3000/admin/name-tags>

- **Fronts** carry the name, title, department and that person's own QR code.
- **Backs** carry the portal QR, the same for everyone.

Print the fronts, put the same sheets back in, then print the backs. Tags are
90 by 54 mm, ten to an A4 page.

In the print dialog, set **margins to None** and turn off headers and footers,
or nothing will line up. Use "Save as PDF" in the same dialog if you want a
file. Check one page before printing all ninety.

Each front carries a different code, so do not photocopy a sheet.

## Table tents and the slide QR

<http://localhost:3000/admin/qr-assets>

- Table tents, A5 landscape, one per page. Press Ctrl and P to print.
- A PNG of the portal QR for the welcome slide, and an SVG that stays sharp
  at any size.

All of it points at `event.portalUrl` in `config/event.json`. **Set that to the
real address before printing anything**, or every code will point at nothing.
The page warns you while it is still the placeholder.

## The simulated registration run

The brief asks that the desk can check in 80 people in under 15 minutes. This
measures the portal's share of that:

```powershell
npm run build
```

```powershell
npm run start
```

Then, in a second terminal:

```powershell
npm run simulate:check-in
```

It signs in two desks, checks in all 78 dummy attendees through the real HTTP
endpoints, and reports the timing. It refuses to run if the database holds
anyone who is not from the sample list, so it can never touch a real attendee
list.

On the machine this was built on: 78 people in 0.9 seconds, about 11 ms of
server time each, against the 11.5 seconds per person the 15 minute target
allows. The queue, not the portal, is the slow part.

## A note on the headcount total

The total counts everyone on the list, which is 90 people: 78 attendees and 12
secretariat. Everyone with a name tag is expected, so everyone is counted.

---

# Module 5: feedback

## The two kinds of form

**Per session.** A session gets a form when `feedbackEnabled` is true for it in
`config/event.json`. The form asks for 1 to 5 stars and an optional comment,
and it is linked from that session's page.

**The whole event.** One form at `/feedback/event`, asking for an overall
rating, which session was most useful, one thing to improve, and anything
else. It is linked from the home page while it is open.

## One answer per phone

Each form takes one answer per device. Coming back to a form you have already
answered says so instead of offering it again.

This uses a cookie, not a login, so it is a politeness mechanism rather than a
guarantee. Someone determined to answer twice can clear their browser data.
That is the right trade for a leadership event.

## Names

Who gets named is an admin setting, per form, at
<http://localhost:3000/admin/feedback>:

| Setting                       | What the attendee sees                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| Anonymous, no names collected | No name field at all. A name is not stored even if one is posted. |
| Names required                | A name field that must be filled in.                              |
| Name optional                 | A name field that says "leave it blank to stay anonymous".        |

There is an event wide default, and any form can have its own setting that
overrides it. Changing the default moves every form that is following it.

A name here is what the person typed. There is no login, so the portal does
not claim the answer came from a particular person on the attendee list.

## Opening and closing a form

Every form has a Close button on the admin page. A closed form tells attendees
it is closed rather than silently failing. Useful for the event form, which
you may not want answered on Day 1.

## Seeing the results

<http://localhost:3000/admin/feedback> lists every form with its number of
answers and its average. Click a form for the star spread, the comments, and
for the event form, which session people picked as most useful.

## It works without JavaScript

The feedback form is a plain HTML form. If a phone is on bad Wi-Fi and the
scripts never arrive, the form still submits and still records the answer.
This was checked by posting the form with no JavaScript running at all.

That is why the rating is radio buttons rather than a tap-a-star widget, and
why the result comes back in the web address rather than on the page.

## Trying it

```powershell
npm run dev
```

Then open <http://localhost:3000/feedback/d1-keynote> on a phone, leave an
answer, and look at <http://localhost:3000/admin/feedback> to see it.

To start again with no answers:

```powershell
npm run db:reset
```

---

# Working on this from another machine, or from your phone

The repository is at <https://github.com/KamalHazriq/event-portal> and it is
**private**. It holds the project brief and internal planning, so keep it that
way unless you have a reason not to.

## What is not in the repository

Three things are deliberately git-ignored, so a fresh checkout does not have
them and nothing will run until you create them:

| Missing          | Why                       | How to get it back           |
| ---------------- | ------------------------- | ---------------------------- |
| `.env.local`     | Holds the admin PIN       | `cp .env.example .env.local` |
| `prisma/dev.db`  | The local database        | `npm run db:push`            |
| The dummy people | Loaded into that database | `npm run db:seed`            |

## Setting up a fresh checkout

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run db:push && npm run db:seed
```

Then `npm run dev` as usual. On Windows use `Copy-Item .env.example .env.local`
for the second one.

## Running the browser tests somewhere new

```bash
npx playwright install chromium
```

Only needed once per machine. The logic tests, `npm run test`, need nothing
extra and are the quicker check when you are working on a small screen.

## A note on editing from a phone

Reading code, changing config and asking for small edits all work fine. What
does not travel well is anything you need to _look_ at: the name tag print
layout, the big screen, and the theme. Leave those for when you are back at a
laptop, or at least check them before printing anything.

---

# The schedule preview on GitHub Pages

<https://kamalhazriq.github.io/event-portal/>

Published automatically on every push to `main`, and by hand from the Actions
tab on GitHub, which works from a phone.

## What is on it, and what is not

| On the preview                  | Not on the preview                   |
| ------------------------------- | ------------------------------------ |
| Home, with now and next         | Check in and the registration desk   |
| The full agenda, all three days | Feedback forms                       |
| Every session page              | The admin console                    |
| Resources                       | Anything that writes to the database |

GitHub Pages serves flat files only. It cannot run the parts of the portal
that need a server, which is why half the modules are missing from it. A
banner at the top of every page says so.

## It is a snapshot, not the live portal

The pages are saved at the moment of publishing, so "now and next" shows
where the clock was when it was built, and it does not move. For the real
thing, run the portal.

## How it is made

`scripts/build-static-preview.ts` starts the real portal and saves what it
renders. There is no second copy of the pages, so the preview cannot drift
away from the real portal: fix a layout once and the preview gets it too.

Before saving, it generates a copy of the config with the server-only modules
switched off, so no saved page carries a link to something Pages cannot
serve. The agenda's day tabs become real folders, because a static host
cannot read a query string.

Build it yourself with:

```powershell
npm run preview:static
```

That writes the `out` folder, which is git-ignored.

## If you rename the repository

The base path has to match the repository name, in two places:

- `PREVIEW_BASE_PATH` in `.github/workflows/pages.yml`
- the default in `scripts/build-static-preview.ts`

Otherwise every stylesheet and link on the published site points at the wrong
address.
