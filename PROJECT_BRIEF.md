# Project brief: Event Portal (first use: D&I Power Summit 2026-2027)

Read this whole file before writing any code. Re-read it at the start of every new session. If anything here is unclear or conflicts, ask me before building.

## 1. What we are building

A reusable, mobile-first web portal for live corporate events. First use: a 3-day leadership event for about 80 people (78 attendees + 12 secretariat), Mon 14 to Wed 16 Dec 2026, in a hotel ballroom in Malaysia.

Two kinds of screens:
- **Attendee screens** on phones (opened by scanning a QR code).
- **Big-screen views** on the ballroom projector (poll results, top questions, countdown).
- **Admin console** on a laptop for the secretariat (open/close polls, moderate Q&A, see headcount).

It must be reusable for later events (town halls, next year's summit) by changing a config file, not code.

## 1b. Decisions already made (from planning, 3 Nov 2026)

- **Live polls and Q&A run on Slido** (TNB company licence), embedded in the event PowerPoint. The portal does NOT need its own polls or Q&A for this event. Our own Q&A and polls are a backup only (build last, if time).
- **Check-in:** a personal QR code printed on the FRONT of each name tag; the secretariat scans it at the desk. Manual name search as a fallback.
- **Entry point:** one portal URL, shared through one QR code on the back of the name tag, on the welcome slide, on table tents, and as a link in the calendar invite.
- **Language:** English only.
- **Feedback anonymity:** an admin setting per form (anonymous / named / optional name), decided later.
- **Q&A names (backup module only):** each person chooses to add their name or stay anonymous.
- **Operators:** either Kamal (who is also MC) or a teammate, so the admin console must work well on a phone and allow 2 to 3 admins at once.
- **Look and feel:** NOT decided. The theme will come from the person designing the main event slides. Build all colours, fonts and logo as theme tokens in config, ship a neutral TNB-blue placeholder theme, and support both a light and a dark theme. The big screen should feel modern and "futuristic" (large numbers, smooth subtle motion) once the theme is set.

## 2. Hard rules (do not break these)

1. **No AI or external API calls anywhere.** No OpenAI, Claude, Copilot, translation, analytics or tracking scripts. Session content is confidential.
2. **No real personal data in the repo.** Use generated dummy attendees only. Real data will be loaded later from a file that is git-ignored.
3. **Everything event-specific lives in config**, never hard-coded in components.
4. **All reads and writes go through one data adapter interface.** Components and pages never import the database directly. Hosting is not decided yet (TNB Microsoft 365/Azure, or a public cloud like Vercel + Supabase), so the storage must be swappable.
5. **Login sits behind a switch** (`AUTH_MODE=none | microsoft`). Build `none` now. Leave a clean place for Microsoft Entra ID login later, but do not implement it yet.
6. **Works on slow hotel Wi-Fi and mobile data.** Light pages, no heavy images, no large client libraries. First load under about 300 KB of JavaScript if possible.
7. **Real-time without websockets**: use short polling (every 3 to 5 seconds) on live screens. Reason: works on any host, including restricted corporate ones.
8. Plain English UI text. No em dashes in UI copy.

## 3. Tech stack (use this unless you have a strong reason; ask first)

- Next.js (App Router) + TypeScript, strict mode
- Tailwind CSS
- Data: a `DataAdapter` TypeScript interface, with a first implementation on **SQLite via Prisma** for local development. Later implementations (Supabase, SharePoint lists) must only need a new adapter file.
- Validation: zod for all inputs and the config file
- QR codes: a small QR library to generate codes (no external QR web service)
- Export: a small library for Excel (xlsx) and simple PDF
- Tests: Vitest for logic, Playwright for a few key flows
- Package manager: npm

## 4. Folder structure

```
/config/event.json        # the event config (validated by zod)
/config/attendees.sample.csv  # dummy attendees, committed
/config/attendees.csv      # real attendees later, git-ignored
/src/app/                  # pages (attendee, screen, admin)
/src/modules/<module>/     # one folder per module: components, logic, tests
/src/data/adapter.ts       # DataAdapter interface
/src/data/sqlite/          # SQLite implementation
/src/lib/                  # shared helpers (auth switch, config loader, ids)
/docs/                     # how to run, how to deploy, how to reuse
```

## 5. Event config (config/event.json)

Must include at least:
- event: name, short name, dates, venue (can be "TBC"), timezone (Asia/Kuala_Lumpur)
- branding: primary colour `#0053A1`, navy `#042C75`, light panel `#E6EEF8`, font Arial, logo path (placeholder for now)
- days: list of days, each with sessions
- session: id, day, start, end, title, description, objectives, speaker ids, room, type (talk / breakout / activity / break), flags: qaEnabled, feedbackEnabled
- speakers: id, name, title, short bio, photo path (optional)
- resources: list of take-away links (title, url, description)
- surprise: optional countdown target time and label

Validate on startup and show a clear error if invalid. Fill it with a realistic dummy 3-day agenda (Day 1 afternoon start, dinner and night activity; Day 2 full working day with breakout; Day 3 morning closing at noon).

## 6. Modules (build in this order, one at a time)

NEW ORDER after the Slido decision (the detailed module specs below still apply):
1. Module 1: Schedule and session pages (unchanged). Add a "Join Slido" button on each session page, with the Slido event link or code taken from config.
2. Module 4: QR check-in (front-of-name-tag QR). Include an admin page that prints name tags as PDF: front = name, title, department, personal check-in QR; back = portal QR.
3. Module 5: Feedback, with the anonymity setting per form.
4. Module 6: Admin console, phone-friendly, 2 to 3 admins at once.
5. NEW Module 8: Big-screen mode. Full-screen pages for the projector: "now and next" session, live check-in counter, surprise countdown, welcome screen with the portal QR. Must look good at 1920x1080 and be readable from the back of a ballroom. Uses the theme tokens.
6. Module 7: Report export: attendance and feedback, plus an import of Slido's Excel export so poll and Q&A results land in the same report.
7. BACKUP ONLY, if time remains before 4 Dec: Module 2 (Q&A) and Module 3 (polls), in case Slido is unavailable on the day.

Also add an admin page that generates printable QR assets: table tents (A5) and a slide-ready PNG of the portal QR.

### Confirmed extras (build after the must-haves, before the backup Q&A/polls)

- **Arrival wall (big screen):** during registration, each check-in shows a welcome card ("Welcome, <name>, <department>") with a subtle animation, plus a live counter ("42 / 78 arrived"). Reuses check-in data. Option to hide names and show only the counter.
- **Lucky draw (big screen):** animated name spinner that picks from checked-in attendees only. Admin can exclude names (e.g. CDIO, secretariat), draw several winners, and no one can win twice. Results saved to the report.
- **Photo wall:** attendees upload photos from their phone (compress in the browser to about 1600 px wide before upload); every photo waits for admin approval; approved photos play as a slideshow in big-screen mode during breaks and dinner. Max 10 photos per device. Storage goes through the data adapter so it can move to approved storage later. Admin can download all approved photos as a zip after the event. (Check with GRC on storing photos of leaders before using real data.)
- **Take-away resources page:** links and files listed in config.
- **SVC / ATC / OTC summary page:** admin uploads the committee Excel (starting with SVC); the portal shows a simple read-only summary view. Access limited by an admin setting. No DLC.

### Proposed, not confirmed yet (do NOT build until I say so)

- **Commitment wall:** each leader submits one 2027 commitment on their phone; shown as floating cards on the big screen at closing; exported to the report.
- **Team leaderboard:** points per breakout group or department (on-time check-in, feedback submitted, activity win, photos posted); shown on the big screen during breaks.

### Explicitly out of scope for this event

Per-session check-in, certificates, and all AI features.

### Module 1: Schedule and session pages
- Home: event name, today's sessions, "now" and "next" highlight based on current time (with a dev override to fake the time)
- Full agenda by day (tabs)
- Session page: time, title, description, objectives, speakers with bios, links to Q&A and feedback for that session if enabled
- Resources page
- Done when: all content comes from event.json; works well on a 375 px wide phone; Lighthouse performance and accessibility both 90+.

### Module 2: Live Q&A per session
- Attendee: submit a question (max 280 chars), optional name or anonymous, upvote others' questions (one vote per device, stored with a device id in localStorage)
- Moderator (admin): approve / hide / mark answered / pin; questions are hidden until approved (pre-moderation ON by default, configurable per session)
- Big screen: top approved questions by votes, auto-refresh
- Rate limit: max 5 questions per device per session
- Done when: a hidden question never appears on attendee or big screen; vote counts are correct with 20 simulated devices.

### Module 3: Polls
- Types: single choice, multiple choice, word cloud (short text, max 30 chars)
- Admin: create polls ahead of time (also loadable from config), open / close, reveal results
- Attendee: sees the currently open poll, votes once per device
- Big screen: live bar chart or word cloud, large readable text
- Reused for: ice-breaker poll game, breakout sub-topic voting, night activity song voting
- Done when: 80 simulated voters in 30 seconds give correct totals.

### Module 4: QR check-in
- Attendee list loaded from CSV (columns: no, staff_no, name, title, department, remark)
- Each attendee gets a personal QR (printable sheet of name tags with QR) and there is also a manual search by name for the registration desk
- Admin: live headcount overall and by department, list of who has not checked in, undo a check-in
- Day-level check-in (one per day); per-session check-in is a later option
- Done when: the registration desk can check in 80 people in under 15 minutes in a simulated run.

### Module 5: Feedback
- Per-session form: 1 to 5 stars + one optional comment
- Final event form: overall rating, best session, one thing to improve, free comment
- One submission per device per form
- Done when: results show per session in admin.

### Module 6: Admin console
- Protected by an admin PIN from an environment variable (temporary until real login)
- One page per module plus a "live control" page used during sessions: current session, open poll, Q&A queue, headcount
- Countdown timer control for the surprise element (shows on big screen)

### Module 7: Report export
- One click export: attendance, Q&A (all, with status), poll results, feedback, as Excel (one sheet each) and a short PDF summary
- No AI; just tables and simple counts / averages

## 7. Quality and safety

- Sanitize and escape all user text (no HTML injection)
- Basic rate limiting on all write endpoints
- No personal data in logs
- Every module has a few unit tests for its logic and at least one Playwright happy-path test
- Seed script creates dummy data for every module so I can demo without real people
- A simple load-test script that simulates 80 devices voting and asking questions

## 8. How to work with me

- I am one person building part-time, not a full-time developer. Explain what you did in plain language after each step, and tell me exactly how to run and test it.
- Build ONE module at a time. After each module: run the tests, show me how to check it, update `/docs`, make a git commit with a clear message, then STOP and wait for me.
- Keep dependencies minimal. Ask before adding any large library or any paid service.
- If something in this brief is a bad idea technically, say so and suggest a better option before building.
- Deadline: feature freeze Fri 4 Dec 2026. Must-have: schedule, check-in with name tags, feedback, admin console, big-screen mode. Should-have: report export with Slido import. Backup only: own Q&A and polls. Anything else waits.

## 9. First task

1. Set up the project, git, linting, and the folder structure above.
2. Create `config/event.json` with the zod schema and a dummy 3-day agenda, and `config/attendees.sample.csv` with 78 dummy attendees.
3. Create the `DataAdapter` interface and the SQLite implementation (even if Module 1 barely uses it).
4. Build Module 1 only.
5. Write `/docs/RUNNING.md` explaining how to run it locally on Windows.
6. Commit, then stop and tell me how to check it.
