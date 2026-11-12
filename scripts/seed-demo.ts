/**
 * Fills the portal with a convincing three days of dummy activity.
 *
 * This is for showing the admin console to someone, or for checking a layout
 * against realistic numbers, without waiting for an actual event. Everything
 * it writes is invented: arrivals, star ratings and comments.
 *
 * Run it with: npm run demo:seed
 *
 * It refuses to run if the database holds anyone who is not from
 * config/attendees.sample.csv, so it can never touch a real attendee list.
 * It clears the check ins and feedback it manages first, so running it twice
 * gives the same result rather than piling up.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getData } from '../src/data/index';
import { parseAttendeeCsv } from '../src/lib/attendee-import';
import { getEventConfig } from '../src/lib/config';
import {
  bestSessionChoices,
  EVENT_FORM_ID,
  feedbackForms,
  SETTING_KEYS,
} from '../src/modules/feedback/logic';
import { SURPRISE_KEYS } from '../src/modules/admin/logic';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

/** Seeded, so the demo looks the same every time it is rebuilt. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261214);

const pick = <T>(list: readonly T[]): T =>
  list[Math.min(Math.floor(random() * list.length), list.length - 1)] as T;

/** Ratings that look like a real event: mostly good, with honest grumbles. */
function plausibleRating(): number {
  const roll = random();
  if (roll < 0.42) return 5;
  if (roll < 0.76) return 4;
  if (roll < 0.92) return 3;
  if (roll < 0.98) return 2;
  return 1;
}

const GOOD_COMMENTS = [
  'Clear and well paced. The examples made the point land.',
  'Best session of the day for me. Practical, not theoretical.',
  'Good to hear this said out loud at last.',
  'Useful. I have three things to take back to my team.',
  'Strong content. I would happily sit through a longer version.',
  'The question and answer part was the most valuable bit.',
  'Honest and direct. More of this please.',
];

const MIXED_COMMENTS = [
  'Good content but we ran over and lost the discussion time.',
  'Interesting, though it was pitched a little high for a mixed room.',
  'Solid, but the slides were hard to read from the back.',
  'Worth doing. Could lose about fifteen minutes without losing anything.',
  'Fine, although it covered ground we did last year.',
];

const POOR_COMMENTS = [
  'Too much reading from slides. I lost the thread halfway.',
  'Hard to follow. I am not sure what I am meant to do differently.',
  'The room was too cold to concentrate.',
];

const IMPROVEMENTS = [
  'Longer breaks. Twenty minutes disappears very quickly with ninety people.',
  'Start the breakouts earlier in the day while everyone is still fresh.',
  'Share the slides before the session, not after.',
  'Fewer presentations, more working time in small groups.',
  'Better microphones. The back of the room missed a lot of questions.',
  'Give the breakout groups a clearer brief up front.',
];

function commentFor(rating: number): string {
  if (rating >= 4) return pick(GOOD_COMMENTS);
  if (rating === 3) return pick(MIXED_COMMENTS);
  return pick(POOR_COMMENTS);
}

/** An ISO instant for a local event time, without a date library. */
function instant(date: string, minuteOfDay: number, timezoneOffsetHours = 8): string {
  // A late session plus a random delay can run past midnight. Keep it on the
  // same day rather than producing an hour like 25.
  const safe = Math.max(0, Math.min(Math.round(minuteOfDay), 23 * 60 + 59));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  const utc = new Date(`${date}T${hh}:${mm}:00Z`);
  utc.setUTCHours(utc.getUTCHours() - timezoneOffsetHours);
  return utc.toISOString();
}

