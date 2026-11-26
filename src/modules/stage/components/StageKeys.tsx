'use client';

import { useEffect } from 'react';

/**
 * Keyboard and presentation-clicker keys for the stage console, for a laptop
 * on the floor: Right arrow or Page Down is Next cue, Left arrow or Page Up is
 * Previous cue, and 1 to 9 put that tile on the screen. Ignored while typing.
 */
export function StageKeys() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      let el: HTMLElement | null = null;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') el = document.getElementById('cue-next');
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')
        el = document.getElementById('cue-prev');
      else if (/^[1-9]$/.test(e.key)) el = document.querySelector(`[data-tile-index="${e.key}"]`);
      if (el) {
        e.preventDefault();
        el.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
