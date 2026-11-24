'use client';

import { useState } from 'react';

import { GiftSpinner, type GiftItemView } from './GiftSpinner';

/**
 * At the desk, for someone not on the participant list: they still spin for
 * a door gift. The name is optional, so the Door gifts page can say who.
 */
export function GuestGift({ items, kiosk = false }: { items: GiftItemView[]; kiosk?: boolean }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const Wrapper = kiosk ? 'section' : 'details';
  return (
    <Wrapper
      className="w-full max-w-md rounded-xl border border-dashed border-line bg-surface p-4 text-left"
      {...(kiosk ? { 'aria-label': 'Door gift for a guest' } : {})}
    >
      {kiosk ? (
        <p className="font-semibold text-ink">Not on the list? You still get a door gift.</p>
      ) : (
        <summary className="cursor-pointer font-semibold text-ink">
          Not on the list? Door gift for a guest
        </summary>
      )}
      <p className="mt-2 text-sm text-ink-soft">
        Type their name if you can (it shows on the Door gifts page), then spin.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
          Guest name (optional)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-ink"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-on-primary"
        >
          Spin a door gift
        </button>
      </div>
      {open ? (
        <GiftSpinner
          guest
          kiosk={kiosk}
          attendeeId=""
          name={name.trim()}
          offer={{ state: 'spin', items }}
          onClose={() => {
            setOpen(false);
            setName('');
          }}
        />
      ) : null}
    </Wrapper>
  );
}
