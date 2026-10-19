import { useRef, useState, type ReactNode } from 'react';
import { translate, useI18n } from '../../i18n';
import type { WorkbenchThread } from '../MatterWorkbench';
import { useDragReorder, usePendingOrder } from './useDragReorder';

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
 * Shortcut rows that can be put in another order: dragged (useDragReorder) or
 * moved with Alt+↑/↓ on the focused row. The new order is shown at once and
 * handed to `onReorder`; nothing moves without it.
 */
export function ShortcutList({ threads, renderRow, onReorder }: {
  threads: WorkbenchThread[];
  renderRow: (thread: WorkbenchThread) => ReactNode;
  onReorder?: ((keys: string[]) => void) | undefined;
}) {
  useI18n();
  const ordered = orderShortcuts(threads);
  const [shownKeys, setPending] = usePendingOrder(ordered.map(thread => thread.key));
  const shown = shownKeys.map(key => ordered.find(thread => thread.key === key)!).filter(Boolean);
  const list = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  // The host may pass a new callback on every render; a drag in progress must
  // not be torn down by that.
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const commit = (keys: string[], moved: string) => {
    if (keys.join('\n') === shown.map(thread => thread.key).join('\n')) return;
    setPending(keys);
    onReorderRef.current?.(keys);
    const title = shown.find(thread => thread.key === moved)?.title ?? '';
    setAnnouncement(translate('workbench.shortcutMoved', { title, position: keys.indexOf(moved) + 1, count: keys.length }));
  };
  useDragReorder(list, { axis: 'y', itemSelector: ':scope > [data-shortcut]', enabled: Boolean(onReorder), onCommit: commit });

  return (
    <div ref={list} className="matter-shortcut-list">
      {shown.map((thread, index) => (
        <div key={thread.key} data-shortcut={thread.key} data-reorder-key={thread.key} className="matter-shortcut"
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
