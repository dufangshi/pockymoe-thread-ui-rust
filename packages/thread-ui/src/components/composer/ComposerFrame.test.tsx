/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerFrame, type ComposerFrameProps } from './ComposerFrame';

let cleanup: (() => void) | null = null;

function baseProps(): ComposerFrameProps {
  return {
    activeView: 'chat',
    layerClassName: 'layer',
    formClassName: 'form',
    shellClassName: 'shell',
    inputGroupClassName: 'group',
    error: null,
    followTail: false,
    photoInputRef: { current: null },
    fileInputRef: { current: null },
    onAppendAttachments: vi.fn(),
    onToggleFollow: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    formRef: { current: null },
    promptSlot: <div data-slot="prompt">Prompt</div>,
    toolbarSlot: <div data-slot="toolbar">Toolbar</div>,
    goalSlot: null,
    shellPromptSlot: null,
  };
}

function renderFrame(props: ComposerFrameProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<ComposerFrame {...props} />);
  });
  cleanup = () => {
    flushSync(() => {
      root.unmount();
    });
    container.remove();
  };
  return container;
}

describe('ComposerFrame', () => {
  beforeEach(() => {
    cleanup = null;
  });

  afterEach(() => {
    delete document.documentElement.dataset.themePreset;
    cleanup?.();
    cleanup = null;
    vi.restoreAllMocks();
  });

  it('renders chat form slots and the jump-to-latest control', () => {
    const props = baseProps();
    const container = renderFrame(props);

    expect(container.querySelector('[data-testid="chat-composer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="prompt"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="toolbar"]')).toBeTruthy();

    const jumpButton = Array.from(container.querySelectorAll('button')).find(
      (entry) => entry.getAttribute('aria-label') === 'Jump to latest',
    );
    expect(jumpButton).toBeTruthy();
    jumpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(props.onToggleFollow).toHaveBeenCalledTimes(1);
  });

  it('renders error, goal, and shell prompt slots', () => {
    const container = renderFrame({
      ...baseProps(),
      activeView: 'shell',
      error: 'failed',
      goalSlot: <div data-slot="goal">Goal</div>,
      shellPromptSlot: <div data-slot="shell-prompt">Shell</div>,
    });

    expect(container.querySelector('[data-testid="chat-composer"]')).toBeNull();
    expect(container.textContent).toContain('failed');
    expect(container.querySelector('[data-slot="goal"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="shell-prompt"]')).toBeTruthy();
  });

  it.each(['classic', 'plum-pocket'])('anchors usage to the shell in %s without a footer row', (preset) => {
    const subscriptionUsage = {
      provider: 'claude' as const,
      authKind: 'subscription' as const,
      observedAt: new Date().toISOString(),
      stale: false,
      windows: [{ id: '5h', durationMinutes: 300, label: '5h', usedPercent: 10, resetsAt: null }],
    };
    document.documentElement.dataset.themePreset = preset;
    const container = renderFrame({ ...baseProps(), subscriptionUsage });
    expect(container.querySelector('.shell .thread-composer-usage-tag .thread-subscription-usage')).toBeTruthy();
    expect(container.querySelector('.thread-composer-usage-footer')).toBeNull();
  });
});
