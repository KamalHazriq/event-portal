/**
 * A pretend attendee for testing on a phone: pick "Test Participant" on My
 * points, then earn points, react, comment and send feedback as them. Added
 * and removed from the Test plan page; the Ready check warns while it is on
 * the list. Its staff number cannot clash with a real one.
 */
import type { AttendeeImportRow } from '@/data/types';

export const TEST_STAFF_NO = 'TEST0001';

export const TEST_PARTICIPANT: AttendeeImportRow = {
  no: null,
  staffNo: TEST_STAFF_NO,
  name: 'Test Participant',
  title: 'Test account',
  department: 'Strategy, Partnership & Transformation',
  remark: 'For testing only. Remove it on the Test plan page before the event.',
  isSecretariat: false,
};
