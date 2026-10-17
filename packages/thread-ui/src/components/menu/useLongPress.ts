import { useRef, type MouseEvent, type TouchEvent } from 'react';

/** A touch held still for half a second opens the same menu as a right click or
    the ⋯ button (iOS fires no contextmenu); the click that follows is dropped. */
export function useLongPress(onLongPress: (point: { x: number; y: number }) => void, delay = 500) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => { window.clearTimeout(timer.current); start.current = null; };
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      fired.current = false;
      start.current = { x: touch.clientX, y: touch.clientY };
      timer.current = window.setTimeout(() => {
        if (!start.current) return;
        fired.current = true;
        onLongPress(start.current);
      }, delay);
    },
    onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (start.current && touch && Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y) > 10) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture(event: MouseEvent) {
      if (fired.current) { fired.current = false; event.preventDefault(); event.stopPropagation(); }
    },
  };
}
