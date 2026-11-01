import { describe, expect, it, vi } from 'vitest';

import {
  useComposerToolbarProps,
  type UseComposerToolbarPropsInput,
} from './useComposerToolbarProps';

function input(
  overrides: Partial<UseComposerToolbarPropsInput> = {},
): UseComposerToolbarPropsInput {
  return {
    isShellView: false,
    canToggleShellView: true,
    isMobileShell: false,
    shellPromptLabel: null,
    openMenu: null,
    toolbarClassName: 'toolbar',
    iconButtonClassName: 'icon',
    menuClassName: 'menu',
    menuItemClassName: 'item',
    panelButtonClassName: 'panel',
    chipButtonClassName: 'chip',
    inlineToggleClassName: 'inline',
    sendButtonBaseClassName: 'send',
    slashPanelView: 'root',
    availableToolboxItems: [],
    busy: false,
    settingsBusy: false,
    compactBusy: false,
    forkBusy: false,
    fastMode: false,
    goalComposeMode: false,
    goalBusy: false,
    goalStatus: undefined,
    activeView: 'chat',
    disabled: false,
    model: 'model-a',
    modelOptions: [],
    contextUsage: null,
    reasoningEffort: null,
    supportedEfforts: [],
    displayedCollaborationMode: 'default',
    sandboxMode: 'workspace-write',
    sendButtonLabel: 'Send',
    sendButtonClassName: 'send-class',
    modelControlsDisabled: false,
    effortControlsDisabled: false,
    effortControlTitle: 'Effort',
    forkTurnOptionsState: { status: 'idle', data: null, error: null },
    skillsState: { status: 'idle', data: null, error: null },
    goalState: { status: 'idle', data: null, error: null },
    goalHistory: [],
    copiedSkillName: null,
    hooksPanelMode: 'list',
    hooksState: { status: 'idle', data: null, error: null },
    hookConfigBusy: false,
    hookConfigError: null,
    hookConfigSuccess: null,
    editingHookTarget: null,
    hookScope: 'project',
    hookEventName: 'preToolUse',
    hookMatcher: 'Bash',
    hookCommand: 'echo ok',
    hookTimeoutSec: '30',
    hookStatusMessage: '',
    mcpPanelMode: 'list',
    mcpState: { status: 'idle', data: null, error: null },
    mcpConfigPath: null,
    mcpConfigError: null,
    mcpConfigSuccess: null,
    mcpConfigBusy: false,
    mcpHttpName: '',
    mcpHttpUrl: '',
    mcpRawBlock: '',
    capabilities: {
      hostConfigFiles: true,
      hookTrust: true,
      mcpConfigEditing: true,
      planMode: true,
      sandboxMode: true,
      forkFromTurn: false,
    },
    shellControlState: null,
    onToggleView: vi.fn(),
    onDismissPromptFocus: vi.fn(),
    onSetOpenMenu: vi.fn(),
    onToolboxItemClick: vi.fn(),
    onSetSlashPanelView: vi.fn(),
    onUpdateGoal: vi.fn(),
    onOpenForkTurns: vi.fn(),
    onForkLatest: vi.fn(),
    onForkTurn: vi.fn(),
    onCopySkillInvokeName: vi.fn(),
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
    onSetMcpPanelMode: vi.fn(),
    onClearMcpConfigStatus: vi.fn(),
    onSetMcpHttpName: vi.fn(),
    onSetMcpHttpUrl: vi.fn(),
    onSetMcpRawBlock: vi.fn(),
    onPrepareRawMcpBlock: vi.fn(),
    onSaveHttpMcp: vi.fn(),
    onSaveRawMcpBlock: vi.fn(),
    onPickPhoto: vi.fn(),
    onPickFile: vi.fn(),
    onUpdateSettings: vi.fn(),
    onPasteShell: vi.fn(),
    onCopyShell: vi.fn(),
    onClearShell: vi.fn(),
    onShellControl: vi.fn(),
    ...overrides,
  };
}

describe('useComposerToolbarProps', () => {
  it('builds chat-mode menu prop groups', () => {
    const props = useComposerToolbarProps(input({ openMenu: 'slash' }));

    expect(props.slashToolboxProps?.open).toBe(true);
    expect(props.attachmentMenuProps?.open).toBe(false);
    expect(props.slashToolboxProps?.planModeAvailable).toBe(true);
    expect(props.settingsToolbarProps?.sandboxModeAvailable).toBe(true);
    expect(props.shellToolsPanelProps).toBeNull();
    expect(props.slashToolboxProps?.onToggle()).toBeUndefined();
  });

  it('hides chat prop groups in shell mode and exposes shell tools when open', () => {
    const props = useComposerToolbarProps(
      input({
        isShellView: true,
        activeView: 'shell',
        openMenu: 'shellTools',
      }),
    );

    expect(props.slashToolboxProps).toBeNull();
    expect(props.attachmentMenuProps).toBeNull();
    expect(props.settingsToolbarProps).toBeNull();
    expect(props.shellToolsPanelProps?.busy).toBe(false);
  });

  it('uses stable menu toggle updater semantics', () => {
    const setOpenMenu = vi.fn();
    const props = useComposerToolbarProps(
      input({ onSetOpenMenu: setOpenMenu }),
    );

    props.attachmentMenuProps?.onToggle();

    expect(setOpenMenu).toHaveBeenCalledTimes(1);
    expect(setOpenMenu.mock.calls[0]?.[0](null)).toBe('attachments');
    expect(setOpenMenu.mock.calls[0]?.[0]('attachments')).toBeNull();
  });
});
