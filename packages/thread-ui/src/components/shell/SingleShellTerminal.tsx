import { translate as t, useI18n } from '../../i18n';
import { RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShellSessionDto, ShellStatusDto } from '@pockymoe/shared';

import type { ThreadShellAdapter } from '../../adapters';
import { ShellPane, type ShellPaneHandle } from './ShellPane';
import { ShellTouchControls } from './ShellTouchControls';
import { controlSequenceForLetter } from './shellSnapshot';
import { EMPTY_SHELL_PANE_RUNTIME_STATE, type ShellPaneRuntimeState } from './shellState';

/**
 * One terminal that is not part of a thread's terminal panel: the same pane,
 * socket, replay and phone key bar, without tabs, splits or "New terminal".
 * A harness sign-in window runs its login command here. `onExit` is called
 * once, when the device reports that the process ended.
 */
export function SingleShellTerminal({
  shell: initialShell,
  shellAdapter,
  effectiveTheme = 'dark',
  onExit,
}: {
  shell: ShellSessionDto;
  /** Only `connectSocket` is used. */
  shellAdapter: Pick<ThreadShellAdapter, 'connectSocket'>;
  effectiveTheme?: 'light' | 'dark';
  onExit?: () => void;
}) {
  useI18n();
  const [shell, setShell] = useState(initialShell);
  const [runtime, setRuntime] = useState<ShellPaneRuntimeState>(EMPTY_SHELL_PANE_RUNTIME_STATE);
  const [isMobileShell, setIsMobileShell] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const ctrlRef = useRef(false);
  const pane = useRef<ShellPaneHandle | null>(null);
  const exited = useRef(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const adapter = useRef<ThreadShellAdapter>({
    connectSocket: handlers => shellAdapter.connectSocket(handlers),
    fetchState: () => Promise.reject(new Error('unsupported')),
    createShell: () => Promise.reject(new Error('unsupported')),
    terminateShell: () => Promise.reject(new Error('unsupported')),
    updateShell: () => Promise.reject(new Error('unsupported')),
  });
  adapter.current.connectSocket = handlers => shellAdapter.connectSocket(handlers);

  // The same rule as the thread terminal panel (ThreadShellPanel).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
    const update = () => setIsMobileShell(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const transformInput = useCallback((data: string) => {
    if (!ctrlRef.current) return data;
    ctrlRef.current = false;
    setCtrlPressed(false);
    return data.length === 1 ? controlSequenceForLetter(data) ?? data : data;
  }, []);
  const onShellUpdate = useCallback(
    (_id: string, updater: (shell: ShellSessionDto) => ShellSessionDto, nextState?: ShellStatusDto) => {
      setShell(updater);
      if ((nextState === 'exited' || nextState === 'not_found') && !exited.current) {
        exited.current = true;
        onExitRef.current?.();
      }
    },
    [],
  );
  const ended = shell.status === 'exited' || shell.status === 'not_found';
  const status = ended || !runtime.hasShell || runtime.shellInputEnabled
    ? null
    : runtime.isConnecting
      ? { connecting: true, text: t('workbench.terminalConnecting') }
      : runtime.error || shell.status === 'detached'
        ? { connecting: false, text: runtime.error ?? t('workbench.terminalDisconnected') }
        : null;

  return (
    <div
      className={`terminal-panel shell-direct-input single-shell-terminal ${isMobileShell ? 'shell-is-mobile is-compact' : ''}`}
      data-terminal-theme={effectiveTheme}
      data-testid="single-shell-terminal"
    >
      <div className="terminal-body">
        <div className="terminal-groups" data-orientation="horizontal">
          <div className="terminal-pane is-active" style={{ flexGrow: 1 }} data-shell-id={shell.id} data-testid="terminal-pane">
            <ShellPane
              ref={pane}
              paneId={shell.id}
              shell={shell}
              isActive
              isVisible
              autoFocus={!isMobileShell}
              inputTransform={transformInput}
              isMobileShell={isMobileShell}
              effectiveTheme={effectiveTheme}
              workspacePathMissing={false}
              shellAdapter={adapter.current}
              onActivate={() => {}}
              onShellUpdate={onShellUpdate}
              onRuntimeStateChange={setRuntime}
            />
            {status && (
              <div className={`terminal-pane-status ${status.connecting ? 'is-connecting' : ''}`} role="status">
                <span>{status.text}</span>
                {!status.connecting && (
                  <button type="button" onClick={() => void pane.current?.reconnect()}>
                    <RotateCw size={13} aria-hidden="true" />{t('workbench.terminalReconnect')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {isMobileShell && !ended && (
        <ShellTouchControls
          enabled={runtime.shellInputEnabled}
          ctrl={ctrlPressed}
          onCtrl={() => { ctrlRef.current = !ctrlRef.current; setCtrlPressed(ctrlRef.current); }}
          onInput={data => { pane.current?.sendInput(transformInput(data)); }}
          onFocus={() => pane.current?.focus()}
          onPaste={() => { void pane.current?.pasteFromClipboard(); }}
          onSelect={() => pane.current?.startSelection()}
        />
      )}
    </div>
  );
}
