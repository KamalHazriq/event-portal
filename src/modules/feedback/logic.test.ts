import { describe, expect, it } from 'vitest';

import { getEventConfig } from '@/lib/config';
import { EventConfigSchema } from '@/lib/event-schema';

import {
  anonymityLabel,
  EVENT_FORM_ID,
  EVENT_FORM_SLUG,
  feedbackForms,
  findFeedbackForm,
  formatAverage,
  formIdFromSlug,
  isFormOpen,
  MAX_COMMENT,
  parseRating,
  problemMessage,
  ratingBarWidths,
  resolveAnonymity,
  slugForFormId,
  tallyBestSessions,
  validateSubmission,
  type FeedbackForm,
} from './logic';

const sessionForm: FeedbackForm = {
  id: 'd1-keynote',
  slug: 'd1-keynote',
  kind: 'session',
  title: 'Keynote',
  context: 'Day 1',
};

const eventForm: FeedbackForm = {
  id: EVENT_FORM_ID,
  slug: EVENT_FORM_SLUG,
  kind: 'event',
  title: 'About the summit',
  context: 'The whole event',
};

describe('anonymity', () => {
  it('uses the form setting when there is one', () => {
    expect(resolveAnonymity('anonymous', 'named')).toBe('anonymous');
  });

  it('falls back to the event default', () => {
    expect(resolveAnonymity(null, 'named')).toBe('named');
  });

  it('falls back to name optional when nothing is set', () => {
    expect(resolveAnonymity(null, null)).toBe('optional');
  });

  it('ignores a value that is not one of the three modes', () => {
    expect(resolveAnonymity('whatever', null)).toBe('optional');
    expect(resolveAnonymity('whatever', 'anonymous')).toBe('anonymous');
  });

  it('describes each mode in plain English', () => {
    expect(anonymityLabel('anonymous')).toBe('Anonymous, no names collected');
    expect(anonymityLabel('named')).toBe('Names required');
    expect(anonymityLabel('optional')).toBe('Name optional');
  });
});

describe('open and closed', () => {
  it('is open unless an admin closed it', () => {
    expect(isFormOpen(null)).toBe(true);
    expect(isFormOpen('open')).toBe(true);
    expect(isFormOpen('closed')).toBe(false);
  });
});

describe('form ids and slugs', () => {
  it('maps the friendly event path to the stored id', () => {
    expect(formIdFromSlug('event')).toBe(EVENT_FORM_ID);
    expect(slugForFormId(EVENT_FORM_ID)).toBe('event');
  });

  it('leaves a session id alone', () => {
    expect(formIdFromSlug('d1-keynote')).toBe('d1-keynote');
    expect(slugForFormId('d1-keynote')).toBe('d1-keynote');
  });
});

describe('parseRating', () => {
  it('accepts the five star values', () => {
    for (const value of ['1', '2', '3', '4', '5']) {
      expect(parseRating(value)).toBe(Number(value));
    }
  });

  it('refuses anything else', () => {
    expect(parseRating('0')).toBeNull();
    expect(parseRating('6')).toBeNull();
    expect(parseRating('')).toBeNull();
    expect(parseRating('4.5')).toBeNull();
    expect(parseRating('five')).toBeNull();
    expect(parseRating(null)).toBeNull();
    expect(parseRating(undefined)).toBeNull();
  });
});

