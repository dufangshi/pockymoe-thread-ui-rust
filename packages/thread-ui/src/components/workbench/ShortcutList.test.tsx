/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import type { WorkbenchThread } from '../MatterWorkbench';
import { ShortcutList, orderShortcuts } from './ShortcutList';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  setLocale('en', false);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const thread = (key: string, shortcutOrder?: number): WorkbenchThread => ({
  key, title: key.toUpperCase(), subtitle: '', href: `/threads/${key}`, status: 'idle', favorite: true,
  ...(shortcutOrder === undefined ? {} : { shortcutOrder }),
});
const titles = () => [...host.querySelectorAll('[data-shortcut]')].map(row => row.textContent);
function render(threads: WorkbenchThread[], onReorder = vi.fn()) {
  act(() => root.render(<ShortcutList threads={threads} onReorder={onReorder}
    renderRow={item => <a href={item.href}>{item.title}</a>} />));
  return onReorder;
}

it('orders shortcuts by their stored place, then the rest as given', () => {
  expect(orderShortcuts([thread('a'), thread('b', 1), thread('c'), thread('d', 0)]).map(item => item.key)).toEqual(['d', 'b', 'a', 'c']);
});

it('moves the focused row with Alt+arrows and shows the order before the host saves it', () => {
  const onReorder = render([thread('a'), thread('b'), thread('c')]);
  const link = host.querySelector<HTMLAnchorElement>('a[href="/threads/c"]')!;
  act(() => { link.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true })); });
  expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  expect(titles()).toEqual(['A', 'C', 'B']);
  expect(host.querySelector('[role="status"]')!.textContent).toBe('C moved to 2 of 3');
  // Moving past either end does nothing.
  act(() => { host.querySelector('a[href="/threads/a"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true })); });
  expect(onReorder).toHaveBeenCalledTimes(1);
});

it('drags a row with the mouse and keeps the drop from opening its link', () => {
  const onReorder = render([thread('a'), thread('b'), thread('c')]);
  host.querySelectorAll<HTMLElement>('[data-shortcut]').forEach((row, index) => {
    row.getBoundingClientRect = () => ({ top: index * 50, bottom: index * 50 + 46, height: 46, left: 0, right: 200, width: 200, x: 0, y: index * 50, toJSON: () => ({}) });
  });
  const pointer = (target: EventTarget, type: string, clientY: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY, button: 0 });
    Object.assign(event, { pointerType: 'mouse' });
    act(() => { target.dispatchEvent(event); });
  };
  const first = host.querySelector('a[href="/threads/a"]')!;
  pointer(first, 'pointerdown', 20);
  pointer(window, 'pointermove', 24);
  expect(host.querySelector('[data-reordering]')).toBeNull();
  pointer(window, 'pointermove', 125);
  expect(host.querySelector('[data-dragging]')?.textContent).toBe('A');
  pointer(window, 'pointerup', 125);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  first.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
  expect(titles()).toEqual(['B', 'C', 'A']);
});

it('lets a quick touch scroll and drags only after a long press', () => {
  vi.useFakeTimers();
  try {
    const onReorder = render([thread('a'), thread('b')]);
    host.querySelectorAll<HTMLElement>('[data-shortcut]').forEach((row, index) => {
      row.getBoundingClientRect = () => ({ top: index * 50, bottom: index * 50 + 46, height: 46, left: 0, right: 200, width: 200, x: 0, y: index * 50, toJSON: () => ({}) });
    });
    const touch = (target: EventTarget, type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: type === 'touchend' ? [] : [{ clientX: 10, clientY }] });
      act(() => { target.dispatchEvent(event); });
      return event;
    };
    const row = host.querySelector('a[href="/threads/a"]')!;
    touch(row, 'touchstart', 20);
    expect(touch(row, 'touchmove', 60).defaultPrevented).toBe(false);
    touch(row, 'touchend', 60);
    expect(onReorder).not.toHaveBeenCalled();
    touch(row, 'touchstart', 20);
    act(() => { vi.advanceTimersByTime(800); });
    expect(host.querySelector('[data-dragging]')).not.toBeNull();
    expect(touch(row, 'touchmove', 72).defaultPrevented).toBe(true);
    touch(row, 'touchend', 72);
    expect(onReorder).toHaveBeenCalledWith(['b', 'a']);
  } finally { vi.useRealTimers(); }
});
