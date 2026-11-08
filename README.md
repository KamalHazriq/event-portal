# Event Portal

A mobile first web portal for live corporate events. First use: the D&I Power
Summit, 14 to 16 December 2026.

Built to be reused: the event lives in a config file, not in the code.

## Have a look

Schedule preview: <https://kamalhazriq.github.io/event-portal/>

That is the read-only half, published to GitHub Pages. Check in, feedback and
the admin console need a server, so they are not on it.

## Start here

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:push
npm run db:seed
npm run dev
```

Then open <http://localhost:3000>.

Full instructions, including how to pretend it is a different date, are in
[docs/RUNNING.md](docs/RUNNING.md).

## Documentation

- [docs/RUNNING.md](docs/RUNNING.md) - running and testing it on Windows
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - how it is put together and why
- [docs/REUSING.md](docs/REUSING.md) - running it for a different event
- [docs/DEPLOYING.md](docs/DEPLOYING.md) - what hosting still needs to decide

## What is built

| Module                                            | State               |
| ------------------------------------------------- | ------------------- |
| 1. Schedule and session pages                     | Done                |
| 4. QR check in and name tags                      | Done                |
| 5. Feedback                                       | Done                |
| 6. Admin console                                  | Done                |
| 8. Big screen mode                                | Done                |
| 7. Report export with Slido import                | Done                |
| Extras: lucky draw, photo wall, committee summary | Preview, dummy data |
| 2 and 3. Own Q&A and polls                        | Preview, build last |

Live polls and Q&A run on Slido for this event. The portal links out to it.

"Preview" means the admin page exists and can be clicked through, running on
invented data that is never saved. See "Previews of the modules still to come"
in [docs/RUNNING.md](docs/RUNNING.md).

## Ground rules

- No AI, no analytics, no tracking, nothing calls an external service.
- No real personal data in this repository. The committed attendee list is
  invented, and `config/attendees.csv` is git-ignored.
- Everything event-specific is in `config/event.json`.
- The secretariat pages sit behind a PIN from `ADMIN_PIN`. Change it before the event.
- All storage goes through the adapter in `src/data/`, so the database can be
  swapped once hosting is decided.
