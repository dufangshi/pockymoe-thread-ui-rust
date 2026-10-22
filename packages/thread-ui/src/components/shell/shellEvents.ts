import { translate, useI18n } from '../../i18n';
import type {
  ShellEventEnvelope,
  ShellEventPayloadMap,
  ShellStatusDto,
} from '@pockymoe/shared';

import {
  extractCommandOutput,
  normalizeShellSnapshot,
} from './shellSnapshot';
import {
  basenameFromPath,
  buildPromptLabel,
} from './shellPresentation';

export interface PendingShellCommand {
  command: string;
  beforeSnapshot: string;
}

export interface NormalizedShellOutputEvent {
  data: string;
  replace: boolean;
  /** Recorded output replayed on attaching: its queries were answered already. */
  replay: boolean;
  cursorX: number | undefined;
  cursorY: number | undefined;
  paneHeight: number | undefined;
  promptLabel: string | null;
  isCommandRunning: boolean;
}

export interface ShellSnapshotUpdate {
  nextSnapshot: string;
  nextPendingCommand: PendingShellCommand | null;
  lastCommandOutput: string | null;
}

export interface ShellLifecycleEventAction {
  viewerId: string | null | undefined;
  isConnecting: boolean | undefined;
  settleAttachPromise: boolean | undefined;
  isCommandRunning: boolean | undefined;
  connectionError: string | null | undefined;
  intentionalDisconnect: boolean | undefined;
  closeSocket: boolean;
  shellUpdate:
    | {
        status: ShellStatusDto;
        attachedViewerId: string | null | undefined;
      }
    | undefined;
}

export interface ShellAttachTimeoutAction {
  connectionError: string;
  isConnecting: false;
  settleAttachPromise: false;
  closeSocket: true;
}

export interface ShellTerminalSize {
  cols: number;
  rows: number;
}

export interface ShellAttachMessage {
  type: 'shell.attach';
  shellId: string;
  cols: number;
  rows: number;
}

export interface ShellSocketOpenAction {
  message: ShellAttachMessage;
  shouldScheduleAttachTimeout: true;
}

export type ShellAttachStartAction =
  | { type: 'skip' }
  | { type: 'measureSize' }
  | { type: 'scheduleRetry' }
  | { type: 'reuseSocket'; shouldClearAttachRetry: boolean }
  | {
      type: 'startAttach';
      attachSize: ShellTerminalSize;
      shouldClearAttachRetry: boolean;
      shouldClearReconnectTimer: boolean;
    };

export interface ShellResizeDecision {
  nextLastSentSize: ShellTerminalSize;
  message:
    | {
        type: 'shell.resize';
        shellId: string;
        viewerId: string;
        cols: number;
        rows: number;
      }
    | null;
}

export interface ShellSocketCloseAction {
  shouldDetachShell: boolean;
  shouldScheduleReconnect: boolean;
}

export interface ShellManualDisconnectAction {
  userDisconnectedShellId: string | null;
  intentionalDisconnect: true;
  detachMessage: ReturnType<typeof buildShellDetachMessage>;
  shouldCloseSocket: boolean;
  shouldClearSocketRef: true;
  shouldClearLastSentSize: true;
  shouldDetachShell: boolean;
}

export interface ShellSocketEffectCleanupAction {
  intentionalDisconnect: true;
  shouldClearAttachRetry: boolean;
  detachMessage: ReturnType<typeof buildShellDetachMessage>;
  shouldSendDetachMessage: boolean;
  shouldClearViewer: true;
  isConnecting: false;
  settleAttachPromise: false | undefined;
  shouldClearAttachTimeout: boolean;
  shouldCloseSocket: true;
  shouldClearSocketRef: boolean;
}

export type ShellReconnectRequestAction =
  | { type: 'reject' }
  | { type: 'alreadyConnected' }
  | { type: 'joinPending' }
  | { type: 'startAttach' };

export interface ShellReconnectStartAction {
  shouldClearUserDisconnectedShellId: boolean;
  intentionalDisconnect: false;
  connectionError: null;
  isConnecting: true;
  shouldIncrementReconnectKey: true;
}

export interface ShellMissingSessionResetAction {
  viewerId: null;
  isConnecting: false;
  settleAttachPromise: false;
  connectionError: null;
  runtimePromptLabel: null;
  isCommandRunning: false;
  shellSnapshot: '';
  lastCommandOutput: '';
  pendingCommand: null;
  shouldResetTerminal: true;
}

export interface ShellPaneUnmountCleanupAction {
  shouldClearReconnectTimer: boolean;
  shouldClearAttachTimeout: boolean;
  shouldClearAttachRetry: boolean;
  settleAttachPromise: false;
}

