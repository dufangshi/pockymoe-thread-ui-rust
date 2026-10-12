/**
 * @vitest-environment jsdom
 */
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ModelOptionDto,
  ReasoningEffortDto,
  SandboxModeDto,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';

import type { SettingsMenu } from './types';
import { ComposerSettingsToolbar } from './ComposerSettingsToolbar';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const modelOptions: ModelOptionDto[] = [
  {
    id: 'gpt-5',
    model: 'gpt-5',
    displayName: 'GPT-5',
    description: '',
    isDefault: true,
    hidden: false,
    supportedReasoningEfforts: [
      { reasoningEffort: 'low', description: '' },
      { reasoningEffort: 'medium', description: '' },
    ],
    defaultReasoningEffort: 'medium',
  },
  {
    id: 'gpt-5-mini',
    model: 'gpt-5-mini',
    displayName: 'GPT-5 mini',
    description: '',
    isDefault: false,
    hidden: false,
    supportedReasoningEfforts: [
      { reasoningEffort: 'minimal', description: '' },
    ],
    defaultReasoningEffort: 'minimal',
  },
];

function renderNode(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(node);
  });

  return container;
}

function renderToolbar({
  initialOpenMenu = null,
  reasoningEffort = 'medium',
  disabled = false,
  goalBusy = false,
  activeView = 'chat',
  sandboxMode = 'workspace-write',
  sandboxModeAvailable = true,
  supportedEfforts = modelOptions[0]?.supportedReasoningEfforts ?? [],
  effortControlsDisabled = false,
  effortControlTitle = 'Select reasoning effort',
  onUpdateSettings = vi.fn(),
  model = 'gpt-5',
  availableModels = modelOptions,
  agent,
  queueing = false,
}: {
  initialOpenMenu?: SettingsMenu;
  reasoningEffort?: ReasoningEffortDto | null;
  disabled?: boolean;
  goalBusy?: boolean;
  activeView?: 'chat' | 'shell';
  sandboxMode?: SandboxModeDto | null;
  sandboxModeAvailable?: boolean;
  supportedEfforts?: ModelOptionDto['supportedReasoningEfforts'];
  effortControlsDisabled?: boolean;
  effortControlTitle?: string;
  onUpdateSettings?: (input: UpdateThreadSettingsInput) => void;
  model?: string;
  availableModels?: ModelOptionDto[];
  agent?: string;
  queueing?: boolean;
} = {}) {
  function Harness() {
    const [openMenu, setOpenMenu] = useState<SettingsMenu>(initialOpenMenu);

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <ComposerSettingsToolbar
          openMenu={openMenu}
          model={model}
          agent={agent}
          queueing={queueing}
          modelOptions={availableModels}
          modelContextTitle="1k / 8k tokens"
          contextUsage={null}
          reasoningEffort={reasoningEffort}
          supportedEfforts={supportedEfforts}
          sandboxMode={sandboxMode}
          sandboxModeAvailable={sandboxModeAvailable}
          settingsBusy={false}
          goalComposeMode={false}
          goalBusy={goalBusy}
          activeView={activeView}
          disabled={disabled}
          fastMode={false}
          sendButtonLabel="Send"
          sendButtonClassName="send-state"
          modelControlsDisabled={false}
          effortControlsDisabled={effortControlsDisabled}
          effortControlTitle={effortControlTitle}
          inlineToggleClassName="inline-toggle"
          menuItemClassName="menu-item"
          sendButtonBaseClassName="send-base"
          onSetOpenMenu={setOpenMenu}
          onUpdateSettings={onUpdateSettings}
        />
      </form>
    );
  }

  return renderNode(<Harness />);
}

function buttonByText(view: HTMLElement, text: string) {
  return Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes(text),
  );
}

