// @vitest-environment jsdom
import { act, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useModalFocus } from './useModalFocus';
let host: HTMLDivElement, root: Root, before: HTMLButtonElement;
let frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  frames = new Map(); let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 40, 40)] as unknown as DOMRectList);
  before = document.createElement('button'); document.body.append(before); before.focus();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); before.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Modal({ initial, empty = false }: { initial?: string; empty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); useModalFocus(ref, true, undefined, initial);
  return <div ref={ref} role="dialog" tabIndex={-1}>{!empty ? <><button>Close</button><button data-initial-focus="">Cancel</button><button>Discard</button></> : null}</div>;
}
function paint(node: ReactNode) { act(() => root.render(node)); act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); }); }
it('keeps focus on the explicit initial control instead of falling through void focus() results', () => {
  paint(<Modal initial="[data-initial-focus]" />);
  expect(document.activeElement).toBe(host.querySelector('[data-initial-focus]'));
});
it('uses the first focusable control only when no initial control was requested', () => {
  paint(<Modal />); expect(document.activeElement).toBe(host.querySelector('button'));
});
it('focuses the modal root when there are no controls', () => {
  paint(<Modal empty />); expect(document.activeElement).toBe(host.querySelector('[role=dialog]'));
});
