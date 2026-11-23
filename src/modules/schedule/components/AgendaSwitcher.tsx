'use client';

import { useState, type ReactNode } from 'react';

import type { ResolvedDay } from '../logic';
import { DayTabs } from './DayTabs';

/**
 * The agenda's days, all rendered on the server up front, so switching day
 * is instant. The address follows the tab, so a reload or a shared link
 * lands on the same day.
 */
export function AgendaSwitcher({
  days,
  initial,
  panels,
  timezone,
  extraParams,
}: {
  days: ResolvedDay[];
  initial: string;
  /** One panel per day id, plus "mine" for Favourites. */
  panels: Record<string, ReactNode>;
  timezone: string;
  extraParams: string;
}) {
  const [selected, setSelected] = useState(initial);

  const select = (dayId: string) => {
    setSelected(dayId);
    try {
      window.history.replaceState(null, '', `/agenda?day=${dayId}${extraParams}`);
    } catch {
      // The day still changes on screen.
    }
  };

  return (
    <>
      <DayTabs
        days={days}
        selectedDayId={selected}
        showMine
        timezone={timezone}
        extraParams={extraParams}
        onSelect={select}
      />
      <div key={selected} className="agenda-panel">
        {panels[selected] ?? panels[initial]}
      </div>
    </>
  );
}
