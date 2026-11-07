/**
 * Dummy data for the admin console previews.
 *
 * Several admin pages belong to modules that are not built yet: the big
 * screen (Module 8), the report export (Module 7), the extras (lucky draw,
 * photo wall, committee summary) and the backup Q&A and polls (Modules 2
 * and 3). Their pages exist now so the secretariat can see the whole console
 * and comment on it before the real thing is built.
 *
 * Rules for this file:
 * - Nothing here is stored. Each page builds its data from this file on every
 *   request, and anything an admin clicks lives in the browser tab only.
 * - Every name below is invented. None comes from the attendee list, so a
 *   preview can never put an invented question or photo against a real
 *   person once the real list is loaded.
 * - It is seeded, so a preview looks the same every time it is opened.
 *
 * When a module is built for real, delete its preview page and its section
 * of this file. Nothing else depends on it.
 */
import type { ResolvedSession } from '@/modules/schedule/logic';

/* ------------------------------------------------------------------ random */

/** Small seeded generator. Same seed, same sequence, every run. */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(random: () => number, list: readonly T[]): T {
  return list[Math.min(Math.floor(random() * list.length), list.length - 1)] as T;
}

function intBetween(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Invented names for previews. Deliberately not the attendee list. */
export const MOCK_NAMES = [
  'Aina Kamil',
  'Benjamin Lau',
  'Chitra Nair',
  'Darren Yeoh',
  'Erni Saad',
  'Faizal Hashim',
  'Grace Tan',
  'Hafiz Rosli',
  'Indra Kumar',
  'Juliana Ong',
  'Khairul Anuar',
  'Lim Mei Ling',
  'Muthu Selvam',
  'Nadia Zulkifli',
  'Oliver Chin',
  'Priya Menon',
  'Qistina Jamal',
  'Rahman Idris',
  'Siti Aminah',
  'Teoh Wei Jie',
] as const;

/* -------------------------------------------------------------- big screen */

export type BigScreenView = {
  id: string;
  title: string;
  description: string;
  /** How often the real page will re-poll, per brief hard rule 7. */
  refreshSeconds: number | null;
  /** When the MC would normally put it up. */
  whenToUse: string;
};

export const BIG_SCREEN_VIEWS: readonly BigScreenView[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Event name, tagline and the portal QR, large enough to scan from a table.',
    refreshSeconds: null,
    whenToUse: 'Doors open, registration, between sessions',
  },
  {
    id: 'now-next',
    title: 'Now and next',
    description: 'The running session with time left, and what comes after it.',
    refreshSeconds: 5,
    whenToUse: 'Breaks, so people know when to come back',
  },
  {
    id: 'arrivals',
    title: 'Arrival wall',
    description: 'A welcome card for each check in, with a live "42 / 78 arrived" counter.',
    refreshSeconds: 3,
    whenToUse: 'Registration each morning',
  },
  {
    id: 'countdown',
    title: 'Surprise countdown',
    description: 'Big numbers counting down to the surprise. Set on the live control page.',
    refreshSeconds: 5,
    whenToUse: 'The build up to the surprise',
  },
  {
    id: 'lucky-draw',
    title: 'Lucky draw',
    description: 'The name spinner, driven from the lucky draw page.',
    refreshSeconds: 3,
    whenToUse: 'Dinner and the closing',
  },
  {
    id: 'photos',
    title: 'Photo slideshow',
    description: 'Approved photos from the photo wall, one every eight seconds.',
    refreshSeconds: 5,
    whenToUse: 'Breaks and dinner',
  },
];

/* ------------------------------------------------------------- Q&A backup */

export type MockQuestionStatus = 'pending' | 'approved' | 'answered' | 'hidden';

export type MockQuestion = {
  id: string;
  sessionId: string;
  text: string;
  /** "Anonymous" when the person chose not to give a name. */
  name: string;
  votes: number;
  status: MockQuestionStatus;
  pinned: boolean;
  minutesAgo: number;
};

