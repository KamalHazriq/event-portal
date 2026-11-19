import { describe, expect, it } from 'vitest';

import { isPortalStyle, resolveStyle } from './look';

describe('the portal style', () => {
  it('uses the stored choice when it is a style we have', () => {
    expect(resolveStyle('ruled', 'classic')).toBe('ruled');
    expect(resolveStyle('classic', 'ruled')).toBe('classic');
  });

  it('falls back to the config default otherwise', () => {
    expect(resolveStyle(null, 'ruled')).toBe('ruled');
    expect(resolveStyle('neon', 'classic')).toBe('classic');
    expect(isPortalStyle('neon')).toBe(false);
  });
});
