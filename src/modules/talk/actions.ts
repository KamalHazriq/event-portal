'use server';

import { revalidatePath } from 'next/cache';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';
import { SCREEN_KEYS } from '@/modules/big-screen/logic';

import { COMMENT_KEYS, resolveCommentLayout } from './logic';
import { findSession } from './server';

/**
 * Secretariat controls for comments and reactions. Each checks the session
 * itself: a Server Action is a public endpoint whatever renders the form.
 */
async function assertAdmin(): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
}

function done(): void {
  for (const path of ['/admin/comments', '/admin/big-screen']) revalidatePath(path);
}

export async function moderateComment(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = plainText(formData.get('id'), 64);
  const act = String(formData.get('act') ?? '');
  const data = getData();
  if (act === 'approve') await data.comments.setStatus(id, 'approved');
  else if (act === 'hide') await data.comments.setStatus(id, 'hidden');
  else if (act === 'delete') await data.comments.remove(id);
  const did: Record<string, string> = {
    approve: 'Approved a comment',
    hide: 'Hid a comment',
    delete: 'Deleted a comment',
  };
  if (did[act]) await recordActivity(did[act]);
  done();
}

/** Approves every waiting comment on one talk. */
export async function approveAllComments(formData: FormData): Promise<void> {
  await assertAdmin();
  const sessionId = plainText(formData.get('sessionId'), 64);
  const data = getData();
  // Every talk at once, unless one is named.
  const waiting = (
    sessionId ? await data.comments.listBySession(sessionId) : await data.comments.listAll()
  ).filter((c) => c.status === 'pending');
  for (const c of waiting) await data.comments.setStatus(c.id, 'approved');
  if (waiting.length > 0) await recordActivity(`Approved ${waiting.length} comments`);
  done();
}

export async function showCommentsOnScreen(formData: FormData): Promise<void> {
  await assertAdmin();
  const sessionId = plainText(formData.get('sessionId'), 64);
  if (!findSession(sessionId)) return;
  const data = getData();
  await data.settings.set(COMMENT_KEYS.screenSession, sessionId);
  await data.settings.set(SCREEN_KEYS.view, 'comments');
  await recordActivity('Put the comments on the big screen');
  done();
}

export async function setScreenReactions(formData: FormData): Promise<void> {
  await assertAdmin();
  const on = formData.get('mode') === 'on';
  await getData().settings.set(COMMENT_KEYS.screenReactions, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned on reactions on the big screen' : 'Turned off reactions on the big screen',
  );
  done();
}

/** Comments wait for approval, or go straight up (names are always shown). */
export async function setCommentApproval(formData: FormData): Promise<void> {
  await assertAdmin();
  const on = formData.get('mode') === 'on';
  await getData().settings.set(COMMENT_KEYS.approval, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned comment approval on' : 'Turned comment approval off: comments go straight up',
  );
  done();
}

/** How the projector shows comments: a list, or floating bubbles sized by likes. */
export async function setCommentLayout(formData: FormData): Promise<void> {
  await assertAdmin();
  const layout = resolveCommentLayout(String(formData.get('layout') ?? ''));
  await getData().settings.set(COMMENT_KEYS.screenLayout, layout);
  await recordActivity(`Set the comments screen to ${layout}`);
  done();
}