export const SHELL_ATTACH_RETRY_DELAY_MS = 120;
export const SHELL_RECONNECT_DELAY_MS = 800;
export const SHELL_ATTACH_TIMEOUT_MS = 4000;
export const SHELL_RECONNECT_PROMISE_TIMEOUT_MS = 4500;

export function deriveShellAttachTimeoutAction({
  isCurrentSocket,
  viewerId,
}: {
  isCurrentSocket: boolean;
  viewerId: string | null;
}): ShellAttachTimeoutAction | null {
  if (!isCurrentSocket || viewerId) {
    return null;
  }

  return {
    connectionError: translate("workbench.shellConnectionTimedOutReconnecting"),
    isConnecting: false,
    settleAttachPromise: false,
    closeSocket: true,
  };
}

export function deriveShellSocketOpenAction({
  isCurrentSocket,
  shellId,
  attachSize,
}: {
  isCurrentSocket: boolean;
  shellId: string;
  attachSize: ShellTerminalSize;
}): ShellSocketOpenAction | null {
  if (!isCurrentSocket) {
    return null;
  }

  return {
    message: {
      type: 'shell.attach',
      shellId,
      cols: attachSize.cols,
      rows: attachSize.rows,
    },
    shouldScheduleAttachTimeout: true,
  };
}

export function shouldScheduleShellReconnect({
  intentionalDisconnect,
  userDisconnectedShellId,
  shellId,
}: {
  intentionalDisconnect: boolean;
  userDisconnectedShellId: string | null;
  shellId: string;
}) {
  return !intentionalDisconnect && userDisconnectedShellId !== shellId;
}

export function deriveShellSocketCloseAction({
  isCurrentSocket,
  hadViewer,
  intentionalDisconnect,
  userDisconnectedShellId,
  shellId,
}: {
  isCurrentSocket: boolean;
  hadViewer: boolean;
  intentionalDisconnect: boolean;
  userDisconnectedShellId: string | null;
  shellId: string;
}): ShellSocketCloseAction | null {
  if (!isCurrentSocket) {
    return null;
  }

  return {
    shouldDetachShell: hadViewer,
    shouldScheduleReconnect: shouldScheduleShellReconnect({
      intentionalDisconnect,
      userDisconnectedShellId,
      shellId,
    }),
  };
}

export function shouldScheduleAttachRetry({
  hasAttachSize,
  hasPendingRetry,
}: {
  hasAttachSize: boolean;
  hasPendingRetry: boolean;
}) {
  return !hasAttachSize && !hasPendingRetry;
}

export function deriveShellAttachStartAction({
  shellId,
  terminalReady,
  isVisible,
  canAttachShell,
  userDisconnectedShellId,
  hasTerminal,
  attachSize,
  hasPendingAttachRetry,
  hasCurrentSocketForShell,
  hasReconnectTimer,
}: {
  shellId: string | null;
  terminalReady: boolean;
  isVisible: boolean;
  canAttachShell: boolean;
  userDisconnectedShellId: string | null;
  hasTerminal: boolean;
  attachSize: ShellTerminalSize | null | undefined;
  hasPendingAttachRetry: boolean;
  hasCurrentSocketForShell: boolean;
  hasReconnectTimer: boolean;
}): ShellAttachStartAction {
  if (
    !shellId ||
    !terminalReady ||
    !isVisible ||
    !canAttachShell ||
    userDisconnectedShellId === shellId ||
    !hasTerminal
  ) {
    return { type: 'skip' };
  }

  if (attachSize === undefined) {
    return { type: 'measureSize' };
  }

  if (!attachSize) {
    return shouldScheduleAttachRetry({
      hasAttachSize: false,
      hasPendingRetry: hasPendingAttachRetry,
    })
      ? { type: 'scheduleRetry' }
      : { type: 'skip' };
  }

  if (hasCurrentSocketForShell) {
    return {
      type: 'reuseSocket',
      shouldClearAttachRetry: hasPendingAttachRetry,
    };
  }

  return {
    type: 'startAttach',
    attachSize,
    shouldClearAttachRetry: hasPendingAttachRetry,
    shouldClearReconnectTimer: hasReconnectTimer,
  };
}

export function deriveShellReconnectRequestAction({
  hasShellId,
  terminalReady,
  workspacePathMissing,
  hasViewer,
  hasPendingAttach,
}: {
  hasShellId: boolean;
  terminalReady: boolean;
  workspacePathMissing: boolean;
  hasViewer: boolean;
  hasPendingAttach: boolean;
}): ShellReconnectRequestAction {
  if (!hasShellId || !terminalReady || workspacePathMissing) {
    return { type: 'reject' };
  }

  if (hasViewer) {
    return { type: 'alreadyConnected' };
  }

  if (hasPendingAttach) {
    return { type: 'joinPending' };
  }

  return { type: 'startAttach' };
}

