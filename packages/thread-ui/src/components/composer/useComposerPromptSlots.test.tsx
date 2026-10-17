/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useComposerPromptSlots,
  type UseComposerPromptSlotsInput,
} from './useComposerPromptSlots';

let cleanup: (() => void) | null = null;

function baseInput(
  overrides: Partial<UseComposerPromptSlotsInput> = {},
): UseComposerPromptSlotsInput {
  return {
    isShellView: false,
    promptRef: createRef<HTMLDivElement>(),
    prompt: '',
    disabled: false,
    promptPlaceholder: 'Ask Codex',
    canInterrupt: false,
    interruptLabel: 'Stop',
    composerPromptRegionClassName: 'prompt-region',
    graphChatInputClassName: 'chat-input',
    promptInputClassName: 'shell-input',
    goalComposeMode: false,
    goalTokenBudget: '',
    goalLocalError: null,
    goalBusy: false,
    busy: false,
    sendButtonLabel: 'Send',
    sendButtonClassName: 'send-button',
    onInterrupt: vi.fn(),
    onPromptInput: vi.fn(),
    onPromptPaste: vi.fn(),
    onPromptKeyDown: vi.fn(),
    onPromptKeyUp: vi.fn(),
    onPromptMouseUp: vi.fn(),
    onPromptBlur: vi.fn(),
    onPromptDragEnter: vi.fn(),
    onPromptDragOver: vi.fn(),
    onPromptDragLeave: vi.fn(),
    onPromptDrop: vi.fn(),
    onGoalTokenBudgetChange: vi.fn(),
    onCancelGoal: vi.fn(),
    onShellPromptChange: vi.fn(),
    ...overrides,
  };
}

function PromptSlotsProbe(input: UseComposerPromptSlotsInput) {
  const slots = useComposerPromptSlots(input);

  return (
    <>
      {slots.promptSlot}
      {slots.goalSlot}
      {slots.shellPromptSlot}
    </>
  );
}

function render(input: UseComposerPromptSlotsInput) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<PromptSlotsProbe {...input} />);
  });
  cleanup = () => {
    flushSync(() => {
      root.unmount();
    });
    container.remove();
  };

  return container;
}

function renderNode(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<>{node}</>);
  });
  cleanup = () => {
    flushSync(() => {
      root.unmount();
    });
    container.remove();
  };

  return container;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
});

describe('useComposerPromptSlots', () => {
  it('renders chat prompt and goal slots outside shell view', () => {
    const input = baseInput({
      goalComposeMode: true,
      goalTokenBudget: '50',
      goalLocalError: 'Too low',
    });
    const container = render(input);

    expect(container.querySelector('[role="textbox"]')).toBeTruthy();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).toContain('Ask Codex');
    expect(container.textContent).toContain('Too low');

    container.querySelector('[role="textbox"]')?.dispatchEvent(
      new InputEvent('input', { bubbles: true }),
    );
    expect(input.onPromptInput).toHaveBeenCalledTimes(1);

    container.querySelector('button[type="button"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(input.onCancelGoal).toHaveBeenCalledTimes(1);
  });

  it('renders shell prompt slot and forwards shell input changes', () => {
    const input = baseInput({
      isShellView: true,
      prompt: 'pwd',
      canInterrupt: true,
      goalBusy: true,
    });
    const container = render(input);
    const textarea = container.querySelector('textarea');
    const sendButton = container.querySelector(
      'button[aria-label="Send Shell Input"]',
    );

    expect(container.querySelector('[role="textbox"]')).toBeNull();
    expect(textarea?.value).toBe('pwd');
    expect(sendButton?.hasAttribute('disabled')).toBe(true);

    if (!textarea) {
      throw new Error('Missing shell prompt textarea');
    }
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    valueSetter?.call(textarea, 'ls');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    expect(input.onShellPromptChange).toHaveBeenCalledWith('ls');

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      }),
    );
    expect(input.onPromptKeyDown).toHaveBeenCalledTimes(1);
  });

  it('returns null slots for inactive surfaces', () => {
    expect(useComposerPromptSlots(baseInput()).shellPromptSlot).toBeNull();
    expect(
      useComposerPromptSlots(baseInput({ isShellView: true })).promptSlot,
    ).toBeNull();
    expect(
      useComposerPromptSlots(baseInput({ isShellView: true })).goalSlot,
    ).toBeNull();
  });

  it('allows rendering an individual returned slot', () => {
    const { promptSlot } = useComposerPromptSlots(
      baseInput({ prompt: 'hello' }),
    );
    const container = renderNode(promptSlot);

    expect(container.querySelector('[role="textbox"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Ask Codex');
  });

  it('shows plan mode above the prompt with a way out', () => {
    const onExitPlanMode = vi.fn();
    const container = render(baseInput({ planMode: true, onExitPlanMode }));
    expect(container.querySelector('.composer-mode-chip')?.textContent).toContain('Plan mode');
    flushSync(() => container.querySelector<HTMLButtonElement>('[aria-label="Exit plan mode"]')!.click());
    expect(onExitPlanMode).toHaveBeenCalledOnce();
  });

  it('adds the send shortcut after the placeholder', () => {
    const container = render(baseInput({ promptPlaceholder: 'Message', promptPlaceholderHint: ' · Ctrl+Enter to send' }));
    expect(container.querySelector('.thread-composer-placeholder-hint')?.textContent).toBe(' · Ctrl+Enter to send');
  });
});
