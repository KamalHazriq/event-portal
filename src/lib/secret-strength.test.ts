import { describe, expect, it } from 'vitest';

import { weakEventCode, weakPin } from './secret-strength';

describe('weak PINs', () => {
  it('flags short, common, repeated and simple run PINs', () => {
    for (const pin of [
      '1234',
      '246810',
      '123456',
      '000000',
      '111111',
      '654321',
      '345678',
      'admin',
      'Password',
    ]) {
      expect(weakPin(pin), pin).toBe(true);
    }
  });

  it('accepts a PIN that is not obvious', () => {
    for (const pin of ['739218', 'k7Rm2xQp', '58203741']) {
      expect(weakPin(pin), pin).toBe(false);
    }
  });
});

describe('weak event codes', () => {
  it('flags short codes and obvious words or years', () => {
    for (const code of ['summit', 'summit-2027', 'PowerSummit', 'event2026', 'welcome123']) {
      expect(weakEventCode(code), code).toBe(true);
    }
  });

  it('accepts a long random code', () => {
    for (const code of ['k7Rm2xQp9vLd', 'bX4-nQ8z-Wt3-Hy6']) {
      expect(weakEventCode(code), code).toBe(false);
    }
  });
});
