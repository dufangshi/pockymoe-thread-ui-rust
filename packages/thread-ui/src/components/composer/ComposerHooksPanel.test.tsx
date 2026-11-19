/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentHookDto, ThreadHooksDto } from '@pockymoe/shared';
import { ComposerHooksPanel } from './ComposerHooksPanel';
import type { HooksPanelMode } from './types';

// The panel's own buttons, not the copy and expand buttons of its path chips.
const panelButtons = (view: Element) =>
  Array.from(view.querySelectorAll<HTMLButtonElement>('button')).filter((button) => !button.closest('.path-chip'));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderNode(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(node);
  });

  return container;
}

function hook(overrides: Partial<AgentHookDto> = {}): AgentHookDto {
  return {
    key: 'project:PreToolUse:Bash',
    source: 'project',
    sourcePath: '/repo/.codex/hooks.json',
    eventName: 'preToolUse',
    matcher: 'Bash',
    handlerType: 'command',
    command: 'echo ok',
    timeoutSec: 30,
    statusMessage: 'Checking',
    pluginId: null,
    displayOrder: 0,
    enabled: true,
    isManaged: false,
    trustStatus: 'trusted',
    currentHash: 'hash',
    ...overrides,
  };
}

function hooksData(overrides: Partial<ThreadHooksDto> = {}): ThreadHooksDto {
  return {
    cwd: '/repo',
    globalHooksPath: '/home/u/.codex/hooks.json',
    projectHooksPath: '/repo/.codex/hooks.json',
    hooks: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<Parameters<typeof ComposerHooksPanel>[0]> = {},
) {
  return {
    hooksPanelMode: 'list' as HooksPanelMode,
    hooksState: {
      status: 'ready' as const,
      error: null,
      data: hooksData(),
    },
    hostConfigFilesAvailable: true,
    hookTrustAvailable: true,
    hookConfigBusy: false,
    hookConfigError: null,
    hookConfigSuccess: null,
    editingHookTarget: null,
    hookScope: 'project' as const,
    hookEventName: 'preToolUse' as const,
    hookMatcher: 'Bash',
    hookCommand: 'echo ok',
    hookTimeoutSec: '30',
    hookStatusMessage: 'Checking',
    composerChipButtonClassName: 'chip',
    onResetHookForm: vi.fn(),
    onSetHooksPanelMode: vi.fn(),
    onClearHookConfigStatus: vi.fn(),
    onSetEditingHookTarget: vi.fn(),
    onSetHookScope: vi.fn(),
    onSetHookEventName: vi.fn(),
    onSetHookMatcher: vi.fn(),
    onSetHookCommand: vi.fn(),
    onSetHookTimeoutSec: vi.fn(),
    onSetHookStatusMessage: vi.fn(),
    onSaveHook: vi.fn(),
    onStartEditingHook: vi.fn(),
    onTrustHook: vi.fn(),
    onUntrustHook: vi.fn(),
    ...overrides,
  };
}

describe('ComposerHooksPanel', () => {
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

  it('renders hook list and invokes edit/trust actions', () => {
    const editable = hook();
    const untrusted = hook({
      key: 'project:PostToolUse:Bash',
      eventName: 'postToolUse',
      trustStatus: 'untrusted',
    });
    const onStartEditingHook = vi.fn();
    const onUntrustHook = vi.fn();
    const onTrustHook = vi.fn();
    const view = renderNode(
      <ComposerHooksPanel
        {...baseProps({
          onStartEditingHook,
          onUntrustHook,
          onTrustHook,
          hooksState: {
            status: 'ready',
            error: null,
            data: hooksData({
              hooks: [editable, untrusted],
              warnings: ['Project hooks are experimental'],
              errors: [
                {
                  path: '/broken/hooks.json',
                  message: 'Invalid hook config',
                },
              ],
            }),
          },
        })}
      />,
    );

    expect(view.textContent).toContain('Before a tool runs · Bash');
    expect(view.textContent).toContain('After a tool runs · Bash');
    expect(view.textContent).toContain('Project hooks are experimental');
    expect(view.textContent).toContain('Invalid hook config');

    const buttons = panelButtons(view);
    buttons.find((button) => button.textContent === 'Edit')?.click();
    buttons.find((button) => button.textContent === 'Untrust')?.click();
    buttons.find((button) => button.textContent === 'Trust')?.click();

    expect(onStartEditingHook).toHaveBeenCalledWith(editable);
    expect(onUntrustHook).toHaveBeenCalledWith(editable);
    expect(onTrustHook).toHaveBeenCalledWith(untrusted);
  });

  it('opens add mode from list state', () => {
    const onResetHookForm = vi.fn();
    const onSetHooksPanelMode = vi.fn();
    const onClearHookConfigStatus = vi.fn();
    const view = renderNode(
      <ComposerHooksPanel
        {...baseProps({
          onResetHookForm,
          onSetHooksPanelMode,
          onClearHookConfigStatus,
        })}
      />,
    );

    panelButtons(view)[0]?.click();

    expect(onResetHookForm).toHaveBeenCalledTimes(1);
    expect(onSetHooksPanelMode).toHaveBeenCalledWith('add');
    expect(onClearHookConfigStatus).toHaveBeenCalledTimes(1);
  });

  it('renders add form and saves hook', () => {
    const onSaveHook = vi.fn();
    const view = renderNode(
      <ComposerHooksPanel
        {...baseProps({
          hooksPanelMode: 'add',
          onSaveHook,
        })}
      />,
    );

    expect(view.textContent).toContain('Scope');
    expect(view.textContent).toContain('Command');
    expect(view.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'echo ok',
    );

    panelButtons(view)
      .find((button) => button.textContent === 'Write Hook')
      ?.click();

    expect(onSaveHook).toHaveBeenCalledTimes(1);
  });

  it('renders edit form and clears edit target on back', () => {
    const onSetHooksPanelMode = vi.fn();
    const onSetEditingHookTarget = vi.fn();
    const view = renderNode(
      <ComposerHooksPanel
        {...baseProps({
          hooksPanelMode: 'edit',
          editingHookTarget: {
            scope: 'global',
            eventName: 'preToolUse',
            matcher: 'Bash',
            command: 'echo ok',
          },
          onSetHooksPanelMode,
          onSetEditingHookTarget,
        })}
      />,
    );

    expect(view.textContent).toContain('Editing PreToolUse in global hooks.json');

    panelButtons(view)
      .find((button) => button.textContent === 'Back')
      ?.click();

    expect(onSetHooksPanelMode).toHaveBeenCalledWith('list');
    expect(onSetEditingHookTarget).toHaveBeenCalledWith(null);
  });
});
