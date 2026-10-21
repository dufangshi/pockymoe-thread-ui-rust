import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { shellThemeProps } from '../../themeHooks';

const HOVER_DELAY_MS = 400;
const PRESS_DELAY_MS = 400;
const MOVE_SLOP_PX = 10;

/** A shortened name shown in full: after a pointer rests on it (desktop), or
    while a finger holds it (touch; it goes when the finger lifts). It sits above
    the row (below when there is no room), from the name's start, and never
    reaches the ⋯ column at the rows' end. Names that fit show nothing. */
export function useExplorerNameBubble(name: string) {
  const label = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const press = useRef<{ x: number; y: number } | null>(null);
  const shown = useRef(false);
  const [place, setPlace] = useState<{ style: CSSProperties; theme: ReturnType<typeof shellThemeProps> } | null>(null);
  const clear = () => window.clearTimeout(timer.current);
  const hide = useCallback(() => { clear(); press.current = null; shown.current = false; setPlace(null); }, []);
  useEffect(() => hide, [hide]);
  const show = () => {
    const element = label.current;
    if (!element || !truncated(element)) return;
    const row = element.closest<HTMLElement>('[role="treeitem"]');
    const rowBox = (row ?? element).getBoundingClientRect();
    const start = element.getBoundingClientRect().left;
    const actions = row?.querySelector<HTMLElement>('.thread-graph-tree-actions')?.getBoundingClientRect();
    const end = Math.min(actions && actions.width > 0 ? actions.left : rowBox.right, window.innerWidth) - 6;
    const left = Math.max(6, Math.min(start - 6, end - 160));
    const above = rowBox.top > 64;
    // In the inks of the tree it names, whatever the theme paints there: the
    // bubble lives on the page's body, outside the tree's own palette.
    const ink = getComputedStyle(element).color;
    shown.current = true;
    setPlace({
      theme: shellThemeProps(element),
      style: {
        color: ink, background: surfaceBehind(element), borderColor: `color-mix(in srgb, ${ink} 22%, transparent)`,
        position: 'fixed', left, maxWidth: Math.max(160, end - left), zIndex: 1000,
        ...(above ? { bottom: window.innerHeight - rowBox.top + 4 } : { top: rowBox.bottom + 4 }),
      },
    });
  };
  const handlers = {
    onMouseEnter: () => { clear(); timer.current = window.setTimeout(show, HOVER_DELAY_MS); },
    onMouseLeave: hide,
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      press.current = { x: touch.clientX, y: touch.clientY };
      clear();
      timer.current = window.setTimeout(() => { if (press.current) show(); }, PRESS_DELAY_MS);
    },
    onTouchMove: (event: TouchEvent) => {
      const touch = event.touches[0];
      if (press.current && touch && Math.hypot(touch.clientX - press.current.x, touch.clientY - press.current.y) > MOVE_SLOP_PX) hide();
    },
    onTouchEnd: hide,
    onTouchCancel: hide,
    // A hold that showed the name is only a look: no tap, no system menu.
    onClickCapture: (event: MouseEvent) => { if (shown.current) { event.preventDefault(); event.stopPropagation(); } },
    onContextMenu: (event: MouseEvent) => { if (press.current) event.preventDefault(); },
  };
  const bubble = place ? createPortal(
    <div role="tooltip" className={`thread-ui-shell explorer-name-bubble ${place.theme.themeClass}`}
      data-theme-effective={place.theme['data-theme-effective']} style={place.style}>{name}</div>,
    document.body,
  ) : null;
  return { label, handlers, bubble };
}

/** The first painted background behind an element. */
function surfaceBehind(element: HTMLElement) {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && color !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
  }
  return undefined;
}

function truncated(element: HTMLElement) {
  return [element, ...element.querySelectorAll<HTMLElement>('*')].some(node => node.scrollWidth > node.clientWidth + 1);
}
