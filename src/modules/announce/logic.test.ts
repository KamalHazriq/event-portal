import { describe, expect, it } from 'vitest';

import {
  alertSupport,
  cleanAnnouncementText,
  isLive,
  parseAnnouncement,
  parseHistory,
  safeHref,
} from './logic';

const base = {
  serviceWorker: true,
  pushManager: true,
  notification: true,
  ios: false,
  standalone: false,
  permission: 'default' as const,
};

describe('announcements', () => {
  it('reads a stored announcement, and only links inside the portal', () => {
    const raw = JSON.stringify({
      id: 'a',
      text: 'Bus at 7:30',
      href: 'https://evil.example',
      at: '2026-12-14T00:00:00Z',
      pushed: 3,
    });
    expect(parseAnnouncement(raw)).toMatchObject({ text: 'Bus at 7:30', href: '' });
    expect(parseAnnouncement('nope')).toBeNull();
    expect(parseAnnouncement('{"id":1}')).toBeNull();
    expect(safeHref('/agenda')).toBe('/agenda');
    expect(safeHref('//evil.example')).toBe('');
    expect(safeHref('javascript:alert(1)')).toBe('');
  });

  it('stops showing after twelve hours', () => {
    const a = { id: 'a', text: 'x', href: '', at: '2026-12-14T00:00:00Z', pushed: null };
    expect(isLive(a, new Date('2026-12-14T11:59:00Z'))).toBe(true);
    expect(isLive(a, new Date('2026-12-14T12:01:00Z'))).toBe(false);
    expect(isLive(null, new Date())).toBe(false);
  });

  it('keeps one tidy line', () => {
    expect(cleanAnnouncementText('  Bus\n\nleaves   7:30 ')).toBe('Bus leaves 7:30');
    expect(cleanAnnouncementText('x'.repeat(300))).toHaveLength(200);
  });

  it('keeps the history readable', () => {
    expect(parseHistory('[{"id":"a","text":"t","href":"","at":"x"},{"bad":1}]')).toHaveLength(1);
    expect(parseHistory(null)).toEqual([]);
  });
});

describe('alertSupport', () => {
  it('is ready on a phone that supports it', () => {
    expect(alertSupport(base)).toBe('ready');
  });
  it('asks iPhone users to add to the home screen first', () => {
    expect(alertSupport({ ...base, ios: true })).toBe('install-first');
    expect(alertSupport({ ...base, ios: true, standalone: true })).toBe('ready');
  });
  it('says when the browser blocked it, or cannot do it', () => {
    expect(alertSupport({ ...base, permission: 'denied' })).toBe('blocked');
    expect(alertSupport({ ...base, pushManager: false })).toBe('unsupported');
  });
});
