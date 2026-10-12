/**
 * @vitest-environment jsdom
 */
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentBackendToolboxItemSchemaDto,
  ThreadForkTurnOptionDto,
  ThreadHooksDto,
  ThreadMcpServersDto,
  ThreadSkillsDto,
} from '@pockymoe/shared';

import type { SlashPanelState, SlashPanelView } from './types';
import { ComposerSlashToolboxMenu } from './ComposerSlashToolboxMenu';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const toolboxItems: AgentBackendToolboxItemSchemaDto[] = [
  {
    action: 'fast',
    command: '/fast',
    label: 'Fast mode',
    description: 'Toggle fast mode',
  },
  {
    action: 'skills',
    command: '/skills',
    label: 'Skills',
    description: 'Show skills',
  },
];

const emptySkillsState: SlashPanelState<ThreadSkillsDto> = {
  status: 'ready',
  data: {
    cwd: '/repo',
    skills: [],
    errors: [],
  },
  error: null,
};

const skillsState: SlashPanelState<ThreadSkillsDto> = {
  status: 'ready',
  data: {
    cwd: '/repo',
    skills: [
      {
        name: 'review',
        path: '/skills/review',
        scope: 'repo',
        enabled: true,
        description: 'Review code',
        shortDescription: 'Review code',
        interface: {
          displayName: 'Review',
          shortDescription: 'Review code',
        },
      },
    ],
    errors: [],
  },
  error: null,
};

const mcpState: SlashPanelState<ThreadMcpServersDto> = {
  status: 'ready',
  data: {
    servers: [],
  },
  error: null,
};

const hooksState: SlashPanelState<ThreadHooksDto> = {
  status: 'ready',
  data: {
    cwd: '/repo',
    globalHooksPath: '/home/u/.codex/hooks.json',
    projectHooksPath: '/repo/.codex/hooks.json',
    hooks: [],
    warnings: [],
    errors: [],
  },
  error: null,
};

const forkTurnOptionsState: SlashPanelState<ThreadForkTurnOptionDto[]> = {
  status: 'ready',
  data: [],
  error: null,
};

function renderNode(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(node);
  });

  return container;
}

