import { describe, expect, it } from 'vitest';

import { isPlaceholderUrl, looksUnconfirmed } from './placeholder';

describe('placeholders in the config', () => {
  it('spots example and replace-me links', () => {
    expect(isPlaceholderUrl('https://example.com/power-summit/posters')).toBe(true);
    expect(isPlaceholderUrl('https://events.example.com/x')).toBe(true);
    expect(isPlaceholderUrl('https://app.sli.do/event/REPLACE-WITH-REAL-SLIDO-EVENT')).toBe(true);
    expect(isPlaceholderUrl('not a url')).toBe(true);
    expect(isPlaceholderUrl('')).toBe(true);
  });

  it('lets real links through', () => {
    expect(isPlaceholderUrl('https://app.sli.do/event/abc123')).toBe(false);
    expect(isPlaceholderUrl('https://tnb.sharepoint.com/sites/x')).toBe(false);
  });

  it('spots names and titles still to be confirmed', () => {
    expect(looksUnconfirmed('Two senior general managers, to confirm')).toBe(true);
    expect(looksUnconfirmed('Speaker TBC')).toBe(true);
    expect(looksUnconfirmed('Head of SPTx')).toBe(false);
  });
});