export function deriveShellReconnectStartAction({
  shellId,
  userDisconnectedShellId,
}: {
  shellId: string | null;
  userDisconnectedShellId: string | null;
}): ShellReconnectStartAction {
  return {
    shouldClearUserDisconnectedShellId:
      Boolean(shellId) && userDisconnectedShellId === shellId,
    intentionalDisconnect: false,
    connectionError: null,
    isConnecting: true,
    shouldIncrementReconnectKey: true,
  };
}

export function deriveShellMissingSessionResetAction({
  hasShell,
}: {
  hasShell: boolean;
}): ShellMissingSessionResetAction | null {
  if (hasShell) {
    return null;
  }

  return {
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
  };
}

export function deriveShellPaneUnmountCleanupAction({
  hasReconnectTimer,
  hasAttachTimeout,
  hasAttachRetry,
}: {
  hasReconnectTimer: boolean;
  hasAttachTimeout: boolean;
  hasAttachRetry: boolean;
}): ShellPaneUnmountCleanupAction {
  return {
    shouldClearReconnectTimer: hasReconnectTimer,
    shouldClearAttachTimeout: hasAttachTimeout,
    shouldClearAttachRetry: hasAttachRetry,
    settleAttachPromise: false,
  };
}

export function buildShellDetachMessage({
  shellId,
  viewerId,
}: {
  shellId: string | null;
  viewerId: string | null;
}) {
  return shellId && viewerId
    ? {
        type: 'shell.detach' as const,
        shellId,
        viewerId,
      }
    : null;
}

export function deriveShellManualDisconnectAction({
  shellId,
  viewerId,
  hasSocket,
}: {
  shellId: string | null;
  viewerId: string | null;
  hasSocket: boolean;
}): ShellManualDisconnectAction {
  return {
    userDisconnectedShellId: shellId,
    intentionalDisconnect: true,
    detachMessage: buildShellDetachMessage({ shellId, viewerId }),
    shouldCloseSocket: hasSocket,
    shouldClearSocketRef: true,
    shouldClearLastSentSize: true,
    shouldDetachShell: Boolean(shellId),
  };
}

export function deriveShellSocketEffectCleanupAction({
  shellId,
  viewerId,
  socketReadyState,
  openReadyState,
  hasAttachRetryTimer,
  hasAttachTimeout,
  isCurrentSocket,
}: {
  shellId: string;
  viewerId: string | null;
  socketReadyState: number;
  openReadyState: number;
  hasAttachRetryTimer: boolean;
  hasAttachTimeout: boolean;
  isCurrentSocket: boolean;
}): ShellSocketEffectCleanupAction {
  const detachMessage = buildShellDetachMessage({ shellId, viewerId });
  return {
    intentionalDisconnect: true,
    shouldClearAttachRetry: hasAttachRetryTimer,
    detachMessage,
    shouldSendDetachMessage: Boolean(
      detachMessage && socketReadyState === openReadyState,
    ),
    shouldClearViewer: true,
    isConnecting: false,
    settleAttachPromise: isCurrentSocket ? false : undefined,
    shouldClearAttachTimeout: hasAttachTimeout,
    shouldCloseSocket: true,
    shouldClearSocketRef: isCurrentSocket,
  };
}

export function deriveShellResizeDecision({
  size,
  previousSize,
  shellId,
  viewerId,
  syncBackendSize,
}: {
  size: ShellTerminalSize;
  previousSize: ShellTerminalSize | null;
  shellId: string | null;
  viewerId: string | null;
  syncBackendSize: boolean;
}): ShellResizeDecision {
  if (!syncBackendSize) {
    return {
      nextLastSentSize: previousSize ?? size,
      message: null,
    };
  }

  if (previousSize?.cols === size.cols && previousSize.rows === size.rows) {
    return {
      nextLastSentSize: previousSize,
      message: null,
    };
  }

  return {
    nextLastSentSize: size,
    message:
      shellId && viewerId
        ? {
            type: 'shell.resize',
            shellId,
            viewerId,
            cols: size.cols,
            rows: size.rows,
          }
        : null,
  };
}

