import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal window's focus (see docs/ui-principles.md §4): it moves in when the
 * window opens (to `initial`, else the first control), Tab and Shift+Tab stay
 * inside, Esc closes it, and focus returns to what had it before.
 */
export function useModalFocus(windowRef: RefObject<HTMLElement | null>, open: boolean, onClose?: () => void, initial?: string) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const root = windowRef.current;
    if (!root) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const visible = (element: HTMLElement) => element.offsetParent !== null || element.getClientRects().length > 0;
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    const frame = requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return;
      (initial ? root.querySelector<HTMLElement>(initial) : null)?.focus() ?? focusables()[0]?.focus() ?? root.focus();
    });
    const key = (event: KeyboardEvent) => {
      // A window stacked above this one (another dialog with focus) handles its own keys.
      const active = document.activeElement;
      if (active && !root.contains(active) && active.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (event.key === 'Escape' && close.current) { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) { event.preventDefault(); return; }
      const first = list[0]!, last = list[list.length - 1]!;
      const inside = root.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !inside)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key, true);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [windowRef, open, initial]);
}
