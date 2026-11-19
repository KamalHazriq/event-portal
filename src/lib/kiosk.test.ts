import { describe, expect, it } from 'vitest';

import { kioskBlocks } from './kiosk';

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