export function normalizeShellOutputEvent(
  payload: ShellEventPayloadMap['shell.output'],
  fallbackCwd: string | null | undefined,
): NormalizedShellOutputEvent {
  const cwdBaseName =
    typeof payload.cwdBaseName === 'string' ? payload.cwdBaseName : null;
  const envPrefix =
    typeof payload.envPrefix === 'string' ? payload.envPrefix : null;

  return {
    data: typeof payload.data === 'string' ? payload.data : '',
    replace: payload.replace === true,
    replay: payload.replay === true,
    cursorX: typeof payload.cursorX === 'number' ? payload.cursorX : undefined,
    cursorY: typeof payload.cursorY === 'number' ? payload.cursorY : undefined,
    paneHeight:
      typeof payload.paneHeight === 'number' ? payload.paneHeight : undefined,
    promptLabel: buildPromptLabel(
      cwdBaseName ?? basenameFromPath(fallbackCwd),
      envPrefix,
    ),
    isCommandRunning: payload.isCommandRunning === true,
  };
}

export function updateShellSnapshotFromOutput({
  currentSnapshot,
  data,
  replace,
  isCommandRunning,
  pendingCommand,
}: {
  currentSnapshot: string;
  data: string;
  replace: boolean;
  isCommandRunning: boolean;
  pendingCommand: PendingShellCommand | null;
}): ShellSnapshotUpdate {
  if (!data) {
    return {
      nextSnapshot: currentSnapshot,
      nextPendingCommand: pendingCommand,
      lastCommandOutput: null,
    };
  }

  const nextSnapshot = replace
    ? normalizeShellSnapshot(data)
    : normalizeShellSnapshot(`${currentSnapshot}${data}`);

  if (!replace || isCommandRunning || !pendingCommand) {
    return {
      nextSnapshot,
      nextPendingCommand: pendingCommand,
      lastCommandOutput: null,
    };
  }

  return {
    nextSnapshot,
    nextPendingCommand: null,
    lastCommandOutput: extractCommandOutput(
      pendingCommand.beforeSnapshot,
      nextSnapshot,
      pendingCommand.command,
    ),
  };
}

export function deriveShellLifecycleEventAction({
  event,
  currentViewerId,
}: {
  event: ShellEventEnvelope;
  currentViewerId: string | null;
}): ShellLifecycleEventAction | null {
  if (event.type === 'shell.output') {
    return null;
  }

  if (event.type === 'shell.connected') {
    const nextViewerId = String(event.payload.viewerId ?? '');
    return {
      viewerId: nextViewerId || null,
      isConnecting: false,
      settleAttachPromise: Boolean(nextViewerId),
      isCommandRunning: undefined,
      connectionError: undefined,
      intentionalDisconnect: undefined,
      closeSocket: false,
      shellUpdate: {
        status: 'attached',
        attachedViewerId: nextViewerId,
      },
    };
  }

  if (event.type === 'shell.error') {
    return {
      viewerId: undefined,
      isConnecting: false,
      settleAttachPromise: false,
      isCommandRunning: undefined,
      connectionError: String(
        event.payload.message ?? translate("workbench.shellConnectionFailed"),
      ),
      intentionalDisconnect: undefined,
      closeSocket: false,
      shellUpdate:
        event.payload.code === 'viewer_conflict'
          ? {
              status: 'detached',
              attachedViewerId: null,
            }
          : undefined,
    };
  }

  if (event.type === 'shell.detached') {
    const detachedViewerId = String(event.payload.viewerId ?? '');
    if (!detachedViewerId || detachedViewerId !== currentViewerId) {
      return null;
    }

    const detachedReason = String(event.payload.reason ?? '');
    return {
      viewerId: null,
      isConnecting: false,
      settleAttachPromise: false,
      isCommandRunning: false,
      connectionError:
        detachedReason === 'replaced'
          ? translate("workbench.thisShellConnectionWasTakenOverBy")
          : null,
      intentionalDisconnect: detachedReason === 'replaced' ? true : undefined,
      closeSocket: true,
      shellUpdate: {
        status: 'detached',
        attachedViewerId: null,
      },
    };
  }

  if (event.type === 'shell.exited') {
    const nextState = event.payload.state === 'exited' ? 'exited' : 'not_found';
    return {
      viewerId: null,
      isConnecting: false,
      settleAttachPromise: false,
      isCommandRunning: false,
      connectionError: undefined,
      intentionalDisconnect: true,
      closeSocket: true,
      shellUpdate: {
        status: nextState,
        attachedViewerId: null,
      },
    };
  }

  const nextState = event.payload.state;
  return {
    viewerId: nextState === 'attached' ? undefined : null,
    isConnecting: nextState === 'attached' ? undefined : false,
    settleAttachPromise: nextState === 'attached' ? undefined : false,
    isCommandRunning: nextState === 'attached' ? undefined : false,
    connectionError: undefined,
    intentionalDisconnect: undefined,
    closeSocket: false,
    shellUpdate: {
      status: nextState,
      attachedViewerId: nextState === 'attached' ? undefined : null,
    },
  };
}
