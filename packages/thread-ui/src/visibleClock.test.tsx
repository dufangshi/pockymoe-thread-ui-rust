/** @vitest-environment jsdom */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useVisibleClock } from './visibleClock';

let root: Root;
let container: HTMLDivElement;
const intersections: Array<(visible: boolean) => void> = [];
function Clock({ enabled = true }: { enabled?: boolean }) {
  const [element, ref] = useState<HTMLSpanElement | null>(null);
  const now = useVisibleClock(enabled, 1000, element);
  return <span ref={ref}>{now}</span>;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container); intersections.length = 0;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      intersections.push(visible => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver));
    }
    observe() {} disconnect() {}
  });
});
afterEach(() => {
  act(() => root.unmount()); container.remove();
  delete document.documentElement.dataset.pockymoeRendering;
  delete (document as unknown as { hidden?: boolean }).hidden;
  vi.unstubAllGlobals(); vi.useRealTimers();
});

it('shares one second clock across thirty visible rows, and no timer across hidden rows', () => {
  act(() => root.render(<>{Array.from({ length: 30 }, (_, i) => <Clock key={i} />)}</>));
  expect(vi.getTimerCount()).toBe(0);
  act(() => intersections.forEach(show => show(true)));
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(1000));
  expect([...container.querySelectorAll('span')].every(row => row.textContent === '1000')).toBe(true);
  act(() => {
    document.documentElement.dataset.pockymoeRendering = 'paused';
    window.dispatchEvent(new Event('pockymoe-rendering-change'));
  });
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(60000));
  expect(container.firstElementChild?.textContent).toBe('1000');
  act(() => {
    delete document.documentElement.dataset.pockymoeRendering;
    window.dispatchEvent(new Event('pockymoe-rendering-change'));
  });
  expect(container.firstElementChild?.textContent).toBe('61000');
  expect(vi.getTimerCount()).toBe(1);
});

it('catches up on intersection and browser visibility without replaying missed ticks', () => {
  act(() => root.render(<Clock />));
  act(() => vi.advanceTimersByTime(10000));
  expect(container.textContent).toBe('0');
  act(() => intersections[0]!(true));
  expect(container.textContent).toBe('10000');
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(60000));
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(container.textContent).toBe('70000');
  act(() => intersections[0]!(false));
  expect(vi.getTimerCount()).toBe(0);
});

it('removes its last timer when disabled and ignores a disposed observer callback', () => {
  act(() => root.render(<Clock />));
  act(() => intersections[0]!(true));
  expect(vi.getTimerCount()).toBe(1);
  act(() => root.render(<Clock enabled={false} />));
  expect(vi.getTimerCount()).toBe(0);
  act(() => intersections[0]!(true));
  expect(vi.getTimerCount()).toBe(0);
});
