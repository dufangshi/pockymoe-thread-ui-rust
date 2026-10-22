import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Terminal } from 'xterm';

import type {
  ShellEventEnvelope,
  ShellSessionDto,
  ShellStatusDto,
} from '@pockymoe/shared';
import type {
  ShellSocketConnection,
  ThreadShellAdapter,
} from '../../adapters';
import {
  deriveShellLifecycleEventAction,
} from './shellEvents';
import {
  applyShellSocketCleanupEffects,
  applyShellSocketCloseEffects,
  clearWindowTimerRef,
  deriveShellSocketCleanupApplicationFromRefs,
  scheduleShellAttachRetry,
  scheduleShellAttachTimeout,
} from './shellSocketSideEffects';
import {
  applyShellLifecycleEventUpdate,
  deriveInitialShellAttachStartAction,
  deriveMeasuredShellAttachStartAction,
  deriveShellConnectedEventAction,
  deriveShellOutputEventApplication,
  deriveShellSocketCloseApplication,
  deriveShellSocketOpenApplication,
  shouldHandleShellSocketEvent,
} from './shellSocketLifecycle';
import { renderShellSnapshot, writeShellReplay } from './shellTerminal';

export interface ShellPendingCommand {
  command: string;
  beforeSnapshot: string;
}

export interface ShellSnapshotCursor {
  cursorX: number | undefined;
  cursorY: number | undefined;
  paneHeight: number | undefined;
}

export interface UseShellSocketLifecycleInput {
  shell: ShellSessionDto | null;
  shellAdapter: ThreadShellAdapter;
  canAttachShell: boolean;
  terminalReady: boolean;
  reconnectKey: number;
  terminalRef: MutableRefObject<Terminal | null>;
  socketRef: MutableRefObject<ShellSocketConnection | null>;
  viewerIdRef: MutableRefObject<string | null>;
  shellIdRef: MutableRefObject<string | null>;
  reconnectTimerRef: MutableRefObject<number | null>;
  attachTimeoutRef: MutableRefObject<number | null>;
  attachRetryTimerRef: MutableRefObject<number | null>;
  isVisibleRef: MutableRefObject<boolean>;
  intentionalDisconnectRef: MutableRefObject<boolean>;
  userDisconnectedShellIdRef: MutableRefObject<string | null>;
  shellSnapshotRef: MutableRefObject<string>;
  pendingCommandRef: MutableRefObject<ShellPendingCommand | null>;
  lastCommandOutputRef: MutableRefObject<string>;
  snapshotCursorRef: MutableRefObject<ShellSnapshotCursor>;
  syncTerminalSizeRef: MutableRefObject<
    () => { cols: number; rows: number } | null
  >;
  setReconnectKey: Dispatch<SetStateAction<number>>;
  setViewerId: (nextViewerId: string | null) => void;
  setIsConnecting: Dispatch<SetStateAction<boolean>>;
  setConnectionError: Dispatch<SetStateAction<string | null>>;
  setRuntimePromptLabel: Dispatch<SetStateAction<string | null>>;
  setIsCommandRunning: Dispatch<SetStateAction<boolean>>;
  settleAttachPromise: (connected: boolean) => void;
  onShellUpdate: (
    shellId: string,
    updater: (shell: ShellSessionDto) => ShellSessionDto,
    nextState?: ShellStatusDto,
  ) => void;
}

function refValue<T>(ref: MutableRefObject<T>) {
  return ref.current;
}

