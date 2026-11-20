import { describe, expect, it } from 'vitest';

import { kioskBlocks, kioskLockRequested } from './kiosk';

describe('kioskBlocks', () => {
  it('keeps a locked device out of the admin pages, except signing in', () => {
    expect(kioskBlocks('/admin', true)).toBe(true);
    expect(kioskBlocks('/admin/attendees', true)).toBe(true);
    expect(kioskBlocks('/admin/sign-in', true)).toBe(false);
    expect(kioskBlocks('/kiosk', true)).toBe(false);
    expect(kioskBlocks('/api/check-in', true)).toBe(false);
    expect(kioskBlocks('/administrator', true)).toBe(false);
    expect(kioskBlocks('/admin', false)).toBe(false);
  });
});

describe('kioskLockRequested', () => {
  it('locks only when asked, so previewing the kiosk is safe', () => {
    expect(kioskLockRequested('/kiosk', new URLSearchParams('lock=1'))).toBe(true);
    expect(kioskLockRequested('/kiosk', new URLSearchParams(''))).toBe(false);
    expect(kioskLockRequested('/kiosk', new URLSearchParams('lock=0'))).toBe(false);
    expect(kioskLockRequested('/admin', new URLSearchParams('lock=1'))).toBe(false);
  });
});
