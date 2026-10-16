import { useEffect, useRef, useState, type ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';
import type { WorkbenchThread } from '../MatterWorkbench';

/** A touch has to rest this long before it drags a row instead of scrolling. */
const LONG_PRESS_MS = 350;

/** Shortcuts in their order, by `shortcutOrder` and then as given (recency). */
export function orderShortcuts(threads: WorkbenchThread[]) {
  return threads
    .map((thread, index) => ({ thread, index }))
    .sort((a, b) => {
      const left = a.thread.shortcutOrder, right = b.thread.shortcutOrder;
      if (left !== undefined && right !== undefined) return left - right || a.index - b.index;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return a.index - b.index;
    })
    .map(({ thread }) => thread);
}

/**
 * Shortcut rows that can be put in another order: a mouse drags a row once it
 * moves, a touch after a long press (a quick swipe still scrolls), and Alt+↑/↓
 * moves the focused row. The new order is shown at once and handed to
 * `onReorder`; nothing moves without it.
 */
export function ShortcutList({ threads, renderRow, onReorder }: {
  threads: WorkbenchThread[];
  renderRow: (thread: WorkbenchThread) => ReactNode;
  onReorder?: ((keys: string[]) => void) | undefined;
}) {
  useI18n();
  const ordered = orderShortcuts(threads);
  const orderedKeys = ordered.map(thread => thread.key).join('\n');
  // The order shown while the host saves it; dropped once the host agrees.
  const [pending, setPending] = useState<string[] | null>(null);
  useEffect(() => {
    if (pending && pending.join('\n') === orderedKeys) setPending(null);
  }, [orderedKeys, pending]);
  const shown = pending
    ? [...pending.map(key => ordered.find(thread => thread.key === key)).filter((thread): thread is WorkbenchThread => Boolean(thread)),
      ...ordered.filter(thread => !pending.includes(thread.key))]
    : ordered;
  const list = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  // The host may pass a new callback on every render; a drag in progress must
  // not be torn down by that.
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const reorderable = Boolean(onReorder);
  const commit = (keys: string[], moved: string) => {
    if (keys.join('\n') === shown.map(thread => thread.key).join('\n')) return;
    setPending(keys);
    onReorderRef.current?.(keys);
    const title = shown.find(thread => thread.key === moved)?.title ?? '';
    setAnnouncement(translate('workbench.shortcutMoved', { title, position: keys.indexOf(moved) + 1, count: keys.length }));
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const keysRef = useRef<string[]>([]);
  keysRef.current = shown.map(thread => thread.key);

  useEffect(() => {
    const node = list.current;
    if (!node || !reorderable) return;
    let drag: {
      key: string; index: number; startY: number; pitch: number; tops: number[];
      rows: HTMLElement[]; target: number; active: boolean; timer: number; touch: boolean; startX: number;
    } | null = null;
    let swallowClick = false;
    const rowsOf = () => [...node.querySelectorAll<HTMLElement>(':scope > [data-shortcut]')];
    const begin = (clientX: number, clientY: number, row: HTMLElement, touch: boolean) => {
      const rows = rowsOf();
      const index = rows.indexOf(row);
      if (index < 0) return;
      const tops = rows.map(item => item.getBoundingClientRect().top);
      const pitch = rows.length > 1 ? Math.abs((tops[1] ?? 0) - (tops[0] ?? 0)) : row.getBoundingClientRect().height;
      drag = { key: row.dataset.shortcut!, index, startY: clientY, startX: clientX, pitch, tops, rows, target: index, active: false, timer: 0, touch };
      if (touch) drag.timer = window.setTimeout(() => activate(), LONG_PRESS_MS);
    };
    const activate = () => {
      if (!drag) return;
      drag.active = true;
      node.setAttribute('data-reordering', '');
      drag.rows[drag.index]?.setAttribute('data-dragging', '');
      navigator.vibrate?.(8);
    };
    const move = (clientX: number, clientY: number, event: Event) => {
      if (!drag) return;
      const dy = clientY - drag.startY, dx = clientX - drag.startX;
      if (!drag.active) {
        // A touch that moves before the long press is a scroll; a mouse drags
        // once it has moved a few pixels up or down.
        if (drag.touch) { if (Math.hypot(dx, dy) > 8) cancel(); return; }
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
        activate();
      }
      event.preventDefault();
      const rows = drag.rows;
      const last = rows.length - 1;
      const target = Math.max(0, Math.min(last, drag.index + Math.round(dy / (drag.pitch || 1))));
      drag.target = target;
      rows.forEach((row, index) => {
        if (index === drag!.index) row.style.transform = `translateY(${dy}px)`;
        else if (index > drag!.index && index <= target) row.style.transform = `translateY(${-drag!.pitch}px)`;
        else if (index < drag!.index && index >= target) row.style.transform = `translateY(${drag!.pitch}px)`;
        else row.style.transform = '';
      });
    };
    const reset = () => {
      node.removeAttribute('data-reordering');
      for (const row of rowsOf()) { row.style.transform = ''; row.removeAttribute('data-dragging'); }
    };
    const cancel = () => {
      if (drag) window.clearTimeout(drag.timer);
      drag = null;
      reset();
    };
    const finish = () => {
      if (!drag) return;
      window.clearTimeout(drag.timer);
      const { active, index, target, key } = drag;
      drag = null;
      reset();
      if (!active) return;
      // The release ends a drag, not a tap: the row's link stays put.
      swallowClick = true;
      window.setTimeout(() => { swallowClick = false; }, 0);
      if (target === index) return;
      const keys = [...keysRef.current];
      keys.splice(index, 1);
      keys.splice(target, 0, key);
      commitRef.current(keys, key);
    };
    const rowFor = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      if (!element || element.closest('button, [role="menu"], details, summary')) return null;
      return element.closest<HTMLElement>('[data-shortcut]');
    };
    const mouseDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const row = rowFor(event.target);
      if (row) begin(event.clientX, event.clientY, row, false);
    };
    const mouseMove = (event: PointerEvent) => { if (event.pointerType === 'mouse') move(event.clientX, event.clientY, event); };
    const mouseUp = (event: PointerEvent) => { if (event.pointerType === 'mouse') finish(); };
    const touchStart = (event: TouchEvent) => {
      const row = event.touches.length === 1 ? rowFor(event.target) : null;
      if (row) begin(event.touches[0]!.clientX, event.touches[0]!.clientY, row, true);
    };
    const touchMove = (event: TouchEvent) => { if (drag) move(event.touches[0]!.clientX, event.touches[0]!.clientY, event); };
    const click = (event: MouseEvent) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // The long press is ours: no link menu or callout on top of the drag, and a
    // mouse drag moves the row, not the link.
    const contextMenu = (event: Event) => { if (drag) event.preventDefault(); };
    const nativeDrag = (event: Event) => event.preventDefault();
    node.addEventListener('pointerdown', mouseDown);
    window.addEventListener('pointermove', mouseMove);
    window.addEventListener('pointerup', mouseUp);
    node.addEventListener('touchstart', touchStart, { passive: true });
    node.addEventListener('touchmove', touchMove, { passive: false });
    node.addEventListener('touchend', finish);
    node.addEventListener('touchcancel', cancel);
    node.addEventListener('click', click, true);
    node.addEventListener('contextmenu', contextMenu);
    node.addEventListener('dragstart', nativeDrag);
    return () => {
      cancel();
      node.removeEventListener('pointerdown', mouseDown);
      window.removeEventListener('pointermove', mouseMove);
      window.removeEventListener('pointerup', mouseUp);
      node.removeEventListener('touchstart', touchStart);
      node.removeEventListener('touchmove', touchMove);
      node.removeEventListener('touchend', finish);
      node.removeEventListener('touchcancel', cancel);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', contextMenu);
      node.removeEventListener('dragstart', nativeDrag);
    };
  }, [reorderable]);

  return (
    <div ref={list} className="matter-shortcut-list">
      {shown.map((thread, index) => (
        <div key={thread.key} data-shortcut={thread.key} className="matter-shortcut"
          onKeyDown={event => {
            if (!onReorder || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            event.preventDefault();
            const target = index + (event.key === 'ArrowUp' ? -1 : 1);
            if (target < 0 || target >= shown.length) return;
            const keys = shown.map(item => item.key);
            keys.splice(index, 1);
            keys.splice(target, 0, thread.key);
            commit(keys, thread.key);
            // Keep the keyboard on the row that moved.
            const focused = document.activeElement;
            window.requestAnimationFrame(() => { if (focused instanceof HTMLElement) focused.focus(); });
          }}>
          {renderRow(thread)}
        </div>
      ))}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
