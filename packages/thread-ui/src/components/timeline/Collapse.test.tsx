/** @vitest-environment jsdom */
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from './Collapse';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;

function Probe({ open, text, onLayout }: { open: boolean; text: string; onLayout?: (text: string | null) => void }) {
  useLayoutEffect(() => onLayout?.(container.textContent), [open, text, onLayout]);
  return <Collapse open={open}><p>{text}</p></Collapse>;
}

async function render(open: boolean, text = 'last content', onLayout?: (text: string | null) => void) {
  if (!root) {
    container = document.createElement('div');
    root = createRoot(container);
  }
  await act(async () => root!.render(<Probe open={open} text={text} {...(onLayout ? { onLayout } : {})} />));
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Collapse', () => {
  it.each(['no matchMedia', 'reduced motion'])('switches immediately with %s', async (mode) => {
    vi.stubGlobal('matchMedia', mode === 'reduced motion' ? vi.fn(() => ({ matches: true })) : undefined);
    const onLayout = vi.fn();
    await render(false, 'last content', onLayout);
    expect(container.innerHTML).toBe('');
    await render(true, 'last content', onLayout);
    expect(onLayout).toHaveBeenLastCalledWith('last content');
    expect(container.querySelector('.tlog-collapse')?.getAttribute('data-state')).toBe('open');
    expect(container.querySelector('[data-settled="true"]')).not.toBeNull();
    await render(false, 'replacement', onLayout);
    expect(onLayout).toHaveBeenLastCalledWith('');
    expect(container.innerHTML).toBe('');
  });

  it('keeps the last content for 260ms while closing and settles only after opening finishes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
    await render(true);
    await render(false, 'replacement');
    expect(container.textContent).toBe('last content');
    expect(container.querySelector('.tlog-collapse')?.getAttribute('data-state')).toBe('closed');
    expect(container.querySelector('[data-settled]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(259));
    expect(container.textContent).toBe('last content');
    await act(async () => vi.advanceTimersByTime(1));
    expect(container.innerHTML).toBe('');
    await render(true, 'new content');
    expect(container.querySelector('.tlog-collapse')?.getAttribute('data-state')).toBe('closed');
    expect(container.querySelector('[data-settled]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(32));
    expect(container.querySelector('.tlog-collapse')?.getAttribute('data-state')).toBe('open');
    expect(container.querySelector('[data-settled]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(267));
    expect(container.querySelector('[data-settled]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-settled="true"]')?.textContent).toBe('new content');
  });
});
