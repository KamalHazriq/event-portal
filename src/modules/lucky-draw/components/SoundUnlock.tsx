'use client';

import { useEffect } from 'react';

import { unlockSound } from '../sound';

/** Turns the projector's sound on at the first click or key press anywhere. */
export function SoundUnlock() {
  useEffect(() => {
    const unlock = () => unlockSound();
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);
  return null;
}
