import { useExclusiveSecondary } from './useExclusiveSecondary';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * The keyboard of every app menu (see docs/ui-principles.md §3): focus goes to
 * the first item when it opens; ↑/↓ move and wrap, Home/End jump; Esc closes it
 * and returns focus to the trigger; Tab closes it and moves on.
 */
export function useMenuKeyboard(menuRef: RefObject<HTMLElement | null>, open: boolean, onClose: (restoreFocus: boolean) => void, itemSelector = '[role^="menuitem"]:not([disabled])', replaceSheets = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useExclusiveSecondary(menuRef, open, () => close.current(false), 'menu', replaceSheets);
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const items = () => [...menu.querySelectorAll<HTMLElement>(itemSelector)];
    items()[0]?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      // A slider or radio group among the items owns Home and End (its lowest
      // and highest value), as it owns left and right.
      if ((event.key === 'Home' || event.key === 'End') && ['slider', 'radio'].includes((event.target as HTMLElement | null)?.getAttribute?.('role') ?? '')) return;
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      // A slider among the items (the composer's effort) keeps left and right;
      // up and down move between items and must not also step the slider.
      const move = (to: number) => { event.preventDefault(); if ((event.target as HTMLElement | null)?.getAttribute?.('role') === 'slider') event.stopPropagation(); list[(to + list.length) % list.length]?.focus(); };
      if (event.key === 'ArrowDown') move(index + 1);
      else if (event.key === 'ArrowUp') move(index < 0 ? -1 : index - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(list.length - 1);
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(true); }
      else if (event.key === 'Tab') close.current(false);
    };
    menu.addEventListener('keydown', key);
    return () => menu.removeEventListener('keydown', key);
  }, [menuRef, open, itemSelector]);
}
