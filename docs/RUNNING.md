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
rating, which session was most useful (from the sessions that ask for
feedback, so meals and registration are not offered), one thing to improve,
and anything else. It is linked from the home page while it is open.

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

# The preview on GitHub Pages

<https://kamalhazriq.github.io/event-portal/>

Published automatically on every push to `main`. Each finished step is
fast-forwarded onto `main`, so it can be seen as soon as it is done. It can
also be published by hand from the Actions tab on GitHub, which works from a
phone.

## What is on it

| Part           | What it shows                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------ |
| The schedule   | Home with now and next, the full agenda, every session page, resources                           |
| The admin demo | <https://kamalhazriq.github.io/event-portal/admin/>: every admin page, filled with invented data |
| The big screen | `/screen/welcome/`, `/screen/now-next/`, `/screen/arrivals/`, `/screen/countdown/`               |
| The report     | The PDF summary page, and the demo Excel file from the Download Excel button                     |
| Feedback forms | What attendees see, one page per form                                                            |

The admin demo is drawn as if it were Day 2 at 10:40, with three breakouts
running and most people checked in. A yellow banner on every demo page says
so. Buttons and forms do nothing, because GitHub Pages cannot run the server
half of the portal: to try them, run the portal locally.

## How the demo is made safely

The build makes a throwaway database in the system temp folder, loads the
sample attendees and the invented demo activity into it, starts the portal
against it with a random one-off PIN, saves the pages, and deletes the
database. Your local database and any real attendee list are never touched,
and the PIN is never written anywhere.

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

---

# Module 6: the admin console

## Live control

<http://localhost:3000/admin/live> is the page to keep open during a session.
It shows what is on now and how many minutes are left, what is next, how full
the room is, the Slido link for the running session, and the countdown
control. It refreshes itself every twenty seconds.

## The surprise countdown

Set in `config/event.json`, but an admin moves it from the live page during
the event and the stored setting wins. Buttons for 5, 10, 15, 30 and 60
minutes from now, a field for an exact time, an off switch, and a "back to
the config file" button that clears every override.

To put it on the projector, choose Countdown on the big screen page. See
Module 8 below.

## Demo data

```powershell
npm run demo:seed
```

Fills the portal with a convincing three days: arrivals spread across each
morning, several hundred feedback answers with a realistic spread of stars
and written comments, and the settings an admin would have changed. Useful
for showing the console to someone without waiting for an event.

It refuses to run if the database holds anyone who is not from
`config/attendees.sample.csv`, so it can never write invented feedback
against a real attendee list. Forms that already have answers are left alone,
so run `npm run db:reset` first for a clean demo.

Everything it writes is invented.