const QUESTION_TEXTS = [
  'How will we measure whether this is working a year from now?',
  'What support is there for managers who want to start this in their own team?',
  'Can we see the numbers by division, not just the group total?',
  'How does this fit with the cost targets we were given last quarter?',
  'What is the one thing you would ask us to stop doing?',
  'Will the flexible working pilot be extended to operations staff?',
  'How do we keep this going after the summit, when everyone is back to the day job?',
  'What did the last cohort find hardest about putting this into practice?',
  'Who owns this at board level?',
  'Is there budget behind this, or is it a goodwill initiative?',
  'How do we make sure site staff hear the same message we heard today?',
  'Can the slides be shared on the resources page afterwards?',
];

/**
 * A handful of questions per Q&A enabled session, in a believable mix of
 * states: most approved, a few waiting, one or two already answered or hidden.
 */
export function mockQuestions(sessions: ResolvedSession[], seed = 2026): MockQuestion[] {
  const random = seededRandom(seed);
  const questions: MockQuestion[] = [];

  for (const session of sessions) {
    if (!session.qaEnabled) continue;
    const count = intBetween(random, 4, 7);

    for (let i = 0; i < count; i += 1) {
      const roll = random();
      const status: MockQuestionStatus =
        roll < 0.25 ? 'pending' : roll < 0.75 ? 'approved' : roll < 0.9 ? 'answered' : 'hidden';

      questions.push({
        id: `${session.id}-q${i + 1}`,
        sessionId: session.id,
        text: pickFrom(random, QUESTION_TEXTS),
        name: random() < 0.55 ? 'Anonymous' : pickFrom(random, MOCK_NAMES),
        votes: status === 'pending' ? 0 : intBetween(random, 0, 24),
        status,
        pinned: false,
        minutesAgo: intBetween(random, 1, 40),
      });
    }
  }

  // One pinned question per session at most, the best voted approved one.
  const bestBySession = new Map<string, MockQuestion>();
  for (const q of questions) {
    if (q.status !== 'approved') continue;
    const best = bestBySession.get(q.sessionId);
    if (!best || q.votes > best.votes) bestBySession.set(q.sessionId, q);
  }
  for (const q of bestBySession.values()) q.pinned = true;

  return questions;
}

/* ------------------------------------------------------------ polls backup */

export type MockPollKind = 'single' | 'multiple' | 'wordcloud';
export type MockPollStatus = 'draft' | 'open' | 'closed';

export type MockPoll = {
  id: string;
  question: string;
  kind: MockPollKind;
  status: MockPollStatus;
  /** What it is used for, from the brief. */
  usedFor: string;
  options: { label: string; votes: number }[];
  voters: number;
};

/** Splits a number of voters across options, unevenly, like a real room. */
function spreadVotes(random: () => number, labels: string[], voters: number) {
  const weights = labels.map(() => 0.3 + random());
  const total = weights.reduce((sum, w) => sum + w, 0);
  const votes = weights.map((w) => Math.floor((w / total) * voters));
  // Put the rounding leftovers on the first option so totals match exactly.
  votes[0] = (votes[0] ?? 0) + (voters - votes.reduce((sum, v) => sum + v, 0));
  return labels.map((label, i) => ({ label, votes: votes[i] ?? 0 }));
}

export function mockPolls(voters: number, seed = 1214): MockPoll[] {
  const random = seededRandom(seed);
  const safe = Math.max(0, voters);

  return [
    {
      id: 'ice-breaker',
      question: 'How many years have you been with the company?',
      kind: 'single',
      status: 'closed',
      usedFor: 'Ice breaker, Day 1',
      options: spreadVotes(
        random,
        ['Less than 5', '5 to 10', '11 to 20', 'More than 20'],
        Math.round(safe * 0.94),
      ),
      voters: Math.round(safe * 0.94),
    },
    {
      id: 'breakout-topic',
      question: 'Which sub topics should your breakout spend most time on? Pick up to two.',
      kind: 'multiple',
      status: 'open',
      usedFor: 'Breakout sub topic voting, Day 2',
      options: spreadVotes(
        random,
        ['Hiring and promotion', 'Flexible working', 'Mentoring', 'Site safety culture'],
        Math.round(safe * 1.7),
      ),
      voters: Math.round(safe * 0.85),
    },
    {
      id: 'one-word',
      question: 'One word for how you feel about 2027',
      kind: 'wordcloud',
      status: 'closed',
      usedFor: 'Closing, Day 3',
      options: spreadVotes(
        random,
        ['Ready', 'Hopeful', 'Energised', 'Curious', 'Busy', 'Together', 'Bold', 'Focused'],
        Math.round(safe * 0.8),
      ),
      voters: Math.round(safe * 0.8),
    },
    {
      id: 'song-vote',
      question: 'Pick the song for the night activity',
      kind: 'single',
      status: 'draft',
      usedFor: 'Night activity, Day 1',
      options: [
        { label: 'Song A', votes: 0 },
        { label: 'Song B', votes: 0 },
        { label: 'Song C', votes: 0 },
      ],
      voters: 0,
    },
  ];
}

