import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronLeft, FolderOpen, X } from 'lucide-react';
import { translate as t, useI18n } from '../../i18n';
import type { WorkbenchPresentation } from './presentation';
import { FilePanelContext } from './FilePanelContext';
import { useTerminalKeyboardInset } from './useTerminalKeyboardInset';
import {
  WorkbenchPaneSwitchButton,
  WorkbenchPaneSwitchContext,
  type WorkbenchPane,
  type WorkbenchPaneSwitch,
} from './paneSwitch';
import {
  clampToolPanelHeight,
  toolPanelBounds,
  useWorkbenchToolPanel,
  type WorkbenchToolPanelControls,
  type WorkbenchToolPanelState,
} from './toolPanel';

export interface WorkbenchPanelsOptions {
  deviceLabel: string;
  workspaceLabel: string;
  primaryTitle: string;
  /** Receives the phone split switch, for a dock that shows the pinned conversations. */
  onPaneSwitchChange?: ((value: WorkbenchPaneSwitch | null) => void) | undefined;
  primaryStatus: string;
  primaryHarness: string;
  presentation: WorkbenchPresentation;
  onPresentationChange: (
    patch: Partial<WorkbenchPresentation>,
  ) => boolean | void;
  candidates: Array<{ id: string; title: string }>;
  referenceTitle?: string;
  /** Navigation status of each pane's thread, for the phone's pinned titles. */
  marks?: Partial<Record<WorkbenchPane, string | undefined>>;
  referenceContent?: ReactNode;
  collaborationContent?: ReactNode;
  onMakePrimary: () => void;
  storageFailed?: boolean;
  focusedPane?: 'primary' | 'reference';
  onFocusPane?: (pane: 'primary' | 'reference') => boolean | void;
  /** Bottom panel content (the terminal). A function receives the panel actions. */
  toolContent?: ReactNode | ((controls: WorkbenchToolPanelControls) => ReactNode);
  toolTitle?: string;
  toolsTargetLabel?: string;
  /** The file explorer provides its own single toolbar and close action. */
  inlineFilesHeader?: boolean;
  toolsOpen?: boolean;
  onCloseTools?: () => void;
}
export function WorkbenchPanels({
  options: o,
  children,
  explorer,
  revealExplorer,
  toolPanel: sharedToolPanel,
}: {
  options: WorkbenchPanelsOptions;
  children: ReactNode;
  explorer: ReactNode;
  revealExplorer: number;
  /** Owned by the workbench chrome when its rail also restores a maximized panel. */
  toolPanel?: WorkbenchToolPanelState;
}) {
  useI18n();
  const ownToolPanel = useWorkbenchToolPanel();
  const toolPanel = sharedToolPanel ?? ownToolPanel;
  const { mode, referenceId, ratio } = o.presentation;
  const root = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 1000);
  const [mobileView, setMobileView] = useState<'primary' | 'reference'>(
    'primary',
  );
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode) {
      const before = previousMode.current;
      previousMode.current = mode;
      if (mode === 'collaboration') setMobileView('reference');
      else if (
        mode === 'thread' &&
        before === 'focus' &&
        (!compact || o.onFocusPane?.('reference') !== false)
      )
        setMobileView('reference');
    }
  }, [mode, compact, o.onFocusPane]);
  const [filesVisited, setFilesVisited] = useState(mode === 'files');
  // Keep terminals mounted after the first open: hiding the panel must not
  // close their sockets or drop scrollback.
  const toolsOpen = Boolean(o.toolsOpen);
  const keyboardInset = useTerminalKeyboardInset(root, compact && toolsOpen);
  const [toolsVisited, setToolsVisited] = useState(toolsOpen);
  useEffect(() => { if (toolsOpen) setToolsVisited(true); }, [toolsOpen]);
  const mainColumn = useRef<HTMLDivElement>(null);
  const [columnHeight, setColumnHeight] = useState(0);
  const panelDrag = useRef<{ y: number; height: number; next: number } | null>(null);
  const drag = useRef<{ x: number; ratio: number; width: number } | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('remote-codex.explorer-width'));
      return Number.isFinite(saved) && saved > 0 ? Math.max(360, saved) : 560;
    } catch { return 560; }
  });
  const [rootWidth, setRootWidth] = useState(window.innerWidth);
  const drawerDrag = useRef<{ x: number; width: number } | null>(null);
  const visibleDrawerWidth = Math.min(drawerWidth, Math.max(360, rootWidth - 280));
  const resizeDrawer = (width: number) => {
    const next = Math.round(Math.max(360, Math.min(Math.max(360, rootWidth - 280), width)));
    setDrawerWidth(next);
    try { localStorage.setItem('remote-codex.explorer-width', String(next)); } catch { /* Optional preference. */ }
  };
  const drawerResizeHandle = () => !compact && (
    <div
      role="separator"
      tabIndex={0}
      aria-label={t('workbench.resizeExplorer')}
      aria-orientation="vertical"
      aria-valuemin={360}
      aria-valuemax={Math.max(360, rootWidth - 280)}
      aria-valuenow={visibleDrawerWidth}
      className="workbench-tool-resize"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drawerDrag.current = { x: event.clientX, width: visibleDrawerWidth };
      }}
      onPointerMove={(event) => {
        if (drawerDrag.current) resizeDrawer(drawerDrag.current.width + drawerDrag.current.x - event.clientX);
      }}
      onPointerUp={(event) => {
        drawerDrag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drawerDrag.current = null; }}
      onLostPointerCapture={() => { drawerDrag.current = null; }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          resizeDrawer(visibleDrawerWidth + (event.key === 'ArrowLeft' ? 24 : -24));
        }
      }}
    />
  );
  const [lastReveal, setLastReveal] = useState(revealExplorer);
  useEffect(() => {
    if (lastReveal !== revealExplorer) {
      setLastReveal(revealExplorer);
      if (revealExplorer > 0) {
        o.onPresentationChange({ mode: 'files' });
      }
    }
  }, [revealExplorer, lastReveal, o.onPresentationChange]);
  useEffect(() => {
    if (mode === 'files') setFilesVisited(true);
  }, [mode]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setCompact(width < 800);
      setRootWidth(width);
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!mainColumn.current) return;
    const observer = new ResizeObserver((entries) => setColumnHeight(entries[0].contentRect.height));
    observer.observe(mainColumn.current);
    return () => observer.disconnect();
  }, []);
  // The stored height is a preference; the visible height always leaves room
  // for the conversation and grows back when the window does.
  const panelHeight = clampToolPanelHeight(toolPanel.height, columnHeight, compact);
  const panelBounds = toolPanelBounds(columnHeight, compact);
  const panelMaximized = toolPanel.maximized && !toolPanel.collapsed;
  const toolPanelControls: WorkbenchToolPanelControls = {
    maximized: panelMaximized,
    collapsed: toolPanel.collapsed,
    compact,
    toggleMaximized: () => toolPanel.update({ maximized: !panelMaximized, collapsed: false }),
    toggleCollapsed: () => toolPanel.update({ collapsed: !toolPanel.collapsed, maximized: false }),
    close: () => o.onCloseTools?.(),
  };
  const resizePanel = (height: number, persist: boolean) =>
    toolPanel.update({ height: clampToolPanelHeight(height, columnHeight, compact) }, persist);
  const panelSash = (
    <div
      role="separator"
      tabIndex={0}
      aria-label={t('workbench.terminalResize')}
      aria-orientation="horizontal"
      aria-valuemin={panelBounds.min}
      aria-valuemax={panelBounds.max}
      aria-valuenow={panelHeight}
      className="workbench-panel-sash"
      data-testid="workbench-panel-sash"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panelDrag.current = { y: event.clientY, height: panelHeight, next: panelHeight };
      }}
      onPointerMove={(event) => {
        const drag = panelDrag.current;
        if (!drag) return;
        drag.next = drag.height + drag.y - event.clientY;
        resizePanel(drag.next, false);
      }}
      onPointerUp={(event) => {
        const drag = panelDrag.current;
        panelDrag.current = null;
        if (drag) resizePanel(drag.next, true);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { panelDrag.current = null; }}
      onLostPointerCapture={() => {
        const drag = panelDrag.current;
        panelDrag.current = null;
        if (drag) resizePanel(drag.next, true);
      }}
      onDoubleClick={() => toolPanel.update({ height: null })}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 96 : 24;
        const next = event.key === 'ArrowUp' ? panelHeight + step
          : event.key === 'ArrowDown' ? panelHeight - step
            : event.key === 'Home' ? panelBounds.min
              : event.key === 'End' ? panelBounds.max : null;
        if (next === null) return;
        event.preventDefault();
        resizePanel(next, true);
      }}
    />
  );
  useEffect(() => {
    setMobileView('primary');
  }, [o.primaryTitle]);
  const close = () => {
    if (o.onPresentationChange({ mode: 'focus' }) === false) return;
    setMobileView('primary');
  };
  const showThread =
    Boolean(referenceId) && (mode === 'thread' || mode === 'files');
  const showReference = showThread || mode === 'collaboration';
  const closeFiles = () =>
    o.onPresentationChange({ mode: referenceId ? 'thread' : 'focus' });
  // Minimized, the files view keeps only its tree, a strip at the right edge, and
  // folds its editor into a tab on the strip's left edge. Closing it, or a screen
  // too narrow to dock it, ends that.
  const [filesMinimized, setFilesMinimized] = useState(false);
  useEffect(() => { if (mode !== 'files' || compact) setFilesMinimized(false); }, [mode, compact]);
  // A phone split of two conversations is switched from their composers.
  const paneSwitchEnabled = compact && showThread;
  const [switchClaims, setSwitchClaims] = useState<Record<WorkbenchPane, number>>({ primary: 0, reference: 0 });
  const claimSwitch = useCallback((pane: WorkbenchPane) => {
    setSwitchClaims(current => ({ ...current, [pane]: current[pane] + 1 }));
    return () => setSwitchClaims(current => ({ ...current, [pane]: current[pane] - 1 }));
  }, []);
  const onFocusPane = o.onFocusPane;
  const selectPane = useCallback((pane: WorkbenchPane) => {
    if (onFocusPane?.(pane) !== false) setMobileView(pane);
  }, [onFocusPane]);
  const referenceTitle = o.referenceTitle ?? t('workbench.loadingThreadDetail');
  const paneSwitches = useMemo(() => {
    if (!paneSwitchEnabled) return null;
    const base = { active: mobileView, titles: { primary: o.primaryTitle, reference: referenceTitle }, ...(o.marks ? { marks: o.marks } : {}), select: selectPane, claim: claimSwitch };
    return { primary: { ...base, pane: 'primary' }, reference: { ...base, pane: 'reference' } } satisfies Record<WorkbenchPane, WorkbenchPaneSwitch>;
  }, [paneSwitchEnabled, mobileView, o.primaryTitle, referenceTitle, o.marks?.primary, o.marks?.reference, selectPane, claimSwitch]);
  const onPaneSwitchChange = o.onPaneSwitchChange;
  useEffect(() => {
    if (!onPaneSwitchChange) return;
    onPaneSwitchChange(paneSwitches?.primary ?? null);
    return () => onPaneSwitchChange(null);
  }, [onPaneSwitchChange, paneSwitches]);
  // Without a composer (a loading or unavailable conversation) the pane keeps its own switch.
  const paneSwitchFallback = (pane: WorkbenchPane) => paneSwitches && mobileView === pane && switchClaims[pane] === 0 && (
    <div className="workbench-pane-switch-fallback">
      <WorkbenchPaneSwitchButton target="primary" value={paneSwitches[pane]} />
      <WorkbenchPaneSwitchButton target="reference" value={paneSwitches[pane]} />
    </div>
  );
  const historyHandlers = useRef({
    onFocusPane: o.onFocusPane,
    onPresentationChange: o.onPresentationChange,
    onCloseTools: o.onCloseTools,
  });
  historyHandlers.current = {
    onFocusPane: o.onFocusPane,
    onPresentationChange: o.onPresentationChange,
    onCloseTools: o.onCloseTools,
  };
  // Phone panes are views, not route navigation. Back returns to the left conversation.
  useEffect(() => {
    const drawerOpen = mode === 'files' || o.toolsOpen;
    if (
      !compact ||
      (!drawerOpen && (!showReference || mobileView !== 'reference'))
    )
      return;
    const marker = `workbench-reference-${Date.now()}`;
    history.pushState({ ...history.state, workbenchReference: marker }, '');
    const back = () => {
      const handlers = historyHandlers.current;
      if (o.toolsOpen) handlers.onCloseTools?.();
      else if (mode === 'files')
        handlers.onPresentationChange({
          mode: referenceId ? 'thread' : 'focus',
        });
      else {
        if (handlers.onFocusPane?.('primary') === false) {
          history.pushState(
            { ...history.state, workbenchReference: marker },
            '',
          );
          return;
        }
        setMobileView('primary');
      }
    };
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('popstate', back);
      if (history.state?.workbenchReference === marker) {
        const { workbenchReference: _, ...state } = history.state;
        history.replaceState(state, '');
      }
    };
  }, [compact, mobileView, showReference, mode, referenceId, o.toolsOpen]);
  return (
    <div
      ref={root}
      className={`workbench-panels ${compact ? 'is-compact' : ''}`}
      data-testid="workbench-panels"
      data-mode={mode}
      style={{ '--primary-ratio': `${ratio}%`, '--workbench-tool-width': `${visibleDrawerWidth}px`, paddingBottom: keyboardInset || undefined } as CSSProperties}
    >
      {o.storageFailed && (
        <p role="status" className="workbench-persistence-notice">
          {t('workbench.layoutSessionOnly')}
        </p>
      )}
      {compact && showReference && !showThread && (
        <nav
          className="workbench-mobile-views"
          aria-label={t('workbench.panelViews')}
        >
          <button
            aria-pressed={mobileView === 'primary'}
            onClick={() => {
              if (o.onFocusPane?.('primary') !== false)
                setMobileView('primary');
            }}
          >
            {o.primaryTitle}
          </button>
          <button
            aria-pressed={mobileView === 'reference'}
            onClick={() => {
              if (!showThread || o.onFocusPane?.('reference') !== false)
                setMobileView('reference');
            }}
          >
            {showThread ? o.referenceTitle : t('workbench.collaboration')}
          </button>
        </nav>
      )}
      <div className="workbench-content">
      <div ref={mainColumn} className={`workbench-main-column ${o.toolsOpen && panelMaximized ? 'has-maximized-panel' : ''}`}>
      <div
        className={`workbench-pane-grid ${showReference ? 'has-reference' : ''}`}
        // A maximized terminal covers the conversations without unmounting
        // them (scroll and drafts survive); keep them out of the tab order.
        inert={o.toolsOpen && panelMaximized ? true : undefined}
      >
        <section
          className="workbench-primary matter-chat"
          data-testid="primary-pane"
          data-focused={o.focusedPane === 'primary'}
          onPointerDownCapture={(event) => {
            if (o.onFocusPane?.('primary') === false)
              event.preventDefault();
          }}
          onFocusCapture={(event) => {
            if (o.onFocusPane?.('primary') === false)
              (event.relatedTarget as HTMLElement | null)?.focus();
          }}
          hidden={compact && showReference && mobileView !== 'primary'}
        >
          <WorkbenchPaneSwitchContext.Provider value={paneSwitches?.primary ?? null}>
            <div className="workbench-pane-body">{children}</div>
          </WorkbenchPaneSwitchContext.Provider>
          {paneSwitchFallback('primary')}
        </section>
        {showReference && (
          <div
            role="separator"
            tabIndex={compact ? -1 : 0}
            aria-label={t('workbench.resizeComparison')}
            aria-orientation="vertical"
            aria-valuemin={35}
            aria-valuemax={65}
            aria-valuenow={ratio}
            className="workbench-pane-resize"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                ratio,
                width: root.current?.clientWidth ?? 1000,
              };
            }}
            onPointerMove={(e) => {
              if (drag.current)
                o.onPresentationChange({
                  ratio: Math.max(
                    35,
                    Math.min(
                      65,
                      drag.current.ratio +
                        ((e.clientX - drag.current.x) / drag.current.width) *
                          100,
                    ),
                  ),
                });
            }}
            onPointerUp={(e) => {
              drag.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                o.onPresentationChange({
                  ratio: Math.max(
                    35,
                    Math.min(65, ratio + (e.key === 'ArrowLeft' ? -5 : 5)),
                  ),
                });
              }
            }}
          />
        )}
        <section
          className="workbench-reference"
          data-testid="reference-pane"
          data-focused={o.focusedPane === 'reference'}
          onPointerDownCapture={(event) => {
            if (showThread && o.onFocusPane?.('reference') === false)
              event.preventDefault();
          }}
          onFocusCapture={(event) => {
            if (showThread && o.onFocusPane?.('reference') === false)
              (event.relatedTarget as HTMLElement | null)?.focus();
          }}
          hidden={!showReference || (compact && mobileView !== 'reference')}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) {
              e.preventDefault();
              close();
            }
          }}
        >
          {!paneSwitchEnabled && <header className="workbench-pane-heading">
            <div>
              <strong>
                {showThread
                  ? (o.referenceTitle ?? t('workbench.loadingThreadDetail'))
                  : t('workbench.collaboration')}
              </strong>
            </div>
            {mode !== 'files' && (
              <button
                aria-label={t('workbench.referenceFiles')}
                title={t('workbench.referenceFiles')}
                onClick={() => o.onPresentationChange({ mode: 'files' })}
              >
                <FolderOpen size={16} />
              </button>
            )}
            {showThread && (
              <button onClick={o.onMakePrimary} data-testid="make-primary">
                {t('workbench.makePrimary')}
              </button>
            )}
            <button
              onClick={close}
              aria-label={t('workbench.closeSplit')}
              title={t('workbench.closeSplitContinues')}
            >
              <X size={17} />
            </button>
          </header>}
          <div className="workbench-pane-body" hidden={!showThread}>
            <WorkbenchPaneSwitchContext.Provider value={paneSwitches?.reference ?? null}>
              {o.referenceContent}
            </WorkbenchPaneSwitchContext.Provider>
          </div>
          {paneSwitchFallback('reference')}
          <div
            className="workbench-pane-body workbench-collaboration"
            hidden={mode !== 'collaboration'}
          >
            {o.collaborationContent}
          </div>
        </section>
      </div>
      {toolsVisited && o.toolContent && (
        <section
          role="region"
          aria-label={o.toolTitle ?? t('workbench.terminal')}
          className={`workbench-bottom-panel ${panelMaximized ? 'is-maximized' : ''} ${toolPanel.collapsed ? 'is-collapsed' : ''}`}
          data-testid="workbench-bottom-panel"
          hidden={!o.toolsOpen}
          style={{ '--workbench-panel-height': `${panelHeight}px` } as CSSProperties}
        >
          {!panelMaximized && !toolPanel.collapsed && panelSash}
          {typeof o.toolContent === 'function' ? o.toolContent(toolPanelControls) : o.toolContent}
        </section>
      )}
      </div>
      {filesVisited && (
        <aside
          role="region"
          aria-label={t('workbench.referenceFiles')}
          className="workbench-tool-drawer"
          data-minimized={filesMinimized || undefined}
          hidden={mode !== 'files'}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
              event.preventDefault();
              event.stopPropagation();
              closeFiles();
            }
          }}
        >
          {drawerResizeHandle()}
          {!o.inlineFilesHeader && <header>
            <div>
              <strong>{t('workbench.referenceFiles')}</strong>
              {o.toolsTargetLabel && <small>{o.toolsTargetLabel}</small>}
            </div>
            <button
              data-testid="workbench-close-files"
              aria-label={t('workbench.closeFiles')}
              onClick={closeFiles}
            >
              <X size={17} />
            </button>
          </header>}
          <FilePanelContext.Provider value={o.inlineFilesHeader ? {
            close: closeFiles,
            ...(o.toolsTargetLabel ? { label: o.toolsTargetLabel } : {}),
            ...(compact ? {} : { minimized: filesMinimized, setMinimized: setFilesMinimized }),
          } : null}>
            <div className="workbench-pane-body workbench-files">{explorer}</div>
          </FilePanelContext.Provider>
          {filesMinimized && (
            <button type="button" className="workbench-files-restore" aria-label={t('workbench.restoreFiles')} title={t('workbench.restoreFiles')}
              onClick={() => setFilesMinimized(false)}>
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
          )}
        </aside>
      )}
      </div>
    </div>
  );
}
