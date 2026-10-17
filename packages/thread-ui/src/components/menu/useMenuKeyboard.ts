import { useEffect, useRef, type RefObject } from 'react';

/**
 * The keyboard of every app menu (see docs/ui-principles.md §3): focus goes to
 * the first item when it opens; ↑/↓ move and wrap, Home/End jump; Esc closes it
 * and returns focus to the trigger; Tab closes it and moves on.
 */
export function useMenuKeyboard(menuRef: RefObject<HTMLElement | null>, open: boolean, onClose: (restoreFocus: boolean) => void, itemSelector = '[role^="menuitem"]:not([disabled])') {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const items = () => [...menu.querySelectorAll<HTMLElement>(itemSelector)];
    items()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const move = (to: number) => { event.preventDefault(); list[(to + list.length) % list.length]?.focus(); };
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
