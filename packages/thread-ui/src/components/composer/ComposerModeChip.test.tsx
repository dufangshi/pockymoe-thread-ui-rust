// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposerModeChips } from './ComposerModeChip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement | null = null;
afterEach(() => { container?.remove(); container = null; });

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return container;
}

describe('ComposerModeChips', () => {
  it('shows nothing without a mode in force', () => {
    expect(render(<ComposerModeChips busy={false} />).textContent).toBe('');
  });

  it('shows a running goal with its objective, plan and fast, each with a way out', () => {
    const pause = vi.fn(), exitPlan = vi.fn(), exitFast = vi.fn(), open = vi.fn();
    const view = render(
      <ComposerModeChips busy={false} goal={{ objective: 'make the tests pass', onPause: pause, onOpen: open }}
        plan={{ onExit: exitPlan }} fast={{ onExit: exitFast }} />,
    );
    expect([...view.querySelectorAll('[data-mode]')].map((chip) => chip.getAttribute('data-mode'))).toEqual(['goal', 'plan', 'fast']);
    expect(view.textContent).toContain('make the tests pass');
    act(() => view.querySelector<HTMLButtonElement>('[aria-label="Pause goal"]')!.click());
    act(() => view.querySelector<HTMLButtonElement>('[aria-label="Exit plan mode"]')!.click());
    act(() => view.querySelector<HTMLButtonElement>('[aria-label="Turn off fast mode"]')!.click());
    act(() => view.querySelector<HTMLButtonElement>('.composer-mode-chip-open')!.click());
    expect([pause, exitPlan, exitFast, open].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });
});