describe('ComposerSettingsToolbar', () => {
  it('adds the mascot, chevron and per-intent send icon only for Plum Pocket', () => {
    const classic = renderToolbar({ agent: 'claude', queueing: true });
    expect(classic.querySelector('.composer-model-avatar')).toBeNull();
    expect(classic.querySelector('.composer-model-chevron')).toBeNull();
    expect(classic.querySelector('.send-base path')?.getAttribute('d')).toBe('M8 13V3');
    // Classic keeps its label while a turn runs.
    expect(classic.querySelector('.send-base')?.getAttribute('aria-label')).toBe('Send Prompt');
    act(() => root?.unmount());
    container?.remove();

    document.documentElement.dataset.themeFeatures = 'composer.modelAvatar composer.intentIcons';
    const plum = renderToolbar({ agent: 'claude', queueing: true });
    expect(plum.querySelector('.composer-model-avatar')?.getAttribute('data-agent')).toBe('claude');
    expect(plum.querySelector('.composer-model-chevron')).not.toBeNull();
    const sendLater = plum.querySelector('.send-base');
    expect(sendLater?.querySelector('.composer-send-later')).not.toBeNull();
    expect(sendLater?.getAttribute('data-send-intent')).toBe('queue');
    expect(sendLater?.getAttribute('aria-label')).toBe('Send after this turn');
    expect(sendLater?.getAttribute('title')).toBe('Send after this turn');
    act(() => root?.unmount());
    container?.remove();

    const idle = renderToolbar({ agent: 'claude' });
    expect(idle.querySelector('.send-base .composer-send-plane')).not.toBeNull();
  });


  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    delete document.documentElement.dataset.themeFeatures;
    if (root) act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.unstubAllGlobals();
  });

  it('preserves the full model name in a clickable label with effort and context in its title', () => {
    const view = renderToolbar({
      model: 'opus[1m]',
      availableModels: [
        {
          ...modelOptions[0]!,
          model: 'opus[1m]',
          displayName: 'Opus · 5 (1M context)',
        },
      ],
    });
    const label = view.querySelector('[data-testid="composer-model-label"]');
    expect(label?.querySelector('.composer-model-name')?.textContent).toBe(
      'Opus · 5 (1M context)',
    );
    expect(label?.querySelector('.composer-model-effort')?.textContent).toBe(
      'medium',
    );
    expect(label?.getAttribute('title')).toContain('medium');
    expect(label?.getAttribute('title')).toContain('1k / 8k tokens');
    expect(label?.closest('button')?.getAttribute('type')).toBe('button');
    expect(label?.getAttribute('tabindex')).toBeNull();
  });

  it('selects models and effort without restoring the separate permission control', () => {
    const onUpdateSettings = vi.fn();
    const view = renderToolbar({ initialOpenMenu: 'model', onUpdateSettings });
    expect(view.querySelector('[data-composer-menu-trigger]')).not.toBeNull();
    expect(view.querySelector('[data-composer-menu-surface]')).not.toBeNull();
    expect(view.querySelector('.composer-sandbox-control')).toBeNull();
    act(() => buttonByText(view, 'GPT-5 mini')!.click());
    expect(onUpdateSettings).toHaveBeenCalledWith({
      model: 'gpt-5-mini',
      reasoningEffort: 'minimal',
    });
    act(() => buttonByText(view, 'low')!.click());
    expect(onUpdateSettings).toHaveBeenCalledWith({ reasoningEffort: 'low' });
    expect(buttonByText(view, 'Plan')).toBeUndefined();
  });

  it('keeps the chat send button disabled when composer input is disabled', () => {
    const view = renderToolbar({ disabled: true });

    expect(
      view.querySelector<HTMLButtonElement>('[aria-label="Send Prompt"]')
        ?.disabled,
    ).toBe(true);
  });

  it('does not disable the shell send button from chat prompt disabled state', () => {
    const view = renderToolbar({ activeView: 'shell', disabled: true });

    expect(
      view.querySelector<HTMLButtonElement>('[aria-label="Send Prompt"]')
        ?.disabled,
    ).toBe(false);
  });
});