/* -------------------------------------------------------------- photo wall */

export type MockPhotoStatus = 'pending' | 'approved' | 'rejected';

export type MockPhoto = {
  id: string;
  caption: string;
  /** A device label, never a person. Matches how the real wall will work. */
  device: string;
  status: MockPhotoStatus;
  /** Colour for the placeholder tile, so no image files are needed. */
  hue: number;
  sizeKb: number;
  minutesAgo: number;
};

const PHOTO_CAPTIONS = [
  'Our table at the opening',
  'Breakout group B',
  'The view from the back row',
  'Ice breaker chaos',
  'Gala dinner, table 4',
  'Coffee queue',
  'Post-it wall after the breakout',
  'Team selfie',
  'The stage before doors open',
  'Night activity',
  '',
  '',
];

export function mockPhotos(seed = 1612): MockPhoto[] {
  const random = seededRandom(seed);
  return Array.from({ length: 18 }, (_, i) => {
    const roll = random();
    return {
      id: `photo-${i + 1}`,
      caption: pickFrom(random, PHOTO_CAPTIONS),
      device: `device-${String(intBetween(random, 1, 40)).padStart(2, '0')}`,
      status: roll < 0.4 ? 'pending' : roll < 0.9 ? 'approved' : 'rejected',
      hue: Math.floor(random() * 360),
      sizeKb: intBetween(random, 180, 420),
      minutesAgo: intBetween(random, 1, 300),
    } satisfies MockPhoto;
  });
}

/* ------------------------------------------------------ committee summary */

export type CommitteeId = 'SVC' | 'ATC' | 'OTC';

export type MockCommitteeItem = {
  ref: string;
  title: string;
  division: string;
  decision: 'Approved' | 'Noted' | 'Deferred' | 'Approved with conditions';
  meeting: string;
};

export const COMMITTEES: { id: CommitteeId; name: string }[] = [
  { id: 'SVC', name: 'SVC' },
  { id: 'ATC', name: 'ATC' },
  { id: 'OTC', name: 'OTC' },
];

const PAPER_TITLES = [
  'Graduate intake plan for 2027',
  'Flexible working pilot, phase two',
  'Mentoring programme for first line managers',
  'Women in engineering scholarship',
  'Site accessibility upgrades',
  'Return to work programme after long leave',
  'Leadership pipeline review',
  'Pay equity review, terms of reference',
  'Employee resource groups, funding model',
  'Inclusive hiring panel guidelines',
];

const DIVISIONS = [
  'Group Human Resources',
  'Distribution Network',
  'Generation',
  'Grid Division',
  'Retail',
  'Group Finance',
];

const DECISIONS: MockCommitteeItem['decision'][] = [
  'Approved',
  'Approved',
  'Noted',
  'Approved with conditions',
  'Deferred',
];

/**
 * What the committee Excel will look like once read in. The real upload
 * starts with SVC, per the brief, so SVC has the most rows.
 */
