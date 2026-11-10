/**
 * A simple load test for the backup polls and Q&A (brief section 7, and the
 * "done when" lines for Modules 2 and 3):
 *
 *   - 80 phones answer a poll inside 30 seconds, and the totals are exact;
 *   - 20 phones ask questions and vote, and the vote counts are exact;
 *   - a second answer from the same phone is not counted.
 *
 * It talks to a running portal over HTTP like real phones do, each with its
 * own cookie, then checks the stored numbers through the data adapter.
 *
 * Run the portal first (npm run dev, or npm run build && npm run start), then:
 *   npm run load:test
 *   npm run load:test -- http://localhost:3000
 *
 * It makes its own poll and questions and removes them afterwards, and puts
 * backup mode back the way it found it. It never touches attendees.
 */
import { join } from 'node:path';

import { getData } from '../src/data/index';
import { getEventConfig } from '../src/lib/config';
import { tallyPoll } from '../src/modules/polls/logic';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(join(process.cwd(), file));
  } catch {
    // Optional.
  }
}

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const VOTERS = 80;
const ASKERS = 20;

/** One pretend phone: keeps the device cookie the portal gives it. */
class Phone {
  private cookie = '';

  async post(
    path: string,
    fields: Record<string, string | string[]>,
  ): Promise<{ ok: boolean; state: string }> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      for (const v of Array.isArray(value) ? value : [value]) body.append(key, v);
    }
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      body,
      headers: { accept: 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}) },
    });
    const set = response.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0] ?? '';
    return (await response
      .json()
      .catch(() => ({ ok: false, state: `http-${response.status}` }))) as {
      ok: boolean;
      state: string;
    };
  }
}

function check(label: string, pass: boolean, detail: string): boolean {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${detail}`);
  return pass;
}

async function main(): Promise<void> {
  const config = getEventConfig();
  const data = getData();
  const session = config.days.flatMap((d) => d.sessions).find((s) => s.qaEnabled);
  if (!session) throw new Error('No session has qaEnabled, so there is nothing to test Q&A on.');

  try {
    await fetch(`${BASE}/`);
  } catch {
    throw new Error(`The portal is not answering at ${BASE}. Start it first.`);
  }

  const backupBefore = await data.settings.get('backup.mode');
  const openBefore = (await data.polls.list()).find((p) => p.status === 'open');
  const premodBefore = await data.settings.get(`qa.premoderation.${session.id}`);

  const poll = await data.polls.create({
    question: 'Load test poll',
    kind: 'single',
    options: ['A', 'B', 'C', 'D'],
  });
  const questionIds: string[] = [];
  let allPassed = true;

  try {
    await data.settings.set('backup.mode', 'on');
    await data.settings.set(`qa.premoderation.${session.id}`, 'off');
    await data.polls.setStatus(poll.id, 'open');

    /* ---- polls: 80 phones, all at once ---- */
    const phones = Array.from({ length: VOTERS }, () => new Phone());
    const expected = [0, 0, 0, 0];
    const started = Date.now();
    const answers = await Promise.all(
      phones.map((phone, i) => {
        const choice = i % 4;
        expected[choice] = (expected[choice] ?? 0) + 1;
        return phone.post('/api/polls/vote', { pollId: poll.id, choice: String(choice) });
      }),
    );
    const seconds = (Date.now() - started) / 1000;
    // Every phone tries again. None of these may count.
    const repeats = await Promise.all(
      phones.map((phone) => phone.post('/api/polls/vote', { pollId: poll.id, choice: '0' })),
    );

    const results = tallyPoll(poll, await data.polls.votes(poll.id));
    const counted = results.rows.map((r) => r.votes);
    allPassed =
      check(
        'poll answers accepted',
        answers.every((a) => a.state === 'voted'),
        `${answers.filter((a) => a.state === 'voted').length} of ${VOTERS}`,
      ) && allPassed;
    allPassed =
      check(
        'poll totals',
        JSON.stringify(counted) === JSON.stringify(expected),
        `counted ${counted.join(', ')}, expected ${expected.join(', ')}`,
      ) && allPassed;
    allPassed =
      check(
        'one answer per phone',
        results.voters === VOTERS && repeats.every((r) => r.state === 'already'),
        `${results.voters} voters after ${VOTERS} repeat attempts`,
      ) && allPassed;
    allPassed =
      check('inside 30 seconds', seconds < 30, `${seconds.toFixed(1)} s for ${VOTERS} phones`) &&
      allPassed;

    /* ---- Q&A: 20 phones ask one question each, then all vote on the first three ---- */
    const askers = Array.from({ length: ASKERS }, () => new Phone());
    const asked = await Promise.all(
      askers.map((phone, i) =>
        phone.post('/api/qa/ask', { sessionId: session.id, text: `Load test question ${i + 1}` }),
      ),
    );
    const mine = (await data.questions.listBySession(session.id)).filter((q) =>
      q.text.startsWith('Load test question '),
    );
    questionIds.push(...mine.map((q) => q.id));
    allPassed =
      check(
        'questions accepted',
        asked.every((a) => a.ok) && mine.length === ASKERS,
        `${mine.length} of ${ASKERS} stored`,
      ) && allPassed;

    const targets = mine.slice(0, 3);
    await Promise.all(
      askers.flatMap((phone) =>
        targets.flatMap((q) => [
          phone.post('/api/qa/vote', { sessionId: session.id, questionId: q.id }),
          // And the same vote again, which must not count.
          phone.post('/api/qa/vote', { sessionId: session.id, questionId: q.id }),
        ]),
      ),
    );
    const after = await data.questions.listBySession(session.id);
    const votes = targets.map((t) => after.find((q) => q.id === t.id)?.votes ?? -1);
    allPassed =
      check(
        'question votes',
        votes.every((v) => v === ASKERS),
        `${votes.join(', ')} (expected ${ASKERS} each, from ${ASKERS} phones voting twice)`,
      ) && allPassed;

    // The sixth question from one phone is refused.
    const keen = new Phone();
    const states: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      states.push(
        (
          await keen.post('/api/qa/ask', {
            sessionId: session.id,
            text: `Load test question keen ${i}`,
          })
        ).state,
      );
    }
    questionIds.push(
      ...(await data.questions.listBySession(session.id))
        .filter((q) => q.text.startsWith('Load test question keen'))
        .map((q) => q.id),
    );
    allPassed =
      check(
        'five questions per phone',
        states[5] === 'too-many' && states.slice(0, 5).every((s) => s === 'asked'),
        states.join(', '),
      ) && allPassed;
  } finally {
    // Leave everything as it was found.
    await data.polls.remove(poll.id);
    for (const id of questionIds) await data.questions.remove(id);
    if (openBefore) await data.polls.setStatus(openBefore.id, 'open');
    if (backupBefore === null) await data.settings.remove('backup.mode');
    else await data.settings.set('backup.mode', backupBefore);
    if (premodBefore === null) await data.settings.remove(`qa.premoderation.${session.id}`);
    else await data.settings.set(`qa.premoderation.${session.id}`, premodBefore);
    await data.close();
  }

  console.log(allPassed ? '\nAll checks passed.' : '\nSome checks failed.');
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