Note: after `npm run demo:seed`, two of the feedback browser tests ("an
optional name is kept when given") fail, because the demo changes the name
setting on some forms. Run `npm run db:reset` before `npm run test:e2e`.

## Who else is signed in

**Admins** in the admin navigation shows every desk that has a page open
(green while it is there, grey for half an hour after it goes quiet), which
page each is on, and a log of what was done: check ins, countdown changes,
what went on the projector, approvals, uploads, downloads and so on. Runs of
the same line from one desk are folded together ("12 times").

It holds desk labels and plain descriptions only. It never names an attendee,
and the wording is fixed in the code, never taken from anything typed in.

Every admin page is now real. The earlier "preview" pages with dummy data
have all been replaced.

---

# Module 8: the big screen

Full screen pages for the ballroom projector, in the big screen theme from
config (dark by default) and sized to read from the back of the room at
1920 x 1080.

## The four views

| View         | What the room sees                                                        |
| ------------ | ------------------------------------------------------------------------- |
| Welcome      | Event name, tagline, dates, venue and a large portal QR to scan           |
| Now and next | What is running, when it ends and minutes left, then what comes next      |
| Arrivals     | "74 / 78 arrived" with a bar, and a welcome card as each person checks in |
| Countdown    | Big ticking digits towards the surprise, with its label above             |

During parallel breakouts, now and next shows all three side by side.

The arrivals counter is **guests only**, so it reads "/ 78", not "/ 90". The
desk headcount still counts all 90, because everyone with a name tag is
expected at the desk. The secretariat never get a welcome card either.

## Running it in the room

1. On the laptop plugged into the projector, open
   <http://localhost:3000/screen> (or the real address once hosted).
2. Sign in with the PIN, using the label `screen`.
3. Press **F11** for full screen. Leave it open all day.
4. On your phone, open **Big screen** in the admin navigation and tap the view
   you want. The projector follows within about four seconds.

The phone page shows a small live copy of what is on the projector, so you can
check it without turning round. "Hide the live preview" switches it off if
your phone is on poor Wi-Fi.

**Hide names, counter only** on the same page takes every name off the
arrivals view. Setting `features.arrivalWall` to `false` in the config does the
same thing permanently.

A second screen that should always show one thing, such as a monitor by the
registration desk, can open a view directly: `/screen/welcome`,
`/screen/now-next`, `/screen/arrivals` or `/screen/countdown`. Those ignore what
the MC picks.

## Why it needs the PIN

The arrivals view shows names and departments, so the projector pages are
behind the same PIN as the admin pages rather than open to anyone with the
link. The projector laptop signs in like any desk, and stays signed in for 14
hours.

## Trying it before the event

```powershell
npm run demo:seed
npm run dev
```

Then open these, each with a pretend time so there is something to show:

- <http://localhost:3000/screen/now-next?now=2026-12-15T10:40> (three breakouts)
- <http://localhost:3000/screen/now-next?now=2026-12-14T15:10> (the keynote)
- <http://localhost:3000/screen/arrivals?now=2026-12-15T09:00>
- <http://localhost:3000/screen/countdown> (set a time on the live control page first)

The corner says "Test time" whenever the clock is pretend.

## Changing the look

All colours come from `branding.themes.dark` in `config/event.json` (or
`light`, if `branding.bigScreenTheme` is set to `light`). When the slide
designer settles the theme, change those values and the projector follows.
The QR code always stays black on white so it scans.

The motion is deliberately small: new views and new arrival cards fade in, and
the arrivals bar slides. A laptop set to reduce motion gets none of it.

---

# Module 7: the report

Open **Reports** in the admin navigation, or <http://localhost:3000/admin/reports>.

## The Excel file

**Download Excel** builds the whole event into one `.xlsx` file, fresh each
time, named like `power-summit-report-2026-12-16.xlsx`. One sheet per topic:

| Sheet                    | What is in it                                                                     |
| ------------------------ | --------------------------------------------------------------------------------- |
| Summary                  | The headline numbers                                                              |
| Attendance               | Everyone on the list, the time they arrived each day, and how (QR or name search) |
| Attendance by department | Guests per department, per day                                                    |
| Feedback                 | Every answer, with the name only where the form allowed it and the person gave it |
| Feedback by session      | Answers, average stars and the spread of stars per session                        |
| Best session votes       | From the final event form                                                         |
| Slido ...                | The Slido polls and questions, once uploaded                                      |

It holds names, so keep it on approved storage. The QR secrets and the
"remark" column (meal needs and so on) are never in it.

Text people typed, such as a comment starting with `=`, is always written as
text, never as a formula, so nothing in the file can run when it is opened.

## The PDF summary

**Summary for PDF** opens a two page A4 summary: attendance per day and per
department, feedback averages per session, the best rated and best voted
sessions, and the Slido highlights. Press **Print or save as PDF** and choose
**Save as PDF** in the print dialog.

It has counts and averages only, no names, so it can go further than the Excel
file, for example into a management update.

## Adding the Slido results

After the event:

1. In Slido, open the event, go to **Analytics** (or **Export**), and export the
   results as **Excel**, not CSV.
2. On the reports page, choose that file under **Slido results** and press
   **Upload**.

The page says how many sheets of polls and questions it kept. Those land in
the Excel report as extra sheets, and their highlights (the top answer per
poll, the most liked questions) go into the PDF summary.

Only poll and question sheets are kept. Anything else in the export, such as
a participant list with email addresses, is left out and never stored.
Uploading again replaces the earlier file, so a corrected export never doubles
up. **Remove the Slido results** takes them out of the report.

Slido has changed its export layout over the years, so the import finds the
sheets by their names and column headings rather than fixed positions. If an
upload says it found no polls or questions, send me the file's sheet names and
column headings (not the file itself) and I will adjust it.

## No new libraries

The brief asks for a small Excel and PDF library. Neither was needed: an
`.xlsx` file is a zip of XML files, and `src/lib/xlsx/` writes and reads it
using only what Node already has. The PDF is the browser's own "Save as PDF",
the same approach as the name tags. Both were checked against Python's
openpyxl, which opens the files Excel makes and reads the files this makes.

## Trying it

```powershell
npm run db:push
npm run demo:seed
npm run dev
```

`db:push` is needed once, because Module 7 adds one table for uploaded
spreadsheets. Then open the reports page and download the file.

---

# The lucky draw

Open **Lucky draw** in the admin navigation, or
<http://localhost:3000/admin/lucky-draw>.

## Drawing

1. Pick how many winners (1, 2, 3, 5 or 10) and, if you like, type the prize,
   such as "Dinner door prize".
2. Leave **Put it on the big screen** ticked to switch the projector to the
   draw at the same time.
3. Press **Draw**.

The projector spins through the names for about five seconds, slowing like a
wheel, and stops on the winners. A projector that is reloaded later shows the
result straight away, and a laptop set to reduce motion skips the spin.

## The rules

- Only people **checked in that day** are in the hat.
- **Nobody can win twice**, across every draw and every day. The database
  itself refuses a second win, so this holds even when two desks press Draw
  at the same moment: the second desk is asked to press Draw again.
- The draw happens on the server with the computer's secure random numbers,
  so it is fair and every desk sees the same result.

## Who can win

Open **Who can win** and untick anyone who should not, such as the CDIO, then
**Save who can win**. The secretariat start unticked. Once you save, the list
is exactly what you chose.

## Someone is not in the room

Press **Not here** next to their name. They come off the winners list and out
of the hat, and you can draw again for the same prize.

## Rehearsing

**Start over**, at the bottom, clears every winner (after you tick the
confirmation box). Who can win stays as it is.

## In the report

The Excel file gains a **Lucky draw** sheet: draw number, prize, order, name,
department, time and desk. The PDF summary gives the count only, with no
names, like the rest of the PDF.

## Turning it off

Set `features.luckyDraw` to `false` in `config/event.json`. The page and the
big screen view disappear.

---

# The committee summary

Open **Committees** in the admin navigation, or
<http://localhost:3000/admin/committees>. One section per committee listed
under `committees` in `config/event.json` (SVC, ATC and OTC to start with).

## Uploading

Choose the committee's Excel file (`.xlsx`, up to 5 MB) and press **Upload**.
The portal then shows, read only:

- the rows as they are in the file, the first twelve open and the rest folded
  away;
- a count for every column that looks like a category, such as a decision, a
  status or a division ("Approved 7, Noted 1").

Nothing assumes particular column names, so any tidy table works. A title row
above the table is fine. Uploading again replaces the earlier file, and
**Remove this file** takes it out.

## Who can see it

**Secretariat only** (the default) keeps the summaries on the admin page,
behind the PIN.

**Anyone with the portal link** also opens a read only page at `/committees`.
The portal has no personal login yet, so that really does mean anyone who has
the link: check that is acceptable for the papers before choosing it.

## Turning it off

Set `features.committees` to `false` in `config/event.json`.

---

# The team guide

<http://localhost:3000/guide> is a one page tour of the portal for showing
the team: the three kinds of screen, an event day from start to finish with a
link to each page involved, who does what, how it is kept safe, and the
questions people ask. It needs no sign in and holds nothing private.

It reads the config, so it names your event and leaves out anything that is
switched off. It is linked from the secretariat home page and from the foot of
every attendee page.

---

# The look

The theme is the dark teal and green from the event slide template (the
"Telegraf" style): near-black background, deep teal panels, a bright green
for buttons and links.

- **Colours** are the `branding.themes` block in `config/event.json`. Phones
  and the console use `defaultTheme` (now `dark`); the projector uses
  `bigScreenTheme`. A matching light version is there too: set
  `defaultTheme` to `light` to try it.
- **Polish** (the glow behind pages, the lift on cards, the accent bar under
  each page title, the grid on the projector) is in one place, the "Theme
  polish" part of `src/app/globals.css`, and is built from the same colours.
  Change the colours and it follows.
- **The font.** Telegraf is a licensed font, so it is not included. Where it
  is installed on a device it is used; otherwise the next font in
  `branding.fontFamily` is. To use it everywhere, the font files would need to
  be licensed and added.
- **Printing** always uses the light colours on white paper, whatever the
  screen theme: name tags, table tents and the report summary.

Every text and background pair was checked to meet the WCAG AA contrast level
(4.5 to 1 or better) in both themes.

## Logos

All logo files are in `public/branding/` and named in the `branding` block of
`config/event.json`, so the next event swaps them there:

| Setting                                           | File                                  | Where it shows                                       |
| ------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `logoPath`                                        | `event-wordmark.webp`                 | Light backgrounds and anything printed (table tents) |
| `logoDarkPath`                                    | `event-wordmark-on-dark.webp`         | The home page, the guide and the projector welcome   |
| `markPath` / `markDarkPath`                       | `d-logo.webp` / `d-logo-on-dark.webp` | Beside the event name in every page header           |
| `organisationLogoPath`                            | `digital-information.webp`            | The page footer, on a white tile                     |
| `iconPath`, `appleIconPath`, `public/favicon.ico` | the D logo                            | The browser tab and the phone home screen            |

The originals were 2000 px wide; these are trimmed and shrunk copies, about
6 to 23 KB each, so pages stay light on hotel Wi-Fi.

## Screen sizes

Every page is built phone first and checked at four widths: phone (375),
tablet (768), laptop (1366) and desktop (1920). Nothing scrolls sideways at
any of them. From laptop width up, the home page becomes two columns (the
event and what is on at the left, the day down the right); reading pages such
as the agenda keep a comfortable line length. The printable name tags and
table tents keep their exact paper sizes: on a narrow screen the tags drop to
one column and the tents scroll inside their own box.

---

# The photo wall

## For attendees

**Photos** in the menu, or <http://localhost:3000/photos>. Choose or take
photos, add a caption if you like, and they are sent one at a time.

- Each photo is shrunk **on the phone** before sending: a 4000 by 3000 camera
  photo of several MB becomes 1600 px on its longest side, about 200 to 300
  KB. Portrait photos stay upright.
- Re-encoding on the phone also **removes the location and camera details**
  hidden in the photo. They never reach the server.
- **Up to 10 photos per phone.**
- Sharing needs JavaScript, because the shrinking happens in the browser.

## For the secretariat

**Photos** in the admin navigation. New photos land in **Waiting** and appear
by themselves every 20 seconds.

- **Approve** puts a photo on the wall; **Reject** keeps it off. **Approve
  all** clears the queue in one go.
- **Take down** removes an approved photo from the slideshow later.
- **Show the slideshow now** switches the projector to it. It is also on the
  big screen page as **Photo slideshow**: each photo for eight seconds,
  cross fading, newest first. With nothing approved yet, the projector shows a
  QR code that opens the sharing page.
- **Download approved photos** gives one zip of every approved photo, with a
  `captions.csv` beside them.

## Safety

- The server checks every upload **is a real JPEG** by reading its bytes, not
  by trusting the file name, and refuses anything else or anything too large.
- A photo waiting for approval, or rejected, can only be opened by a signed
  in desk. Only approved photos are public, and only by their random address.
- Photos are stored through the data adapter (in SQLite today), so they can
  move to approved storage later without any page changing.

## Trying it

`npm run demo:seed` adds six invented images (colour gradients with a label,
no people) from `scripts/demo-photos`: four approved, two waiting.

Run `npm run db:push` once first, for the new photo table.

---

# Modules 2 and 3: the backup Q&A and polls

Slido runs Q&A and polls for this event. The portal has its own as a backup,
**switched off for attendees** until an admin turns backup mode on.

## If Slido fails on the day

1. Open **Q&A** or **Polls** in the admin navigation.
2. Press **Slido is down, switch to the portal**.

From that moment, with no reload needed on anyone's phone beyond the usual
refresh:

- the Slido button on each session page becomes **Ask a question**;
- the home page shows **A poll is open** whenever one is;
- **Switch back to Slido** undoes it.

While backup mode is off you can still prepare polls and try everything on
the admin pages. Attendees see none of it: `/poll` and `/qa/...` do not exist.

## Q&A

- Attendees ask a question (up to 280 characters), with their name or
  anonymously, and vote others up. One vote per phone per question, and at
  most five questions per phone per session.
- Questions **wait for approval** by default. On the Q&A page: **Approve**,
  **Pin** (one per session, shown first as "being answered now"),
  **Answered**, **Hide**. A hidden or waiting question never reaches phones or
  the projector.
- **Approval first: on / off** changes that for one session, if you would
  rather questions appear straight away.
- **Show top questions on the big screen** puts the four most voted approved
  questions on the projector, with a QR code to ask or vote.

## Polls

- Three kinds: single choice, multiple choice, and word cloud (up to 30
  characters).
- **Load prepared polls** brings in the ones written under `polls` in
  `config/event.json`. **Write a new poll** adds one on the day.
- **Open** a poll (opening one closes any other), **Close** it, and **Reveal
  results** when you want the room to see them. Until then phones only see
  "your answer is in" and the projector shows how many have answered.
- **Put on the big screen** shows the open poll with a QR code to answer,
  then the bars or the word cloud once revealed.
- One answer per phone per poll.

## In the report

If the backup was used, the Excel report gains a **Questions** sheet (every
question with its status and votes) and a **Poll results** sheet.

## The load test

```powershell
npm run dev
```

and in a second window:

```powershell
npm run load:test
```

It pretends to be 80 phones answering a poll at once and 20 phones asking and
voting, over the network like real phones, then checks the stored numbers are
exact, that repeat answers were not counted, and that a sixth question from
one phone was refused. It makes its own poll and questions, removes them
afterwards, and puts backup mode back as it found it.

Run `npm run db:push` once first, for the new tables (questions, polls, and
the admin log).

---

# The layout and the motion

**On a laptop or desktop**, the secretariat pages are an app: a sidebar on
the left with the pages grouped by when they are used (on the day, engaging
the room, after the event, set up), and the page filling the rest of the
screen. The home page is a dashboard with the live numbers first. **On a
phone or tablet** it is a header with a swipeable row of tabs instead.

**Attendee pages** use the full width too: the home page is two columns from
laptop width, the agenda lists sessions in two columns, and the menu sits
beside the name.

**Motion** is subtle and all done in CSS, so pages stay light: a slow drifting
glow and a faint grid behind every page, cards that rise in one after another
as a page opens, a lift and glow when a card is hovered, a light sweep across
main buttons, and a gentle breathing glow on whatever is happening now. A
device set to reduce motion gets none of it, and nothing printed has any.

The page list for the sidebar, the phone tabs and the dashboard is in one
place, `src/components/admin-pages.ts`.
