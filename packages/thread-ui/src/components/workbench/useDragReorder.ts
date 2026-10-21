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
  /**
   * An item may also be dragged out of the list (a mouse, in any direction):
   * told where the pointer is while held, and asked at the release whether the
   * place it was dropped took it (then the order stays).
   */
  outside?: {
    move: (key: string, x: number, y: number) => void;
    drop: (key: string, x: number, y: number) => boolean;
    end: () => void;
  } | undefined;
}

/**
 * Items put in another order by dragging: a mouse drags once it moves along the
 * axis, a touch after resting still for REORDER_LONG_PRESS_MS (a quick swipe
 * still scrolls). Items may differ in size. The list gets `data-reordering`, the
 * held item `data-dragging`, and a touch that is still waiting `data-pressing`.
 * The release never opens the item's link. The list is looked up when a press
 * starts, so a list that is rendered again (a new element) keeps dragging.
 */
export function useDragReorder(listRef: RefObject<HTMLElement | null>, { axis, itemSelector, enabled, onCommit, scrollRef, outside }: Options) {
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const away = useRef(outside);
  away.current = outside;
  const detachable = Boolean(outside);
  useEffect(() => {
    if (!enabled) return;
    const horizontal = axis === 'x';
    let drag: {
      list: HTMLElement; key: string; index: number; items: HTMLElement[]; starts: number[]; sizes: number[]; gap: number;
      origin: number; startX: number; startY: number; target: number; active: boolean; touch: boolean; timer: number; last: number; x: number; y: number;
    } | null = null;
    let swallowClick = false;
    let frame = 0;
    const scrollerOf = (list: HTMLElement) => scrollRef?.current ?? list;
    const scrollOf = (list: HTMLElement) => horizontal ? scrollerOf(list).scrollLeft : scrollerOf(list).scrollTop;
    const along = (x: number, y: number) => horizontal ? x : y;
    const itemsOf = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(itemSelector)].filter(item => item.dataset.reorderKey);
    const begin = (list: HTMLElement, x: number, y: number, item: HTMLElement, touch: boolean) => {
      const items = itemsOf(list);
      const index = items.indexOf(item);
      if (index < 0 || (items.length < 2 && !away.current)) return;
      const scroll = scrollOf(list);
      const rects = items.map(entry => entry.getBoundingClientRect());
      // Positions in content coordinates, so scrolling during the drag changes nothing.
      const starts = rects.map(rect => (horizontal ? rect.left : rect.top) + scroll);
      const sizes = rects.map(rect => horizontal ? rect.width : rect.height);
      const gap = items.length > 1 ? Math.max(0, (starts[1] ?? 0) - (starts[0] ?? 0) - (sizes[0] ?? 0)) : 0;
      drag = { list, key: item.dataset.reorderKey!, index, items, starts, sizes, gap, origin: along(x, y) + scroll, startX: x, startY: y, target: index, active: false, touch, timer: 0, last: along(x, y), x, y };
      if (touch) {
        item.setAttribute('data-pressing', '');
        list.addEventListener('touchmove', touchMove, { passive: false });
        list.addEventListener('touchend', finish);
        list.addEventListener('touchcancel', cancel);
        drag.timer = window.setTimeout(activate, REORDER_LONG_PRESS_MS);
      }
    };
    const activate = () => {
      if (!drag) return;
      drag.active = true;
      drag.list.setAttribute('data-reordering', '');
      const item = drag.items[drag.index];
      item?.removeAttribute('data-pressing');
      item?.setAttribute('data-dragging', '');
      navigator.vibrate?.(10);
    };
    const layout = () => {
      if (!drag) return;
      const { items, starts, sizes, gap, index } = drag;
      const pointer = drag.last + scrollOf(drag.list);
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
      const scroller = scrollerOf(drag.list);
      const box = scroller.getBoundingClientRect();
      const low = horizontal ? box.left : box.top, high = horizontal ? box.right : box.bottom;
      const edge = 36;
      const step = drag.last < low + edge ? -8 : drag.last > high - edge ? 8 : 0;
      if (!step) return;
      const before = scrollOf(drag.list);
      if (horizontal) scroller.scrollLeft += step; else scroller.scrollTop += step;
      if (scrollOf(drag.list) !== before) { layout(); frame = window.requestAnimationFrame(autoScroll); }
    };
    const move = (x: number, y: number, event: Event) => {
      if (!drag) return;
      const dx = x - drag.startX, dy = y - drag.startY;
      if (!drag.active) {
        // A touch that moves before the long press is a scroll; a mouse drags
        // once it has moved a few pixels along the axis (or any way, when the
        // item may leave the list).
        if (drag.touch) { if (Math.hypot(dx, dy) > 8) cancel(); return; }
        const main = horizontal ? dx : dy, cross = horizontal ? dy : dx;
        if (detachable ? Math.hypot(dx, dy) < 6 : Math.abs(main) < 6 || Math.abs(main) < Math.abs(cross)) return;
        activate();
      }
      event.preventDefault();
      drag.last = along(x, y);
      drag.x = x; drag.y = y;
      layout();
      if (!drag.touch) away.current?.move(drag.key, x, y);
      if (!frame) frame = window.requestAnimationFrame(autoScroll);
    };
    const reset = (list: HTMLElement) => {
      list.removeAttribute('data-reordering');
      list.removeEventListener('touchmove', touchMove);
      list.removeEventListener('touchend', finish);
      list.removeEventListener('touchcancel', cancel);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      for (const item of itemsOf(list)) {
        item.style.transform = '';
        item.removeAttribute('data-dragging');
        item.removeAttribute('data-pressing');
      }
    };
    function cancel() {
      if (!drag) return;
      window.clearTimeout(drag.timer);
      const { list, active, touch } = drag;
      drag = null;
      reset(list);
      if (active && !touch) away.current?.end();
    }
    function finish() {
      if (!drag) return;
      window.clearTimeout(drag.timer);
      const { list, active, index, target, key, items, x, y, touch } = drag;
      drag = null;
      reset(list);
      if (!active) return;
      swallowClick = true;
      window.setTimeout(() => { swallowClick = false; }, 0);
      const taken = !touch && away.current ? away.current.drop(key, x, y) : false;
      if (!touch) away.current?.end();
      if (taken || target === index) return;
      const keys = items.map(item => item.dataset.reorderKey!);
      keys.splice(index, 1);
      keys.splice(target, 0, key);
      commit.current(keys, key);
    }
    const itemFor = (target: EventTarget | null) => {
      const list = listRef.current;
      const element = target instanceof Element ? target : null;
      // Buttons and menus inside an item keep their own presses.
      if (!list || !element || !list.contains(element) || element.closest('button, input, [role="menu"], details, summary, [data-reorder-ignore]')) return null;
      const item = itemsOf(list).find(entry => entry.contains(element));
      return item ? { list, item } : null;
    };
    const mouseDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const found = itemFor(event.target);
      if (found) begin(found.list, event.clientX, event.clientY, found.item, false);
    };
    const mouseMove = (event: PointerEvent) => { if (event.pointerType === 'mouse') move(event.clientX, event.clientY, event); };
    const mouseUp = (event: PointerEvent) => { if (event.pointerType === 'mouse') finish(); };
    const touchStart = (event: TouchEvent) => {
      const found = event.touches.length === 1 ? itemFor(event.target) : null;
      if (found) begin(found.list, event.touches[0]!.clientX, event.touches[0]!.clientY, found.item, true);
    };
    function touchMove(event: TouchEvent) { if (drag) move(event.touches[0]!.clientX, event.touches[0]!.clientY, event); }
    const click = (event: MouseEvent) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // The long press is ours: no link menu or callout on top of it, and a mouse
    // drag moves the item, not its link.
    const contextMenu = (event: Event) => { if (drag) event.preventDefault(); };
    const nativeDrag = (event: Event) => { if (itemFor(event.target)) event.preventDefault(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag?.active) { event.preventDefault(); cancel(); } };
    document.addEventListener('pointerdown', mouseDown);
    window.addEventListener('pointermove', mouseMove);
    window.addEventListener('pointerup', mouseUp);
    document.addEventListener('touchstart', touchStart, { passive: true });
    document.addEventListener('click', click, true);
    document.addEventListener('contextmenu', contextMenu);
    document.addEventListener('dragstart', nativeDrag);
    document.addEventListener('keydown', escape, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', mouseDown);
      window.removeEventListener('pointermove', mouseMove);
      window.removeEventListener('pointerup', mouseUp);
      document.removeEventListener('touchstart', touchStart);
      document.removeEventListener('click', click, true);
      document.removeEventListener('contextmenu', contextMenu);
      document.removeEventListener('dragstart', nativeDrag);
      document.removeEventListener('keydown', escape, true);
    };
  }, [listRef, scrollRef, axis, itemSelector, enabled, detachable]);
}