describe('validateSubmission', () => {
  it('accepts stars with no comment', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '4',
      comment: '',
      name: '',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rating).toBe(4);
      expect(result.value.answers).toEqual({});
      expect(result.value.displayName).toBe('');
    }
  });

  it('keeps a comment and a name', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '5',
      comment: '  Really useful session.  ',
      name: '  Siti Osman ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answers.comment).toBe('Really useful session.');
      expect(result.value.displayName).toBe('Siti Osman');
    }
  });

  it('asks for a rating when none was chosen', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '',
      comment: '',
      name: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain('rating-missing');
  });

  it('refuses a rating outside one to five', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '9',
      comment: '',
      name: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain('rating-invalid');
  });

  it('throws away a name on an anonymous form, even if one is posted', () => {
    const result = validateSubmission(sessionForm, 'anonymous', {
      rating: '3',
      comment: 'Fine.',
      name: 'Someone Who Typed Their Name',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.displayName).toBe('');
  });

  it('requires a name when the form is set to named', () => {
    const result = validateSubmission(sessionForm, 'named', {
      rating: '3',
      comment: '',
      name: '   ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain('name-missing');
  });

  it('refuses a comment that is too long', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '3',
      comment: 'x'.repeat(MAX_COMMENT + 50),
      name: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain('comment-too-long');
  });

  it('collects the extra event questions', () => {
    const result = validateSubmission(
      eventForm,
      'optional',
      {
        rating: '5',
        comment: 'Great three days.',
        improve: 'More breaks.',
        bestSessionId: 'd1-keynote',
        name: '',
      },
      new Set(['d1-keynote', 'd2-strategy']),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answers).toEqual({
        comment: 'Great three days.',
        improve: 'More breaks.',
        bestSessionId: 'd1-keynote',
      });
    }
  });

  it('drops a best session that is not a real session', () => {
    const result = validateSubmission(
      eventForm,
      'optional',
      { rating: '4', comment: '', improve: '', bestSessionId: 'made-up', name: '' },
      new Set(['d1-keynote']),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.answers.bestSessionId).toBeUndefined();
  });

  it('strips control characters out of what people type', () => {
    const result = validateSubmission(sessionForm, 'optional', {
      rating: '4',
      comment: 'Good\u0000 session\u0007',
      name: 'A\u0000B',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answers.comment).toBe('Good session');
      expect(result.value.displayName).toBe('AB');
    }
  });

  it('reports every problem at once, with no repeats', () => {
    const result = validateSubmission(sessionForm, 'named', {
      rating: '',
      comment: 'x'.repeat(MAX_COMMENT + 1),
      name: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toContain('rating-missing');
      expect(result.problems).toContain('name-missing');
      expect(new Set(result.problems).size).toBe(result.problems.length);
    }
  });

  it('writes problems in plain English with no em dashes', () => {
    const all = (['rating-missing', 'rating-invalid', 'name-missing', 'comment-too-long'] as const)
      .map(problemMessage)
      .join(' ');
    expect(all).not.toMatch(/[—–]/);
    expect(problemMessage('name-missing')).toContain('name');
  });
});

describe('the forms this event has', () => {
  const config = getEventConfig();

  it('includes one per session that asks for feedback, plus the event form', () => {
    const forms = feedbackForms(config);
    const sessionsWithFeedback = config.days.flatMap((day) =>
      day.sessions.filter((session) => session.feedbackEnabled),
    );

    expect(forms).toHaveLength(sessionsWithFeedback.length + 1);
    expect(forms.at(-1)?.id).toBe(EVENT_FORM_ID);
  });

  it('finds a form by its stored id', () => {
    expect(findFeedbackForm(config, EVENT_FORM_ID)?.kind).toBe('event');
    expect(findFeedbackForm(config, 'does-not-exist')).toBeNull();
  });

  it('leaves out sessions that do not ask for feedback', () => {
    const ids = new Set(feedbackForms(config).map((form) => form.id));
    // The coffee break does not ask for feedback.
    expect(ids.has('d1-break-pm')).toBe(false);
  });
});

describe('the config guards the reserved form ids', () => {
  it('refuses a session called "event"', () => {
    const base = {
      configVersion: 1,
      event: {
        name: 'Minimal',
        shortName: 'Min',
        startDate: '2027-01-01',
        endDate: '2027-01-01',
        venue: 'TBC',
      },
      branding: {
        brand: { primary: '#0053A1', navy: '#042C75', panel: '#E6EEF8' },
        themes: { light: theme(), dark: theme() },
      },
      days: [
        {
          id: 'day-1',
          date: '2027-01-01',
          label: 'Day 1',
          sessions: [{ id: 'event', start: '09:00', end: '10:00', title: 'Hi', type: 'talk' }],
        },
      ],
    };

    const result = EventConfigSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('event-final');
  });
});

describe('results', () => {
  it('writes an average the way a person would say it', () => {
    expect(formatAverage(4.25)).toBe('4.3 out of 5');
    expect(formatAverage(5)).toBe('5.0 out of 5');
    expect(formatAverage(null)).toBe('no ratings yet');
  });

  it('scales the bars against the most common rating', () => {
    const widths = ratingBarWidths({ 1: 0, 2: 1, 3: 2, 4: 8, 5: 4 });
    expect(widths[4]).toBe(100);
    expect(widths[5]).toBe(50);
    expect(widths[1]).toBe(0);
  });

  it('does not divide by zero before anyone has answered', () => {
    expect(ratingBarWidths({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })[3]).toBe(0);
  });

  it('counts which session people liked most', () => {
    const tally = tallyBestSessions([
      { answers: { bestSessionId: 'a' } },
      { answers: { bestSessionId: 'b' } },
      { answers: { bestSessionId: 'a' } },
      { answers: {} },
    ]);

    expect(tally).toEqual([
      { sessionId: 'a', votes: 2 },
      { sessionId: 'b', votes: 1 },
    ]);
  });
});

function theme(): Record<string, string> {
  return {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#EEEEEE',
    border: '#CCCCCC',
    text: '#000000',
    textMuted: '#555555',
    primary: '#0053A1',
    primaryText: '#FFFFFF',
    accent: '#00A3E0',
    accentText: '#042C75',
    live: '#C2410C',
    success: '#1C7C4D',
    warning: '#A16207',
  };
}
