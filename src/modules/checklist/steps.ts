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
  /**
   * The round of changes this step was last new or different in. A step whose
   * rev equals LATEST_REVISION shows a "Latest" badge.
   */
  rev?: number;
};

/** Bump this when a batch of changes lands, and mark the steps it touched with it. */
export const LATEST_REVISION = 3;

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
            rev: 2,
            do: 'On this page, under Test as an attendee, press Add a test participant. On the Door gifts page, set "When can people spin?" to "Now, any day" for testing.',
            expect:
              'Test Participant is on the list, and the Door gifts page says the spin is open now.',
            links: [
              { href: '#tester', label: 'Test as an attendee (on this page)' },
              { href: '/admin/door-gifts', label: 'Door gifts' },
            ],
          },
          {
            id: 'a-prep-clock',
            rev: 2,
            do: 'On this page, under Test clock, pick a session and press "Use this time on this device" (or a quick jump such as "Day 1, after it ends"). Then open the attendee pages on the same device and tap around: Home, Agenda, a session.',
            expect:
              'Every page shows the yellow "Test clock" bar and behaves as if it were that moment: the home page shows what is on now and next, earlier sessions are done, reactions and comments open. "Back to real time" ends it; other devices never see it.',
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
            id: 'a-in-welcome',
            rev: 2,
            do: 'Still in the private window, open any page (say the Agenda). Type "Test", tap Test Participant, then press "Yes, that is me".',
            expect:
              'Before the page, it asks "Welcome! Who are you?" (a small "continue without a name" link is only a backup for someone not on the list). After a name is picked it asks "Are you Test Participant?". "No, that is not me" goes back. Once confirmed the phone goes on to the page it was opening, and is never asked again.',
            links: [{ href: '/agenda', label: 'Agenda (in a private window)' }],
          },
          {
            id: 'a-in-gift',
            rev: 2,
            do: 'On the phone, open the home page and the door gift page. Then, at the desk, check Test Participant in (see S5).',
            expect:
              'Before check in, the phone says a door gift is waiting, to spin for at the registration desk. After the desk spin, the home page shows "Your door gift" with it, and the door gift page shows the same gift.',
            links: [
              { href: '/', label: 'Home page' },
              { href: '/door-gift', label: 'Door gift' },
            ],
          },
          {
            id: 'a-in-taken',
            rev: 2,
            do: 'On a second phone, pick Test Participant on the welcome page too.',
            expect:
              'It says the name is already signed in on another device and asks for the staff number (TEST0001). A wrong number is refused.',
            links: [{ href: '/agenda', label: 'Agenda (second phone)' }],
          },
          {
            id: 'a-in-install',
            rev: 2,
            do: 'On the home page tap Install (Android and Chrome). On an iPhone, tap Share, then Add to Home Screen.',
            expect:
              'An icon appears on the home screen and opens full screen like an app. On an iPhone the app asks for the event code once (no white screen). On a Samsung tablet or phone in Samsung Internet, the home page shows the three menu steps (☰, Add page to, Home screen) instead of an Install button.',
            links: [{ href: '/', label: 'Home page' }],
          },
          {
            id: 'a-in-admin',
            rev: 2,
            do: 'Type /admin after the address.',
            expect:
              'The Secretariat PIN page straight away, never the event code page first. A wrong PIN is refused. The same for /screen, /kiosk and /admin/tour (the tour is for the secretariat only; the old /guide address now leads there).',
            links: [
              { href: '/admin', label: '/admin' },
              { href: '/screen', label: '/screen' },
              { href: '/kiosk', label: '/kiosk' },
              { href: '/admin/tour', label: 'Tour' },
            ],
          },
        ],
      },
      {
        id: 'a-home',
        title: 'A2. Home, agenda and sessions',
        steps: [
          {
            id: 'a-home-plain',
            rev: 3,
            do: 'Open the Welcome and the Bingo ice breaker (Day 1) on the agenda, and look for the M-level session (Day 2).',
            expect:
              'Welcome and Bingo show the time and place only: no reactions, no comments, no Slido button, no rating, and they are missing from the Comments, Q&A and report lists. The M-level session is private, so it is not on the agenda at all.',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
          {
            id: 'a-home-arrows',
            rev: 3,
            do: 'Open any session and scroll to the end. Use the Previous and Next buttons, and the back button at the top.',
            expect:
              'The buttons are solid blocks with a square chevron, no underlines, and open the neighbouring session.',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
          {
            id: 'a-home-ended',
            rev: 3,
            do: 'With the test clock set to "Day 2, after it ends" (or after the event), open Home, Agenda and a session.',
            expect:
              'Every page carries a banner saying the event has finished and thanking people; the agenda cards show Finished.',
            links: [
              { href: '#test-clock', label: 'Test clock (on this page)' },
              { href: '/', label: 'Home' },
            ],
          },
          {
            id: 'a-home-layout',
            rev: 3,
            do: 'Open the agenda on a laptop width and on the phone.',
            expect:
              'One vertical list, never columns. On the laptop the time sits to the left of each card. Sessions say "Main hall" (not Classroom hall) and there is no Emcee on the list.',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
          {
            id: 'a-home-resources',
            rev: 3,
            do: 'Open Resources. Open a session poster, a Day 1 or Day 2 slides entry, and a breakout output. Press the blue "Download all" button on a category, then pick a single file.',
            expect:
              'Each resource links to a folder or a direct file, with the files listed one by one under it. There is no event photos entry, and no posters for the welcome, ice breaker, M-level or other non-talk sessions. Single and multiple downloads both work.',
            links: [{ href: '/resources', label: 'Resources' }],
          },
          {
            id: 'a-home-home',
            rev: 2,
            do: 'Look at the home page.',
            expect:
              'Event name and dates, what is on now and next, the Join Slido button with its code, the alerts card, and the Know before you go link. While a session is live (use the test clock), it has a React and comment button that opens it, and a Slides button if it has slides.',
            links: [{ href: '/', label: 'Home page' }],
          },
          {
            id: 'a-home-agenda',
            rev: 2,
            do: 'Open the Agenda and go through Day 1, Day 2 and Day 3.',
            expect:
              'Every time, title, room and speaker matches the official agenda. The Day 1, Day 2 and Day 3 tabs are all the same width. On an event day, finished sessions fold into "Earlier today".',
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
            rev: 2,
            do: 'Open a session page.',
            expect:
              'Description, speakers, the Slido button (it opens Slido and shows the code), Open the slides if the session has a slides link, and links to the previous and next session. Comments sit right under the reactions while the session is on. The back and next buttons are one solid blue colour, arrow included.',
            links: [{ href: '/agenda', label: 'Agenda (tap any session)' }],
          },
          {
            id: 'a-home-info',
            rev: 2,
            do: 'Open Know before you go and Resources.',
            expect:
              'Resources shows the four "(test link)" files, each opening a sample PDF (swap them for the real links on Event info, Resources). The dress code shows one line per day. No line says "Coming soon" unless you meant it.',
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
            id: 'a-part-signed',
            rev: 3,
            do: 'Without a name chosen, try to comment, ask a question, vote in a poll and send feedback.',
            expect:
              'Each asks you to choose your name first. After you do, the comment says "Posted as <name>", your own waiting comment says "Yours, waiting for approval" (only when approval is on), and feedback says "Sent as <name>".',
            links: [
              { href: '/agenda', label: 'Agenda' },
              { href: '/poll', label: 'Poll' },
              { href: '/feedback/event', label: 'Event feedback' },
            ],
          },
          {
            id: 'a-part-like',
            rev: 3,
            do: 'On a session page with comments, tap the heart on a comment a few times.',
            expect: 'The count changes at once and the page does not refresh or jump.',
            links: [{ href: '/agenda', label: 'Agenda' }],
          },
          {
            id: 'a-part-pollbtn',
            rev: 3,
            do: 'With Slido off (backup mode), look at the top bar of any page.',
            expect: 'The top button says "Vote in the poll" and opens the poll, not Slido.',
            links: [{ href: '/poll', label: 'Poll' }],
          },
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
            rev: 2,
            do: 'On a live talk, signed in as Test Participant, post a comment. Then open a lunch or break session.',
            expect:
              'There is no name box: it says "Posted as Test Participant". Your comment shows at once marked "Yours, waiting for approval", and for everyone once approved. Lunch, breaks, registration and free time have no reactions or comments.',
            links: [
              { href: '/agenda', label: 'Agenda (open a session)' },
              { href: '/admin/comments', label: 'Approve it' },
            ],
          },
          {
            id: 'a-part-photo',
            rev: 2,
            do: 'On the Photos page, take or choose ONE photo, write a caption, then press Share.',
            expect:
              'It says "waiting for approval" (or "On the wall" if approval is off). Once approved it shows in "On the wall" with your name, and pops up on the big screen photo wall.',
            links: [
              { href: '/photos', label: 'Photos' },
              { href: '/admin/photos', label: 'Approve it' },
            ],
          },
          {
            id: 'a-part-feedback',
            rev: 2,
            do: 'After a session ends, open its feedback form, give stars and a comment, send it. Then try again.',
            expect:
              'A thank you, and the second try says it was already sent. The form says "Sent as Test Participant": no answer is anonymous. Someone not signed in is asked to find their name first. On Day 3, the whole-summit form works too.',
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
            id: 'a-points-full',
            rev: 3,
            do: 'Open the leaderboard.',
            expect:
              'Everyone with points is listed, with ties marked "tied". The secretariat are not on it.',
            links: [{ href: '/leaderboard', label: 'Leaderboard' }],
          },
          {
            id: 'a-points-gift',
            rev: 3,
            do: 'Check Test Participant in at the desk, then watch the spin popup on the desk screen.',
            expect:
              'A mystery box says "What will be your mystery gift?". Press Spin! and it stops on one gift with confetti and a fanfare. The popup never lists the gifts.',
            links: [
              { href: '/admin/desk', label: 'Desk' },
              { href: '/door-gift', label: 'Door gift (on the phone)' },
            ],
          },
          {
            id: 'a-points-join',
            rev: 2,
            do: 'On My points, type your staff number and tap Find me.',
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
            rev: 2,
            do: 'Ask the secretariat to post an announcement with a link and "Also send it as a notification" ticked.',
            expect:
              'The phone buzzes, tapping it opens the page that was chosen, and the message shows at the top of every page.',
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
            id: 's-ready-tour',
            rev: 3,
            do: 'Open Tour (under Set up). Use "Add the test participant" and one of the pretend time buttons, then go down the demo steps, opening each link.',
            expect:
              'The page lists what to bring (laptop, projector, one phone with a QR to scan), shows the pretend time as ON or OFF, and every demo step opens the right page in a new tab.',
            links: [{ href: '/admin/tour', label: 'Tour' }],
          },
          {
            id: 's-ready-clock',
            rev: 3,
            do: 'Switch the test clock on, look at the top of every secretariat page, then switch it off with the Off button.',
            expect:
              'A clear bar shows while it is on and disappears when it is off. The Test plan page says ON or OFF.',
            links: [{ href: '#test-clock', label: 'Test clock (on this page)' }],
          },
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
            id: 's-login-stay',
            rev: 3,
            do: 'Install the secretariat app, sign in, then tap an alert notification.',
            expect:
              'The app opens on the right page without asking for the PIN again. A short database hiccup never signs you out.',
            links: [{ href: '/admin', label: 'Dashboard' }],
          },
          {
            id: 's-login-back',
            rev: 3,
            do: 'Open a report, a feedback page and an attendee, and look at the back link.',
            expect: 'The back link sits at the top left on every one.',
            links: [{ href: '/admin/reports', label: 'Reports' }],
          },
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
            rev: 2,
            do: 'On your laptop and phone, install the Secretariat app: the Install button on the dashboard (iPhone: Share, then Add to Home Screen).',
            expect:
              'An icon called Secretariat appears, with a small blue S on the D so it is easy to tell apart from the attendee app, and it opens straight to the secretariat. Already installed? Delete it and install again to get the new icon.',
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
            rev: 2,
            do: 'On every secretariat phone, tap Install, then Turn on team alerts (on the Announce page). iPhone: add to the home screen first and open from the icon.',
            expect:
              'It says team alerts are on for this device. Open "Devices with alerts on" at the bottom of Announce: each phone is listed as team or attendee, with the name of whoever signed in on it.',
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
            rev: 2,
            do: 'Open the Secretariat overview (the first page after the PIN) and scroll down past the four number cards.',
            expect:
              '"Needs attention" (only when something does), "Still to fill in before the event", and at the bottom the Storage card saying the database is ready. Each lists only what you expect.',
            links: [{ href: '/admin', label: 'Dashboard' }],
          },
          {
            id: 's-login-search',
            rev: 2,
            do: 'On a laptop press / (or tap the "Find a page" box on a phone) and type "stock", then "report", then "clear".',
            expect:
              'Each shows the matching secretariat pages as you type (Door gifts, Reports, Admins). Enter or a tap opens the first. Committees never shows: it is switched off.',
            links: [{ href: '/admin', label: 'Secretariat' }],
          },
        ],
      },
      {
        id: 's-people',
        title: 'S2. The participant list',
        steps: [
          {
            id: 's-people-bonus',
            rev: 3,
            do: 'On Points, under Bonus points, pick a person, give them some points and a reason, then look at the leaderboard and their My points page. Then press Take back.',
            expect:
              'The points add to their total at once (leaderboard, podium and My points show "Bonus from the secretariat"), the Points table has a Bonus column, and Take back removes them again.',
            links: [
              { href: '/admin/points', label: 'Points, Bonus' },
              { href: '/leaderboard', label: 'Leaderboard' },
            ],
          },
          {
            id: 's-people-undo',
            rev: 3,
            do: 'Check Test Participant in (and spin), then undo the check in from the attendee page or the desk list.',
            expect:
              'The check in, the door gift and any lucky draw win are all undone together, and their points drop. Spinning again works as the first time.',
            links: [
              { href: '/admin/attendees', label: 'Attendees' },
              { href: '/admin/door-gifts', label: 'Door gifts' },
            ],
          },
          {
            id: 's-people-table',
            rev: 3,
            do: 'Open Attendees on a laptop and on a tablet.',
            expect: 'The whole table fits without sideways scrolling and every column is readable.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-upload',
            do: 'On Attendees, upload the Master list (or check it is already loaded).',
            expect:
              'The count matches your list, departments show their short names, and the secretariat are marked.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-search',
            rev: 2,
            do: 'Type part of a name, a staff number, a role and a department in the search box. Do not press anything.',
            expect:
              'The list filters as you type, and the buttons light up when you point at them. Nobody has "No department" by mistake.',
            links: [
              { href: '/admin/attendees', label: 'Attendees' },
              { href: '/admin/desk', label: 'Desk' },
            ],
          },
          {
            id: 's-people-role',
            rev: 2,
            do: 'Tap the No role filter. Pick one person, tap Edit, fill in the role (or fix the name or department), and Save.',
            expect:
              'No role lists everyone with an empty role. After saving, the list says Saved and shows the new role; name tags and the desk show it too. Fix the same row in the Excel, because uploading the list again overwrites hand edits.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-secretariat',
            rev: 2,
            do: 'Look at the Secretariat filter and the count on the Attendees page.',
            expect:
              'Everyone whose role, department or remark says Secretariat is marked by itself. Only open "The secretariat" box below the list if someone was missed.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-both',
            rev: 2,
            do: 'For someone who is secretariat and a participant too (for example Farah): press Edit on their row, untick Secretariat, and Save.',
            expect:
              'They lose the Secretariat badge and stay a participant even after the list is uploaded again: ranked on the leaderboard and able to win the lucky draw.',
            links: [{ href: '/admin/attendees', label: 'Attendees' }],
          },
          {
            id: 's-people-askfirst',
            rev: 2,
            do: 'At the top of Attendees, find "Ask new phones who they are". Turn it off, open the Agenda in a private window, then turn it back on.',
            expect:
              'Off: the private window goes straight to the Agenda. On: it asks "Who are you?" first. Secretariat desks signed in with the PIN are never asked.',
            links: [
              { href: '/admin/attendees', label: 'Attendees' },
              { href: '/agenda', label: 'Agenda (private window)' },
            ],
          },
        ],
      },
      {
        id: 's-content',
        title: 'S3. Agenda and event details',
        steps: [
          {
            id: 's-content-speaker',
            rev: 3,
            do: 'Edit a session on Agenda: choose a speaker from the dropdown, then type a name in the Other box and save.',
            expect:
              'The speaker list under the box updates at once as you pick. A typed Other name is added to the speakers and shown on the agenda.',
            links: [{ href: '/admin/agenda', label: 'Agenda editor' }],
          },
          {
            id: 's-content-resfiles',
            rev: 3,
            do: 'On Event info, edit a resource and add files one by one in the form "Title | link". Save.',
            expect: 'The resources page shows the entry with each file listed under it.',
            links: [
              { href: '/admin/event-info', label: 'Event info' },
              { href: '/resources', label: 'Resources' },
            ],
          },
          {
            id: 's-content-agenda',
            rev: 2,
            do: 'On Agenda, check each day against the official agenda. Open a session, change its time with the time picker (tap the clock), then Save.',
            expect:
              'The change shows on a phone within a few seconds. If you set the end before the start by mistake, nothing is saved and a red box says "it ends before it starts".',
            links: [
              { href: '/admin/agenda', label: 'Agenda editor' },
              { href: '/agenda', label: 'Agenda as attendees see it' },
            ],
          },
          {
            id: 's-content-speakers',
            rev: 2,
            do: 'Fill in real speaker names and titles under Speakers. Then open a session, tap the Speakers dropdown and tick its speakers.',
            expect: 'The dropdown closed shows the chosen names. Session pages show them.',
            links: [{ href: '/admin/agenda', label: 'Agenda editor' }],
          },
          {
            id: 's-content-slides',
            rev: 2,
            do: 'Open d1-svc, d1-atc and d1-otc on Agenda. Paste each report\'s organisation-only OneDrive link into "Slides or handout link", type "Open the report" in "Button label", and Save.',
            expect:
              'Each session page shows an "Open the report" button that opens the file for signed in staff only. While the session is live the home page shows a "Report" button. An empty label shows "Open the slides"; an empty link removes the button.',
            links: [
              { href: '/admin/agenda', label: 'Agenda editor' },
              { href: '/agenda', label: 'Agenda (open that session)' },
            ],
          },
          {
            id: 's-content-event',
            rev: 2,
            do: 'On Event info, use the tabs at the top. Event details: check the name, venue, footer, Slido link and code. Know before you go: fill in Transport, Parking, Hotel check in and Wi-Fi.',
            expect:
              'Each tab shows only its part, and saving comes back to the same tab. The Know before you go page has no "Coming soon" left. The Slido link opens Slido.',
            links: [
              { href: '/admin/event-info?tab=info', label: 'Event info, Know before you go' },
              { href: '/info', label: 'Know before you go' },
            ],
          },
          {
            id: 's-content-resources',
            rev: 2,
            do: 'On Event info, open the Resources tab and add the resource links (organisation-only OneDrive links for anything sensitive).',
            expect:
              'Each shows on the Resources page and opens. A link from a personal account or "Anyone with the link" is not used.',
            links: [
              { href: '/admin/event-info?tab=resources', label: 'Event info, Resources' },
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
            id: 's-print-pdf',
            rev: 3,
            do: 'Open the report summary and choose Print or save as PDF.',
            expect:
              'The top has the organiser logo, then Highlights, Most liked comments and the Leaderboard top five. No staff numbers or emails appear.',
            links: [{ href: '/admin/reports/summary', label: 'Report summary' }],
          },
          {
            id: 's-print-tag',
            rev: 2,
            do: 'On Name tags choose White or Blue and print ONE page first (margins None, headers off, background graphics on for blue).',
            expect:
              'Names fit, the D&I logo is there, AGENDA is printed under the QR (no "Scan for the agenda" line), and scanning the QR opens the portal without asking for the code.',
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
            rev: 3,
            do: 'Find someone by name, by department (type CORES), and from the Whole list tab.',
            expect:
              'Each finds them and a tap on Check in works. The first time someone is checked in, a door gift card covers the desk: press "Spin!": the gifts flick past in one window and stop on one, with confetti, then press "Handed over" (or "Later"). Checking them in again never spins twice: it shows which gift is theirs.',
            links: [{ href: '/admin/desk', label: 'Desk' }],
          },
          {
            id: 's-desk-guest',
            rev: 3,
            do: 'On Desk, open "Not on the list? Door gift for a guest", type a name and press "Spin a door gift". Then on a phone choose "continue without a name" on the welcome page.',
            expect:
              'The guest gets the same spin, and Door gifts lists them under "Guests not on the list". The phone carries on without a name for that visit only.',
            links: [
              { href: '/admin/desk', label: 'Desk' },
              { href: '/admin/door-gifts', label: 'Door gifts' },
            ],
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
            rev: 3,
            do: '(Optional) On the Desk page open the kiosk: "Preview" on your own laptop, and "Open and lock this device" on the tablet. On the locked tablet, hold up a card; then type three letters of a name and pick the person; then try typing /admin.',
            expect:
              'Preview never locks your laptop. The locked tablet shows a big "Welcome" for the card and for the typed name (it asks to confirm the name first), and the first time shows the door gift card: the person presses Spin!, sees their gift with confetti, then Done (or Later) takes the kiosk back to waiting. Typing /admin shows a "locked to the kiosk" page that needs the PIN.',
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
            rev: 2,
            do: 'From the Big screen page show each view in turn: Welcome, Now and next, Arrivals, Countdown, Lucky draw, Photo wall, Questions, Poll, Leaderboard, Comments.',
            expect:
              'A hexagon wipe covers each change, then the new view appears within a few seconds. The Welcome QR scans. Arrivals counts and welcomes everyone who has checked in, the secretariat included (they stay out of the leaderboard and the lucky draw). The Photo wall scrolls in the layout chosen on the Big screen page.',
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
            id: 's-room-comments',
            rev: 3,
            do: 'On Comments, switch approval off, post a comment from a phone, then switch the screen look to Bubbles. Pick the talk on the Big screen page.',
            expect:
              'With approval off the comment appears at once. The big screen shows the talk you chose, as a list or as bubbles, and the choice is on both pages.',
            links: [
              { href: '/admin/comments', label: 'Comments' },
              { href: '/admin/big-screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-room-podium',
            rev: 3,
            do: 'On Big screen choose Podium reveal, pick Top 3, then press Reveal next until the winner shows. Try Top 5 and Top 10.',
            expect:
              'The button names the place coming up (Reveal 5th place, 4th place, and so on), and a second button reveals places 4 to the last at once. Three people tied for 8th show 8th three times, one row each. Places pop in from the bottom up: the top 3 on the podium, places 4 and below in a box underneath, the winner gets a crown, confetti and a fanfare, tied people share a place, and Start again hides it. The title reads "Top N best participants".',
            links: [{ href: '/admin/big-screen', label: 'Big screen' }],
          },
          {
            id: 's-room-suggest',
            rev: 3,
            do: 'Open Big screen with the test clock on a lunch time, then a talk time.',
            expect:
              'A suggestion card says what to show for that moment (for example the photo wall at lunch) and puts it on the screen with one tap; it stays quiet if that view is already up.',
            links: [
              { href: '/admin/big-screen', label: 'Big screen' },
              { href: '#test-clock', label: 'Test clock (on this page)' },
            ],
          },
          {
            id: 's-room-announce-time',
            rev: 3,
            do: 'On Announce, send a message with the quick buttons for how long it stays (10, 15, 30 minutes or 1 hour), then open "Alert log".',
            expect:
              'The banner on phones counts down and disappears when its time is up. The alert log lists the names that received each alert.',
            links: [{ href: '/admin/announce', label: 'Announce' }],
          },
          {
            id: 's-room-polls',
            rev: 3,
            do: 'Vote in a poll from a phone, then open the poll on the Polls page.',
            expect: '"Who voted what" lists each person and their choice. Nothing is anonymous.',
            links: [{ href: '/admin/polls', label: 'Polls' }],
          },
          {
            id: 's-room-picker-fun',
            rev: 3,
            do: 'On Name picker, turn "Make it fun" off and pick a name.',
            expect:
              'The screen shows the name calmly with no confetti or sound; with it on there is confetti and a fanfare.',
            links: [{ href: '/admin/name-picker', label: 'Name picker' }],
          },
          {
            id: 's-room-live',
            do: 'Open Live control and set a countdown.',
            expect:
              'What is on, what is next and the room count are right. The countdown shows on the projector.',
            links: [{ href: '/admin/live', label: 'Live control' }],
          },
          {
            id: 's-room-announce',
            rev: 2,
            do: 'On Announce, write a message, choose "Tapping it opens" (try the dropdown: every option is readable), keep When: Now, and press Post or schedule. Then "Send a test to this device", then Take it down.',
            expect:
              'The banner appears on attendee phones with the link, and goes away when taken down. The big screen never shows announcements. The test arrives on a phone with alerts on.',
            links: [
              { href: '/admin/announce', label: 'Announce' },
              { href: '/', label: 'Home page (as an attendee)' },
            ],
          },
          {
            id: 's-room-team',
            rev: 2,
            do: 'On Announce, under Test your alerts, press "Send a test to the team". Then send a message with "The secretariat team only" chosen. Then, from another phone, share a photo that needs approval.',
            expect:
              'Each team phone gets the test and the team message, attendees see nothing (no banner, no alert), and a "Photo waiting" alert arrives (at most one every five minutes).',
            links: [
              { href: '/admin/announce', label: 'Announce' },
              { href: '/photos', label: 'Photos (from another phone)' },
            ],
          },
          {
            id: 's-room-remind',
            rev: 2,
            do: 'On Announce, write a message for everyone, pick a link, tick the notification box, choose When: Later, at two minutes from now (the calendar icon is white and opens a picker), and press Post or schedule. Wait.',
            expect:
              'It is listed under Scheduled, then goes out on the minute exactly like a Now message: banner, link and notification. The list shows Sent. If it stays Waiting, the scheduler is not set up; it still goes out while a big screen page is open.',
            links: [{ href: '/admin/announce', label: 'Announce, Scheduled reminders' }],
          },
          {
            id: 's-room-moderate',
            rev: 2,
            do: 'On Comments, approve and hide a comment from any talk (they are all in one list, each labelled with its talk), and approve and reject a photo. Try the approval switch and each photo layout.',
            expect: 'Each change shows on phones and the big screen.',
            links: [
              { href: '/admin/comments', label: 'Comments' },
              { href: '/admin/photos', label: 'Photos' },
            ],
          },
          {
            id: 's-room-draw',
            rev: 2,
            do: 'On Lucky draw, draw one winner and then several. Mark one "Not here". Then Start over.',
            expect:
              'The big screen spins with a ticking sound, one spinning name for each winner (10 winners spin 10 names), then shows the winners with confetti and a short fanfare (click the projector screen once first so the browser allows sound). A winner whose phone joined the leaderboard gets a banner and an alert.',
            links: [
              { href: '/admin/lucky-draw', label: 'Lucky draw' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-room-picker',
            rev: 2,
            do: 'On Name picker, pick 3 people with a title such as "Share one idea", with "Spin it on the big screen" ticked. Pick again, then press Start the picker again.',
            expect:
              'The big screen shows three names spinning, then stops on them (with "Make it fun" off, no confetti or sound; on by default it has both). The second pick never repeats the first. Nobody picked here is taken out of the lucky draw.',
            links: [
              { href: '/admin/name-picker', label: 'Name picker' },
              { href: '/screen', label: 'Big screen' },
            ],
          },
          {
            id: 's-room-gifts',
            rev: 3,
            do: 'On Door gifts, press "Edit stock, gifts and when to spin", set the real stock of each gift and save. Find Test Participant: change their gift with the dropdown, press Mark collected, then choose "No gift yet". Finally set "When can people spin?" back to "Only on the first day".',
            expect:
              'Each gift shows how many are given, collected and left. The change saves at once and the phone shows the new gift. "No gift yet" lets them spin again at the desk. Everyone on the list gets one, the secretariat included (untick it if not). If the stock is less than the number of people, the page says how many short.',
            links: [
              { href: '/admin/door-gifts', label: 'Door gifts' },
              { href: '/door-gift', label: 'Door gift (on the phone)' },
            ],
          },
          {
            id: 's-room-look',
            rev: 2,
            do: 'On the Secretariat overview, under Portal style, choose Studio and open the home page and the agenda on a phone and a laptop. Then choose Ruled again (or keep Studio).',
            expect:
              'Studio: big light title, square tiles, small mono code labels, the four number tiles and a floating glass hexagon on a laptop, and a dark square with the D on the main buttons. Ruled comes back in one tap.',
            links: [
              { href: '/admin', label: 'Portal style' },
              { href: '/', label: 'Home page' },
            ],
          },
          {
            id: 's-room-points',
            rev: 2,
            do: 'Open Points and look up the test participant.',
            expect:
              'Their points are broken down by what earned them (check in, reactions, feedback and so on), matching what the phone shows on My points.',
            links: [
              { href: '/admin/points', label: 'Points' },
              { href: '/me', label: 'My points' },
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
            id: 's-clean-photos',
            rev: 3,
            do: 'Open the Photos page and the Test plan "Clean slate" section.',
            expect: 'Both have the same "Clear everything except photos" button.',
            links: [
              { href: '/admin/photos', label: 'Photos' },
              { href: '#clean', label: 'Clean slate (on this page)' },
            ],
          },
          {
            id: 's-clean-clear',
            do: 'When all testing is done, use "Clear test data" at the bottom of this page.',
            expect:
              'Headcount shows nobody arrived, the leaderboard and lucky draw are empty, and no test comments or photos remain. The participant list, your agenda edits and the settings stay. The Undo all attendance button next to it clears only the check ins.',
            links: [{ href: '#clean', label: 'Clear test data (bottom of this page)' }],
          },
          {
            id: 's-clean-allbutphotos',
            rev: 2,
            do: 'After the last rehearsal, if you want to keep the rehearsal photos: on Admins, under Resets, type CLEAR and press "Clear everything except photos".',
            expect:
              'Check ins, points, comments, reactions, feedback, lucky draw, votes, sign ins, door gift spins, name picker turns and announcements are gone. The photos, the participant list, your agenda edits, the stock and the settings stay.',
            links: [{ href: '/admin/admins', label: 'Admins, Resets' }],
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
