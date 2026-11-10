import { describe, expect, it } from 'vitest';

import { getEventConfig } from '@/lib/config';
import { buildAgenda } from '@/modules/schedule/logic';

import { mockOperators, mockPolls, mockQuestions, MOCK_NAMES } from './mock-data';

describe('preview mock data', () => {
  const agenda = buildAgenda(getEventConfig());

  it('is the same every time', () => {
    expect(mockQuestions(agenda.sessions)).toEqual(mockQuestions(agenda.sessions));
    expect(mockPolls(78)).toEqual(mockPolls(78));
  });

  it('only gives questions to sessions with Q&A switched on', () => {
    const qaIds = new Set(agenda.sessions.filter((s) => s.qaEnabled).map((s) => s.id));
    for (const q of mockQuestions(agenda.sessions)) expect(qaIds.has(q.sessionId)).toBe(true);
  });

  it('pins at most one approved question per session', () => {
    const pinned = mockQuestions(agenda.sessions).filter((q) => q.pinned);
    expect(new Set(pinned.map((q) => q.sessionId)).size).toBe(pinned.length);
    for (const q of pinned) expect(q.status).toBe('approved');
  });

  it('keeps poll vote totals honest for single choice polls', () => {
    for (const poll of mockPolls(78).filter((p) => p.kind === 'single')) {
      expect(poll.options.reduce((sum, o) => sum + o.votes, 0)).toBe(poll.voters);
    }
  });

  it('uses only invented names, never the attendee list', () => {
    const invented = new Set<string>([...MOCK_NAMES, 'Anonymous']);
    for (const q of mockQuestions(agenda.sessions)) expect(invented.has(q.name)).toBe(true);
  });

  it('shows at most three operators, with the signed in one first', () => {
    const ops = mockOperators('desk-2');
    expect(ops).toHaveLength(3);
    expect(ops[0]?.isYou).toBe(true);
    expect(ops.filter((o) => o.label === 'desk-2')).toHaveLength(1);
  });
});
