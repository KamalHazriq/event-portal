'use client';

import { useEffect, useRef } from 'react';

/**
 * Put inside a form: when the browser refuses to send it, each missed
 * question gets its own message in the page (not just the browser's small
 * bubble, which a bar at the foot of a phone can cover), is marked
 * aria-invalid, and the first one is brought into view and focused.
 * Without JavaScript the browser's own checks still apply.
 */
export function InlineValidation({
  message = 'Please answer this question.',
}: {
  message?: string;
}) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = marker.current?.closest('form');
    if (!form) return;
    let first: HTMLElement | null = null;
    let timer = 0;

    const holder = (el: Element) => el.closest('fieldset') ?? el.closest('label') ?? el;

    function onInvalid(event: Event) {
      const el = event.target as HTMLInputElement;
      event.preventDefault();
      el.setAttribute('aria-invalid', 'true');
      const box = holder(el) as HTMLElement;
      box.setAttribute('data-invalid', 'true');
      if (!box.querySelector(':scope > .field-error')) {
        const p = document.createElement('p');
        p.className = 'field-error';
        p.id = `err-${el.name || Math.random().toString(36).slice(2)}`;
        p.textContent = message;
        box.appendChild(p);
        el.setAttribute('aria-describedby', p.id);
      }
      if (!first) {
        first = el;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          first?.focus();
          first?.scrollIntoView({ block: 'center' });
          first = null;
        }, 0);
      }
    }

    function onChange(event: Event) {
      const el = event.target as HTMLInputElement;
      if (!el.name) return;
      // A radio group is valid once any one of it is picked.
      const group = form!.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(el.name)}"]`);
      if ([...group].every((x) => x.validity.valid)) {
        group.forEach((x) => {
          x.removeAttribute('aria-invalid');
          const box = holder(x) as HTMLElement;
          box.removeAttribute('data-invalid');
          box.querySelector(':scope > .field-error')?.remove();
        });
      }
    }

    form.addEventListener('invalid', onInvalid, true);
    form.addEventListener('change', onChange);
    form.addEventListener('input', onChange);
    return () => {
      form.removeEventListener('invalid', onInvalid, true);
      form.removeEventListener('change', onChange);
      form.removeEventListener('input', onChange);
      window.clearTimeout(timer);
    };
  }, [message]);

  return <span ref={marker} hidden />;
}
