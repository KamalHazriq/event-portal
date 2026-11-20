# Power Summit portal: all the links

Portal address: `https://portal--powersummit-7d255.asia-southeast1.hosted.app`
Event code (for attendees, if they are asked): `summit-2027`
The secretariat PIN is NOT written here. Share it only with the team.

Every address below is added after the portal address.

## The important ones

| Link | Who | What it is |
|---|---|---|
| `/` | Attendees | The home page. They arrive by scanning the QR on the name tag, which carries the event code. |
| `/admin` | Secretariat | Sign in with the PIN. Install it as the Secretariat app. |
| `/admin/desk` | Check in staff | Registration desk: scan the TNB business card or search by name. |
| `/screen` | Projector laptop | The big screen, full screen with F11. Install it as the Big screen app. |
| `/admin/big-screen` | MC / secretariat | The projector remote: pick what the screen shows. |
| `/kiosk` | Self check in tablet | Guests scan their own card. `/kiosk?lock=1` locks the tablet to the kiosk. |
| `/admin/test-plan` | You | Ready check and the end to end checklist. |
| `/admin/announce` | Secretariat | Announcements, team alerts, scheduled reminders. |

## Attendees (phone)

| Link | What it is |
|---|---|
| `/` | Home: now and next, announcements, install button |
| `/agenda` | The full agenda, a tab per day |
| `/session/<id>` | One session, for example `/session/d1-welcome`: objectives, speakers, reactions, comments, Slido |
| `/info` | Know before you go |
| `/resources` | Take aways and links |
| `/photos` | Photo wall: share a photo, see approved ones |
| `/leaderboard` | Points leaderboard |
| `/me` | My points: pick your name to join, and My agenda |
| `/poll` | The live poll |
| `/qa/<sessionId>` | Live Q&A for a session |
| `/feedback/<form>` | Feedback forms, for example `/feedback/event` |
| `/committees` and `/c/<token>` | Committee summaries, only for those given access |
| `/pass` | Where the event code is entered if someone has no QR |

## Projector views (sign in once on the laptop)

`/screen` follows whatever the MC picks. A fixed view can be opened directly:

`/screen/welcome`, `/screen/now-next`, `/screen/arrivals`, `/screen/countdown`,
`/screen/lucky-draw`, `/screen/photos`, `/screen/qa`, `/screen/poll`,
`/screen/comments`, `/screen/leaderboard`

(The Big screen page lists the ones that are switched on.)

## Secretariat: On the day (`/admin/on-the-day`)

| Link | What it is |
|---|---|
| `/admin/desk` | Registration desk |
| `/admin/headcount` | Who has arrived, by department; undo a check in |
| `/admin/live` | What is on now, minutes left, the room and the countdown |
| `/admin/big-screen` | Choose what the projector shows |
| `/admin/runbook` | Morning checklist and the plan for each day (printable) |

## Secretariat: Engage the room (`/admin/engage-the-room`)

| Link | What it is |
|---|---|
| `/admin/comments` | Approve or hide comments |
| `/admin/photos` | Approve photos, photo wall layout, download all |
| `/admin/announce` | Announcements, team only messages, scheduled reminders, test alerts |
| `/admin/lucky-draw` | Draw winners from people checked in |

## Secretariat: Set up (`/admin/set-up`)

| Link | What it is |
|---|---|
| `/admin/agenda` | Edit sessions, times, rooms, speakers |
| `/admin/event-info` | Event name, venue, Know before you go, resource links, Slido, department short names |
| `/admin/attendees` | Upload the participant list |
| `/admin/test-plan` | Ready check and the end to end checklist |
| `/admin/device-check` | Test camera, alerts, speed and clock on each real device |
| `/admin/name-tags` | Print name tags (white or blue card) |
| `/admin/qr-assets` | Table tents and the portal QR for a slide |

## Secretariat: More (`/admin/more`)

| Link | What it is |
|---|---|
| `/admin/insights` | What needs attention, numbers, arrivals |
| `/admin/feedback` | Feedback results per session |
| `/admin/qa` | Questions: moderate, take over from Slido |
| `/admin/polls` | Polls: open, reveal, take over from Slido |
| `/admin/reports` | Download the Excel report; `/admin/reports/summary` is the printable summary |
| `/admin/committees` | Committee summaries and who can see them |
| `/admin/admins` | Which desks are signed in, the activity log, sign everyone out, reset sign ins |
| `/guide` | How the portal works (secretariat only) |

## For the apps and monitoring

| Link | What it is |
|---|---|
| `/admin/app.webmanifest` | Makes the Secretariat installable (no need to open it) |
| `/screen/app.webmanifest`, `/kiosk/app.webmanifest` | Same for the big screen and the kiosk |
| `/api/health` | Answers 200 when the portal and database work. For the uptime alert. |
