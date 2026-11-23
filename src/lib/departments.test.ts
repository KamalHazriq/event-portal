import { describe, expect, it } from 'vitest';

import {
  isDivision,
  canonicalDepartment,
  departmentWithShort,
  departmentsWithoutShortName,
  findShortName,
  shortDepartment,
} from './departments';

const config = {
  departments: [
    { name: 'Corporate & Engineering Services', short: 'CORES' },
    { name: 'Center of Delivery & Operation Services', short: 'CDOS' },
    { name: 'Digital, Data & AI', short: 'DDAI' },
  ],
};

describe('department short names', () => {
  it('finds the short name, loosely', () => {
    expect(shortDepartment(config, 'Corporate & Engineering Services')).toBe('CORES');
    expect(findShortName(config, '  corporate and engineering   services ')).toBe('CORES');
    expect(findShortName(config, 'Centre of Delivery & Operation Services')).toBe('CDOS');
    expect(findShortName(config, 'Digital Data & AI')).toBe('DDAI');
  });

  it('knows a department written as its short name', () => {
    expect(shortDepartment(config, 'Cores')).toBe('CORES');
    expect(departmentWithShort(config, 'Cores')).toBe('Corporate & Engineering Services (CORES)');
    expect(departmentsWithoutShortName(config, ['Cores'])).toEqual([]);
  });

  it('shows anything else as written', () => {
    expect(shortDepartment(config, 'New Unit')).toBe('New Unit');
    expect(shortDepartment(config, '')).toBe('');
  });

  it('writes both for name tags', () => {
    expect(departmentWithShort(config, 'Corporate & Engineering Services')).toBe(
      'Corporate & Engineering Services (CORES)',
    );
    expect(departmentWithShort(config, 'New Unit')).toBe('New Unit');
  });

  it('lists departments still missing a short name, once each', () => {
    expect(
      departmentsWithoutShortName(config, [
        'New Unit',
        'new unit',
        '',
        'Digital, Data & AI',
        'Another',
      ]),
    ).toEqual(['Another', 'New Unit']);
  });
});

describe('canonicalDepartment', () => {
  it('saves one spelling per department', () => {
    expect(canonicalDepartment(config, 'Cores')).toBe('Corporate & Engineering Services');
    expect(canonicalDepartment(config, 'corporate and engineering services')).toBe(
      'Corporate & Engineering Services',
    );
    expect(canonicalDepartment(config, ' New Unit ')).toBe('New Unit');
  });
});

describe('the division', () => {
  const config = {
    departments: [
      { name: 'Digital & Information Division', short: 'D&I', division: true },
      { name: 'Corporate & Engineering Services', short: 'CORES' },
    ],
  };
  it('is not a department', () => {
    expect(isDivision(config, 'Digital & Information Division')).toBe(true);
    expect(isDivision(config, 'D&I')).toBe(true);
    expect(isDivision(config, 'Corporate and Engineering Services')).toBe(false);
    // Called a division even without the mark.
    expect(isDivision({ departments: [] }, 'Some Other Division')).toBe(true);
  });
});