function renderMenu({
  open = true,
  initialView = 'root',
  items = toolboxItems,
  skills = emptySkillsState,
  onToggle = vi.fn(),
  onToolboxItemClick = vi.fn(),
  planModeAvailable = true,
  forkFromTurnAvailable = false,
  displayedCollaborationMode = 'default',
  settingsBusy = false,
  onUpdateSettings = vi.fn(),
  onOpenForkTurns = vi.fn(),
  onCopySkillInvokeName = vi.fn(),
}: {
  open?: boolean;
  initialView?: SlashPanelView;
  items?: AgentBackendToolboxItemSchemaDto[];
  skills?: SlashPanelState<ThreadSkillsDto>;
  onToggle?: () => void;
  onToolboxItemClick?: (
    item: AgentBackendToolboxItemSchemaDto,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  planModeAvailable?: boolean;
  forkFromTurnAvailable?: boolean;
  displayedCollaborationMode?: 'default' | 'plan';
  settingsBusy?: boolean;
  onUpdateSettings?: (input: {
    collaborationMode?: 'default' | 'plan';
  }) => void;
  onOpenForkTurns?: () => Promise<void> | void;
  onCopySkillInvokeName?: (skillName: string) => Promise<void> | void;
} = {}) {
  function Harness() {
    const [slashPanelView, setSlashPanelView] =
      useState<SlashPanelView>(initialView);

    return (
      <ComposerSlashToolboxMenu
        open={open}
        slashPanelView={slashPanelView}
        availableToolboxItems={items}
        planModeAvailable={planModeAvailable}
        forkFromTurnAvailable={forkFromTurnAvailable}
        displayedCollaborationMode={displayedCollaborationMode}
        settingsBusy={settingsBusy}
        busy={false}
        forkBusy={false}
        forkTurnOptionsState={forkTurnOptionsState}
        skillsState={skills}
        goalState={{ status: 'idle', data: null, error: null }}
        goalHistory={[]}
        goalBusy={false}
        copiedSkillName={null}
        hooksPanelMode="list"
        hooksState={hooksState}
        hostConfigFilesAvailable={false}
        hookTrustAvailable={false}
        hookConfigBusy={false}
        hookConfigError={null}
        hookConfigSuccess={null}
        editingHookTarget={null}
        hookScope="project"
        hookEventName="preToolUse"
        hookMatcher="Bash"
        hookCommand="echo ok"
        hookTimeoutSec="30"
        hookStatusMessage="Running hook"
        mcpPanelMode="list"
        mcpState={mcpState}
        mcpConfigEditing={false}
        mcpConfigPath={null}
        mcpConfigError={null}
        mcpConfigSuccess={null}
        mcpConfigBusy={false}
        mcpHttpName=""
        mcpHttpUrl=""
        mcpRawBlock=""
        iconButtonClassName="icon"
        menuClassName="menu"
        menuItemClassName="item"
        panelButtonClassName="panel"
        chipButtonClassName="chip"
        onToggle={onToggle}
        onToolboxItemClick={onToolboxItemClick}
        onUpdateSettings={onUpdateSettings}
        toolboxItemDisabled={(item) => item.action === 'fast'}
        toolboxItemClassName={(item) => `toolbox-${item.action}`}
        toolboxItemStatus={(item) => (item.action === 'fast' ? 'Off' : 'View')}
        onSetSlashPanelView={setSlashPanelView}
        onUpdateGoal={vi.fn()}
        onOpenForkTurns={onOpenForkTurns}
        onForkLatest={vi.fn()}
        onForkTurn={vi.fn()}
        onCopySkillInvokeName={onCopySkillInvokeName}
        onResetHookForm={vi.fn()}
        onSetHooksPanelMode={vi.fn()}
        onClearHookConfigStatus={vi.fn()}
        onSetEditingHookTarget={vi.fn()}
        onSetHookScope={vi.fn()}
        onSetHookEventName={vi.fn()}
        onSetHookMatcher={vi.fn()}
        onSetHookCommand={vi.fn()}
        onSetHookTimeoutSec={vi.fn()}
        onSetHookStatusMessage={vi.fn()}
        onSaveHook={vi.fn()}
        onStartEditingHook={vi.fn()}
        onTrustHook={vi.fn()}
        onUntrustHook={vi.fn()}
        onSetMcpPanelMode={vi.fn()}
        onClearMcpConfigStatus={vi.fn()}
        onSetMcpHttpName={vi.fn()}
        onSetMcpHttpUrl={vi.fn()}
        onSetMcpRawBlock={vi.fn()}
        onPrepareRawMcpBlock={vi.fn()}
        onSaveHttpMcp={vi.fn()}
        onSaveRawMcpBlock={vi.fn()}
      />
    );
  }

  return renderNode(<Harness />);
}

function buttonByText(view: HTMLElement, text: string) {
  return Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.includes(text),
  );
}

