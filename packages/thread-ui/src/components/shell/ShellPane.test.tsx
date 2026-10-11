/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShellEventEnvelope, ShellSessionDto } from '@pockymoe/shared';
import type {
  ShellSocketConnection,
  ShellSocketHandlers,
  ThreadShellAdapter,
} from '../../adapters';
import {
  ShellPane,
  type ShellPaneHandle,
} from './ShellPane';
import { SHELL_ATTACH_TIMEOUT_MS } from './shellEvents';

const terminalInstances: FakeTerminal[] = [];

class FakeTerminal {
  cols = 100;
  rows = 30;
  options: Record<string, unknown>;
  writes: string[] = [];
  disposed = false;
  private dataHandler: ((data: string) => void) | null = null;

  constructor(options: Record<string, unknown>) {
    this.options = options;
    terminalInstances.push(this);
  }

  loadAddon() {}

  open(host: HTMLElement) {
    host.innerHTML = '<div class="xterm-rows"><div></div></div>';
  }

  attachCustomKeyEventHandler() {}

  onRender() { return {dispose() {}}; }

  onData(handler: (data: string) => void) {
    this.dataHandler = handler;
    return {
      dispose: () => {
        this.dataHandler = null;
      },
    };
  }

  input(value: string) { this.dataHandler?.(value); }

  write(value: string) {
    this.writes.push(value);
  }

  reset() {
    this.writes.push('reset');
  }

  scrollToBottom() {}

