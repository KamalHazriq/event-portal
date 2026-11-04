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
