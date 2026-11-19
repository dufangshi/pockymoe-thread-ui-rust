// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GraphWorkspaceImageLightbox, WorkspaceImagePreview } from './ZoomableImage';

function pointer(element: HTMLElement, type: string, id: number, x: number, y = 200) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: id });
  element.dispatchEvent(event);
}

it('pinches, clamps, pans with the remaining finger and recovers from cancellation', () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<WorkspaceImagePreview src="/test.png" alt="Diagram" />));
    const stage = container.querySelector<HTMLElement>('.workspace-image-viewport')!;
    stage.setPointerCapture = vi.fn();
    stage.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, toJSON() {} });
    act(() => { pointer(stage, 'pointerdown', 1, 150); pointer(stage, 'pointerdown', 2, 250); pointer(stage, 'pointermove', 1, 100); pointer(stage, 'pointermove', 2, 300); });
    expect(container.textContent).toContain('200%');
    act(() => { pointer(stage, 'pointerup', 2, 300); pointer(stage, 'pointermove', 1, 120); });
    expect(container.querySelector('img')!.style.transform).toContain('translate3d(20px, 0px');
    act(() => { pointer(stage, 'pointerdown', 2, 300); pointer(stage, 'pointermove', 2, 2000); });
    expect(container.textContent).toContain('500%');
    act(() => { pointer(stage, 'pointercancel', 1, 120); pointer(stage, 'pointercancel', 2, 2000); });
    act(() => container.querySelector<HTMLButtonElement>('[title="Reset zoom"]')!.click());
    expect(container.textContent).toContain('100%');
    act(() => { pointer(stage, 'pointerdown', 3, 100); pointer(stage, 'pointerdown', 4, 300); pointer(stage, 'pointermove', 4, 105); });
    expect(container.textContent).toContain('50%');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('labels a fitted image with its real scale, not 100%', () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<WorkspaceImagePreview src="/wide.png" alt="Banner" />));
    const image = container.querySelector('img')!;
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 4000 });
    Object.defineProperty(image, 'offsetWidth', { configurable: true, value: 240 });
    act(() => { image.dispatchEvent(new Event('load')); });
    expect(container.textContent).toContain('Fit · 6%');
    expect(container.textContent).not.toContain('100%');
  } finally { act(() => root.unmount()); container.remove(); }
});

it('a pinch on the lightbox background does not dismiss it, while a fresh backdrop tap does', () => {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); const onClose = vi.fn();
  try {
    act(() => root.render(<GraphWorkspaceImageLightbox src="/test.png" alt="Chat attachment" onClose={onClose} />));
    const stage = document.querySelector<HTMLElement>('.thread-graph-image-lightbox-viewport')!;
    stage.setPointerCapture = vi.fn();
    act(() => { pointer(stage, 'pointerdown', 1, 50); pointer(stage, 'pointerdown', 2, 100); pointer(stage, 'pointermove', 2, 150); pointer(stage, 'pointerup', 1, 50); pointer(stage, 'pointerup', 2, 150); stage.click(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.thread-graph-image-lightbox-scale')!.textContent).toContain('200%');
    act(() => { pointer(stage.querySelector('img')!, 'pointerdown', 3, 50); pointer(stage, 'pointerup', 3, 50); stage.click(); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { pointer(stage, 'pointerdown', 3, 50); pointer(stage, 'pointerup', 3, 50); stage.click(); });
    expect(onClose).toHaveBeenCalledOnce();
  } finally { act(() => root.unmount()); container.remove(); }
});
