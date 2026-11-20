import { describe, expect, it } from 'vitest';

import { ADMIN_PAGES } from '@/components/admin-pages';

import { allStepIds, TEST_PLAN } from './steps';

describe('the test plan', () => {
  it('has both kinds of user, and every step says what to do and what to see', () => {
    expect(TEST_PLAN.map((p) => p.id)).toEqual(['attendee', 'secretariat']);
    for (const part of TEST_PLAN) {
      expect(part.groups.length).toBeGreaterThan(3);
      for (const group of part.groups) {
        expect(group.steps.length).toBeGreaterThan(0);
        for (const step of group.steps) {
          expect(step.do.length, step.id).toBeGreaterThan(10);
          expect(step.expect.length, step.id).toBeGreaterThan(10);
        }
      }
    }
  });

  it('never repeats a step id', () => {
    const ids = allStepIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only links to pages that exist', () => {
    const adminPages = new Set([
      '/admin',
      '/admin/runbook',
      '/admin/test-plan',
      ...ADMIN_PAGES.map((p) => p.href),
    ]);
    const attendeePages = new Set(['/agenda', '/info', '/photos', '/me', '/screen', '/kiosk']);
    for (const part of TEST_PLAN) {
      for (const group of part.groups) {
        for (const step of group.steps) {
          if (!step.href) continue;
          const known = step.href.startsWith('/admin')
            ? adminPages.has(step.href)
            : attendeePages.has(step.href);
          expect(known, `${step.id} links to ${step.href}`).toBe(true);
        }
      }
    }
  });
});
