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

  it('only links to pages that exist, and every step has one', () => {
    const adminPages = new Set([
      '/admin',
      '/admin/sign-in',
      '/admin/runbook',
      '/admin/test-plan',
      '/admin/reports/summary',
      ...ADMIN_PAGES.map((p) => p.href),
    ]);
    const otherPages = new Set([
      '/',
      '/agenda',
      '/info',
      '/resources',
      '/photos',
      '/me',
      '/leaderboard',
      '/poll',
      '/feedback/event',
      '/screen',
      '/kiosk',
      '/guide',
      '/api/health',
    ]);
    const anchors = new Set(['#ready-h', '#clean']);
    for (const part of TEST_PLAN) {
      for (const group of part.groups) {
        for (const step of group.steps) {
          expect(step.links?.length ?? 0, `${step.id} has a link`).toBeGreaterThan(0);
          for (const link of step.links ?? []) {
            expect(link.label.length, step.id).toBeGreaterThan(2);
            const path = link.href.split('?')[0] ?? '';
            const known = link.href.startsWith('https://github.com/')
              ? true
              : link.href.startsWith('#')
                ? anchors.has(link.href)
                : adminPages.has(path) || otherPages.has(path);
            expect(known, `${step.id} links to ${link.href}`).toBe(true);
          }
        }
      }
    }
  });
});
