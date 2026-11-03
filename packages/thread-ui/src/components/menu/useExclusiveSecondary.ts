import { useLayoutEffect, useRef, type RefObject } from 'react';

const opened = 'pockymoe:secondary-open';

/** Top-level menus and phone sheets replace one another, including portal menus. */
export function useExclusiveSecondary(root: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, kind: 'menu' | 'sheet' = 'menu', replaceSheets = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const owner = root.current;
    const replace = (event: Event) => {
      const next = (event as CustomEvent<{ owner: HTMLElement; replaceSheets: boolean }>).detail;
      if (next.owner !== owner && (kind !== 'sheet' || next.replaceSheets)) close.current();
    };
    window.dispatchEvent(new CustomEvent(opened, { detail: { owner, replaceSheets: kind === 'sheet' || replaceSheets } }));
    window.addEventListener(opened, replace);
    return () => window.removeEventListener(opened, replace);
  }, [root, open, kind, replaceSheets]);
}
