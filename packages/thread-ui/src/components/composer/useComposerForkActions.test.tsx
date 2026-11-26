/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useComposerForkActions,
  type UseComposerForkActionsInput,
  type UseComposerForkActionsResult,
} from './useComposerForkActions';

let latestResult: UseComposerForkActionsResult | null = null;

function HookHarness(props: UseComposerForkActionsInput) {
  latestResult = useComposerForkActions(props);
  return null;
}

function renderHookHarness(
  input: Partial<UseComposerForkActionsInput> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const closeMenu = input.closeMenu ?? vi.fn();
  const props: UseComposerForkActionsInput = {
    slashPanelView: 'forkTurns',
    closeMenu,
    ...input,
  };

  flushSync(() => {
    root.render(<HookHarness {...props} />);
  });

  return {
    closeMenu,
    rerender(nextInput: Partial<UseComposerForkActionsInput>) {
      Object.assign(props, nextInput);
      flushSync(() => {
        root.render(<HookHarness {...props} />);
      });
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function runForkAction(action: () => Promise<void> | undefined) {
  let actionPromise: Promise<void> | undefined;
  flushSync(() => {
    actionPromise = action();
  });

  expect(latestResult?.forkBusy).toBe(true);
  await actionPromise;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  flushSync(() => {});
}

async function flushEffects() {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  flushSync(() => {});
}

describe('useComposerForkActions', () => {
  beforeEach(() => {
    latestResult = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestResult = null;
    vi.restoreAllMocks();
  });

  it('explains when no fork handler is available', async () => {
    const harness = renderHookHarness();

    await latestResult?.forkLatest();
    await flushEffects();

    expect(latestResult?.forkBusy).toBe(false);
    expect(harness.closeMenu).not.toHaveBeenCalled();
    expect(latestResult?.forkError).toContain('Fork is unavailable');
    harness.unmount();
  });

  it('sets busy, forks latest, closes the menu, and clears busy', async () => {
    const onForkLatest = vi.fn();
    const harness = renderHookHarness({ onForkLatest });

    await runForkAction(() => latestResult?.forkLatest());

    expect(onForkLatest).toHaveBeenCalledTimes(1);
    expect(harness.closeMenu).toHaveBeenCalledTimes(1);
    expect(latestResult?.forkBusy).toBe(false);
    harness.unmount();
  });

  it('sets busy, forks a selected turn, closes the menu, and clears busy', async () => {
    const onForkTurn = vi.fn();
    const harness = renderHookHarness({ onForkTurn });

    await runForkAction(() => latestResult?.forkTurn('turn-1'));

    expect(onForkTurn).toHaveBeenCalledWith('turn-1');
    expect(harness.closeMenu).toHaveBeenCalledTimes(1);
    expect(latestResult?.forkBusy).toBe(false);
    harness.unmount();
  });

  it('keeps the menu open but clears busy when fork latest fails', async () => {
    const onForkLatest = vi.fn(async () => {
      throw new Error('fork failed');
    });
    const harness = renderHookHarness({ onForkLatest });

    await runForkAction(() => latestResult?.forkLatest());
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    flushSync(() => {});

    expect(harness.closeMenu).not.toHaveBeenCalled();
    expect(latestResult?.forkBusy).toBe(false);
    expect(latestResult?.forkError).toBe('fork failed');
    harness.unmount();
  });

  it('keeps the operation busy across panel navigation and prevents duplicate forks', async () => {
    let resolveFork: undefined | (() => void);
    const onForkTurn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFork = resolve;
        }),
    );
    const harness = renderHookHarness({
      slashPanelView: 'forkTurns',
      onForkTurn,
    });

    let actionPromise: Promise<void> | undefined;
    flushSync(() => {
      actionPromise = latestResult?.forkTurn('turn-1');
    });
    expect(latestResult?.forkBusy).toBe(true);

    harness.rerender({ slashPanelView: 'root' });
    await flushEffects();
    expect(latestResult?.forkBusy).toBe(true);
    await latestResult?.forkTurn('turn-1');
    expect(onForkTurn).toHaveBeenCalledTimes(1);

    if (resolveFork) {
      resolveFork();
    }
    await actionPromise;
    harness.unmount();
  });

  it('forks into the agent chosen in the fork panel, and only there', async () => {
    const onForkLatest = vi.fn();
    const onForkTurn = vi.fn();
    const fork = vi.fn(async () => {});
    const switching = {
      currentAgentId: 'codex',
      agents: [{ id: 'codex', name: 'Codex' }, { id: 'claude', name: 'Claude Agent' }],
      loadModels: vi.fn(), preview: vi.fn(), switchTo: vi.fn(), fork,
    };
    const harness = renderHookHarness({ slashPanelView: 'fork', onForkLatest, onForkTurn, switching });
    expect(latestResult?.forkAgentId).toBe('codex');
    await runForkAction(() => latestResult?.forkLatest());
    expect(onForkLatest).toHaveBeenCalledTimes(1);

    flushSync(() => latestResult?.setForkAgentId('claude'));
    expect(latestResult?.forkAgentId).toBe('claude');
    await runForkAction(() => latestResult?.forkLatest());
    expect(fork).toHaveBeenLastCalledWith({ agentId: 'claude', turnId: null });
    await runForkAction(() => latestResult?.forkTurn('turn-2'));
    expect(fork).toHaveBeenLastCalledWith({ agentId: 'claude', turnId: 'turn-2' });
    expect(onForkLatest).toHaveBeenCalledTimes(1);
    expect(onForkTurn).not.toHaveBeenCalled();

    // Leaving the fork panels forgets the choice.
    harness.rerender({ slashPanelView: 'root' });
    await flushEffects();
    expect(latestResult?.forkAgentId).toBe('codex');

    // Without a native fork, the current agent is not offered.
    harness.rerender({ slashPanelView: 'fork', nativeFork: false });
    await flushEffects();
    expect(latestResult?.forkAgentId).toBe('claude');
    harness.unmount();
  });
});
