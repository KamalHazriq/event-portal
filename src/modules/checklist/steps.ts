/**
 * The end to end test plan: everything to check before the event, once as an
 * attendee on a phone and once as the secretariat. Plain data, so the page
 * and the tests share it. Each step says what to do and what you should see.
 */
/** A page for a step: a path in the portal, an anchor on this page, or a full address. */
export type StepLink = { href: string; label: string };

export type Step = {
  id: string;
  /** What to do. */
  do: string;
  /** What you should see. */
  expect: string;
  /** Pages that help with this step, opened in a new tab. */
  links?: StepLink[];
};

export type StepGroup = { id: string; title: string; steps: Step[] };

export type Part = {
  id: 'attendee' | 'secretariat';
  title: string;
  intro: string;
  groups: StepGroup[];
};

export const TEST_PLAN: Part[] = [
  {
    id: 'attendee',
    title: 'As an attendee, on a phone',
    intro:
      'Use a real phone that is NOT signed in to the secretariat (a private window works). Try an iPhone and an Android if you can, on the hotel Wi-Fi and on mobile data.',
    groups: [
      {
        id: 'a-prep',
        title: 'A0. Before you start',
        steps: [
          {
            id: 'a-prep-tester',
            do: 'On this page, under Test as an attendee, press Add a test participant. On the phone, open My points, type Test and pick Test Participant.',
            expect: 'The phone is signed in as Test Participant and earns points as them.',
            links: [
              { href: '#tester', label: 'Test as an attendee (on this page)' },
              { href: '/me', label: 'My points' },
            ],
          },
          {
            id: 'a-prep-clock',
            do: 'For the steps that need a live session (reactions, the live highlight, feedback), use the test clock on this page: pick a session and open its links on the phone.',
            expect: 'The session shows as Happening now, with a Test mode notice at the top.',
            links: [{ href: '#test-clock', label: 'Test clock (on this page)' }],
          },
        ],
      },
      {
        id: 'a-in',
        title: 'A1. Getting in',
        steps: [
          {
            id: 'a-in-qr',
            do: 'Scan a printed name tag or table tent QR with the phone camera.',
            expect: 'The portal opens straight to the home page. No code is asked for.',
            links: [
              { href: '/admin/name-tags', label: 'Name tags to print' },
              { href: '/admin/qr-assets', label: 'Table tents' },
            ],
          },
          {
            id: 'a-in-code',
            do: 'In a private window open the plain portal address, without the code.',
            expect:
              'A "participants only" page. A wrong code is refused; the right event code lets you in, with a short hexagon loading screen while it checks.',
            links: [{ href: '/', label: 'The portal (open in a private window)' }],
          },
          {
            id: 'a-in-install',
            do: 'On the home page tap Install (Android and Chrome). On an iPhone, tap Share, then Add to Home Screen.',
            expect: 'An icon appears on the home screen, and it opens full screen like an app.',
            links: [{ href: '/', label: 'Home page' }],
          },
          {
            id: 'a-in-admin',
            do: 'Type /admin after the address.',
            expect:
              'The Secretariat sign in page. A wrong PIN is refused. You cannot get past it. The same for /screen, /kiosk and /guide (the guide is for the secretariat only).',
            links: [
              { href: '/admin', label: '/admin' },
              { href: '/screen', label: '/screen' },
              { href: '/kiosk', label: '/kiosk' },
              { href: '/guide', label: '/guide' },
            ],
          },
        ],
      },
      {
        id: 'a-home',
        title: 'A2. Home, agenda and sessions',
        steps: [
          {
            id: 'a-home-home',
            do: 'Look at the home page.',
            expect:
              'Event name and dates, what is on now and next, the Join Slido button with its code, the alerts card, and the Know before you go link.',
            links: [{ href: '/', label: 'Home page' }],
          },
          {
            id: 'a-home-agenda',
            do: 'Open the Agenda and go through Day 1, Day 2 and Day 3.',
            expect:
              'Every time, title, room and speaker matches the official agenda. On an event day, finished sessions fold into "Earlier today".',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
          {
            id: 'a-home-star',
            do: 'Tap the star on two sessions, open Favourites, then close the browser and open it again.',
            expect: 'Both sessions are listed under Favourites, and still there afterwards.',
            links: [{ href: '/agenda', label: 'Agenda (Favourites is a tab on it)' }],
          },
          {
            id: 'a-home-session',
            do: 'Open a session page.',
            expect:
              'Description, speakers, the Slido button (it opens Slido and shows the code), and links to the previous and next session.',
            links: [{ href: '/agenda', label: 'Agenda (tap any session)' }],
          },
          {
            id: 'a-home-info',
            do: 'Open Know before you go and Resources.',
            expect:
              'No line still says "Coming soon" unless you meant it. Every resource link opens.',
            links: [
              { href: '/info', label: 'Know before you go' },
              { href: '/resources', label: 'Resources' },
            ],
          },
        ],
      },
      {
        id: 'a-part',
        title: 'A3. Taking part',
        steps: [
          {
            id: 'a-part-react',
            do: 'During a live session, tap a reaction.',
            expect: 'It floats up on the big screen within a few seconds.',
            links: [
              { href: '#test-clock', label: 'Test clock' },
              { href: '/agenda', label: 'Agenda (open the live session)' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 'a-part-comment',
            do: 'Post a comment on a session.',
            expect:
              'It says it is waiting for approval. It appears for everyone once the secretariat approves it.',
            links: [
              { href: '/agenda', label: 'Agenda (open a session)' },
              { href: '/admin/comments', label: 'Approve it' },
            ],
          },
          {
            id: 'a-part-photo',
            do: 'On the Photos page, share a photo from the camera.',
            expect:
              'It says "waiting for approval" (or "On the wall" if approval is off). Once approved it shows in "On the wall" and pops up on the big screen.',
            links: [
              { href: '/photos', label: 'Photos' },
              { href: '/admin/photos', label: 'Approve it' },
            ],
          },
          {
            id: 'a-part-feedback',
            do: 'After a session ends, open its feedback form, give stars and a comment, send it. Then try again.',
            expect:
              'A thank you, and the second try says it was already sent. On Day 3, the whole-summit feedback form works too.',
            links: [
              { href: '#test-clock', label: 'Test clock' },
              { href: '/agenda', label: 'Agenda (open a finished session)' },
              { href: '/feedback/event', label: 'Whole summit form' },
            ],
          },
        ],
      },
      {
        id: 'a-points',
        title: 'A4. Points and the leaderboard',
        steps: [
          {
            id: 'a-points-join',
            do: 'On My points, type your name, tap Find me, then tap your name.',
            expect:
              '"You are in." Your points show, and the leaderboard lists you and your department.',
            links: [
              { href: '/me', label: 'My points' },
              { href: '/leaderboard', label: 'Leaderboard' },
            ],
          },
          {
            id: 'a-points-earn',
            do: 'Do something that earns points (a reaction, feedback).',
            expect: 'Your points go up after the next refresh.',
            links: [
              { href: '#test-clock', label: 'Test clock' },
              { href: '/me', label: 'My points' },
            ],
          },
          {
            id: 'a-points-second',
            do: 'On a second phone, pick the same name.',
            expect:
              'It says that name is already signed in and asks for the staff number. A wrong number is refused; the right one works.',
            links: [{ href: '/me', label: 'My points' }],
          },
          {
            id: 'a-points-out',
            do: 'Tap "Not you? Sign out".',
            expect: 'The phone stops collecting points for anyone.',
            links: [{ href: '/me', label: 'My points' }],
          },
        ],
      },
      {
        id: 'a-alerts',
        title: 'A5. Alerts',
        steps: [
          {
            id: 'a-alerts-on',
            do: 'On the home page tap Turn on alerts and allow it. (iPhone: Share, Add to Home Screen first, then open from the icon.)',
            expect: 'It says alerts are on for this device.',
            links: [{ href: '/', label: 'Home page' }],
          },
          {
            id: 'a-alerts-get',
            do: 'Ask the secretariat to post an announcement with the notification box ticked.',
            expect:
              'The phone buzzes, tapping it opens the right page, and the message shows at the top of every page.',
            links: [{ href: '/admin/announce', label: 'Announce' }],
          },
          {
            id: 'a-alerts-off',
            do: 'Tap Turn off.',
            expect: 'No more alerts arrive.',
            links: [{ href: '/', label: 'Home page' }],
          },
        ],
      },
      {
        id: 'a-net',
        title: 'A6. Weak Wi-Fi',
        steps: [
          {
            id: 'a-net-speed',
            do: 'Open the home page and the agenda on hotel Wi-Fi, then on mobile data.',
            expect: 'Each loads in about three seconds or less.',
            links: [
              { href: '/', label: 'Home page' },
              { href: '/agenda', label: 'Agenda' },
            ],
          },
          {
            id: 'a-net-offline',
            do: 'After opening the agenda, switch on airplane mode and open it again.',
            expect: 'The agenda still shows, with a "You are offline" bar.',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
        ],
      },
    ],
  },
  {
    id: 'secretariat',
    title: 'As the secretariat, on a laptop and a phone',
    intro:
      'Do these in order. Use your own desk name each time you sign in, such as desk-1, mc or screen. The menu has four sections: On the day, Engage the room, Set up and More. Tap a section to see everything in it.',
    groups: [
      {
        id: 's-ready',
        title: 'S0. Is the portal ready?',
        steps: [
          {
            id: 's-ready-check',
            do: 'Look at the Ready check at the top of this page.',
            expect:
              'Every line has a tick: participant list, PIN, event code, QR address, team alerts and reminders. Anything marked ! says how to fix it.',
            links: [{ href: '#ready-h', label: 'Ready check (top of this page)' }],
          },
          {
            id: 's-ready-health',
            do: 'Open the portal address followed by /api/health.',
            expect:
              'It answers {"ok":true...}. If you set up the uptime alert, an email arrives when it does not.',
            links: [{ href: '/api/health', label: 'Health check' }],
          },
          {
            id: 's-ready-watch',
            do: 'On GitHub, open the Actions tab, choose Event-day watch, and press Run workflow.',
            expect:
              'It finishes with a green tick within a minute. On 13 to 16 December it runs by itself every 5 minutes and emails you if the portal stops answering.',
            links: [
              {
                href: 'https://github.com/KamalHazriq/event-portal/actions/workflows/event-watch.yml',
                label: 'Event-day watch on GitHub',
              },
            ],
          },
        ],
      },
      {
        id: 's-login',
        title: 'S1. Signing in',
        steps: [
          {
            id: 's-login-wrong',
            do: 'Open /admin and type a wrong PIN.',
            expect: 'It is refused with a message, and nothing opens.',
            links: [{ href: '/admin/sign-in', label: 'Sign in page' }],
          },
          {
            id: 's-login-right',
            do: 'Sign in with the real PIN and a desk name.',
            expect:
              'A hexagon loading screen shows while it works (on a slow connection), then the dashboard says "Good morning" with your desk name. A reload keeps you signed in.',
            links: [{ href: '/admin/sign-in', label: 'Sign in page' }],
          },
          {
            id: 's-login-app',
            do: 'On your laptop and phone, install the Secretariat app: the Install button on the dashboard (iPhone: Share, then Add to Home Screen).',
            expect:
              'An icon called Secretariat appears, and it opens straight to the secretariat, separate from the attendee app.',
            links: [{ href: '/admin', label: 'Secretariat' }],
          },
          {
            id: 's-login-admins',
            do: 'Sign in on a second device with another desk name, then open Admins.',
            expect: 'Both desks are listed with what each one did.',
            links: [{ href: '/admin/admins', label: 'Admins' }],
          },
          {
            id: 's-login-team',
            do: 'On every secretariat phone, tap Install, then Turn on team alerts (on the Announce page). iPhone: add to the home screen first and open from the icon.',
            expect: 'It says team alerts are on for this device.',
            links: [{ href: '/admin/announce', label: 'Announce (team alerts)' }],
          },
          {
            id: 's-login-out',
            do: 'On Admins, under Resets, tick the box and press Sign everyone out. Then sign in again.',
            expect:
              'Every desk, this one included, has to enter the PIN again. The PIN itself is unchanged.',
            links: [{ href: '/admin/admins', label: 'Admins, Resets' }],
          },
          {
            id: 's-login-dash',
            do: 'Read the dashboard.',
            expect:
              'The Storage card says the database is ready. "Needs attention" and "Still to fill in" list only what you expect.',
            links: [{ href: '/admin', label: 'Dashboard' }],
          },
        ],
      },
      {
        id: 's-people',
        title: 'S2. The participant list',
        steps: [
          {
            id: 's-people-upload',
            do: 'On Attendees, upload the Master list (or check it is already loaded).',
            expect:
              'The count matches your list, departments show their short names, and the secretariat are marked.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-search',
            do: 'Search a name, a staff number and a department.',
            expect: 'Each finds the right people. Nobody has "No department" by mistake.',
            links: [
              { href: '/admin/attendees', label: 'Attendees' },
              { href: '/admin/desk', label: 'Desk' },
            ],
          },
        ],
      },
      {
        id: 's-content',
        title: 'S3. Agenda and event details',
        steps: [
          {
            id: 's-content-agenda',
            do: 'On Agenda, check each day against the official agenda. Fix a time or room, then Save.',
            expect:
              'The change shows on a phone within a few seconds. A backwards time is refused with the reason.',
            links: [
              { href: '/admin/agenda', label: 'Agenda editor' },
              { href: '/agenda', label: 'Agenda as attendees see it' },
            ],
          },
          {
            id: 's-content-speakers',
            do: 'Fill in real speaker names and titles, and tick them on their sessions.',
            expect: 'Session pages show the names.',
            links: [{ href: '/admin/agenda', label: 'Agenda editor' }],
          },
          {
            id: 's-content-event',
            do: 'On Event info, check the event name, venue, footer, Slido link and code, and fill in Transport, Parking, Hotel check in and Wi-Fi.',
            expect:
              'The Know before you go page has no "Coming soon" left. The Slido link opens Slido.',
            links: [
              { href: '/admin/event-info', label: 'Event info' },
              { href: '/info', label: 'Know before you go' },
            ],
          },
          {
            id: 's-content-resources',
            do: 'Add the resource links.',
            expect: 'Each shows on the Resources page and opens.',
            links: [
              { href: '/admin/event-info', label: 'Event info' },
              { href: '/resources', label: 'Resources' },
            ],
          },
        ],
      },
      {
        id: 's-print',
        title: 'S4. Printing',
        steps: [
          {
            id: 's-print-tag',
            do: 'On Name tags choose White or Blue and print ONE page first (margins None, headers off, background graphics on for blue).',
            expect:
              'Names fit, the D&I logo is there, and scanning the QR opens the portal without asking for the code.',
            links: [{ href: '/admin/name-tags', label: 'Name tags' }],
          },
          {
            id: 's-print-tent',
            do: 'On QR assets print a table tent and save the slide QR.',
            expect: 'The QR scans from two metres away.',
            links: [{ href: '/admin/qr-assets', label: 'QR assets' }],
          },
          {
            id: 's-print-run',
            do: 'Print the Runbook, one copy for each desk.',
            expect: 'It is readable on paper and has the event code on it.',
            links: [{ href: '/admin/runbook', label: 'Runbook' }],
          },
        ],
      },
      {
        id: 's-desk',
        title: 'S5. The registration desk',
        steps: [
          {
            id: 's-desk-scan',
            do: 'On Desk, tap Use the camera and scan a TNB business card on three different phones.',
            expect:
              '"Checked in" with the right name and department. Scanning the same card again says "Already checked in".',
            links: [{ href: '/admin/desk', label: 'Desk' }],
          },
          {
            id: 's-desk-find',
            do: 'Find someone by name, by department (type CORES), and from the Whole list tab.',
            expect: 'Each finds them and a tap on Check in works.',
            links: [{ href: '/admin/desk', label: 'Desk' }],
          },
          {
            id: 's-desk-head',
            do: 'Open Headcount.',
            expect: 'Arrivals by department match. Undo one check in works.',
            links: [{ href: '/admin/headcount', label: 'Headcount' }],
          },
          {
            id: 's-desk-offline',
            do: 'With the Desk page open on a phone, switch on airplane mode (or turn Wi-Fi off), then check in someone by name from the Whole list. Switch the connection back on.',
            expect:
              'An amber bar says "No connection" and the check in is saved on the device ("1 check in saved"). When the connection returns it sends itself, the bar goes, and Headcount shows the person. Do not reload the page while offline.',
            links: [
              { href: '/admin/desk', label: 'Desk' },
              { href: '/admin/headcount', label: 'Headcount' },
            ],
          },
          {
            id: 's-desk-undoall',
            do: 'On Desk (or Headcount), press "Undo all attendance (for testing)", choose a day, type UNDO and confirm.',
            expect:
              'Every check in for that day is removed and the counters go back to zero. It cannot be put back, so use it only for testing.',
            links: [{ href: '/admin/desk', label: 'Desk' }],
          },
          {
            id: 's-desk-kiosk',
            do: '(Optional) On the Desk page open the kiosk: "Preview" on your own laptop, and "Open and lock this device" on the tablet. On the locked tablet, hold up a card, then try typing /admin.',
            expect:
              'Preview never locks your laptop. The locked tablet shows a big "Welcome", and typing /admin shows a "locked to the kiosk" page that needs the PIN.',
            links: [
              { href: '/kiosk', label: 'Preview the kiosk' },
              { href: '/kiosk?lock=1', label: 'Open and lock (tablet only)' },
            ],
          },
        ],
      },
      {
        id: 's-screen',
        title: 'S6. The projector laptop',
        steps: [
          {
            id: 's-screen-open',
            do: 'On the laptop sign in as "screen", open /screen and press F11. Better: in Chrome or Edge install it as an app (menu, Save and share, Install this page as an app) and open the desktop icon. Using one laptop for both? Set the display to Extend, drag the screen window to the projector, then F11.',
            expect:
              'Full screen, with the D&I logo top left, a slowly moving blue glow, a faint honeycomb and a thin line that sweeps down now and then.',
            links: [{ href: '/screen', label: 'Big screen' }],
          },
          {
            id: 's-screen-device',
            do: 'On the projector laptop, the check in tablet and each secretariat phone, open Device check.',
            expect:
              'Every line is OK or has a plain fix. The corner marks of the test pattern are all visible on the projector.',
            links: [{ href: '/admin/device-check', label: 'Device check' }],
          },
          {
            id: 's-screen-views',
            do: 'From the Big screen page show each view in turn: Welcome, Now and next, Arrivals, Countdown, Lucky draw, Photo wall, Questions, Poll, Leaderboard, Comments.',
            expect:
              'A hexagon wipe covers each change, then the new view appears within a few seconds. The Welcome QR scans. Arrivals counts guests only.',
            links: [
              { href: '/admin/big-screen', label: 'Big screen remote' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-screen-calm',
            do: 'If the projector laptop stutters: on the Big screen page, under Effects, press "Calm mode: turn the effects off". Press it again to turn them back on.',
            expect:
              'In calm mode the background stands still and views change straight away. Turn effects back on if the laptop copes.',
            links: [{ href: '/admin/big-screen', label: 'Big screen remote' }],
          },
          {
            id: 's-screen-long',
            do: 'Leave it running for ten minutes, then unplug the Wi-Fi for 30 seconds.',
            expect:
              'No stutter, including during a wipe. It keeps its last view and catches up when the Wi-Fi is back. If it stutters, note the laptop and tell the developer.',
            links: [{ href: '/screen', label: 'Big screen' }],
          },
        ],
      },
      {
        id: 's-room',
        title: 'S7. Running the room',
        steps: [
          {
            id: 's-room-live',
            do: 'Open Live control and set a countdown.',
            expect:
              'What is on, what is next and the room count are right. The countdown shows on the projector.',
            links: [{ href: '/admin/live', label: 'Live control' }],
          },
          {
            id: 's-room-announce',
            do: 'On Announce, post a message, then "Send a test to this device", then Take it down.',
            expect:
              'The banner appears on attendee phones and goes away. The test arrives on a phone with alerts on.',
            links: [
              { href: '/admin/announce', label: 'Announce' },
              { href: '/', label: 'Home page (as an attendee)' },
            ],
          },
          {
            id: 's-room-team',
            do: 'On Announce, under Test your alerts, press "Send a test to the team". Then send a message with "The team only" chosen. Then, from another phone, share a photo that needs approval.',
            expect:
              'Each team phone gets the test and the team message, attendees see no banner, and a "Photo waiting" alert arrives (at most one every five minutes).',
            links: [
              { href: '/admin/announce', label: 'Announce' },
              { href: '/photos', label: 'Photos (from another phone)' },
            ],
          },
          {
            id: 's-room-remind',
            do: 'On Announce, add a scheduled reminder for two minutes from now, to the team only. Wait.',
            expect:
              'The team phones get it on the minute and the list shows Sent. If it stays Waiting, the scheduler is not set up (see the deploy notes); it still goes out while a big screen page is open.',
            links: [{ href: '/admin/announce', label: 'Announce, Scheduled reminders' }],
          },
          {
            id: 's-room-banner',
            do: 'Post an announcement with "Also show it as a banner on the big screen" ticked, then look at the projector. Then Take it down.',
            expect:
              'A banner shows along the bottom of every projector view, and goes when taken down.',
            links: [
              { href: '/admin/announce', label: 'Announce' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-room-moderate',
            do: 'Approve and hide a comment, and approve and reject a photo. Try the approval switch and each photo layout.',
            expect: 'Each change shows on phones and the big screen.',
            links: [
              { href: '/admin/comments', label: 'Comments' },
              { href: '/admin/photos', label: 'Photos' },
            ],
          },
          {
            id: 's-room-draw',
            do: 'On Lucky draw, draw one winner and then several. Mark one "Not here". Then Start over.',
            expect:
              'The big screen spins with a ticking sound, then shows the winner with confetti and a short fanfare (click the projector screen once first so the browser allows sound). A winner whose phone joined the leaderboard gets a banner and an alert.',
            links: [
              { href: '/admin/lucky-draw', label: 'Lucky draw' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-room-slido',
            do: 'Run a real Slido question and poll. Then switch to the portal backup on the Polls page: from a phone, ask a question and vote in a poll; approve the question on Q&A and show it on the big screen. Then switch back.',
            expect:
              'Both ways work. In backup mode the session page shows the portal Q&A and poll, the question reaches the big screen once approved, and switching back puts the Slido buttons back.',
            links: [
              { href: '/admin/polls', label: 'Polls' },
              { href: '/admin/qa', label: 'Q&A' },
              { href: '/agenda', label: 'Agenda (a session page)' },
            ],
          },
          {
            id: 's-room-committee',
            do: '(If you use it) On Committees, upload a committee Excel and choose who can see its summary. Open the summary link on a phone.',
            expect:
              'The summary shows the right numbers, and only the people you chose can open it.',
            links: [{ href: '/admin/committees', label: 'Committees' }],
          },
          {
            id: 's-room-insights',
            do: 'Open Insights.',
            expect:
              'It lists what needs attention, arrivals per 15 minutes and the liveliest sessions.',
            links: [{ href: '/admin/insights', label: 'Insights' }],
          },
        ],
      },
      {
        id: 's-after',
        title: 'S8. After the event',
        steps: [
          {
            id: 's-after-report',
            do: 'On Reports, download the Excel report, open the PDF summary, and upload the Slido export.',
            expect:
              'The workbook has attendance, departments, feedback and the lucky draw. Department short names are in their own column.',
            links: [
              { href: '/admin/reports', label: 'Reports' },
              { href: '/admin/reports/summary', label: 'Summary for PDF' },
            ],
          },
          {
            id: 's-after-backup',
            do: 'At the end of EACH event day, on Reports, download the Excel file and the approved photos. Keep a copy outside the portal.',
            expect: 'Two files saved. If anything went wrong overnight you still have the day.',
            links: [{ href: '/admin/reports', label: 'Reports' }],
          },
          {
            id: 's-after-photos',
            do: 'On Photos, download the approved photos.',
            expect: 'A zip with the photos and their captions.',
            links: [{ href: '/admin/photos', label: 'Photos' }],
          },
        ],
      },
      {
        id: 's-clean',
        title: 'S9. A clean slate before the event',
        steps: [
          {
            id: 's-clean-clear',
            do: 'When all testing is done, use "Clear test data" at the bottom of this page.',
            expect:
              'Headcount shows nobody arrived, the leaderboard and lucky draw are empty, and no test comments or photos remain. The participant list, your agenda edits and the settings stay. The Undo all attendance button next to it clears only the check ins.',
            links: [{ href: '#clean', label: 'Clear test data (bottom of this page)' }],
          },
          {
            id: 's-clean-board',
            do: 'On Admins, under Resets, press Reset the leaderboard sign ins.',
            expect:
              'Every attendee phone is signed out of the leaderboard, so testers pick their name again.',
            links: [{ href: '/admin/admins', label: 'Admins, Resets' }],
          },
          {
            id: 's-clean-final',
            do: 'Look at the dashboard once more.',
            expect: 'Nothing under "Needs attention" that you did not expect.',
            links: [{ href: '/admin', label: 'Dashboard' }],
          },
        ],
      },
    ],
  },
];

export function allStepIds(): string[] {
  return TEST_PLAN.flatMap((part) => part.groups.flatMap((g) => g.steps.map((s) => s.id)));
}
