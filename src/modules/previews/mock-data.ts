/**
 * Dummy data for the one admin page that is still a preview: who else is
 * signed in. Everything else that started here has been built for real.
 *
 * Nothing here is stored, and nothing in it is a real person: the entries
 * are desk labels, never names.
 */

/* ----------------------------------------------------------------- admins */

export type MockOperator = {
  label: string;
  device: string;
  lastSeenMinutes: number;
  page: string;
  isYou: boolean;
};

export type MockActivity = {
  minutesAgo: number;
  operator: string;
  action: string;
};

/**
 * The brief asks for 2 to 3 admins at once. The console already allows it
 * (each desk signs in with the PIN and its own label). What it cannot show
 * yet is who else is signed in, because sign in is a stateless cookie. This
 * is how that panel will look.
 */
export function mockOperators(currentOperator: string): MockOperator[] {
  const others: MockOperator[] = [
    {
      label: 'desk-1',
      device: 'Laptop',
      lastSeenMinutes: 0,
      page: 'Registration desk',
      isYou: false,
    },
    { label: 'desk-2', device: 'Phone', lastSeenMinutes: 1, page: 'Headcount', isYou: false },
    { label: 'mc', device: 'Phone', lastSeenMinutes: 3, page: 'Live control', isYou: false },
  ].filter((op) => op.label !== currentOperator);

  return [
    {
      label: currentOperator,
      device: 'This device',
      lastSeenMinutes: 0,
      page: 'Admins',
      isYou: true,
    },
    ...others,
  ].slice(0, 3);
}

export function mockActivity(currentOperator: string): MockActivity[] {
  return [
    { minutesAgo: 1, operator: 'desk-1', action: 'Checked in 3 people by QR' },
    { minutesAgo: 2, operator: 'desk-2', action: 'Undid a check in (wrong tag scanned)' },
    { minutesAgo: 4, operator: 'mc', action: 'Started the countdown, 15 minutes' },
    { minutesAgo: 6, operator: currentOperator, action: 'Approved 4 photos' },
    { minutesAgo: 9, operator: 'desk-1', action: 'Checked in 1 person by name search' },
    { minutesAgo: 15, operator: 'mc', action: 'Opened the feedback form for the keynote' },
    {
      minutesAgo: 22,
      operator: 'desk-2',
      action: 'Changed the final feedback form to optional name',
    },
  ];
}