  resize(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  focus() {}

  dispose() {
    this.disposed = true;
  }
}

class FakeFitAddon {
  fit() {}
  // Tests set the terminal size directly.
  proposeDimensions() { return undefined; }
}

vi.mock('xterm', () => ({
  Terminal: FakeTerminal,
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: FakeFitAddon,
}));

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface FakeShellSocket extends ShellSocketConnection {
  handlers: ShellSocketHandlers;
  sentMessages: unknown[];
  close: () => void;
  emitClose: () => void;
}

function shell(extra: Partial<ShellSessionDto> = {}): ShellSessionDto {
  return {
    id: 'shell-1',
    threadId: 'thread-1',
    workspaceId: 'workspace-1',
    label: null,
    tmuxSessionName: 'tmux-shell-1',
    backend: 'pty',
    cwd: '/repo',
    status: 'running',
    attachedViewerId: null,
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    lastActivityAt: null,
    ...extra,
  };
}

function makeShellAdapter() {
  const sockets: FakeShellSocket[] = [];
  const adapter: ThreadShellAdapter = {
    fetchState: vi.fn(),
    createShell: vi.fn(),
    terminateShell: vi.fn(),
    updateShell: vi.fn(),
    connectSocket: vi.fn((handlers: ShellSocketHandlers) => {
      const socket: FakeShellSocket = {
        handlers,
        sentMessages: [],
        socket: new EventTarget() as WebSocket,
        close: vi.fn(),
        emitClose() {
          socket.socket.dispatchEvent(new Event('close'));
        },
        send(message: unknown) {
          socket.sentMessages.push(message);
        },
      };
      Object.defineProperty(socket.socket, 'readyState', {
        configurable: true,
        value: WebSocket.OPEN,
      });
      Object.defineProperty(socket.socket, 'close', {
        configurable: true,
        value: vi.fn(() => {
          socket.close();
          socket.emitClose();
        }),
      });
      sockets.push(socket);
      return socket;
    }),
  };

  return { adapter, sockets };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderShellPane({
  adapter,
  mobile = false,
  inputTransform,
  onShellUpdate = vi.fn(),
  onRuntimeStateChange = vi.fn(),
}: {
  adapter: ThreadShellAdapter;
  mobile?: boolean;
  inputTransform?: (data: string) => string;
  onShellUpdate?: Parameters<typeof ShellPane>[0]['onShellUpdate'];
  onRuntimeStateChange?: Parameters<
    typeof ShellPane
  >[0]['onRuntimeStateChange'];
}) {
  const handleRef = { current: null as ShellPaneHandle | null };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  flushSync(() => {
    root?.render(
      <ShellPane
        ref={handleRef}
        paneId="primary"
        shell={shell()}
        isActive
        isVisible
        isMobileShell={mobile}
        {...(inputTransform ? {inputTransform} : {})}
        effectiveTheme="dark"
        workspacePathMissing={false}
        shellAdapter={adapter}
        onActivate={vi.fn()}
        onShellUpdate={onShellUpdate}
        onRuntimeStateChange={onRuntimeStateChange}
      />,
    );
  });

  return { handleRef, onShellUpdate, onRuntimeStateChange };
}

async function waitForConnect(adapter: ThreadShellAdapter) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (vi.mocked(adapter.connectSocket).mock.calls.length > 0) {
      return;
    }
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}

function emitConnected(socket: FakeShellSocket, viewerId = 'viewer-1') {
  const connectedEvent: ShellEventEnvelope = {
    type: 'shell.connected',
    shellId: 'shell-1',
    timestamp: '2026-06-10T00:00:00.000Z',
    payload: {
      viewerId,
    },
  };
  flushSync(() => {
    socket.handlers.onShellEvent?.(connectedEvent);
  });
}

async function attachShell(
  adapter: ThreadShellAdapter,
  sockets: FakeShellSocket[],
) {
  await waitForConnect(adapter);
  const socket = sockets[0];
  if (!socket) {
    throw new Error('Expected shell socket to be connected.');
  }
  flushSync(() => {
    socket.handlers.onConnected?.({});
  });
  emitConnected(socket);
  return socket;
}

describe('ShellPane', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
        ResizeObserver: typeof FakeResizeObserver;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = FakeResizeObserver;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 400,
      top: 0,
      right: 800,
      bottom: 400,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    terminalInstances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
  });

  it('accepts mobile IME text and applies touch control modifiers to direct input', async () => {
    const { adapter, sockets } = makeShellAdapter();
    renderShellPane({ adapter, mobile: true, inputTransform: data => data === 'c' ? '\x03' : data });
    const socket = await attachShell(adapter, sockets);
    expect(terminalInstances[0]!.options.disableStdin).toBe(false);
    terminalInstances[0]!.input('中文');
    terminalInstances[0]!.input('c');
    expect(socket.sentMessages).toContainEqual({type:'shell.input',shellId:'shell-1',viewerId:'viewer-1',data:'中文'});
    expect(socket.sentMessages).toContainEqual({type:'shell.input',shellId:'shell-1',viewerId:'viewer-1',data:'\x03'});
  });

  it('attaches with the measured terminal size and handles connected events', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const onShellUpdate = vi.fn();
    renderShellPane({ adapter, onShellUpdate });

    await waitForConnect(adapter);
    flushSync(() => {
      sockets[0]?.handlers.onConnected?.({});
    });

    expect(adapter.connectSocket).toHaveBeenCalledTimes(1);
    expect(sockets[0]?.sentMessages).toContainEqual({
      type: 'shell.attach',
      shellId: 'shell-1',
      cols: 100,
      rows: 30,
    });

    emitConnected(sockets[0]);

    expect(onShellUpdate).toHaveBeenCalledWith(
      'shell-1',
      expect.any(Function),
      'attached',
    );
  });

  it('sends detach and marks the shell detached on manual disconnect', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const onShellUpdate = vi.fn();
    const { handleRef } = renderShellPane({ adapter, onShellUpdate });

    const socket = await attachShell(adapter, sockets);

    flushSync(() => {
      handleRef.current?.disconnect();
    });

    expect(socket.sentMessages).toContainEqual({
      type: 'shell.detach',
      shellId: 'shell-1',
      viewerId: 'viewer-1',
    });
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(onShellUpdate).toHaveBeenCalledWith(
      'shell-1',
      expect.any(Function),
      'detached',
    );
  });

  it('reconnects after manual disconnect and resolves when reattached', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const { handleRef } = renderShellPane({ adapter });

    const firstSocket = await attachShell(adapter, sockets);
    flushSync(() => {
      handleRef.current?.disconnect();
    });

    const reconnectPromise = handleRef.current?.reconnect();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (sockets.length > 1) {
        break;
      }
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    expect(firstSocket.close).toHaveBeenCalled();
    expect(adapter.connectSocket).toHaveBeenCalledTimes(2);

    const secondSocket = sockets[1];
    expect(secondSocket).toBeDefined();
    flushSync(() => {
      secondSocket.handlers.onConnected?.({});
    });
    expect(secondSocket.sentMessages).toContainEqual({
      type: 'shell.attach',
      shellId: 'shell-1',
      cols: 100,
      rows: 30,
    });

    emitConnected(secondSocket, 'viewer-2');

    await expect(reconnectPromise).resolves.toBe(true);
  });

  it('marks detached and schedules reconnect after an unexpected socket close', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const onShellUpdate = vi.fn();
    renderShellPane({ adapter, onShellUpdate });

    const firstSocket = await attachShell(adapter, sockets);
    vi.useFakeTimers();
    flushSync(() => {
      firstSocket.emitClose();
    });

    expect(onShellUpdate).toHaveBeenCalledWith(
      'shell-1',
      expect.any(Function),
      'detached',
    );

    flushSync(() => {
      vi.advanceTimersByTime(800);
    });
    await Promise.resolve();

    expect(adapter.connectSocket).toHaveBeenCalledTimes(2);
  });

  it('times out a socket that opens without a shell.connected event', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const onRuntimeStateChange = vi.fn();
    renderShellPane({ adapter, onRuntimeStateChange });

    await waitForConnect(adapter);
    const socket = sockets[0];
    expect(socket).toBeDefined();

    vi.useFakeTimers();
    flushSync(() => {
      socket.handlers.onConnected?.({});
    });

    expect(socket.sentMessages).toContainEqual({
      type: 'shell.attach',
      shellId: 'shell-1',
      cols: 100,
      rows: 30,
    });

    flushSync(() => {
      vi.advanceTimersByTime(SHELL_ATTACH_TIMEOUT_MS);
    });

    expect(socket.close).toHaveBeenCalled();
    expect(onRuntimeStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isConnecting: false,
        error: 'Shell connection timed out. Reconnecting...',
      }),
    );
  });

  it('syncs backend size when refreshLayout sees a new attached terminal size', async () => {
    const { adapter, sockets } = makeShellAdapter();
    const { handleRef } = renderShellPane({ adapter });

    const socket = await attachShell(adapter, sockets);
    const terminal = terminalInstances[0];
    expect(terminal).toBeDefined();

    terminal.cols = 132;
    terminal.rows = 42;

    flushSync(() => {
      handleRef.current?.refreshLayout({ syncBackendSize: true });
    });

    expect(socket.sentMessages).toContainEqual({
      type: 'shell.resize',
      shellId: 'shell-1',
      viewerId: 'viewer-1',
      cols: 132,
      rows: 42,
    });
  });
});
