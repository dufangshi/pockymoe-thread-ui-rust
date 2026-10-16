/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerJumpLatestButton } from './ComposerJumpLatestButton';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderButton({
  activeView,
  followTail = false,
  onToggleFollow = vi.fn(),
  canJumpToPreviousTurn = true,
  onJumpToPreviousTurn = vi.fn(),
  canJumpToNextTurn = true,
  onJumpToNextTurn = vi.fn(),
}: {
  activeView: 'chat' | 'shell';
  followTail?: boolean;
  onToggleFollow?: () => void;
  canJumpToPreviousTurn?: boolean;
  onJumpToPreviousTurn?: () => void;
  canJumpToNextTurn?: boolean;
  onJumpToNextTurn?: () => void;
}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(
      <ComposerJumpLatestButton
        activeView={activeView}
        followTail={followTail}
        onToggleFollow={onToggleFollow}
        canJumpToPreviousTurn={canJumpToPreviousTurn}
        onJumpToPreviousTurn={onJumpToPreviousTurn}
        canJumpToNextTurn={canJumpToNextTurn}
        onJumpToNextTurn={onJumpToNextTurn}
      />,
    );
  });

  return { view: container, onToggleFollow, onJumpToPreviousTurn, onJumpToNextTurn };
}

describe('ComposerJumpLatestButton', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it('names its glyphs with data-icon for theme packs', () => {
    const { view } = renderButton({ activeView: 'chat' });
    expect([...view.querySelectorAll('svg[data-icon]')].map((icon) => icon.getAttribute('data-icon')))
      .toEqual(['previous-turn', 'next-turn', 'latest']);
  });

  it('renders only in chat view and forwards clicks', () => {
    const { view, onToggleFollow } = renderButton({ activeView: 'chat' });
    const button = view.querySelector<HTMLButtonElement>(
      '[aria-label="Jump to latest"]',
    );

    expect(button).not.toBeNull();
    button?.click();
    expect(onToggleFollow).toHaveBeenCalledTimes(1);
  });

  it('is hidden in shell view', () => {
    const { view } = renderButton({ activeView: 'shell' });

    expect(view.querySelector('[aria-label="Jump to latest"]')).toBeNull();
  });

  it('marks the navigation as following the tail', () => {
    const { view } = renderButton({ activeView: 'chat', followTail: true });
    expect(view.querySelector('[aria-label="Timeline navigation"]')?.hasAttribute('data-following')).toBe(true);

    renderButton({ activeView: 'chat', followTail: false });
    expect(container?.querySelector('[aria-label="Timeline navigation"]')?.hasAttribute('data-following')).toBe(false);
  });

  it('groups previous, next and latest in one strip without usage', () => {
    const { view } = renderButton({ activeView: 'chat' });
    const nav = view.querySelector('[aria-label="Timeline navigation"]')!;
    expect([...nav.querySelectorAll('button')].map(button => button.getAttribute('aria-label')))
      .toEqual(['Jump to previous turn', 'Jump to next turn', 'Jump to latest']);
    expect(view.querySelector('.thread-subscription-usage')).toBeNull();
  });

  it('jumps to the next turn and disables that segment at the last turn', () => {
    const { view, onJumpToNextTurn } = renderButton({ activeView: 'chat' });
    const next = view.querySelector<HTMLButtonElement>('[aria-label="Jump to next turn"]');
    next?.click();
    expect(onJumpToNextTurn).toHaveBeenCalledTimes(1);

    renderButton({ activeView: 'chat', canJumpToNextTurn: false });
    expect(
      container?.querySelector<HTMLButtonElement>('[aria-label="Jump to next turn"]')?.disabled,
    ).toBe(true);
  });

  it('jumps to the previous turn and disables that segment at the first turn', () => {
    const { view, onJumpToPreviousTurn } = renderButton({ activeView: 'chat' });
    const previous = view.querySelector<HTMLButtonElement>('[aria-label="Jump to previous turn"]');
    previous?.click();
    expect(onJumpToPreviousTurn).toHaveBeenCalledTimes(1);

    renderButton({ activeView: 'chat', canJumpToPreviousTurn: false });
    expect(
      container?.querySelector<HTMLButtonElement>('[aria-label="Jump to previous turn"]')?.disabled,
    ).toBe(true);
  });
});
