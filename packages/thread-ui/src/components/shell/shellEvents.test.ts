import { setLocale } from '../../i18n';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildShellDetachMessage,
  deriveShellAttachStartAction,
  deriveShellManualDisconnectAction,
  deriveShellMissingSessionResetAction,
  deriveShellPaneUnmountCleanupAction,
  deriveShellSocketEffectCleanupAction,
  deriveShellSocketOpenAction,
  deriveShellSocketCloseAction,
  deriveShellResizeDecision,
  deriveShellReconnectRequestAction,
  deriveShellReconnectStartAction,
  deriveShellAttachTimeoutAction,
  deriveShellLifecycleEventAction,
  normalizeShellOutputEvent,
  SHELL_ATTACH_RETRY_DELAY_MS,
  SHELL_ATTACH_TIMEOUT_MS,
  SHELL_RECONNECT_DELAY_MS,
  SHELL_RECONNECT_PROMISE_TIMEOUT_MS,
  shouldScheduleAttachRetry,
  shouldScheduleShellReconnect,
  updateShellSnapshotFromOutput,
} from './shellEvents';

describe('shellEvents utilities', () => {
  afterEach(() => setLocale('en', false));

  it('localizes new reconnect timeout actions after module import without rewriting prior errors', () => {
    setLocale('en', false);
    const input = { isCurrentSocket: true, viewerId: null };
    const englishAction = deriveShellAttachTimeoutAction(input);
    expect(englishAction?.connectionError).toBe('Shell connection timed out. Reconnecting...');
    setLocale('zh-CN', false);
    expect(deriveShellAttachTimeoutAction(input)?.connectionError).toBe('Shell 连接超时，正在重新连接…');
    expect(englishAction?.connectionError).toBe('Shell connection timed out. Reconnecting...');
  });
  it('normalizes output payload fields and prompt labels', () => {
    expect(
      normalizeShellOutputEvent(
        {
          data: 'hello',
          replace: true,
          cursorX: 3,
          cursorY: 4,
          paneHeight: 20,
          cwdBaseName: 'repo',
          envPrefix: 'venv',
          isCommandRunning: true,
        },
        '/workspace/fallback',
      ),
    ).toEqual({
      data: 'hello',
      replace: true,
      replay: false,
      cursorX: 3,
      cursorY: 4,
      paneHeight: 20,
      promptLabel: 'venv repo',
      isCommandRunning: true,
    });
  });

  it('falls back to the shell cwd basename when payload labels are absent', () => {
    expect(
      normalizeShellOutputEvent(
        {
          data: 'hello',
        },
        '/workspace/project',
      ),
    ).toMatchObject({
      promptLabel: 'project',
      replace: false,
      isCommandRunning: false,
    });
  });

  it('appends streamed output to the current normalized snapshot', () => {
    expect(
      updateShellSnapshotFromOutput({
        currentSnapshot: 'one\r\n',
        data: 'two\r\n',
        replace: false,
        isCommandRunning: false,
        pendingCommand: {
          command: 'ls',
          beforeSnapshot: 'one\n',
        },
      }),
    ).toEqual({
      nextSnapshot: 'one\ntwo\n',
      nextPendingCommand: {
        command: 'ls',
        beforeSnapshot: 'one\n',
      },
      lastCommandOutput: null,
    });
  });

  it('extracts command output when a replace snapshot finishes a command', () => {
    expect(
      updateShellSnapshotFromOutput({
        currentSnapshot: 'prompt $',
        data: ['prompt $', '$ pwd', '/workspace/project', 'prompt $'].join(
          '\n',
        ),
        replace: true,
        isCommandRunning: false,
        pendingCommand: {
          command: 'pwd',
          beforeSnapshot: 'prompt $',
        },
      }),
    ).toEqual({
      nextSnapshot: ['prompt $', '$ pwd', '/workspace/project', 'prompt $'].join(
        '\n',
      ),
      nextPendingCommand: null,
      lastCommandOutput: '/workspace/project',
    });
  });

  it('keeps a pending command while a replace snapshot is still running', () => {
    const pendingCommand = {
      command: 'pnpm test',
      beforeSnapshot: 'prompt $',
    };

    expect(
      updateShellSnapshotFromOutput({
        currentSnapshot: 'prompt $',
        data: 'partial output',
        replace: true,
        isCommandRunning: true,
        pendingCommand,
      }),
    ).toEqual({
      nextSnapshot: 'partial output',
      nextPendingCommand: pendingCommand,
      lastCommandOutput: null,
    });
  });

  it('derives connected lifecycle actions', () => {
    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: null,
        event: {
          type: 'shell.connected',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: { viewerId: 'viewer-1' },
        },
      }),
    ).toMatchObject({
      viewerId: 'viewer-1',
      isConnecting: false,
      settleAttachPromise: true,
      closeSocket: false,
      shellUpdate: {
        status: 'attached',
        attachedViewerId: 'viewer-1',
      },
    });
  });

  it('derives error lifecycle actions and detaches viewer conflicts', () => {
    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: 'viewer-1',
        event: {
          type: 'shell.error',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: {
            code: 'viewer_conflict',
            message: 'Already attached.',
          },
        },
      }),
    ).toMatchObject({
      isConnecting: false,
      settleAttachPromise: false,
      connectionError: 'Already attached.',
      shellUpdate: {
        status: 'detached',
        attachedViewerId: null,
      },
    });
  });

  it('ignores detach events for other viewers', () => {
    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: 'viewer-1',
        event: {
          type: 'shell.detached',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: {
            threadId: 'thread-1',
            state: 'detached',
            viewerId: 'viewer-2',
          },
        },
      }),
    ).toBeNull();
  });

  it('marks replaced detach events as intentional disconnects', () => {
    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: 'viewer-1',
        event: {
          type: 'shell.detached',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: {
            threadId: 'thread-1',
            state: 'detached',
            viewerId: 'viewer-1',
            reason: 'replaced',
          },
        },
      }),
    ).toMatchObject({
      viewerId: null,
      isConnecting: false,
      settleAttachPromise: false,
      isCommandRunning: false,
      intentionalDisconnect: true,
      closeSocket: true,
      connectionError:
        'This shell connection was taken over by another pane or device.',
      shellUpdate: {
        status: 'detached',
        attachedViewerId: null,
      },
    });
  });

  it('derives exited and status lifecycle actions', () => {
    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: 'viewer-1',
        event: {
          type: 'shell.exited',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: {
            threadId: 'thread-1',
            state: 'not_found',
          },
        },
      }),
    ).toMatchObject({
      viewerId: null,
      intentionalDisconnect: true,
      closeSocket: true,
      shellUpdate: {
        status: 'not_found',
        attachedViewerId: null,
      },
    });

    expect(
      deriveShellLifecycleEventAction({
        currentViewerId: 'viewer-1',
        event: {
          type: 'shell.status',
          shellId: 'shell-1',
          timestamp: '2026-06-10T00:00:00.000Z',
          payload: {
            threadId: 'thread-1',
            state: 'detached',
          },
        },
      }),
    ).toMatchObject({
      viewerId: null,
      isConnecting: false,
      settleAttachPromise: false,
      closeSocket: false,
      shellUpdate: {
        status: 'detached',
        attachedViewerId: null,
      },
    });
  });

  it('decides when socket close should schedule reconnect', () => {
    expect(
      shouldScheduleShellReconnect({
        intentionalDisconnect: false,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toBe(true);
    expect(
      shouldScheduleShellReconnect({
        intentionalDisconnect: true,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toBe(false);
    expect(
      shouldScheduleShellReconnect({
        intentionalDisconnect: false,
        userDisconnectedShellId: 'shell-1',
        shellId: 'shell-1',
      }),
    ).toBe(false);
  });

  it('builds detach messages only when shell and viewer ids are present', () => {
    expect(
      buildShellDetachMessage({
        shellId: 'shell-1',
        viewerId: 'viewer-1',
      }),
    ).toEqual({
      type: 'shell.detach',
      shellId: 'shell-1',
      viewerId: 'viewer-1',
    });
    expect(
      buildShellDetachMessage({
        shellId: null,
        viewerId: 'viewer-1',
      }),
    ).toBeNull();
    expect(
      buildShellDetachMessage({
        shellId: 'shell-1',
        viewerId: null,
      }),
    ).toBeNull();
  });

  it('derives manual disconnect actions for shell/socket cleanup', () => {
    expect(
      deriveShellManualDisconnectAction({
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        hasSocket: true,
      }),
    ).toEqual({
      userDisconnectedShellId: 'shell-1',
      intentionalDisconnect: true,
      detachMessage: {
        type: 'shell.detach',
        shellId: 'shell-1',
        viewerId: 'viewer-1',
      },
      shouldCloseSocket: true,
      shouldClearSocketRef: true,
      shouldClearLastSentSize: true,
      shouldDetachShell: true,
    });

    expect(
      deriveShellManualDisconnectAction({
        shellId: 'shell-1',
        viewerId: null,
        hasSocket: false,
      }),
    ).toMatchObject({
      userDisconnectedShellId: 'shell-1',
      detachMessage: null,
      shouldCloseSocket: false,
      shouldDetachShell: true,
    });

    expect(
      deriveShellManualDisconnectAction({
        shellId: null,
        viewerId: 'viewer-1',
        hasSocket: true,
      }),
    ).toMatchObject({
      userDisconnectedShellId: null,
      detachMessage: null,
      shouldCloseSocket: true,
      shouldDetachShell: false,
    });
  });

  it('derives socket effect cleanup actions without sending detach on non-open sockets', () => {
    expect(
      deriveShellSocketEffectCleanupAction({
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        socketReadyState: 1,
        openReadyState: 1,
        hasAttachRetryTimer: true,
        hasAttachTimeout: true,
        isCurrentSocket: true,
      }),
    ).toEqual({
      intentionalDisconnect: true,
      shouldClearAttachRetry: true,
      detachMessage: {
        type: 'shell.detach',
        shellId: 'shell-1',
        viewerId: 'viewer-1',
      },
      shouldSendDetachMessage: true,
      shouldClearViewer: true,
      isConnecting: false,
      settleAttachPromise: false,
      shouldClearAttachTimeout: true,
      shouldCloseSocket: true,
      shouldClearSocketRef: true,
    });

    expect(
      deriveShellSocketEffectCleanupAction({
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        socketReadyState: 3,
        openReadyState: 1,
        hasAttachRetryTimer: false,
        hasAttachTimeout: false,
        isCurrentSocket: false,
      }),
    ).toMatchObject({
      shouldClearAttachRetry: false,
      shouldSendDetachMessage: false,
      settleAttachPromise: undefined,
      shouldClearAttachTimeout: false,
      shouldClearSocketRef: false,
    });

    expect(
      deriveShellSocketEffectCleanupAction({
        shellId: 'shell-1',
        viewerId: null,
        socketReadyState: 1,
        openReadyState: 1,
        hasAttachRetryTimer: false,
        hasAttachTimeout: false,
        isCurrentSocket: true,
      }),
    ).toMatchObject({
      detachMessage: null,
      shouldSendDetachMessage: false,
      shouldClearSocketRef: true,
    });
  });

  it('derives resize messages only when backend sync is enabled and size changes', () => {
    expect(
      deriveShellResizeDecision({
        size: { cols: 80, rows: 24 },
        previousSize: null,
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        syncBackendSize: false,
      }),
    ).toEqual({
      nextLastSentSize: { cols: 80, rows: 24 },
      message: null,
    });

    expect(
      deriveShellResizeDecision({
        size: { cols: 80, rows: 24 },
        previousSize: { cols: 80, rows: 24 },
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        syncBackendSize: true,
      }),
    ).toEqual({
      nextLastSentSize: { cols: 80, rows: 24 },
      message: null,
    });

    expect(
      deriveShellResizeDecision({
        size: { cols: 100, rows: 30 },
        previousSize: { cols: 80, rows: 24 },
        shellId: null,
        viewerId: 'viewer-1',
        syncBackendSize: true,
      }),
    ).toEqual({
      nextLastSentSize: { cols: 100, rows: 30 },
      message: null,
    });

    expect(
      deriveShellResizeDecision({
        size: { cols: 100, rows: 30 },
        previousSize: { cols: 80, rows: 24 },
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        syncBackendSize: true,
      }),
    ).toEqual({
      nextLastSentSize: { cols: 100, rows: 30 },
      message: {
        type: 'shell.resize',
        shellId: 'shell-1',
        viewerId: 'viewer-1',
        cols: 100,
        rows: 30,
      },
    });
  });

  it('derives attach timeout actions only for the current socket without a viewer', () => {
    expect(
      deriveShellAttachTimeoutAction({
        isCurrentSocket: false,
        viewerId: null,
      }),
    ).toBeNull();
    expect(
      deriveShellAttachTimeoutAction({
        isCurrentSocket: true,
        viewerId: 'viewer-1',
      }),
    ).toBeNull();
    expect(
      deriveShellAttachTimeoutAction({
        isCurrentSocket: true,
        viewerId: null,
      }),
    ).toEqual({
      connectionError: 'Shell connection timed out. Reconnecting...',
      isConnecting: false,
      settleAttachPromise: false,
      closeSocket: true,
    });
  });

  it('builds attach messages only for the current socket open event', () => {
    expect(
      deriveShellSocketOpenAction({
        isCurrentSocket: false,
        shellId: 'shell-1',
        attachSize: { cols: 80, rows: 24 },
      }),
    ).toBeNull();

    expect(
      deriveShellSocketOpenAction({
        isCurrentSocket: true,
        shellId: 'shell-1',
        attachSize: { cols: 100, rows: 30 },
      }),
    ).toEqual({
      message: {
        type: 'shell.attach',
        shellId: 'shell-1',
        cols: 100,
        rows: 30,
      },
      shouldScheduleAttachTimeout: true,
    });
  });

  it('centralizes shell timer delays and attach retry policy', () => {
    expect(SHELL_ATTACH_RETRY_DELAY_MS).toBe(120);
    expect(SHELL_RECONNECT_DELAY_MS).toBe(800);
    expect(SHELL_ATTACH_TIMEOUT_MS).toBe(4000);
    expect(SHELL_RECONNECT_PROMISE_TIMEOUT_MS).toBe(4500);
    expect(
      shouldScheduleAttachRetry({
        hasAttachSize: false,
        hasPendingRetry: false,
      }),
    ).toBe(true);
    expect(
      shouldScheduleAttachRetry({
        hasAttachSize: false,
        hasPendingRetry: true,
      }),
    ).toBe(false);
    expect(
      shouldScheduleAttachRetry({
        hasAttachSize: true,
        hasPendingRetry: false,
      }),
    ).toBe(false);
  });

  it('derives attach-start guard, retry, reuse, and start actions', () => {
    const baseInput = {
      shellId: 'shell-1',
      terminalReady: true,
      isVisible: true,
      canAttachShell: true,
      userDisconnectedShellId: null,
      hasTerminal: true,
      attachSize: { cols: 80, rows: 24 },
      hasPendingAttachRetry: false,
      hasCurrentSocketForShell: false,
      hasReconnectTimer: false,
    };

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        shellId: null,
      }),
    ).toEqual({ type: 'skip' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        terminalReady: false,
      }),
    ).toEqual({ type: 'skip' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        userDisconnectedShellId: 'shell-1',
      }),
    ).toEqual({ type: 'skip' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        attachSize: undefined,
      }),
    ).toEqual({ type: 'measureSize' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        attachSize: null,
      }),
    ).toEqual({ type: 'scheduleRetry' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        attachSize: null,
        hasPendingAttachRetry: true,
      }),
    ).toEqual({ type: 'skip' });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        hasPendingAttachRetry: true,
        hasCurrentSocketForShell: true,
      }),
    ).toEqual({
      type: 'reuseSocket',
      shouldClearAttachRetry: true,
    });

    expect(
      deriveShellAttachStartAction({
        ...baseInput,
        hasPendingAttachRetry: true,
        hasReconnectTimer: true,
      }),
    ).toEqual({
      type: 'startAttach',
      attachSize: { cols: 80, rows: 24 },
      shouldClearAttachRetry: true,
      shouldClearReconnectTimer: true,
    });
  });

  it('derives imperative reconnect request actions', () => {
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: false,
        terminalReady: true,
        workspacePathMissing: false,
        hasViewer: false,
        hasPendingAttach: false,
      }),
    ).toEqual({ type: 'reject' });
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: true,
        terminalReady: false,
        workspacePathMissing: false,
        hasViewer: false,
        hasPendingAttach: false,
      }),
    ).toEqual({ type: 'reject' });
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: true,
        terminalReady: true,
        workspacePathMissing: true,
        hasViewer: false,
        hasPendingAttach: false,
      }),
    ).toEqual({ type: 'reject' });
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: true,
        terminalReady: true,
        workspacePathMissing: false,
        hasViewer: true,
        hasPendingAttach: false,
      }),
    ).toEqual({ type: 'alreadyConnected' });
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: true,
        terminalReady: true,
        workspacePathMissing: false,
        hasViewer: false,
        hasPendingAttach: true,
      }),
    ).toEqual({ type: 'joinPending' });
    expect(
      deriveShellReconnectRequestAction({
        hasShellId: true,
        terminalReady: true,
        workspacePathMissing: false,
        hasViewer: false,
        hasPendingAttach: false,
      }),
    ).toEqual({ type: 'startAttach' });
  });

  it('derives reconnect start state resets', () => {
    expect(
      deriveShellReconnectStartAction({
        shellId: 'shell-1',
        userDisconnectedShellId: 'shell-1',
      }),
    ).toEqual({
      shouldClearUserDisconnectedShellId: true,
      intentionalDisconnect: false,
      connectionError: null,
      isConnecting: true,
      shouldIncrementReconnectKey: true,
    });

    expect(
      deriveShellReconnectStartAction({
        shellId: 'shell-1',
        userDisconnectedShellId: 'shell-2',
      }),
    ).toMatchObject({
      shouldClearUserDisconnectedShellId: false,
    });

    expect(
      deriveShellReconnectStartAction({
        shellId: null,
        userDisconnectedShellId: null,
      }),
    ).toMatchObject({
      shouldClearUserDisconnectedShellId: false,
    });
  });

  it('skips missing-session reset actions while a shell is present', () => {
    expect(deriveShellMissingSessionResetAction({ hasShell: true })).toBeNull();
  });

  it('derives missing-session reset actions', () => {
    expect(deriveShellMissingSessionResetAction({ hasShell: false })).toEqual({
      viewerId: null,
      isConnecting: false,
      settleAttachPromise: false,
      connectionError: null,
      runtimePromptLabel: null,
      isCommandRunning: false,
      shellSnapshot: '',
      lastCommandOutput: '',
      pendingCommand: null,
      shouldResetTerminal: true,
    });
  });

  it('derives pane unmount timer cleanup actions', () => {
    expect(
      deriveShellPaneUnmountCleanupAction({
        hasReconnectTimer: false,
        hasAttachTimeout: false,
        hasAttachRetry: false,
      }),
    ).toEqual({
      shouldClearReconnectTimer: false,
      shouldClearAttachTimeout: false,
      shouldClearAttachRetry: false,
      settleAttachPromise: false,
    });
    expect(
      deriveShellPaneUnmountCleanupAction({
        hasReconnectTimer: true,
        hasAttachTimeout: true,
        hasAttachRetry: true,
      }),
    ).toEqual({
      shouldClearReconnectTimer: true,
      shouldClearAttachTimeout: true,
      shouldClearAttachRetry: true,
      settleAttachPromise: false,
    });
  });

  it('derives socket close cleanup and reconnect actions', () => {
    expect(
      deriveShellSocketCloseAction({
        isCurrentSocket: false,
        hadViewer: true,
        intentionalDisconnect: false,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toBeNull();

    expect(
      deriveShellSocketCloseAction({
        isCurrentSocket: true,
        hadViewer: true,
        intentionalDisconnect: false,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toEqual({
      shouldDetachShell: true,
      shouldScheduleReconnect: true,
    });

    expect(
      deriveShellSocketCloseAction({
        isCurrentSocket: true,
        hadViewer: false,
        intentionalDisconnect: false,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toEqual({
      shouldDetachShell: false,
      shouldScheduleReconnect: true,
    });

    expect(
      deriveShellSocketCloseAction({
        isCurrentSocket: true,
        hadViewer: true,
        intentionalDisconnect: true,
        userDisconnectedShellId: null,
        shellId: 'shell-1',
      }),
    ).toEqual({
      shouldDetachShell: true,
      shouldScheduleReconnect: false,
    });

    expect(
      deriveShellSocketCloseAction({
        isCurrentSocket: true,
        hadViewer: true,
        intentionalDisconnect: false,
        userDisconnectedShellId: 'shell-1',
        shellId: 'shell-1',
      }),
    ).toEqual({
      shouldDetachShell: true,
      shouldScheduleReconnect: false,
    });
  });
});
