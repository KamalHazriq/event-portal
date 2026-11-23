import { describe, expect, it } from 'vitest';

import { parseStaffNos, secretariatChanges } from './secretariat-list';

describe('the secretariat list', () => {
  it('reads staff numbers however they were pasted', () => {
    expect(parseStaffNos('d10001\nD10002, D10003  d10001;x y')).toEqual([
      'D10001',
      'D10002',
      'D10003',
      'X',
      'Y',
    ]);
    expect(parseStaffNos('')).toEqual([]);
    expect(parseStaffNos('<script>')).toEqual([]);
  });

  it('marks the listed and keeps those the master list calls secretariat', () => {
    const people = [
      { id: 'a', staffNo: 'D1', isSecretariat: false, byList: false },
      { id: 'b', staffNo: 'D2', isSecretariat: true, byList: false },
      { id: 'c', staffNo: 'D3', isSecretariat: true, byList: true },
      { id: 'd', staffNo: 'D4', isSecretariat: false, byList: false },
    ];
    expect(secretariatChanges(people, ['d1'])).toEqual({ mark: ['a'], unmark: ['b'] });
  });
});
