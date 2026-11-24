/**
 * Applies the secretariat list to the attendees. Server only. Called when
 * the list is saved and after every upload of the master list.
 */
import { getData } from '@/data';
import { looksLikeSecretariat } from '@/lib/attendee-import';

import {
  parseStaffNos,
  PARTICIPANT_KEY,
  SECRETARIAT_KEY,
  secretariatChanges,
} from './secretariat-list';

export async function readSecretariatList(): Promise<string[]> {
  return parseStaffNos(await getData().settings.get(SECRETARIAT_KEY));
}

export async function applySecretariatList(): Promise<number> {
  const data = getData();
  const [people, staffNos, participants] = await Promise.all([
    data.attendees.list(),
    readSecretariatList(),
    data.settings.get(PARTICIPANT_KEY).then(parseStaffNos),
  ]);
  const { mark, unmark } = secretariatChanges(
    people.map((p) => ({
      id: p.id,
      staffNo: p.staffNo,
      isSecretariat: p.isSecretariat,
      byList: looksLikeSecretariat(p.department, p.remark, p.title),
    })),
    staffNos,
    participants,
  );
  if (mark.length) await data.attendees.setSecretariat(mark, true);
  if (unmark.length) await data.attendees.setSecretariat(unmark, false);
  return mark.length + unmark.length;
}
