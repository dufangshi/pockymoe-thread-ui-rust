// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useExplorerNameBubble } from './ExplorerNameBubble';

let root: Root;
let host: HTMLDivElement;
function Row({ name }: { name: string }) {
  const bubble = useExplorerNameBubble(name);
  return (
    <div role="treeitem">
      <span ref={bubble.label} className="label" {...bubble.handlers}>{name}</span>
      <div className="thread-graph-tree-actions"><button type="button">⋯</button></div>
      {bubble.bubble}
    </div>
  );
}
const tooltip = () => document.querySelector('[role="tooltip"]');
function render(truncated: boolean) {
  act(() => root.render(<Row name="screenshot-classic-dark-phone-confirm.png" />));
  const label = host.querySelector<HTMLElement>('.label')!;
  Object.defineProperty(label, 'scrollWidth', { configurable: true, value: truncated ? 300 : 100 });
  Object.defineProperty(label, 'clientWidth', { configurable: true, value: 100 });
  return label;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows a shortened name in full after the pointer rests on it, and hides it on leave', () => {
  const label = render(true);
  act(() => { label.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(450); });
  expect(tooltip()?.textContent).toBe('screenshot-classic-dark-phone-confirm.png');
  act(() => { label.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
  expect(tooltip()).toBeNull();
});

it('shows nothing for a name that fits', () => {
  const label = render(false);
  act(() => { label.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); vi.advanceTimersByTime(450); });
  expect(tooltip()).toBeNull();
});

it('shows the name while a finger holds it and hides it when the finger lifts, without a tap', () => {
  const label = render(true);
  const tapped = vi.fn();
  host.querySelector('[role="treeitem"]')!.addEventListener('click', tapped);
  const touch = (type: string) => label.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { touches: type === 'touchend' ? [] : [{ clientX: 10, clientY: 10 }] }));
  act(() => { touch('touchstart'); vi.advanceTimersByTime(450); });
  expect(tooltip()?.textContent).toBe('screenshot-classic-dark-phone-confirm.png');
  act(() => { label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  expect(tapped).not.toHaveBeenCalled();
  act(() => { touch('touchend'); });
  expect(tooltip()).toBeNull();
});
