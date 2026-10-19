import { useEffect, useRef, useState, type RefObject } from 'react';

/** A touch has to rest this long, without moving, before it drags instead of scrolling. */
export const REORDER_LONG_PRESS_MS = 700;

/** Items in a stored order: the listed ones first, in that order, then the rest as given. */
export function inOrder<T>(items: T[], keyOf: (item: T) => string, order: string[] | null | undefined) {
  if (!order?.length) return items;
  const rank = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(keyOf(item)) }))
    .sort((a, b) => {
      if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
      if (a.rank !== undefined) return -1;
      if (b.rank !== undefined) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * The order to show while the host saves a new one: the pending keys first,
 * dropped once the host's own order agrees.
 */
export function usePendingOrder(keys: string[]) {
  const [pending, setPending] = useState<string[] | null>(null);
  const joined = keys.join('\n');
  useEffect(() => {
    if (pending && pending.join('\n') === joined) setPending(null);
  }, [joined, pending]);
  const shown = pending ? [...pending.filter(key => keys.includes(key)), ...keys.filter(key => !pending.includes(key))] : keys;
  return [shown, setPending] as const;
}

interface Options {
  axis: 'x' | 'y';
  /** Selects the draggable items among the list's descendants; each carries `data-reorder-key`. */
  itemSelector: string;
  enabled: boolean;
  /** Receives every item's key in the new order, and the moved one. */
  onCommit: (keys: string[], moved: string) => void;
  /** The element that scrolls along the axis, when it is not the list itself. */
  scrollRef?: RefObject<HTMLElement | null> | undefined;
}

/**
 * Items put in another order by dragging: a mouse drags once it moves along the
 * axis, a touch after resting still for REORDER_LONG_PRESS_MS (a quick swipe
 * still scrolls). Items may differ in size. The list gets `data-reordering`, the
 * held item `data-dragging`, and a touch that is still waiting `data-pressing`.
 * The release never opens the item's link.
 */
export function useDragReorder(listRef: RefObject<HTMLElement | null>, { axis, itemSelector, enabled, onCommit, scrollRef }: Options) {
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return;
    const horizontal = axis === 'x';
    const scroller = () => scrollRef?.current ?? list;
    const scrollOf = () => horizontal ? scroller().scrollLeft : scroller().scrollTop;
    const along = (x: number, y: number) => horizontal ? x : y;
    let drag: {
      key: string; index: number; items: HTMLElement[]; starts: number[]; sizes: number[]; gap: number;
      origin: number; startX: number; startY: number; target: number; active: boolean; touch: boolean; timer: number; last: number;
    } | null = null;
    let swallowClick = false;
    let frame = 0;
    const itemsOf = () => [...list.querySelectorAll<HTMLElement>(itemSelector)].filter(item => item.dataset.reorderKey);
    const begin = (x: number, y: number, item: HTMLElement, touch: boolean) => {
      const items = itemsOf();
      const index = items.indexOf(item);
      if (index < 0 || items.length < 2) return;
      const scroll = scrollOf();
      const rects = items.map(entry => entry.getBoundingClientRect());
      // Positions in content coordinates, so scrolling during the drag changes nothing.
      const starts = rects.map(rect => (horizontal ? rect.left : rect.top) + scroll);
      const sizes = rects.map(rect => horizontal ? rect.width : rect.height);
      const gap = items.length > 1 ? Math.max(0, (starts[1] ?? 0) - (starts[0] ?? 0) - (sizes[0] ?? 0)) : 0;
      drag = { key: item.dataset.reorderKey!, index, items, starts, sizes, gap, origin: along(x, y) + scroll, startX: x, startY: y, target: index, active: false, touch, timer: 0, last: along(x, y) };
      if (touch) {
        item.setAttribute('data-pressing', '');
        drag.timer = window.setTimeout(activate, REORDER_LONG_PRESS_MS);
      }
    };
    const activate = () => {
      if (!drag) return;
      drag.active = true;
      list.setAttribute('data-reordering', '');
      const item = drag.items[drag.index];
      item?.removeAttribute('data-pressing');
      item?.setAttribute('data-dragging', '');
      navigator.vibrate?.(10);
    };
    const layout = () => {
      if (!drag) return;
      const { items, starts, sizes, gap, index } = drag;
      const pointer = drag.last + scrollOf();
      const offset = pointer - drag.origin;
      // The held item's centre decides its place among the others' centres.
      const centre = (starts[index] ?? 0) + offset + (sizes[index] ?? 0) / 2;
      let target = index;
      for (let other = 0; other < items.length; other += 1) {
        if (other === index) continue;
        const middle = (starts[other] ?? 0) + (sizes[other] ?? 0) / 2;
        if (other < index && centre < middle) target = Math.min(target, other);
        if (other > index && centre > middle) target = Math.max(target, other);
      }
      drag.target = target;
      const shift = (sizes[index] ?? 0) + gap;
      const translate = (value: number) => horizontal ? `translateX(${value}px)` : `translateY(${value}px)`;
      items.forEach((item, other) => {
        if (other === index) item.style.transform = translate(offset);
        else if (other > index && other <= target) item.style.transform = translate(-shift);
        else if (other < index && other >= target) item.style.transform = translate(shift);
        else item.style.transform = '';
      });
    };
    // Near either end of the scrolling box, keep scrolling while held there.
    const autoScroll = () => {
      frame = 0;
      if (!drag?.active) return;
      const box = scroller().getBoundingClientRect();
      const low = horizontal ? box.left : box.top, high = horizontal ? box.right : box.bottom;
      const edge = 36;
      const step = drag.last < low + edge ? -8 : drag.last > high - edge ? 8 : 0;
      if (!step) return;
      const before = scrollOf();
      if (horizontal) scroller().scrollLeft += step; else scroller().scrollTop += step;
      if (scrollOf() !== before) { layout(); frame = window.requestAnimationFrame(autoScroll); }
    };
    const move = (x: number, y: number, event: Event) => {
      if (!drag) return;
      const dx = x - drag.startX, dy = y - drag.startY;
      if (!drag.active) {
        // A touch that moves before the long press is a scroll; a mouse drags
        // once it has moved a few pixels along the axis.
        if (drag.touch) { if (Math.hypot(dx, dy) > 8) cancel(); return; }
        const main = horizontal ? dx : dy, cross = horizontal ? dy : dx;
        if (Math.abs(main) < 6 || Math.abs(main) < Math.abs(cross)) return;
        activate();
      }
      event.preventDefault();
      drag.last = along(x, y);
      layout();
      if (!frame) frame = window.requestAnimationFrame(autoScroll);
    };
    const reset = () => {
      list.removeAttribute('data-reordering');
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      for (const item of itemsOf()) {
        item.style.transform = '';
        item.removeAttribute('data-dragging');
        item.removeAttribute('data-pressing');
      }
    };
    const cancel = () => {
      if (drag) window.clearTimeout(drag.timer);
      drag = null;
      reset();
    };
    const finish = () => {
      if (!drag) return;
      window.clearTimeout(drag.timer);
      const { active, index, target, key, items } = drag;
      drag = null;
      reset();
      if (!active) return;
      swallowClick = true;
      window.setTimeout(() => { swallowClick = false; }, 0);
      if (target === index) return;
      const keys = items.map(item => item.dataset.reorderKey!);
      keys.splice(index, 1);
      keys.splice(target, 0, key);
      commit.current(keys, key);
    };
    const itemFor = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      // Buttons and menus inside an item keep their own presses.
      if (!element || element.closest('button, input, [role="menu"], details, summary, [data-reorder-ignore]')) return null;
      return itemsOf().find(item => item.contains(element)) ?? null;
    };
    const mouseDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const item = itemFor(event.target);
      if (item) begin(event.clientX, event.clientY, item, false);
    };
    const mouseMove = (event: PointerEvent) => { if (event.pointerType === 'mouse') move(event.clientX, event.clientY, event); };
    const mouseUp = (event: PointerEvent) => { if (event.pointerType === 'mouse') finish(); };
    const touchStart = (event: TouchEvent) => {
      const item = event.touches.length === 1 ? itemFor(event.target) : null;
      if (item) begin(event.touches[0]!.clientX, event.touches[0]!.clientY, item, true);
    };
    const touchMove = (event: TouchEvent) => { if (drag) move(event.touches[0]!.clientX, event.touches[0]!.clientY, event); };
    const click = (event: MouseEvent) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // The long press is ours: no link menu or callout on top of it, and a mouse
    // drag moves the item, not its link.
    const contextMenu = (event: Event) => { if (drag) event.preventDefault(); };
    const nativeDrag = (event: Event) => { if (itemFor(event.target)) event.preventDefault(); };
    list.addEventListener('pointerdown', mouseDown);
    window.addEventListener('pointermove', mouseMove);
    window.addEventListener('pointerup', mouseUp);
    list.addEventListener('touchstart', touchStart, { passive: true });
    list.addEventListener('touchmove', touchMove, { passive: false });
    list.addEventListener('touchend', finish);
    list.addEventListener('touchcancel', cancel);
    list.addEventListener('click', click, true);
    list.addEventListener('contextmenu', contextMenu);
    list.addEventListener('dragstart', nativeDrag);
    return () => {
      cancel();
      list.removeEventListener('pointerdown', mouseDown);
      window.removeEventListener('pointermove', mouseMove);
      window.removeEventListener('pointerup', mouseUp);
      list.removeEventListener('touchstart', touchStart);
      list.removeEventListener('touchmove', touchMove);
      list.removeEventListener('touchend', finish);
      list.removeEventListener('touchcancel', cancel);
      list.removeEventListener('click', click, true);
      list.removeEventListener('contextmenu', contextMenu);
      list.removeEventListener('dragstart', nativeDrag);
    };
  }, [listRef, scrollRef, axis, itemSelector, enabled]);
}
