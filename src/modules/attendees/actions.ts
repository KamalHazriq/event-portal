'use server';

import { ASK_FIRST_KEY } from '@/modules/identity/logic';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordActivity } from '@/modules/admins/record';

import { applySecretariatList } from './secretariat';
import { parseStaffNos, SECRETARIAT_KEY, PARTICIPANT_KEY } from './secretariat-list';

/** Saves the secretariat's staff numbers and marks them at once. */
export async function saveSecretariatList(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const staffNos = parseStaffNos(String(formData.get('staffNos') ?? ''));
  await getData().settings.set(SECRETARIAT_KEY, staffNos.join('\n'));
  await applySecretariatList();
  await recordActivity(
    `Saved the secretariat list (${staffNos.length} staff numbers)`,
    auth.session.operator,
  );
  revalidatePath('/', 'layout');
  redirect('/admin/attendees?secretariat=saved#secretariat');
}

/** Corrects one person's details. A new upload of the master list overwrites them again. */
export async function saveAttendee(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const id = String(formData.get('id') ?? '').slice(0, 64);
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) redirect(`/admin/attendees/${id}?error=name`);
  const data = getData();
  const person = await data.attendees.get(id);
  if (!person) redirect('/admin/attendees');
  await data.attendees.update(id, {
    name,
    title: String(formData.get('title') ?? ''),
    department: String(formData.get('department') ?? ''),
    remark: String(formData.get('remark') ?? ''),
    email: String(formData.get('email') ?? ''),
  });
  // Secretariat, by staff number in the list, so an upload keeps it.
  // Unticked means "a participant", even if their role says Secretariat.
  const wantSecretariat = formData.get('secretariat') === 'on';
  const [list, participants] = await Promise.all([
    data.settings.get(SECRETARIAT_KEY).then(parseStaffNos),
    data.settings.get(PARTICIPANT_KEY).then(parseStaffNos),
  ]);
  const staffNo = person.staffNo.toUpperCase();
  const without = (xs: string[]) => xs.filter((s) => s !== staffNo);
  await data.settings.set(
    SECRETARIAT_KEY,
    (wantSecretariat ? [...new Set([...list, staffNo])] : without(list)).join('\n'),
  );
  await data.settings.set(
    PARTICIPANT_KEY,
    (wantSecretariat ? without(participants) : [...new Set([...participants, staffNo])]).join('\n'),
  );
  await applySecretariatList();
  await recordActivity(`Edited the details of ${name}`, auth.session.operator);
  revalidatePath('/', 'layout');
  redirect('/admin/attendees?edited=1#who');
}

/** Turns "ask every new phone who they are first" on or off. */
export async function setAskNameFirst(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');
  const on = formData.get('mode') === 'on';
  await getData().settings.set(ASK_FIRST_KEY, on ? 'on' : 'off');
  await recordActivity(
    on ? 'Turned on asking new phones their name' : 'Turned off asking new phones their name',
    auth.session.operator,
  );
  revalidatePath('/', 'layout');
}
