/** The mobile native-scroll viewport covers xterm's sibling screen. Forward
 * only completed taps to the screen's linkifier; leave pans and long presses
 * with the viewport. Non-bubbling mouse events avoid sending duplicate input to
 * a mouse-tracking program or starting xterm's own selection. */
export function installViewportLinkTaps(viewport: HTMLElement, screen: HTMLElement) {
  let press: { id: number; x: number; y: number; at: number; moved: boolean } | null = null;
  let tap = false;
  const down = (event: PointerEvent) => {
    tap = false;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), moved: false };
  };
  const move = (event: PointerEvent) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
  };
  const up = (event: PointerEvent) => {
    move(event);
    tap = !!press && press.id === event.pointerId && !press.moved && performance.now() - press.at < 550;
    press = null;
  };
  const cancel = () => { press = null; tap = false; };
  const click = (event: MouseEvent) => {
    if (!tap) return;
    tap = false;
    const dispatch = (type: string, x = event.clientX) => screen.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: event.clientY, button: 0 }));
    // Re-enter through another cell: xterm caches the last hovered cell even
    // after a confirmation overlay has hidden its current link.
    const bounds = screen.getBoundingClientRect();
    dispatch('mousemove', event.clientX < bounds.left + bounds.width / 2 ? bounds.right - 1 : bounds.left + 1);
    dispatch('mousemove');
    dispatch('mousedown');
    dispatch('mouseup');
  };
  viewport.addEventListener('pointerdown', down);
  viewport.addEventListener('pointermove', move);
  viewport.addEventListener('pointerup', up);
  viewport.addEventListener('pointercancel', cancel);
  viewport.addEventListener('click', click);
  return () => {
    viewport.removeEventListener('pointerdown', down);
    viewport.removeEventListener('pointermove', move);
    viewport.removeEventListener('pointerup', up);
    viewport.removeEventListener('pointercancel', cancel);
    viewport.removeEventListener('click', click);
  };
}