async function main(): Promise<void> {
  const config = getEventConfig();
  const data = getData();

  const health = await data.healthCheck();
  if (!health.ok) {
    console.error(health.detail);
    process.exit(1);
  }

  /* ------------------------------------------------- safety ------------ */

  const sample = parseAttendeeCsv(
    readFileSync(join(process.cwd(), 'config', 'attendees.sample.csv'), 'utf8'),
  );
  const sampleStaffNumbers = new Set(sample.rows.map((row) => row.staffNo));
  const everyone = await data.attendees.list();

  if (everyone.length === 0) {
    console.error('Nobody is loaded yet. Run "npm run db:seed" first.');
    process.exit(1);
  }

  const strangers = everyone.filter((person) => !sampleStaffNumbers.has(person.staffNo));
  if (strangers.length > 0) {
    console.error(
      `The database holds ${strangers.length} people who are not in the sample list.\n` +
        'This looks like a real attendee list. Refusing to write invented feedback against it.\n' +
        'Run "npm run db:reset" to go back to dummy data first.',
    );
    process.exit(1);
  }

  console.log(`Event: ${config.event.name}`);
  console.log(`People: ${everyone.length}`);
  console.log('');

  /* ------------------------------------------------- arrivals ---------- */

  // Each day fills up a bit more, and a few people never make it, which is
  // what the "not yet arrived" list is there to show.
  const dayPlan: { dayId: string; date: string; from: number; share: number }[] = [
    { dayId: 'day-1', date: config.days[0]!.date, from: 13 * 60, share: 0.82 },
    { dayId: 'day-2', date: config.days[1]!.date, from: 8 * 60, share: 0.96 },
    { dayId: 'day-3', date: config.days[2]!.date, from: 8 * 60, share: 0.9 },
  ];

  for (const day of dayPlan) {
    await Promise.all(everyone.map((person) => data.checkIns.remove(person.id, day.dayId)));

    const arriving = everyone.filter(() => random() < day.share);
    let created = 0;

    for (const person of arriving) {
      // Most people arrive in the first twenty minutes, then a long tail.
      const spread = random() < 0.7 ? random() * 20 : 20 + random() * 55;
      const method = random() < 0.88 ? 'qr' : 'manual';

      await data.checkIns.create({
        attendeeId: person.id,
        dayId: day.dayId,
        method,
        byOperator: random() < 0.5 ? 'desk-1' : 'desk-2',
        at: instant(day.date, Math.round(day.from + spread)),
      });
      created += 1;
    }

    console.log(`${day.dayId}: ${created} of ${everyone.length} arrived`);
  }

  /* ----------------------------------------------- lucky draw ---------- */

  // Two draws on the Day 1 evening, from guests who checked in that day.
  // Cleared first, so running the demo twice does not pile up winners.
  await data.luckyDraw.clear();
  const day1 = config.days[0]!;
  const hat = (await data.checkIns.listByDay(day1.id))
    .map((c) => c.attendee)
    .filter((a) => !a.isSecretariat);
  const take = (n: number) => {
    const out: string[] = [];
    while (out.length < n && hat.length > 0) {
      out.push(hat.splice(Math.floor(random() * hat.length), 1)[0]!.id);
    }
    return out;
  };
  for (const [prize, count, minute] of [
    ['Dinner door prize', 3, 21 * 60 + 15],
    ['Night activity prize', 1, 22 * 60 + 20],
  ] as const) {
    await data.luckyDraw.record({
      drawId: `demo-${prize}`,
      prize,
      byOperator: 'mc',
      attendeeIds: take(count),
      at: instant(day1.date, minute),
    });
  }
  console.log('lucky draw winners:   4 across 2 draws');

  /* ------------------------------------------------- feedback ---------- */

  const forms = feedbackForms(config);
  const sessionIds = bestSessionChoices(config).map((s) => s.id);

  let answers = 0;

  for (const form of forms) {
    const existing = await data.feedback.listByForm(form.id);
    if (existing.length > 0) {
      // Nothing in the adapter deletes feedback, so clear it the same way the
      // rest of the module does: through a reset. Skip instead of duplicating.
      console.log(`${form.id}: already has ${existing.length} answers, leaving them alone`);
      continue;
    }

    // A session form gets answers from maybe a third of the room.
    const responders = form.kind === 'event' ? 0.55 : 0.3 + random() * 0.2;
    const day = config.days.find((d) => d.sessions.some((s) => s.id === form.id));
    const session = day?.sessions.find((s) => s.id === form.id);
    const date = day?.date ?? config.days[2]!.date;
    const baseMinute = session ? Number(session.end.slice(0, 2)) * 60 + 10 : 11 * 60 + 50;

    for (const person of everyone) {
      if (random() > responders) continue;

      const rating = plausibleRating();
      const named = random() < 0.35;
      const leavesComment = form.kind === 'event' || random() < 0.45;

      const extra: Record<string, string> = {};
      if (leavesComment) extra.comment = commentFor(rating);
      if (form.kind === 'event') {
        extra.improve = pick(IMPROVEMENTS);
        if (random() < 0.8) extra.bestSessionId = pick(sessionIds);
      }

      await data.feedback.submit({
        formId: form.id,
        kind: form.kind,
        rating,
        answers: extra,
        attendeeId: null,
        displayName: named ? person.name : '',
        // A made up device, so the one answer per device rule still holds.
        deviceId: `demo-${form.id}-${person.id}`,
        at: instant(date, Math.round(baseMinute + random() * 180)),
      });
      answers += 1;
    }
  }

  console.log('');
  console.log(`feedback answers written: ${answers}`);

  /* ------------------------------------------------- settings ---------- */

  // A mix, so the admin page shows each anonymity setting in use.
  await data.settings.set(SETTING_KEYS.anonymityDefault, 'optional');
  const firstSession = forms.find((form) => form.kind === 'session');
  if (firstSession)
    await data.settings.set(SETTING_KEYS.anonymityFor(firstSession.id), 'anonymous');
  await data.settings.set(SETTING_KEYS.anonymityFor(EVENT_FORM_ID), 'optional');

  // A countdown that is clearly set by hand, not just the config default.
  await data.settings.set(SURPRISE_KEYS.enabled, 'true');
  await data.settings.set(SURPRISE_KEYS.targetAt, `${config.days[1]!.date}T20:30`);
  await data.settings.set(SURPRISE_KEYS.label, 'Something special starts in');

  /* ------------------------------------------- a Slido import ---------- */

  // Shaped like what the reports page keeps from a Slido Excel export, so the
  // report and the PDF summary show their Slido sections. Invented throughout.
  const pollRows: string[][] = [];
  for (const [poll, options] of [
    ['How ready is your team for 2027?', ['Very ready', 'Fairly ready', 'Not yet']],
    ['Which breakout topic matters most?', ['Delivery', 'Digital and data', 'People']],
    ['One word for the summit', ['Energising', 'Honest', 'Useful', 'Long']],
  ] as const) {
    options.forEach((option, i) => {
      pollRows.push([i === 0 ? poll : '', option, String(10 + Math.floor(random() * 30))]);
    });
  }
  const questionRows: string[][] = [
    'How will we measure progress a year from now?',
    'Who owns this at board level?',
    'Will the flexible working pilot reach operations staff?',
    'How do site teams hear the same message we heard today?',
    'Can the slides go on the resources page?',
  ].map((q) => [q, 'Anonymous', String(Math.floor(random() * 25))]);

  await data.imports.replace(
    'slido',
    [
      { kind: 'polls', name: 'Poll results', headers: ['Poll', 'Option', 'Votes'], rows: pollRows },
      {
        kind: 'questions',
        name: 'Questions',
        headers: ['Question', 'Author', 'Likes'],
        rows: questionRows,
      },
    ],
    { fileName: 'slido-demo-export.xlsx', byOperator: 'desk-1' },
  );
  console.log(`slido sheets imported: 2 (invented)`);

  /* ---------------------------------------- backup Q&A and polls ------- */

  // Backup mode itself is left off, as it would be on a normal day. These
  // make the Q&A and polls admin pages worth looking at.
  const QUESTIONS = [
    'How will we measure whether this is working a year from now?',
    'What support is there for managers who want to start this in their own team?',
    'Who owns this at board level?',
    'How do site teams hear the same message we heard today?',
    'Will the flexible working pilot be extended to operations staff?',
    'What is the one thing you would ask us to stop doing?',
    'Can the slides be shared on the resources page afterwards?',
  ];
  const ASKERS = ['', '', '', 'Aina K.', 'Darren Y.', 'Priya M.'];
  for (const day of config.days) {
    for (const session of day.sessions) {
      if (!session.qaEnabled) continue;
      for (const old of await data.questions.listBySession(session.id)) {
        if (old.deviceId.startsWith('demo-')) await data.questions.remove(old.id);
      }
      const count = 4 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const roll = random();
        const status =
          roll < 0.3 ? 'pending' : roll < 0.8 ? 'approved' : roll < 0.92 ? 'answered' : 'hidden';
        const question = await data.questions.add({
          sessionId: session.id,
          text: QUESTIONS[(i + session.id.length) % QUESTIONS.length]!,
          name: pick(ASKERS),
          deviceId: `demo-q-${session.id}-${i}`,
          status,
        });
        if (status !== 'pending') {
          const votes = Math.floor(random() * 18);
          for (let v = 0; v < votes; v += 1)
            await data.questions.vote(question.id, `demo-voter-${v}`);
        }
      }
    }
  }

  for (const old of await data.polls.list()) {
    if (old.id.startsWith('config-')) await data.polls.remove(old.id);
  }
  const guestsForPolls = everyone.filter((p) => !p.isSecretariat);
  for (const preset of config.polls) {
    const poll = await data.polls.create({
      id: `config-${preset.id}`,
      question: preset.question,
      kind: preset.kind,
      options: preset.options,
    });
    // The night activity poll stays a draft; the breakout one is left open.
    if (preset.id === 'night-song') continue;
    const words = [
      'ready',
      'hopeful',
      'energised',
      'curious',
      'busy',
      'together',
      'bold',
      'ready',
      'hopeful',
      'ready',
    ];
    await data.polls.setStatus(poll.id, 'open');
    for (const person of guestsForPolls) {
      if (random() > 0.85) continue;
      const choices =
        preset.kind === 'wordcloud'
          ? [pick(words)]
          : preset.kind === 'multiple'
            ? [
                ...new Set([
                  pick(preset.options.map((_, i) => String(i))),
                  pick(preset.options.map((_, i) => String(i))),
                ]),
              ]
            : [
                String(
                  Math.min(
                    preset.options.length - 1,
                    Math.floor(random() * random() * preset.options.length * 1.6),
                  ),
                ),
              ];
      await data.polls.vote(poll.id, `demo-${person.id}`, choices);
    }
    if (preset.id !== 'breakout-topics') {
      await data.polls.setStatus(poll.id, 'closed');
      await data.polls.setRevealed(poll.id, true);
    }
  }
  // Opening each in turn closed the one before; leave the breakout poll open.
  await data.polls.setStatus('config-breakout-topics', 'open');
  console.log(`polls:                ${config.polls.length} (invented answers)`);

  /* ------------------------------------------------ leaderboard ------- */

  // Most of the invented people sign in on the phone they answered polls
  // with, so the leaderboard has points from arrivals and polls to show.
  // Their feedback was sent from a made up phone per form, so those count
  // too, which spreads the scores out the way real taking part would.
  const feedbackDevices = new Map<string, string[]>();
  for (const entry of await data.feedback.listAll()) {
    const owner = everyone.find((p) => entry.deviceId.endsWith(`-${p.id}`));
    if (!owner) continue;
    feedbackDevices.set(owner.id, [...(feedbackDevices.get(owner.id) ?? []), entry.deviceId]);
  }
  let joined = 0;
  for (const person of everyone) {
    if (person.isSecretariat || random() > 0.7) continue;
    await data.players.link(`demo-${person.id}`, person.id);
    for (const deviceId of feedbackDevices.get(person.id) ?? []) {
      await data.players.link(deviceId, person.id);
    }
    joined += 1;
  }
  console.log(`leaderboard:          ${joined} phones signed in`);

  /* ------------------------------------------------ talks: comments ---- */

  // Invented comments and reactions on the talks that have Q&A, so the
  // session pages, the comments page and the projector have something to
  // show. Earlier demo ones go first, so reruns do not pile up.
  const COMMENTS = [
    'The three horizons framing finally made the roadmap click for me.',
    'Would love the slides for the data platform part.',
    'Practical and honest. More of this format please.',
    'Great point about fixing the basics before chasing new tools.',
    'Our team will try the weekly demo idea from this session.',
  ];
  let commentCount = 0;
  let reactionCount = 0;
  const talks = config.days.flatMap((d) => d.sessions).filter((s) => s.qaEnabled);
  for (const talk of talks) {
    for (const old of await data.comments.listBySession(talk.id)) {
      if (old.deviceId.startsWith('demo-')) await data.comments.remove(old.id);
    }
    const said = COMMENTS.filter(() => random() < 0.7);
    for (const [i, text] of said.entries()) {
      const author = pick(everyone);
      const comment = await data.comments.add({
        sessionId: talk.id,
        text,
        name: random() < 0.5 ? author.name : '',
        deviceId: `demo-c-${talk.id}-${i}`,
      });
      await data.comments.setStatus(comment.id, random() < 0.85 ? 'approved' : 'pending');
      const likes = Math.floor(random() * 12);
      for (let n = 0; n < likes; n += 1) {
        await data.comments.like(comment.id, `demo-like-${talk.id}-${i}-${n}`);
      }
      commentCount += 1;
    }
    for (const person of everyone) {
      if (person.isSecretariat || random() > 0.35) continue;
      const kinds = ['clap', 'fire', 'idea', 'love'] as const;
      const taps = 1 + Math.floor(random() * 4);
      for (let t = 0; t < taps; t += 1) {
        await data.reactions.add({
          sessionId: talk.id,
          deviceId: `demo-${person.id}`,
          kind: kinds[Math.floor(random() * kinds.length)] ?? 'clap',
        });
        reactionCount += 1;
      }
    }
  }
  console.log(`talks:                ${commentCount} comments, ${reactionCount} reactions`);

  /* ------------------------------------------------ photo wall --------- */

  // Invented images from scripts/demo-photos: gradients with a label, no
  // people. Earlier demo photos are removed first, so reruns do not pile up.
  for (const old of await data.photos.list()) {
    if (old.deviceId.startsWith('demo-')) await data.photos.remove(old.id);
  }
  const photoSpecs: [number, string, 'approved' | 'pending' | 'rejected'][] = [
    [1, 'Ballroom before doors open', 'approved'],
    [2, 'Breakout group B', 'approved'],
    [3, 'Gala dinner, table 4', 'approved'],
    [4, 'Team photo', 'approved'],
    [5, 'Night activity', 'pending'],
    [6, '', 'pending'],
  ];
  for (const [n, caption, status] of photoSpecs) {
    const dir = join(process.cwd(), 'scripts', 'demo-photos');
    const photo = await data.photos.add({
      deviceId: `demo-device-${n}`,
      caption,
      width: 1200,
      height: 800,
      image: readFileSync(join(dir, `demo-${n}.jpg`)),
      thumbnail: readFileSync(join(dir, `demo-${n}-thumb.jpg`)),
      at: instant(config.days[0]!.date, 19 * 60 + n * 20),
    });
    if (status !== 'pending') await data.photos.setStatus([photo.id], status, 'desk-1');
  }
  console.log('photos:               6 (invented, 4 approved)');

  /* ------------------------------------------ committee papers --------- */

  // Invented papers, so the committee summary has something to count.
  const PAPERS = [
    'Graduate intake plan for 2027',
    'Flexible working pilot, phase two',
    'Mentoring programme for first line managers',
    'Women in engineering scholarship',
    'Site accessibility upgrades',
    'Return to work programme after long leave',
    'Leadership pipeline review',
    'Pay equity review, terms of reference',
  ];
  const DIVISIONS = ['TNS', 'CS', 'DAX', 'CSM', 'GRC'];
  const DECISIONS = ['Approved', 'Approved', 'Approved', 'Noted', 'Deferred'];
  for (const [id, count] of [
    ['svc', 8],
    ['atc', 5],
  ] as const) {
    if (!config.committees.some((c) => c.id === id)) continue;
    const rows = Array.from({ length: count }, (_, i) => [
      `${id.toUpperCase()}/2026/${String(i + 1).padStart(2, '0')}`,
      PAPERS[i % PAPERS.length]!,
      pick(DIVISIONS),
      pick(DECISIONS),
    ]);
    await data.imports.replace(
      `committee:${id}`,
      [{ kind: 'table', name: 'Papers', headers: ['Ref', 'Paper', 'Division', 'Decision'], rows }],
      { fileName: `${id}-papers-demo.xlsx`, byOperator: 'desk-1' },
    );
  }
  console.log('committee files:      2 (invented)');

  const summaries = await data.feedback.summaries();
  const rated = summaries.filter((s) => s.averageRating !== null);
  const overall =
    rated.length > 0
      ? rated.reduce((total, s) => total + (s.averageRating ?? 0), 0) / rated.length
      : 0;

  console.log(`forms with answers:   ${summaries.length}`);
  console.log(`average across forms: ${overall.toFixed(2)} out of 5`);
  console.log('');
  console.log('Done. Every bit of this is invented.');
  console.log('Look at http://localhost:3000/admin after "npm run dev".');

  await data.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