export function mockCommitteeItems(seed = 333): Record<CommitteeId, MockCommitteeItem[]> {
  const random = seededRandom(seed);
  const build = (id: CommitteeId, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      ref: `${id}/2026/${String(i + 1).padStart(2, '0')}`,
      title: pickFrom(random, PAPER_TITLES),
      division: pickFrom(random, DIVISIONS),
      decision: pickFrom(random, DECISIONS),
      meeting: `2026-${String(intBetween(random, 1, 11)).padStart(2, '0')}-${String(intBetween(random, 1, 28)).padStart(2, '0')}`,
    })).sort((a, b) => (a.meeting < b.meeting ? 1 : -1));

  return { SVC: build('SVC', 8), ATC: build('ATC', 5), OTC: build('OTC', 4) };
}

/* ----------------------------------------------------------------- admins */

export type MockOperator = {
  label: string;
  device: string;
  lastSeenMinutes: number;
  page: string;
  isYou: boolean;
};

export type MockActivity = {
  minutesAgo: number;
  operator: string;
  action: string;
};

/**
 * The brief asks for 2 to 3 admins at once. The console already allows it
 * (each desk signs in with the PIN and its own label). What it cannot show
 * yet is who else is signed in, because sign in is a stateless cookie. This
 * is how that panel will look.
 */
export function mockOperators(currentOperator: string): MockOperator[] {
  const others: MockOperator[] = [
    {
      label: 'desk-1',
      device: 'Laptop',
      lastSeenMinutes: 0,
      page: 'Registration desk',
      isYou: false,
    },
    { label: 'desk-2', device: 'Phone', lastSeenMinutes: 1, page: 'Headcount', isYou: false },
    { label: 'mc', device: 'Phone', lastSeenMinutes: 3, page: 'Live control', isYou: false },
  ].filter((op) => op.label !== currentOperator);

  return [
    {
      label: currentOperator,
      device: 'This device',
      lastSeenMinutes: 0,
      page: 'Admins',
      isYou: true,
    },
    ...others,
  ].slice(0, 3);
}

export function mockActivity(currentOperator: string): MockActivity[] {
  return [
    { minutesAgo: 1, operator: 'desk-1', action: 'Checked in 3 people by QR' },
    { minutesAgo: 2, operator: 'desk-2', action: 'Undid a check in (wrong tag scanned)' },
    { minutesAgo: 4, operator: 'mc', action: 'Started the countdown, 15 minutes' },
    { minutesAgo: 6, operator: currentOperator, action: 'Approved 4 photos' },
    { minutesAgo: 9, operator: 'desk-1', action: 'Checked in 1 person by name search' },
    { minutesAgo: 15, operator: 'mc', action: 'Opened the feedback form for the keynote' },
    {
      minutesAgo: 22,
      operator: 'desk-2',
      action: 'Changed the final feedback form to optional name',
    },
  ];
}

/* ------------------------------------------------------- reports and Slido */

export type MockSlidoRow = {
  sheet: 'Polls' | 'Questions';
  session: string;
  item: string;
  result: string;
};

/** What an imported Slido Excel export will add to the report. */
export function mockSlidoImport(sessionTitles: string[], seed = 77): MockSlidoRow[] {
  const random = seededRandom(seed);
  const titles = sessionTitles.length > 0 ? sessionTitles : ['Keynote'];
  const rows: MockSlidoRow[] = [];

  for (const title of titles.slice(0, 4)) {
    rows.push({
      sheet: 'Polls',
      session: title,
      item: 'How confident are you about the 2027 targets?',
      result: `${intBetween(random, 50, 75)} votes, top answer "Fairly confident"`,
    });
    rows.push({
      sheet: 'Questions',
      session: title,
      item: pickFrom(random, QUESTION_TEXTS),
      result: `${intBetween(random, 2, 30)} likes, answered`,
    });
  }
  return rows;
}

export const REPORT_SHEETS = [
  { name: 'Attendance', source: 'Check ins, one row per person per day' },
  { name: 'Feedback', source: 'Every answer, with the form anonymity respected' },
  { name: 'Feedback summary', source: 'Average stars and response count per session' },
  { name: 'Slido polls', source: 'Imported from the Slido Excel export' },
  { name: 'Slido questions', source: 'Imported from the Slido Excel export' },
  { name: 'Lucky draw', source: 'Winners, in draw order' },
] as const;