export function useShellSocketLifecycle({
  shell,
  shellAdapter,
  canAttachShell,
  terminalReady,
  reconnectKey,
  terminalRef,
  socketRef,
  viewerIdRef,
  shellIdRef,
  reconnectTimerRef,
  attachTimeoutRef,
  attachRetryTimerRef,
  isVisibleRef,
  intentionalDisconnectRef,
  userDisconnectedShellIdRef,
  shellSnapshotRef,
  pendingCommandRef,
  lastCommandOutputRef,
  snapshotCursorRef,
  syncTerminalSizeRef,
  setReconnectKey,
  setViewerId,
  setIsConnecting,
  setConnectionError,
  setRuntimePromptLabel,
  setIsCommandRunning,
  settleAttachPromise,
  onShellUpdate,
}: UseShellSocketLifecycleInput) {
  const shellId = shell?.id;
  const shellCwd = shell?.cwd;

  useEffect(() => {
    const terminal = terminalRef.current;
    const baseAttachStartInput = {
      shellId: shellId ?? null,
      terminalReady,
      isVisible: isVisibleRef.current,
      canAttachShell,
      userDisconnectedShellId: userDisconnectedShellIdRef.current,
      hasTerminal: Boolean(terminal),
      hasPendingAttachRetry: attachRetryTimerRef.current !== null,
      hasCurrentSocketForShell: Boolean(
        socketRef.current && shellIdRef.current === shellId,
      ),
      hasReconnectTimer: reconnectTimerRef.current !== null,
    };
    const initialAttachStartAction =
      deriveInitialShellAttachStartAction(baseAttachStartInput);

    if (initialAttachStartAction.type === 'skip') {
      return;
    }

    const attachSize = syncTerminalSizeRef.current();
    const attachStartAction = deriveMeasuredShellAttachStartAction({
      ...baseAttachStartInput,
      attachSize,
    });

    if (
      attachStartAction.type === 'skip' ||
      attachStartAction.type === 'measureSize'
    ) {
      return;
    }

    if (attachStartAction.type === 'scheduleRetry') {
      scheduleShellAttachRetry({
        attachRetryTimerRef,
        setReconnectKey,
      });
      return;
    }

    if (attachStartAction.shouldClearAttachRetry) {
      clearWindowTimerRef(attachRetryTimerRef);
    }

    if (attachStartAction.type === 'reuseSocket') {
      return;
    }

    if (attachStartAction.shouldClearReconnectTimer) {
      clearWindowTimerRef(reconnectTimerRef);
    }

    if (!shellId || !terminal) {
      return;
    }

    const nextAttachSize = attachStartAction.attachSize;

    shellIdRef.current = shellId;
    terminal.reset();
    setConnectionError(null);
    setViewerId(null);
    setIsConnecting(true);
    intentionalDisconnectRef.current = false;

    const shellSocket = shellAdapter.connectSocket({
      onConnected: () => {
        const existingAttachTimeout = attachTimeoutRef.current;
        const openApplication = deriveShellSocketOpenApplication({
          isCurrentSocket: socketRef.current?.socket === shellSocket.socket,
          shellId,
          attachSize: nextAttachSize,
          hasAttachTimeout: existingAttachTimeout !== null,
        });
        const openAction = openApplication.openAction;
        if (!openAction) {
          return;
        }
        shellSocket.send(openAction.message);
        if (
          openApplication.shouldClearAttachTimeout &&
          existingAttachTimeout !== null
        ) {
          clearWindowTimerRef(attachTimeoutRef);
        }
        if (openAction.shouldScheduleAttachTimeout) {
          scheduleShellAttachTimeout({
            shellSocket,
            socketRef,
            viewerIdRef,
            attachTimeoutRef,
            setConnectionError,
            setIsConnecting,
            settleAttachPromise,
          });
        }
      },
      onShellEvent: (event: ShellEventEnvelope) => {
        const shouldHandleEvent = shouldHandleShellSocketEvent({
          eventShellId: event.shellId,
          shellId,
          socketExists: Boolean(shellSocket.socket),
          isCurrentSocket: socketRef.current?.socket === shellSocket.socket,
        });
        if (!shouldHandleEvent) {
          return;
        }

        if (event.type === 'shell.connected') {
          clearWindowTimerRef(attachTimeoutRef);
          const connectedAction = deriveShellConnectedEventAction(event);
          setViewerId(connectedAction.viewerId);
          setIsConnecting(false);
          settleAttachPromise(connectedAction.settleAttachPromise);
          onShellUpdate(
            shellId,
            connectedAction.nextShell,
            'attached',
          );
          return;
        }

        if (event.type === 'shell.output') {
          const { output, snapshotUpdate } = deriveShellOutputEventApplication({
            event,
            shellCwd,
            currentSnapshot: shellSnapshotRef.current,
            pendingCommand: pendingCommandRef.current,
          });

          snapshotCursorRef.current = {
            cursorX: output.cursorX,
            cursorY: output.cursorY,
            paneHeight: output.paneHeight,
          };

          setRuntimePromptLabel(output.promptLabel);
          setIsCommandRunning(output.isCommandRunning);
          if (snapshotUpdate) {
            shellSnapshotRef.current = snapshotUpdate.nextSnapshot;
            pendingCommandRef.current = snapshotUpdate.nextPendingCommand;
            if (snapshotUpdate.lastCommandOutput !== null) {
              lastCommandOutputRef.current = snapshotUpdate.lastCommandOutput;
            }

            if (output.replace) {
              renderShellSnapshot(
                terminal,
                output.data,
                output.cursorX,
                output.cursorY,
                output.paneHeight,
              );
            } else if (output.replay) {
              writeShellReplay(terminal, output.data);
            } else {
              terminal.write(output.data);
            }
          }
          return;
        }

        const action = deriveShellLifecycleEventAction({
          event,
          currentViewerId: viewerIdRef.current,
        });
        if (!action) {
          return;
        }
        if (action.viewerId !== undefined) {
          setViewerId(action.viewerId);
        }
        if (action.isConnecting !== undefined) {
          setIsConnecting(action.isConnecting);
        }
        if (action.settleAttachPromise !== undefined) {
          settleAttachPromise(action.settleAttachPromise);
        }
        if (action.isCommandRunning !== undefined) {
          setIsCommandRunning(action.isCommandRunning);
        }
        if (action.connectionError !== undefined) {
          setConnectionError(action.connectionError);
        }
        if (action.intentionalDisconnect !== undefined) {
          intentionalDisconnectRef.current = action.intentionalDisconnect;
        }
          if (action.shellUpdate) {
            onShellUpdate(
              shellId,
              (entry) => applyShellLifecycleEventUpdate(entry, action),
              action.shellUpdate.status,
            );
          }
        if (action.closeSocket) {
          shellSocket.socket.close();
        }
      },
    });

    socketRef.current = shellSocket;

    shellSocket.socket.addEventListener('close', () => {
      const existingAttachTimeout = attachTimeoutRef.current;
      const closeApplication = deriveShellSocketCloseApplication({
        isCurrentSocket: socketRef.current?.socket === shellSocket.socket,
        hadViewer: Boolean(viewerIdRef.current),
        intentionalDisconnect: intentionalDisconnectRef.current,
        userDisconnectedShellId: userDisconnectedShellIdRef.current,
        shellId,
        hasAttachTimeout: existingAttachTimeout !== null,
      });
      applyShellSocketCloseEffects({
        closeApplication,
        shellId,
        attachTimeoutRef,
        socketRef,
        reconnectTimerRef,
        setViewerId,
        setIsConnecting,
        settleAttachPromise,
        onShellUpdate,
        setReconnectKey,
      });
    });

    return () => {
      const cleanupViewerId = refValue(viewerIdRef);
      const cleanupAction = deriveShellSocketCleanupApplicationFromRefs({
        shellId,
        viewerId: cleanupViewerId,
        shellSocket,
        attachRetryTimerRef,
        attachTimeoutRef,
        socketRef,
        openReadyState: WebSocket.OPEN,
      });
      applyShellSocketCleanupEffects({
        cleanupAction,
        shellSocket,
        attachRetryTimerRef,
        attachTimeoutRef,
        socketRef,
        intentionalDisconnectRef,
        setViewerId,
        setIsConnecting,
        settleAttachPromise,
      });
    };
  }, [
    attachRetryTimerRef,
    attachTimeoutRef,
    canAttachShell,
    intentionalDisconnectRef,
    isVisibleRef,
    lastCommandOutputRef,
    onShellUpdate,
    pendingCommandRef,
    reconnectKey,
    reconnectTimerRef,
    setConnectionError,
    setIsCommandRunning,
    setIsConnecting,
    setReconnectKey,
    setRuntimePromptLabel,
    setViewerId,
    settleAttachPromise,
    shellCwd,
    shellId,
    shellAdapter,
    shellIdRef,
    shellSnapshotRef,
    snapshotCursorRef,
    socketRef,
    syncTerminalSizeRef,
    terminalReady,
    terminalRef,
    userDisconnectedShellIdRef,
    viewerIdRef,
  ]);
}
