'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getData } from '@/data';
import { requireAdminApi } from '@/lib/admin-guard';
import { plainText } from '@/lib/text';
import { recordActivity } from '@/modules/admins/record';

/**
 * Someone turns up who is not on the participant list. The desk adds them to
 * the list (so they have a real record: points, door gift, feedback, the
 * report), then checks them in as anyone else. There is no nameless guest.
 */
export async function addPersonToList(formData: FormData): Promise<void> {
  const auth = await requireAdminApi();
  if (!auth.ok) throw new Error('Not signed in.');

  const name = plainText(String(formData.get('name') ?? ''), 120);
  if (name.length < 3) redirect('/admin/desk?added=short');
  const title = plainText(String(formData.get('title') ?? ''), 120);

  const data = getData();
  // A staff number that cannot clash with a real one: ADD plus four digits.
  let staffNo = '';
  for (let i = 0; i < 20; i++) {
    const candidate = `ADD${String(Math.floor(1000 + Math.random() * 9000))}`;
    if (!(await data.attendees.findByStaffNo(candidate))) {
      staffNo = candidate;
      break;
    }
  }
  if (!staffNo) redirect('/admin/desk?added=error');

  await data.attendees.importRows([
    {
      no: null,
      staffNo,
      name,
      title,
      department: '',
      remark: 'Added at the desk',
      isSecretariat: false,
    },
  ]);
  await recordActivity(`Added ${name} to the list at the desk`, auth.session.operator);
  revalidatePath('/admin/desk');
  redirect(`/admin/desk?added=${encodeURIComponent(name)}`);
}
