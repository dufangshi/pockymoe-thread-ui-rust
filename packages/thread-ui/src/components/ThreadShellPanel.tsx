import { translate as t, useI18n } from '../i18n';
import {
  ChevronDown,
  ChevronUp,
  Ellipsis,
  MessageSquare,
  PanelBottomClose,
  PanelBottomOpen,
  Check,
  Pencil,
  Plus,
  RotateCw,
  SquareSplitHorizontal,
  SquareSplitVertical,
  SquareTerminal,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import type {
  ShellSessionDto,
  ShellStatusDto,
  ThreadShellStateDto,
} from '@pockymoe/shared';
import type { ThreadShellAdapter } from '../adapters';
import type { WorkbenchToolPanelControls } from './workbench/toolPanel';
import { ShellPane, type ShellPaneHandle } from './shell/ShellPane';
import {
  EMPTY_SHELL_PANE_RUNTIME_STATE,
  buildConnectionButtonState,
  buildShellControlState,
  isLiveShell,
  runtimeStatesEqual,
  type ShellPaneRuntimeState,
  type ThreadShellControlState,
} from './shell/shellState';
import { ShellTouchControls } from './shell/ShellTouchControls';
import { controlSequenceForLetter } from './shell/shellSnapshot';
import { TerminalMenu } from './shell/TerminalMenu';
import { confirmAsync } from './menu/confirmAsync';
import { ErrorMark } from './copy/ErrorMark';
import {
  TERMINAL_TABS_DEFAULT,
  TERMINAL_TABS_MAX,
  TERMINAL_TABS_NARROW,
  TerminalStatusDot,
  TerminalTabs,
  type TerminalStatus,
  type TerminalTabEntry,
} from './shell/TerminalTabs';
import {
  TERMINAL_GROUP_MAX_PANES,
  TERMINAL_PANE_MIN_SIZE,
  activeTerminalGroup,
  addTerminalGroup,
  adjacentTerminal,
  loadTerminalLayout,
  reconcileTerminalLayout,
  removeTerminal,
  resizeTerminalPanes,
  saveTerminalLayout,
  splitTerminal,
  type TerminalLayout,
} from './shell/terminalLayout';

export type { ThreadShellControlState } from './shell/shellState';

interface ThreadShellPanelProps {
  threadId: string;
  shellAdapter: ThreadShellAdapter;
  isVisible?: boolean;
  showHeader?: boolean;
  onBackToChat?: (() => void) | undefined;
  /** @deprecated The phone key bar replaced the floating toolbox. */
  showFloatingToolbox?: boolean;
  effectiveTheme?: 'light' | 'dark';
  /** @deprecated Split sizes are stored with the per-thread terminal layout. */
  loadSplitRatio?: (threadId: string) => number | null | undefined;
  /** @deprecated Split sizes are stored with the per-thread terminal layout. */
  saveSplitRatio?: (threadId: string, ratio: number) => void;
  onStateChange?: (state: ThreadShellControlState) => void;
  /** Bottom-panel actions (collapse, maximize, hide) rendered in the title bar. */
  panelControls?: WorkbenchToolPanelControls;
  /** Device · workspace · conversation the commands run in. */
  targetLabel?: string;
  layoutStorageKey?: string;
  /**
   * Bumped when the user opens the terminal for this target: focus it and create
   * a first terminal if there is none. 0 means no request, so following another
   * chat never spawns a shell. Omit it for the legacy behaviour of creating one
   * whenever the panel becomes visible empty.
   */
  openRequest?: number;
  /** Like VS Code, hide the panel after the last terminal is killed or exits. */
  onLastTerminalClosed?: () => void;
}

export interface ThreadShellPanelHandle {
  toggleConnection: () => Promise<void>;
  sendInput: (data: string) => boolean;
  sendCommand: (command: string) => boolean;
  sendControl: (
    action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down' | 'clear',
  ) => boolean;
  copyLastCommandOutput: () => Promise<boolean>;
  terminate: () => Promise<void>;
  focus: () => void;
  refreshLayout: (options?: { focus?: boolean; syncBackendSize?: boolean }) => void;
}

const TABS_WIDTH_KEY = 'remote-codex.terminal-tabs-width';
const SASH_SIZE = 1;

function readTabsWidth() {
  try {
    const value = Number(localStorage.getItem(TABS_WIDTH_KEY));
    return Number.isFinite(value) && value >= TERMINAL_TABS_NARROW ? Math.min(TERMINAL_TABS_MAX, value) : TERMINAL_TABS_DEFAULT;
  } catch {
    return TERMINAL_TABS_DEFAULT;
  }
}

type TerminalMenuState =
  | { kind: 'switcher'; anchor: DOMRect }
  | { kind: 'actions'; anchor: DOMRect | { x: number; y: number }; shellId: string };

function IconButton({ label, onClick, disabled, pressed, expanded, children, testId, keepFocus, danger }: {
  label: string;
  /** Destroys something: drawn in the danger color. */
  danger?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  children: ReactNode;
  testId?: string;
  /** A layout-only control: a focused terminal keeps focus (and a phone its
      keyboard), so the panel does not resize twice under the reader. */
  keepFocus?: boolean;
}) {
  return (
    <button
      type="button"
      className={`terminal-icon-button${danger ? ' is-danger' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      {...(expanded !== undefined ? { 'aria-expanded': expanded, 'aria-haspopup': 'menu' as const } : {})}
      {...(testId ? { 'data-testid': testId } : {})}
      {...(keepFocus ? { onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (document.activeElement?.closest('.xterm')) event.preventDefault();
      } } : {})}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const ThreadShellPanel = forwardRef<
  ThreadShellPanelHandle,
  ThreadShellPanelProps
>(function ThreadShellPanel(
  {
    threadId,
    shellAdapter,
    isVisible = true,
    showHeader = true,
    onBackToChat,
    effectiveTheme = 'dark',
    onStateChange,
    panelControls,
    targetLabel,
    layoutStorageKey,
    openRequest,
    onLastTerminalClosed,
  }: ThreadShellPanelProps,
  ref,
) {
  const { locale } = useI18n();
  const layoutKey = layoutStorageKey ?? `pockymoe:terminal-layout:${threadId}`;
  const [shellState, setShellState] = useState<ThreadShellStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedLayout, setStoredLayout] = useState<TerminalLayout>(() => loadTerminalLayout(layoutKey));
  const [runtime, setRuntime] = useState<Record<string, ShellPaneRuntimeState>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const renamingRef = useRef<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [menu, setMenu] = useState<TerminalMenuState | null>(null);
  const [tabsWidth, setTabsWidth] = useState(readTabsWidth);
  const [groupsSize, setGroupsSize] = useState({ width: 0, height: 0 });
  const [focusArmed, setFocusArmed] = useState(false);
  const [isMobileShell, setIsMobileShell] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const groupsRef = useRef<HTMLDivElement | null>(null);
  const paneRefs = useRef(new Map<string, ShellPaneHandle>());
  const createInFlight = useRef(false);
  const handledOpenRequest = useRef<number | undefined>(undefined);
  const pendingAutoCreate = useRef(openRequest === undefined);
  const hadLiveShells = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const compact = panelControls?.compact ?? isMobileShell;
  const collapsed = panelControls?.collapsed ?? false;
  const panelVisible = isVisible && !collapsed;
  const panelRef = useRef<HTMLDivElement>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const ctrlRef = useRef(false);
  const transformInput = useCallback((data: string) => {
    if (!ctrlRef.current) return data;
    ctrlRef.current = false;
    setCtrlPressed(false);
    return data.length === 1 ? controlSequenceForLetter(data) ?? data : data;
  }, []);

  const shells = useMemo(
    () => [...(shellState?.shells ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)),
    [shellState?.shells],
  );
  const liveShells = useMemo(() => shells.filter(isLiveShell), [shells]);
  const liveIds = useMemo(() => liveShells.map(shell => shell.id), [liveShells]);
  const liveIdsRef = useRef(liveIds);
  liveIdsRef.current = liveIds;
  const layout = useMemo(
    () => (shellState ? reconcileTerminalLayout(storedLayout, liveIds) : storedLayout),
    [liveIds, shellState, storedLayout],
  );
  const activeGroup = activeTerminalGroup(layout);
  const activeShell = liveShells.find(shell => shell.id === layout.activeShellId) ?? null;
  const activeRuntime = (activeShell && runtime[activeShell.id]) || EMPTY_SHELL_PANE_RUNTIME_STATE;
  const workspacePathMissing = shellState?.workspacePathStatus === 'missing';
  const vertical = compact || (groupsSize.width > 0 && groupsSize.width < 520);
  const showTabs = !compact && liveShells.length >= 2;
  const status = shellState?.state ?? 'not_created';

  const labels = useMemo(() => new Map(liveShells.map((shell, index) => [
    shell.id,
    shell.label?.trim() || t('workbench.terminalDefaultName', { value1: layout.numbers?.[shell.id] ?? index + 1 }),
  ])), [layout.numbers, liveShells, locale]);
  const terminalStatus = useCallback((shell: ShellSessionDto): TerminalStatus => {
    const state = runtime[shell.id];
    if (state?.shellInputEnabled) return 'connected';
    if (state?.isConnecting) return 'connecting';
    if (state?.error || shell.status === 'detached') return 'disconnected';
    return 'running';
  }, [runtime]);
  const entries = useMemo(() => new Map<string, TerminalTabEntry>(liveShells.map(shell => [
    shell.id,
    { id: shell.id, label: labels.get(shell.id) ?? shell.id, status: terminalStatus(shell), detail: `${shell.cwd} · ${shell.id.slice(0, 8)}` },
  ])), [labels, liveShells, terminalStatus]);
  const activeLabel = activeShell ? labels.get(activeShell.id) ?? null : null;
  // Read when a terminal is killed, without recreating the kill action on each output.
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  useEffect(() => {
    if (shellState) saveTerminalLayout(layoutKey, layout);
  }, [layout, layoutKey, shellState]);

  const showFeedback = useCallback((_tone: unknown, text: string) => {
    setFeedback(text);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => { setFeedback(null); feedbackTimer.current = null; }, 1800);
  }, []);
  useEffect(() => () => { if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current); }, []);

  const loadShellState = useCallback(async () => {
    try {
      const response = await shellAdapter.fetchState(threadId);
      setShellState(response);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('files.unableToLoadShellState'));
    } finally {
      setLoading(false);
    }
  }, [shellAdapter, threadId]);

  useEffect(() => {
    setLoading(true);
    void loadShellState();
  }, [loadShellState]);

  const updateShellEntry = useCallback(
    (shellId: string, updater: (shell: ShellSessionDto) => ShellSessionDto, nextState?: ShellStatusDto) => {
      setShellState((current) => {
        if (!current) return current;
        const nextShells = current.shells.map(shell => (shell.id === shellId ? updater(shell) : shell));
        return {
          ...current,
          ...(nextState ? { state: nextState } : {}),
          shell: current.shell?.id === shellId ? updater(current.shell) : current.shell,
          shells: nextShells,
        };
      });
      // The process ended on the device (`exit`): drop it like VS Code does.
      if (nextState === 'exited' || nextState === 'not_found') void loadShellState();
    },
    [loadShellState],
  );

  const runtimeHandlers = useRef(new Map<string, (state: ShellPaneRuntimeState) => void>());
  const runtimeHandler = useCallback((shellId: string) => {
    let handler = runtimeHandlers.current.get(shellId);
    if (!handler) {
      handler = (next: ShellPaneRuntimeState) => setRuntime(current =>
        current[shellId] && runtimeStatesEqual(current[shellId], next) ? current : { ...current, [shellId]: next });
      runtimeHandlers.current.set(shellId, handler);
    }
    return handler;
  }, []);
  const paneRefHandlers = useRef(new Map<string, (handle: ShellPaneHandle | null) => void>());
  const paneRef = useCallback((shellId: string) => {
    let handler = paneRefHandlers.current.get(shellId);
    if (!handler) {
      handler = (handle: ShellPaneHandle | null) => {
        if (handle) paneRefs.current.set(shellId, handle);
        else paneRefs.current.delete(shellId);
      };
      paneRefHandlers.current.set(shellId, handler);
    }
    return handler;
  }, []);
  const activePane = () => (layout.activeShellId ? paneRefs.current.get(layout.activeShellId) ?? null : null);

  const updateLayout = useCallback((change: (layout: TerminalLayout) => TerminalLayout) => {
    setStoredLayout(current => change(reconcileTerminalLayout(current, liveIdsRef.current)));
  }, []);
  const activate = useCallback((shellId: string) => {
    if (layout.activeShellId !== shellId) updateLayout(current => ({ ...current, activeShellId: shellId }));
  }, [layout.activeShellId, updateLayout]);
  const select = useCallback((shellId: string) => {
    setFocusArmed(true);
    updateLayout(current => ({ ...current, activeShellId: shellId }));
  }, [updateLayout]);

  const createTerminal = useCallback(async (mode: 'group' | 'split', targetId?: string | null) => {
    if (createInFlight.current) return;
    createInFlight.current = true;
    setBusy(true);
    try {
      const response = await shellAdapter.createShell(threadId);
      setShellState(current => ({
        ...response,
        shells: [...new Map([
          ...(current?.shells ?? []).map(shell => [shell.id, shell] as const),
          ...(response.shells ?? (response.shell ? [response.shell] : [])).map(shell => [shell.id, shell] as const),
        ]).values()],
      }));
      const shellId = response.activeShellId ?? response.shell?.id ?? null;
      if (shellId) {
        updateLayout(current => (mode === 'split' && targetId && current.groups.some(group => group.shellIds.includes(targetId))
          ? splitTerminal(current, targetId, shellId)
          : addTerminalGroup(current, shellId)));
        setFocusArmed(true);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('files.unableToCreateShell'));
    } finally {
      createInFlight.current = false;
      setBusy(false);
    }
  }, [shellAdapter, threadId, updateLayout]);

  const killTerminal = useCallback(async (shellId: string | null | undefined) => {
    if (!shellId) return;
    // A command still runs there: ask first. An idle shell just closes.
    if (runtimeRef.current[shellId]?.isCommandRunning && !(await confirmAsync({
      title: t('workbench.terminalKillRunningTitle', { value1: labelsRef.current.get(shellId) ?? shellId.slice(0, 8) }),
      description: t('workbench.terminalKillRunningBody'),
      confirmLabel: t('workbench.terminalKill'),
    }))) return;
    setBusy(true);
    try {
      await shellAdapter.terminateShell(shellId);
      updateLayout(current => removeTerminal(current, shellId));
      setShellState(current => current ? { ...current, shells: current.shells.filter(shell => shell.id !== shellId) } : current);
      setError(null);
      await loadShellState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('files.unableToTerminateShell'));
    } finally {
      setBusy(false);
    }
  }, [loadShellState, shellAdapter, updateLayout]);

  const startRename = useCallback((shellId: string) => {
    renamingRef.current = shellId;
    setRenamingId(shellId);
    setRenameDraft(labels.get(shellId) ?? '');
  }, [labels]);
  const cancelRename = useCallback(() => {
    renamingRef.current = null;
    setRenamingId(null);
  }, []);
  const submitRename = useCallback(async () => {
    const shellId = renamingRef.current;
    if (!shellId) return;
    renamingRef.current = null;
    setRenamingId(null);
    const label = renameDraft.trim();
    try {
      const updated = await shellAdapter.updateShell(shellId, { label: label || null });
      updateShellEntry(shellId, () => updated);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('files.unableToRenameShell'));
    }
  }, [renameDraft, shellAdapter, updateShellEntry]);

  // An explicit open focuses the terminal and creates the first one if needed.
  useEffect(() => {
    if (!openRequest || openRequest === handledOpenRequest.current) return;
    handledOpenRequest.current = openRequest;
    pendingAutoCreate.current = true;
    setFocusArmed(true);
  }, [openRequest]);
  // Runs after the request effect above; it also depends on the request so a
  // reopen of an already loaded, empty target still creates its terminal.
  useEffect(() => {
    if (!pendingAutoCreate.current || !panelVisible || !shellState || loading || busy || workspacePathMissing || status === 'creating') return;
    pendingAutoCreate.current = false;
    if (liveShells.length === 0) void createTerminal('group');
  }, [busy, createTerminal, liveShells.length, loading, openRequest, panelVisible, shellState, status, workspacePathMissing]);
  useEffect(() => {
    if (!shellState || loading) return;
    if (hadLiveShells.current && liveShells.length === 0) onLastTerminalClosed?.();
    hadLiveShells.current = liveShells.length > 0;
  }, [liveShells.length, loading, onLastTerminalClosed, shellState]);

  // Focus belongs to the terminal until the user focuses something else.
  useEffect(() => {
    if (!focusArmed) return;
    const leave = (event: FocusEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setFocusArmed(false);
    };
    document.addEventListener('focusin', leave);
    return () => document.removeEventListener('focusin', leave);
  }, [focusArmed, panelRef]);
  useEffect(() => {
    if (!focusArmed || !panelVisible || isMobileShell || !layout.activeShellId) return;
    const frame = window.requestAnimationFrame(() => paneRefs.current.get(layout.activeShellId!)?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [focusArmed, isMobileShell, layout.activeShellId, panelVisible]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
    const update = () => setIsMobileShell(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const node = groupsRef.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setGroupsSize(current => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const axisSize = vertical ? groupsSize.height : groupsSize.width;
  const canSplit = useCallback((shellId: string) => {
    const group = layout.groups.find(entry => entry.shellIds.includes(shellId));
    if (!group || group.shellIds.length >= TERMINAL_GROUP_MAX_PANES) return false;
    return axisSize === 0 || axisSize / (group.shellIds.length + 1) >= TERMINAL_PANE_MIN_SIZE;
  }, [axisSize, layout.groups]);

  const connectionButtonState = buildConnectionButtonState({
    activeRuntime,
    activeShell,
    busy,
    loading,
    status,
    workspacePathMissing,
  });
  const handleConnectionToggle = async () => {
    if (connectionButtonState.disabled) return;
    if (activeRuntime.shellInputEnabled) {
      activePane()?.disconnect();
      return;
    }
    if (!activeShell) {
      await createTerminal('group');
      return;
    }
    await activePane()?.reconnect();
  };

  useEffect(() => {
    onStateChange?.(buildShellControlState({
      activeRuntime,
      activeShell,
      connectionButtonDisabled: connectionButtonState.disabled,
      connectionButtonLabel: connectionButtonState.label,
      isMobileShell,
      busy,
      loading,
      error,
    }));
  }, [activeRuntime, activeShell, busy, connectionButtonState.disabled, connectionButtonState.label, error, isMobileShell, loading, onStateChange]);

  useImperativeHandle(ref, () => ({
    async toggleConnection() { await handleConnectionToggle(); },
    sendInput(data: string) { return activePane()?.sendInput(data) ?? false; },
    sendCommand(command: string) { return activePane()?.sendCommand(command) ?? false; },
    sendControl(action) { return activePane()?.sendControl(action) ?? false; },
    async copyLastCommandOutput() { return (await activePane()?.copyLastCommandOutput()) ?? false; },
    async terminate() { await killTerminal(layout.activeShellId); },
    focus() { activePane()?.focus(); },
    refreshLayout(options) {
      for (const shellId of activeGroup?.shellIds ?? []) paneRefs.current.get(shellId)?.refreshLayout(options);
    },
  }));

  const startDrag = (event: ReactPointerEvent, onMove: (delta: number) => void, onEnd?: () => void) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const origin = { x: event.clientX, y: event.clientY };
    const move = (moveEvent: PointerEvent) => onMove(vertical && target.dataset.axis !== 'x'
      ? moveEvent.clientY - origin.y
      : moveEvent.clientX - origin.x);
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      onEnd?.();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  };
  const paneSashes = activeGroup && activeGroup.shellIds.length > 1
    ? activeGroup.shellIds.slice(0, -1).map((shellId, index) => {
      const total = axisSize - SASH_SIZE * (activeGroup.shellIds.length - 1);
      const resize = (delta: number, from = activeGroup.sizes) => updateLayout(current => ({
        ...current,
        groups: current.groups.map(group => (group.shellIds.includes(shellId)
          ? { ...group, sizes: resizeTerminalPanes(from, index, delta, total) }
          : group)),
      }));
      return (
        <div
          key={`sash-${shellId}`}
          role="separator"
          tabIndex={0}
          aria-label={t('workbench.terminalResizePanes')}
          aria-orientation={vertical ? 'horizontal' : 'vertical'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((activeGroup.sizes[index] ?? 0) * 100)}
          className="terminal-pane-sash"
          data-testid="terminal-pane-sash"
          style={{ order: index * 2 + 1 }}
          onPointerDown={(event) => {
            const from = activeGroup.sizes;
            startDrag(event, delta => resize(delta, from));
          }}
          onKeyDown={(event) => {
            const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            resize(event.key === keys[0] ? -24 : 24);
          }}
        />
      );
    })
    : null;

  const resizeTabs = (width: number, persist: boolean) => {
    const max = Math.max(TERMINAL_TABS_NARROW, Math.min(TERMINAL_TABS_MAX, Math.round((groupsSize.width + tabsWidth) / 2)));
    const next = Math.round(Math.max(TERMINAL_TABS_NARROW, Math.min(max, width)));
    setTabsWidth(next);
    if (persist) {
      try { localStorage.setItem(TABS_WIDTH_KEY, String(next)); } catch { /* Optional preference. */ }
    }
    return next;
  };

  const openActions = (shellId: string, event: ReactMouseEvent | ReactKeyboardEvent) => {
    const anchor = 'clientX' in event && event.clientX ? { x: event.clientX, y: event.clientY } : (event.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ kind: 'actions', anchor, shellId });
  };
  const menuItem = (key: string, label: string, icon: ReactNode, onSelect: () => void, options: { danger?: boolean; disabled?: boolean } = {}) => (
    <button key={key} type="button" role="menuitem" className={`terminal-menu-item ${options.danger ? 'is-danger' : ''}`} disabled={options.disabled}
      onClick={() => { setMenu(null); onSelect(); }}>
      {icon}<span>{label}</span>
    </button>
  );
  const SplitIcon = vertical ? SquareSplitVertical : SquareSplitHorizontal;

  const renderMenu = () => {
    if (!menu) return null;
    if (menu.kind === 'actions') {
      const label = labels.get(menu.shellId) ?? '';
      const attached = Boolean(runtime[menu.shellId]?.shellInputEnabled);
      const pane = paneRefs.current.get(menu.shellId);
      return (
        <TerminalMenu anchor={menu.anchor} label={t('workbench.terminalMore')} onClose={() => setMenu(null)}>
          {menuItem('split', t('workbench.terminalSplit'), <SplitIcon size={15} />, () => void createTerminal('split', menu.shellId), { disabled: busy || !canSplit(menu.shellId) })}
          {menuItem('rename', t('workbench.terminalRenameNamed', { value1: label }), <Pencil size={15} />, () => startRename(menu.shellId))}
          {/* Stop watching without touching the process; distinct from Kill. */}
          {menuItem('connection', attached ? t('workbench.disconnectShell') : t('workbench.terminalReconnect'),
            attached ? <Unplug size={15} /> : <RotateCw size={15} />,
            () => { if (attached) pane?.disconnect(); else void pane?.reconnect(); }, { disabled: !pane })}
          {panelControls && menuItem('collapse', panelControls.collapsed ? t('workbench.terminalExpand') : t('workbench.terminalCollapse'),
            panelControls.collapsed ? <PanelBottomOpen size={15} /> : <PanelBottomClose size={15} />, panelControls.toggleCollapsed)}
          {menuItem('kill', t('workbench.terminalKillNamed', { value1: label }), <Trash2 size={15} />, () => void killTerminal(menu.shellId), { danger: true, disabled: busy })}
        </TerminalMenu>
      );
    }
    return (
      <TerminalMenu anchor={menu.anchor} label={t('workbench.terminalSwitch')} onClose={() => { cancelRename(); setMenu(null); }}>
        {layout.groups.flatMap(group => group.shellIds.map((shellId, index) => {
          const entry = entries.get(shellId);
          if (!entry) return null;
          const prefix = group.shellIds.length > 1 ? (index === 0 ? '┌ ' : index === group.shellIds.length - 1 ? '└ ' : '├ ') : '';
          return (
            <div key={shellId} className="terminal-menu-row" data-shell-id={shellId}>
              {renamingId === shellId ? (
                <form className="terminal-menu-rename" onSubmit={(event) => { event.preventDefault(); void submitRename(); }}>
                  <input aria-label={t('workbench.terminalName')} value={renameDraft} autoFocus onChange={event => setRenameDraft(event.currentTarget.value)} />
                  <button type="submit" className="terminal-icon-button" aria-label={t('files.save')} title={t('files.save')}><Check size={15} /></button>
                </form>
              ) : (
                <>
                  <button type="button" role="menuitemradio" aria-checked={layout.activeShellId === shellId} className="terminal-menu-item"
                    onClick={() => { setMenu(null); updateLayout(current => ({ ...current, activeShellId: shellId })); }}>
                    <span className="terminal-tab-prefix" aria-hidden="true">{prefix}</span>
                    <SquareTerminal size={15} aria-hidden="true" />
                    <span>{entry.label}</span>
                    <TerminalStatusDot status={entry.status} />
                  </button>
                  <button type="button" className="terminal-icon-button" aria-label={t('workbench.terminalRenameNamed', { value1: entry.label })} onClick={() => startRename(shellId)}><Pencil size={15} /></button>
                  <button type="button" className="terminal-icon-button is-danger" aria-label={t('workbench.terminalKillNamed', { value1: entry.label })} disabled={busy} onClick={() => void killTerminal(shellId)}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          );
        }))}
        {menuItem('new', t('workbench.terminalNew'), <Plus size={15} />, () => void createTerminal('group'), { disabled: busy || loading || workspacePathMissing })}
      </TerminalMenu>
    );
  };

  const statusText = (shell: ShellSessionDto) => {
    const state = runtime[shell.id];
    if (!state || state.shellInputEnabled || !panelVisible) return null;
    if (state.isConnecting) return { connecting: true, text: t('workbench.terminalConnecting') };
    if (state.error || shell.status === 'detached') return { connecting: false, text: state.error ?? t('workbench.terminalDisconnected') };
    return null;
  };

  // A failed terminal action (or the first load) is a mark beside the toolbar,
  // not a banner; a missing workspace folder greys New and says why on a tap.
  const errorMark = error ? (
    <ErrorMark message={error} onRetry={shellState ? undefined : () => { setLoading(true); void loadShellState(); }} />
  ) : null;
  const missingMark = workspacePathMissing
    ? <ErrorMark kind="unavailable" message={t('files.workspacePathIsMissingOnThisMachine')} />
    : null;

  const header = showHeader && (
    <div className="terminal-header" onDoubleClick={(event) => {
      if (panelControls && event.target === event.currentTarget) panelControls.toggleMaximized();
    }}>
      {compact ? (
        <button
          type="button"
          className="terminal-switcher"
          aria-label={`${t('workbench.terminalSwitch')}: ${activeLabel ?? t('workbench.terminal')}`}
          aria-haspopup="menu"
          aria-expanded={menu?.kind === 'switcher'}
          disabled={!liveShells.length}
          onClick={(event) => setMenu({ kind: 'switcher', anchor: event.currentTarget.getBoundingClientRect() })}
        >
          <SquareTerminal size={15} aria-hidden="true" />
          <span>{activeLabel ?? t('workbench.terminal')}</span>
          {activeShell && <TerminalStatusDot status={terminalStatus(activeShell)} />}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      ) : (
        <>
          <h2 className="terminal-title">{t('workbench.terminal')}</h2>
          {!showTabs && activeShell && (
            <span className="terminal-header-active" title={entries.get(activeShell.id)?.detail}>
              <TerminalStatusDot status={terminalStatus(activeShell)} />
              <span>{activeLabel}</span>
            </span>
          )}
        </>
      )}
      {targetLabel && (
        <span className="terminal-target" title={t('workbench.terminalRunsIn', { value1: targetLabel })} data-testid="terminal-target">
          {targetLabel}
        </span>
      )}
      <span className="terminal-feedback" aria-live="polite">{feedback}</span>
      {errorMark}
      <div className="terminal-actions" role="toolbar" aria-label={t('workbench.terminal')}>
        <IconButton label={t('workbench.terminalNew')} disabled={busy || loading || workspacePathMissing} onClick={() => void createTerminal('group')} testId="terminal-new">
          <Plus size={16} />
        </IconButton>
        {missingMark}
        {!compact && (
          <IconButton label={t('workbench.terminalSplit')} disabled={busy || !activeShell || !canSplit(activeShell.id)} onClick={() => void createTerminal('split', activeShell?.id)} testId="terminal-split">
            <SplitIcon size={16} />
          </IconButton>
        )}
        {!compact && (
          <IconButton label={t('workbench.terminalKill')} disabled={busy || !activeShell} onClick={() => void killTerminal(activeShell?.id)} testId="terminal-kill" danger>
            <Trash2 size={16} />
          </IconButton>
        )}
        {/* One terminal has no tab to right-click: its rename and connection live here, as on phones. */}
        {(compact || !showTabs) && activeShell && (
          <IconButton label={t('workbench.terminalMore')} expanded={menu?.kind === 'actions'} onClick={(event) => openActions(activeShell.id, event)} testId="terminal-more">
            <Ellipsis size={16} />
          </IconButton>
        )}
        {panelControls && (
          <>
            <span className="terminal-actions-separator" aria-hidden="true" />
            {!compact && (
              <IconButton label={panelControls.collapsed ? t('workbench.terminalExpand') : t('workbench.terminalCollapse')} pressed={panelControls.collapsed} onClick={panelControls.toggleCollapsed} testId="terminal-collapse">
                {panelControls.collapsed ? <PanelBottomOpen size={16} /> : <PanelBottomClose size={16} />}
              </IconButton>
            )}
            {(!compact || !panelControls.collapsed) && (
              <IconButton label={panelControls.maximized ? t('workbench.terminalRestore') : t('workbench.terminalMaximize')} pressed={panelControls.maximized} onClick={panelControls.toggleMaximized} testId="terminal-maximize" keepFocus>
                {panelControls.maximized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </IconButton>
            )}
            {compact && panelControls.collapsed && (
              <IconButton label={t('workbench.terminalExpand')} onClick={panelControls.toggleCollapsed} testId="terminal-collapse" keepFocus>
                <PanelBottomOpen size={16} />
              </IconButton>
            )}
            <IconButton label={t('workbench.terminalHide')} onClick={panelControls.close} testId="workbench-close-tools">
              <X size={16} />
            </IconButton>
          </>
        )}
        {!panelControls && onBackToChat && (
          <IconButton label={t('workbench.terminalBackToChat')} onClick={onBackToChat}>
            <MessageSquare size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={panelRef}
      className={`terminal-panel shell-direct-input ${isMobileShell ? 'shell-is-mobile' : ''} ${compact ? 'is-compact' : ''}`}
      data-terminal-theme={effectiveTheme}
      data-testid="terminal-panel"
    >
      {header}
      {/* Without the header (the host draws its own), the marks keep a slim row. */}
      {!header && (errorMark || missingMark) && !collapsed && (
        <div className="terminal-marks flex shrink-0 items-center justify-end gap-1 px-2 py-1">
          {errorMark}{missingMark}
        </div>
      )}
      <div className="terminal-body" hidden={collapsed}>
        <div
          ref={groupsRef}
          className="terminal-groups"
          data-orientation={vertical ? 'vertical' : 'horizontal'}
          onKeyDownCapture={(event) => {
            // VS Code: Alt+Left/Right moves between split panes of the visible group.
            if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const next = adjacentTerminal(layout, event.key === 'ArrowLeft' ? -1 : 1);
            if (!next) return;
            event.preventDefault();
            event.stopPropagation();
            select(next);
          }}
        >
          {liveShells.map(shell => {
            const index = activeGroup?.shellIds.indexOf(shell.id) ?? -1;
            const active = layout.activeShellId === shell.id;
            const state = statusText(shell);
            return (
              <div
                key={shell.id}
                className={`terminal-pane ${active ? 'is-active' : ''} ${(activeGroup?.shellIds.length ?? 0) > 1 ? 'is-split' : ''}`}
                hidden={index < 0}
                style={{ order: index * 2, flexGrow: activeGroup?.sizes[index] ?? 1 }}
                data-shell-id={shell.id}
                data-testid="terminal-pane"
                onPointerDownCapture={() => activate(shell.id)}
                onFocusCapture={() => activate(shell.id)}
              >
                <ShellPane
                  ref={paneRef(shell.id)}
                  paneId={shell.id}
                  shell={shell}
                  isActive={active}
                  isVisible={panelVisible && index >= 0}
                  autoFocus={focusArmed}
                  inputTransform={transformInput}
                  isMobileShell={isMobileShell}
                  effectiveTheme={effectiveTheme}
                  workspacePathMissing={workspacePathMissing}
                  shellAdapter={shellAdapter}
                  onActivate={() => activate(shell.id)}
                  onShellUpdate={updateShellEntry}
                  onRuntimeStateChange={runtimeHandler(shell.id)}
                  onFeedback={showFeedback}
                />
                {state && (
                  <div className={`terminal-pane-status ${state.connecting ? 'is-connecting' : ''}`} role="status">
                    <span>{state.text}</span>
                    {!state.connecting && (
                      <button type="button" onClick={() => void paneRefs.current.get(shell.id)?.reconnect()}>
                        <RotateCw size={13} aria-hidden="true" />{t('workbench.terminalReconnect')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {paneSashes}
          {!liveShells.length && (
            <div className="terminal-empty">
              {loading || busy ? (
                <span>{loading ? t('files.loadingShellState') : t('chat.creating')}</span>
              ) : (
                <>
                  <span>{t('workbench.terminalEmpty')}</span>
                  {/* A missing workspace folder: New in the header (or the marks row) is
                      greyed with its mark; this area only says there is no terminal. */}
                  {!workspacePathMissing && (
                    <button type="button" onClick={() => void createTerminal('group')}>
                      <Plus size={15} aria-hidden="true" />{t('workbench.terminalNew')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {showTabs && (
          <>
            <div
              role="separator"
              tabIndex={0}
              aria-label={t('workbench.terminalResizeTabs')}
              aria-orientation="vertical"
              aria-valuemin={TERMINAL_TABS_NARROW}
              aria-valuemax={TERMINAL_TABS_MAX}
              aria-valuenow={tabsWidth}
              className="terminal-tabs-sash"
              data-axis="x"
              onPointerDown={(event) => {
                const from = tabsWidth;
                let last = from;
                startDrag(event, delta => { last = resizeTabs(from - delta, false); }, () => resizeTabs(last, true));
              }}
              onDoubleClick={() => resizeTabs(tabsWidth > TERMINAL_TABS_NARROW ? TERMINAL_TABS_NARROW : TERMINAL_TABS_DEFAULT, true)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                resizeTabs(tabsWidth + (event.key === 'ArrowLeft' ? 24 : -24), true);
              }}
            />
            <div className="terminal-tabs-host" style={{ width: tabsWidth }}>
              <TerminalTabs
                layout={layout}
                entries={entries}
                width={tabsWidth}
                busy={busy}
                renamingId={renamingId}
                renameDraft={renameDraft}
                onRenameDraft={setRenameDraft}
                onSubmitRename={() => void submitRename()}
                onCancelRename={cancelRename}
                onSelect={(shellId) => updateLayout(current => ({ ...current, activeShellId: shellId }))}
                onStartRename={startRename}
                onSplit={(shellId) => void createTerminal('split', shellId)}
                onKill={(shellId) => void killTerminal(shellId)}
                onFocusTerminal={() => { setFocusArmed(true); activePane()?.focus(); }}
                onContextMenu={openActions}
                canSplit={canSplit}
              />
            </div>
          </>
        )}
      </div>
      {isMobileShell && panelVisible && activeShell && (
        <ShellTouchControls
          enabled={activeRuntime.shellInputEnabled}
          ctrl={ctrlPressed}
          onCtrl={() => { ctrlRef.current = !ctrlRef.current; setCtrlPressed(ctrlRef.current); }}
          onInput={data => { activePane()?.sendInput(transformInput(data)); }}
          onFocus={() => activePane()?.focus()}
          onPaste={() => { void activePane()?.pasteFromClipboard(); }}
          onSelect={() => activePane()?.startSelection()}
        />
      )}
      {renderMenu()}
    </div>
  );
});
