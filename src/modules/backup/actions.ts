'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { getEventConfig } from '@/lib/config';
import { plainText } from '@/lib/text';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';
import { validatePollInput } from '@/modules/polls/logic';
import { QA_KEYS } from '@/modules/qa/logic';

/**
 * Admin controls for the backup Q&A and polls. Each checks the session
 * itself: a Server Action is a public endpoint whatever renders the form.
 */
async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

function done(): void {
  for (const path of ['/admin/qa', '/admin/polls', '/admin/live', '/admin/big-screen']) {
    revalidatePath(path);
  }
}

/** Slido is down: switch attendees over to the portal's own Q&A and polls. */
export async function setBackupMode(formData: FormData): Promise<void> {
  await assertAdmin();
  await getData().settings.set(QA_KEYS.backupMode, formData.get('mode') === 'on' ? 'on' : 'off');
  done();
}

/* -------------------------------------------------------------------- Q&A */

export async function moderateQuestion(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = plainText(formData.get('id'), 64);
  const act = String(formData.get('act') ?? '');
  const data = getData();
  if (act === 'approve') await data.questions.setStatus(id, 'approved');
  else if (act === 'answered') await data.questions.setStatus(id, 'answered');
  else if (act === 'hide') await data.questions.setStatus(id, 'hidden');
  else if (act === 'pin') await data.questions.setPinned(id, true);
  else if (act === 'unpin') await data.questions.setPinned(id, false);
  else if (act === 'delete') await data.questions.remove(id);
  done();
}

export async function setPremoderation(formData: FormData): Promise<void> {
  await assertAdmin();
  const sessionId = plainText(formData.get('sessionId'), 64);
  if (!getEventConfig().days.some((d) => d.sessions.some((s) => s.id === sessionId))) return;
  await getData().settings.set(
    QA_KEYS.premoderation(sessionId),
    formData.get('mode') === 'off' ? 'off' : 'on',
  );
  done();
}

export async function showQuestionsOnScreen(formData: FormData): Promise<void> {
  await assertAdmin();
  const sessionId = plainText(formData.get('sessionId'), 64);
  const data = getData();
  await data.settings.set(QA_KEYS.screenSession, sessionId);
  await data.settings.set(SCREEN_KEYS.view, 'qa');
  done();
}

/* ------------------------------------------------------------------ polls */

export async function createPoll(formData: FormData): Promise<void> {
  await assertAdmin();
  const checked = validatePollInput({
    question: plainText(formData.get('question'), 400),
    kind: String(formData.get('kind') ?? ''),
    optionLines: String(formData.get('options') ?? '').slice(0, 4000),
  });
  // The form has "required" on its fields; this is the safety net.
  if (!checked.ok) return;
  await getData().polls.create(checked.value);
  done();
}

/** Adds any poll listed in config/event.json that is not there yet. */
export async function loadPollsFromConfig(): Promise<void> {
  await assertAdmin();
  const data = getData();
  const existing = new Set((await data.polls.list()).map((p) => p.id));
  for (const preset of getEventConfig().polls) {
    if (existing.has(`config-${preset.id}`)) continue;
    const checked = validatePollInput({
      question: preset.question,
      kind: preset.kind,
      optionLines: preset.options.join('\n'),
    });
    if (checked.ok) await data.polls.create({ id: `config-${preset.id}`, ...checked.value });
  }
  done();
}

export async function controlPoll(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = plainText(formData.get('id'), 64);
  const act = String(formData.get('act') ?? '');
  const data = getData();
  if (act === 'open') await data.polls.setStatus(id, 'open');
  else if (act === 'close') await data.polls.setStatus(id, 'closed');
  else if (act === 'reveal') await data.polls.setRevealed(id, true);
  else if (act === 'conceal') await data.polls.setRevealed(id, false);
  else if (act === 'delete' && formData.get('confirm') === 'yes') await data.polls.remove(id);
  else if (act === 'screen') await data.settings.set(SCREEN_KEYS.view, 'poll');
  done();
}
