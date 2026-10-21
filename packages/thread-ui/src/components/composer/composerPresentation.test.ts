import { describe, expect, it } from 'vitest';

import {
  authStatusLabel,
  buildComposerClassNames,
  buildComposerControlState,
  editableHookTarget,
  goalStatusLabel,
  hookEventJsonKey,
  hookEventLabel,
  hookSourceLabel,
  hookTrustLabel,
  skillScopeLabel,
} from './composerPresentation';
import type { AgentHookDto } from '@pockymoe/shared';

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

describe('composer presentation helpers', () => {
  it('formats toolbox and management labels', () => {
    expect(authStatusLabel('bearerToken')).toBe('Token');
    expect(authStatusLabel('oAuth')).toBe('OAuth');
    expect(skillScopeLabel('repo')).toBe('Repo');
    expect(skillScopeLabel('user')).toBe('User');
    expect(goalStatusLabel('budgetLimited')).toBe('Budget');
  });

  it('formats hook labels and JSON keys', () => {
    expect(hookEventLabel('permissionRequest')).toBe('PermissionRequest');
    expect(hookEventJsonKey('postCompact')).toBe('PostCompact');
    expect(hookSourceLabel('cloudRequirements')).toBe('Cloud');
    expect(hookSourceLabel('sessionFlags')).toBe('Session');
    expect(hookTrustLabel('untrusted')).toBe('Review');
  });

  it('builds editable hook targets only for user/project command hooks', () => {
    expect(editableHookTarget(hook())).toEqual({
      scope: 'project',
      eventName: 'preToolUse',
      matcher: 'Bash',
      command: 'echo ok',
      timeoutSec: 30,
      statusMessage: 'Checking',
    });
    expect(editableHookTarget(hook({ source: 'user' }))?.scope).toBe('global');
    expect(editableHookTarget(hook({ source: 'sessionFlags' }))).toBeNull();
    expect(editableHookTarget(hook({ handlerType: 'prompt' }))).toBeNull();
    expect(editableHookTarget(hook({ isManaged: true }))).toBeNull();
  });

  it('derives composer control labels and disabled states', () => {
    expect(
      buildComposerControlState({
        goalComposeMode: true,
        goalBusy: false,
        threadConnected: true,
        busy: false,
        isShellView: false,
        settingsBusy: false,
        supportedEffortCount: 2,
        fastMode: false,
      }),
    ).toMatchObject({
      promptPlaceholder:
        'Describe the goal the backend should continue working toward...',
      sendButtonLabel: 'Set goal',
      sendButtonClassName: 'ui-action-info',
      interruptLabel: 'Stop Current Turn',
      effortControlsDisabled: false,
      effortControlTitle: 'Select reasoning effort',
    });

    expect(
      buildComposerControlState({
        goalComposeMode: false,
        goalBusy: false,
        threadConnected: false,
        busy: true,
        isShellView: true,
        settingsBusy: true,
        supportedEffortCount: 0,
        fastMode: true,
      }),
    ).toMatchObject({
      promptPlaceholder: 'Send shell input to the attached terminal...',
      sendButtonLabel: 'Connecting...',
      sendButtonClassName: 'ui-action-danger',
      interruptLabel: 'Send Ctrl-C',
      modelControlsDisabled: true,
      effortControlsDisabled: true,
      effortControlTitle:
        'Fast mode is on. Turn it off from the slash toolbox to edit reasoning.',
    });
  });

  it('derives composer shell/chat class names', () => {
    const chatClasses = buildComposerClassNames({
      isShellView: false,
      edgeToEdgeMobile: true,
      isMobileShell: false,
      openMenu: true,
      isDragTargetActive: true,
      busy: true,
    });

    expect(chatClasses.composerLayerClassName).toContain('z-[80]');
    expect(chatClasses.formClassName).toContain(
      'thread-graph-composer-form-floating',
    );
    expect(chatClasses.graphChatInputClassName).toContain('is-drag-target');
    // Sending shows on the send key, not as a tint over the prompt.
    expect(chatClasses.graphChatInputGroupClassName).not.toContain('amber');

    const shellClasses = buildComposerClassNames({
      isShellView: true,
      edgeToEdgeMobile: false,
      isMobileShell: true,
      openMenu: false,
      isDragTargetActive: false,
      busy: false,
    });

    expect(shellClasses.composerLayerClassName).toContain(
      'thread-shell-composer-layer',
    );
    expect(shellClasses.formClassName).toContain(
      'thread-composer-form-floating',
    );
    expect(shellClasses.composerMenuItemClassName).toBe(
      'thread-composer-menu-item',
    );
  });
});