describe('ComposerSlashToolboxMenu', () => {
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

  it('renders a trigger and keeps the surface hidden while closed', () => {
    const onToggle = vi.fn();
    const view = renderMenu({ open: false, onToggle });

    expect(
      view.querySelector('[data-composer-menu-surface="true"]'),
    ).toBeNull();
    view
      .querySelector<HTMLButtonElement>('[aria-label="Open slash toolbox"]')
      ?.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders root toolbox items and forwards item clicks', () => {
    const onToolboxItemClick = vi.fn();
    const view = renderMenu({ onToolboxItemClick });

    expect(buttonByText(view, '/fast')?.disabled).toBe(true);
    buttonByText(view, '/skills')?.click();

    expect(onToolboxItemClick).toHaveBeenCalledTimes(1);
    expect(onToolboxItemClick.mock.calls[0]?.[0]).toMatchObject({
      action: 'skills',
      command: '/skills',
    });
  });

  it('toggles plan mode from the slash toolbox', () => {
    const onUpdateSettings = vi.fn();
    const view = renderMenu({ onUpdateSettings });
    const planButton = buttonByText(view, '/plan');

    expect(planButton?.getAttribute('aria-pressed')).toBe('false');
    planButton?.click();
    expect(onUpdateSettings).toHaveBeenCalledWith({
      collaborationMode: 'plan',
    });
  });

  it('shows active plan mode and can switch it off', () => {
    const onUpdateSettings = vi.fn();
    const view = renderMenu({
      displayedCollaborationMode: 'plan',
      onUpdateSettings,
    });
    const planButton = buttonByText(view, '/plan');

    expect(planButton?.getAttribute('aria-pressed')).toBe('true');
    expect(planButton?.textContent).toContain('On');
    planButton?.click();
    expect(onUpdateSettings).toHaveBeenCalledWith({
      collaborationMode: 'default',
    });
  });

  it('splits goal list navigation from opening the goal composer', () => {
    const goalItem: AgentBackendToolboxItemSchemaDto = {
      action: 'goal',
      command: '/goal',
      label: 'Goal',
      description: 'Manage goals',
    };
    const onToolboxItemClick = vi.fn();
    const view = renderMenu({ items: [goalItem], onToolboxItemClick });

    flushSync(() => {
      view
        .querySelector<HTMLButtonElement>('[aria-label="View goals"]')
        ?.click();
    });
    expect(view.textContent).toContain('No goals in this thread yet.');
    expect(onToolboxItemClick).not.toHaveBeenCalled();
  });

  it('opens goal compose mode only from the trailing Open action', () => {
    const goalItem: AgentBackendToolboxItemSchemaDto = {
      action: 'goal',
      command: '/goal',
      label: 'Goal',
      description: 'Manage goals',
    };
    const onToolboxItemClick = vi.fn();
    const view = renderMenu({ items: [goalItem], onToolboxItemClick });

    view
      .querySelector<HTMLButtonElement>('[aria-label="Open goal composer"]')
      ?.click();
    expect(onToolboxItemClick).toHaveBeenCalledTimes(1);
    expect(onToolboxItemClick.mock.calls[0]?.[0]).toMatchObject({
      action: 'goal',
    });
  });

  it('renders the empty root state', () => {
    const view = renderMenu({ items: [], planModeAvailable: false });

    expect(view.textContent).toContain(
      'No backend tools are available for this thread.',
    );
  });

  it('routes fork selection to the fork turn picker', () => {
    const onOpenForkTurns = vi.fn();
    const view = renderMenu({
      initialView: 'fork',
      forkFromTurnAvailable: true,
      onOpenForkTurns,
    });

    flushSync(() => {
      buttonByText(view, 'Fork from selected turn')?.click();
    });

    expect(onOpenForkTurns).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain('No turns available to fork yet.');
  });

  it('renders the skills panel and forwards copy actions', () => {
    const onCopySkillInvokeName = vi.fn();
    const view = renderMenu({
      initialView: 'skills',
      skills: skillsState,
      onCopySkillInvokeName,
    });

    view
      .querySelector<HTMLButtonElement>('[aria-label="Copy $review"]')
      ?.click();

    expect(view.textContent).toContain('Review');
    expect(onCopySkillInvokeName).toHaveBeenCalledWith('review');
  });
});

describe('ComposerSlashToolboxMenu theme flags', () => {
  afterEach(() => {
    if (root) flushSync(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    delete document.documentElement.dataset.themeFeatures;
  });

  it('renders icon rows and the slash glyph only with composer.richMenus', () => {
    const plain = renderMenu({});
    expect(plain.querySelector('.composer-toolbox-icon')).toBeNull();
    expect(plain.querySelector('.composer-slash-glyph')).toBeNull();
    flushSync(() => root?.unmount());
    container?.remove();
    document.documentElement.dataset.themeFeatures = 'composer.richMenus';
    const rich = renderMenu({});
    expect(rich.querySelector('.composer-slash-glyph')?.textContent).toBe('/');
    expect(rich.querySelectorAll('.composer-toolbox-icon').length).toBeGreaterThan(1);
    expect(rich.querySelector('.composer-toolbox-command')?.textContent).toBe('/plan');
  });
});
