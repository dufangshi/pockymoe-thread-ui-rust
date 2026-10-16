import { WorkbenchPanels, type WorkbenchPanelsOptions } from './workbench/WorkbenchPanels';
import { useWorkbenchToolPanel } from './workbench/toolPanel';
import { getLocale } from '../i18n';
import { translate, useI18n } from '../i18n';
import { useEffect, useState, useRef, type ReactNode, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  FolderOpen,
  Hand,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  Search,
  SlidersHorizontal,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import { useTabScrollEdges } from './useTabScrollEdges';
import { WorkbenchContext } from './WorkbenchContext';
import { WorkbenchPath } from './WorkbenchPath';
import { GroupedThreadTabs, groupThreads, threadGroupActivity } from './GroupedThreadTabs';
import { useThemeFeature } from './themeHooks';
import { PhoneDock, PhoneSheet, type PhonePane } from './workbench/PhoneDock';
import { PhoneDockContext } from './workbench/phoneDockContext';
import type { WorkbenchPaneSwitch } from './workbench/paneSwitch';
import { ComposerSubscriptionUsage, visibleSubscriptionWindows } from './composer/ComposerSubscriptionUsage';
import type { AgentSubscriptionUsageDto } from '@pockymoe/shared';
import { useAppShellNav } from '../app-shell/AppShellNavContext';


export interface WorkbenchThread {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  status: string;
  favorite: boolean;
  parentKey?: string;
  rootKey?: string;
  /** Harness id such as `codex` or `claude`; themes may show it as an avatar. */
  agent?: string;
}
export interface WorkbenchNotification {
  id: string;
  title: string;
  href: string;
  occurredAt: string;
  summary?: string;
}
/** A plugin's thread panel in the workbench rail (it opens in the tools drawer). */
export interface WorkbenchToolPanel {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onToggle: () => void;
}
export interface MatterWorkbenchOptions {
  panels?: WorkbenchPanelsOptions;
  statusActions?: ReactNode;
  /** Subscription usage windows (5-hour, weekly); the phone dock shows them in its status bar. */
  subscriptionUsage?: AgentSubscriptionUsageDto | null;
  emptyWorkspace?: boolean;
  navigationReady?: boolean;
  harnessSessionId?: string | null;
  harnessSessionUrl?: string | null;
  threads: WorkbenchThread[];
  workspaceThreads?: WorkbenchThread[];
  currentKey: string;
  favorite: boolean;
  favoriteBusy?: boolean;
  error?: string | null;
  workspacePath: string;
  activeView: 'chat' | 'shell';
  terminalEnabled: boolean;
  onViewChange: (view: 'chat' | 'shell') => void;
  toolPanels?: WorkbenchToolPanel[];
  onToggleFavorite: () => void;
  onNavigate: (href: string) => void;
  onSearch: () => void;
  search?: ReactNode;
  searchOpen?: boolean;
  notifications: WorkbenchNotification[];
  unreadCount: number;
  onReadNotifications: () => void;
  renderThreadMenu?: (thread: WorkbenchThread) => ReactNode;
}

export function MatterWorkbench({
  options: o,
  title,
  homeHref,
  settings,
  newThread,
  actions,
  threadMenu,
  connection,
  deviceMonitor,
  explorer,
  revealExplorer,
  children,
}: {
  options: MatterWorkbenchOptions;
  title: string;
  homeHref?: string | undefined;
  settings: ReactNode;
  newThread: ReactNode;
  actions: ReactNode;
  threadMenu: ReactNode;
  connection: ReactNode;
  deviceMonitor?: ReactNode;
  explorer: ReactNode;
  revealExplorer: number;
  children: ReactNode;
}) {
  useI18n();
  const tabs = o.workspaceThreads ?? o.threads.filter(thread => thread.key === o.currentKey);
  const tabsRef = useRef<HTMLElement>(null);
  const tabScrollEdges = useTabScrollEdges(tabsRef);
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [o.currentKey, tabs.length]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const change = () => setMobile(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  // A theme with phone drawer tools keeps the phone top bar to touch-sized
  // essentials and moves Home and Chat into the drawer; the device monitor stays.
  const drawerTools = useThemeFeature('workbench.phoneDrawerTools') && mobile;
  // One-handed phone layout: status-only top bar, navigation at the bottom.
  // A setting (Settings → Preferences), on by default; off keeps the classic phone bars.
  const shellNav = useAppShellNav();
  const dock = mobile && (shellNav?.phoneDock ?? true);
  // Left-handed: the dock, the composer's buttons and the turn strip are mirrored.
  const leftHanded = dock && shellNav?.phoneHand === 'left';
  const [threadsOpen, setThreadsOpen] = useState(false);
  // A phone split's pinned conversations, switched from the dock.
  const [paneSwitch, setPaneSwitch] = useState<WorkbenchPaneSwitch | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dock) return;
    // The keyboard needs the room: hide the navigation row while a field has focus.
    const editing = () => {
      const target = document.activeElement;
      return target instanceof HTMLElement && !target.closest('.matter-phone-sheet, .matter-topbar')
        && target.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), [contenteditable]:not([contenteditable="false"])');
    };
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', afterTap, true);
      setTyping(editing());
    };
    const afterTap = () => { window.clearTimeout(timer); timer = window.setTimeout(settle, 0); };
    const focusIn = () => { if (editing()) settle(); };
    // A tap moves focus on mousedown, before mouseup and click: bringing the row
    // back then would move the tapped control (Send, New terminal) from under the
    // finger. It returns once that tap has clicked, or shortly after a blur
    // without one (the keyboard's own close button).
    const focusOut = () => window.setTimeout(() => {
      if (editing()) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 400);
      document.addEventListener('click', afterTap, { capture: true, once: true });
    }, 0);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', afterTap, true);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, [dock]);
  useEffect(() => {
    const root = rootRef.current;
    if (!dock || !root) return;
    // Swiping up on the bottom panel (the composer or the dock) opens the thread
    // sheet. A prompt that can scroll keeps the gesture for itself.
    let start: { x: number; y: number } | null = null;
    const begin = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      start = null;
      if (event.touches.length !== 1 || !target?.closest('.thread-graph-composer-host, .matter-phone-dock')) return;
      if (target.closest('.matter-phone-thread, [role="menu"], [role="listbox"], [role="dialog"], .thread-jump-latest-cluster')) return;
      const scroller = target.closest<HTMLElement>('[role="textbox"], textarea');
      if (scroller && /auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) return;
      start = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
    };
    const end = (event: TouchEvent) => {
      const from = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x, dy = touch.clientY - from.y;
      if (dy > -40 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) document.activeElement.blur();
      setMoreOpen(false);
      setThreadsOpen(true);
    };
    const cancel = () => { start = null; };
    root.addEventListener('touchstart', begin, { passive: true });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', cancel);
    return () => {
      root.removeEventListener('touchstart', begin);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', cancel);
    };
  }, [dock]);
  const toolPanel = useWorkbenchToolPanel();
  // With the bottom panel the conversation stays visible beside the terminal:
  // Chat is "pressed" unless a maximized terminal covers it.
  const chatCovered = Boolean(o.panels && o.activeView === 'shell' && toolPanel.maximized && !toolPanel.collapsed);
  // A compact workbench draws Files over the conversation: Chat closes it.
  const filesCoverChat = () => explorerOpen && (mobile || Boolean(rootRef.current?.querySelector('.workbench-panels.is-compact')));
  const showChat = () => {
    if (filesCoverChat()) setExplorerOpen(false);
    if (o.panels) {
      if (chatCovered) toolPanel.update({ maximized: false });
    } else o.onViewChange('chat');
  };
  const viewChange = useRef(o.onViewChange);
  viewChange.current = o.onViewChange;
  useEffect(() => {
    if (!o.terminalEnabled) return;
    // VS Code's Ctrl+` toggles the terminal, even while xterm has focus.
    const toggle = (event: KeyboardEvent) => {
      if (event.key !== '`' || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      viewChange.current('shell');
    };
    window.addEventListener('keydown', toggle, true);
    return () => window.removeEventListener('keydown', toggle, true);
  }, [o.terminalEnabled]);
  const [shortcutsOpen, setShortcutsOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [legacyExplorerOpen, setLegacyExplorerOpen] = useState(false);
  const explorerOpen = o.panels ? o.panels.presentation.mode === 'files' : legacyExplorerOpen;
  const setExplorerOpen = (value: boolean | ((open: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(explorerOpen) : value;
    if (o.panels) o.panels.onPresentationChange({ mode: next ? 'files' : o.panels.presentation.referenceId ? 'thread' : 'focus' });
    else setLegacyExplorerOpen(next);
  };
  const [explorerWidth, setExplorerWidth] = useState(() => {
    try { return Math.max(260, Math.min(800, Number(localStorage.getItem('remote-codex.explorer-width')) || 360)); } catch { return 360; }
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeOrigin = useRef<{ x: number; width: number } | null>(null);
  const resizeExplorer = (width: number) => {
    const max = Math.max(260, (contentRef.current?.clientWidth ?? 1000) - 320);
    const next = Math.round(Math.max(260, Math.min(max, width)));
    setExplorerWidth(next);
    try { localStorage.setItem('remote-codex.explorer-width', String(next)); } catch { /* Optional preference. */ }
  };
  const [lastReveal, setLastReveal] = useState(revealExplorer);
  if (lastReveal !== revealExplorer) {
    setLastReveal(revealExplorer);
    if (revealExplorer > 0 && !o.panels) setLegacyExplorerOpen(true);
  }
  const navigate = (href: string) => {
    setSidebarOpen(false);
    setBellOpen(false);
    setThreadsOpen(false);
    setMoreOpen(false);
    o.onNavigate(href);
  };
  const pane: PhonePane = explorerOpen ? 'files' : o.activeView === 'shell' ? 'shell' : 'chat';
  const choosePane = (next: PhonePane) => {
    if (next === 'files') { setExplorerOpen(true); return; }
    if (explorerOpen) setExplorerOpen(false);
    // The host's view change toggles the terminal.
    if ((next === 'shell') !== (o.activeView === 'shell')) o.onViewChange('shell');
  };
  const currentThread = o.threads.find(thread => thread.key === o.currentKey) ?? tabs.find(thread => thread.key === o.currentKey);
  const tabRoots = groupThreads(tabs).map(group => group.root);
  const swipeSiblings = tabRoots.some(thread => thread.key === o.currentKey) ? tabRoots : tabs;
  const knownThreads = [...o.threads, ...tabs.filter(tab => !o.threads.some(thread => thread.key === tab.key))];
  const othersRunning = knownThreads.filter(thread => thread.status === 'running' && thread.key !== o.currentKey).length;
  const attention = (thread: WorkbenchThread) => thread.status === 'running' ? 0 : thread.status === 'unread' || thread.status === 'failed' ? 1 : 2;
  const bell = (
    <button
      aria-label={translate("workbench.notifications")}
      aria-expanded={bellOpen}
      onClick={() => {
        setBellOpen(!bellOpen);
        o.onReadNotifications();
      }}
    >
      <Bell />
      {o.unreadCount > 0 && <span className="matter-unread" />}
    </button>
  );
  const renderThread = (thread: WorkbenchThread, activity = threadGroupActivity(thread)) => (
    <div key={thread.key} className="matter-thread-entry">
    <a
      href={thread.href}
      onClick={(e) => {
        e.preventDefault();
        navigate(thread.href);
      }}
      className="matter-thread-row"
      aria-current={thread.key === o.currentKey ? 'page' : undefined}
      title={`${thread.title}\n${thread.subtitle} · ${activity.label}`}
    >
      {thread.agent && <span className="matter-thread-avatar" data-agent={thread.agent} aria-hidden="true" />}
      <span
        className="matter-status-dot"
        data-status={activity.status}
        role="img"
        aria-label={activity.label}
      />
      <span className="matter-thread-copy">
        <span>{thread.title}</span>
        <small>{thread.subtitle}</small>
      </span>
    </a>
    {o.renderThreadMenu?.(thread)}
    </div>
  );
  const renderThreadGroups = (threads: WorkbenchThread[]) => groupThreads(threads).map(({ root, children }) => (
    <div key={root.key}>
      {renderThread(root, threadGroupActivity(root, children))}
      {children.length > 0 && <details className="matter-agent-threads" open={children.some(child => child.key === o.currentKey) || undefined} style={{ margin: '0 0 6px 14px' }}>
        <summary className="matter-agent-threads-summary" style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--theme-fg-soft)' }}>{children.length} {translate("workbench.agentThreads_655dcc")}</summary>
        {children.map(child => renderThread(child))}
      </details>}
    </div>
  ));
  return (
    <div
      ref={rootRef}
      className={`matter-workbench ${sidebarHidden ? 'is-sidebar-hidden' : ''} ${dock ? 'has-phone-dock' : ''} ${leftHanded ? 'is-left-handed' : ''} ${dock && typing ? 'is-typing' : ''}`}
      onClick={(e) => {
        if (
          e.target instanceof Element &&
          !e.target.closest('.matter-thread-menu')
        ) {
          e.currentTarget
            .querySelector('.matter-thread-menu[open]')
            ?.removeAttribute('open');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setBellOpen(false);
          setSidebarOpen(false);
          setThreadsOpen(false);
          setMoreOpen(false);
          e.currentTarget
            .querySelector('.matter-thread-menu[open]')
            ?.removeAttribute('open');
        }
      }}
    >
      {!mobile && <nav className="matter-rail" aria-label={translate("workbench.workspaceTools")}>
        {homeHref && <a
          className="matter-brand"
          href={homeHref}
          aria-label={translate("workbench.pockymoeHome")}
        >
          p<span>m</span>
        </a>}
        <button
          aria-label={translate("workbench.chat")}
          aria-pressed={o.panels ? !chatCovered : o.activeView === 'chat'}
          onClick={showChat}
        >
          <MessageSquare />
        </button>
        {o.terminalEnabled && (
          <button
            aria-label={translate("workbench.terminal")}
            aria-pressed={o.activeView === 'shell'}
            title={`${translate("workbench.terminal")} (Ctrl+\`)`}
            onClick={() => o.onViewChange('shell')}
          >
            <Terminal />
          </button>
        )}
        {o.toolPanels?.map(panel => (
          <button key={panel.id} aria-label={panel.label} title={panel.label}
            aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}</button>
        ))}
        <button aria-label={translate("workbench.toggleExplorer")} aria-pressed={explorerOpen} aria-expanded={explorerOpen}
          title={translate("workbench.explorer")} onClick={() => setExplorerOpen(open => !open)}><FolderOpen /></button>
        <div className="matter-rail-bottom">{deviceMonitor}{settings}</div>
      </nav>}
      {dock ? <header className={`matter-topbar is-status-only ${o.searchOpen ? 'is-search-open' : ''}`}>
        <div className="matter-topbar-status">{deviceMonitor}</div>
        {o.searchOpen && <div className="matter-topbar-search">{o.search}</div>}
        <span className="matter-topbar-spacer" />
        {/* Usage windows are read, rarely touched: they live in the status bar. */}
        {visibleSubscriptionWindows(o.subscriptionUsage).length > 0 && <div className="matter-topbar-usage"><ComposerSubscriptionUsage usage={o.subscriptionUsage} /></div>}
        {othersRunning > 0 && <button className="matter-running-chip" aria-label={translate('workbench.runningCount', { count: othersRunning })} onClick={() => setThreadsOpen(true)}>
          <LoaderCircle aria-hidden="true" /><span>{othersRunning}</span><span className="matter-running-label">{translate('workbench.running')}</span>
        </button>}
        <div className="matter-connection">{connection}</div>
        {bell}
      </header> : <header className={`matter-topbar ${o.searchOpen ? 'is-search-open' : ''}`}>
        <button
          aria-label={translate("workbench.toggleShortcutsSidebar")}
          aria-expanded={mobile ? sidebarOpen : !sidebarHidden}
          onClick={() => {
            if (mobile) setSidebarOpen(!sidebarOpen);
            else setSidebarHidden(!sidebarHidden);
          }}
        >
          <PanelLeft />
        </button>
        <span className="matter-topbar-brand">Pockymoe</span>
        <span className="matter-topbar-separator" />
        <button aria-label={translate("workbench.goBack")} onClick={() => history.back()}>
          <ArrowLeft />
        </button>
        <button data-action="go-forward" aria-label={translate("workbench.goForward")} onClick={() => history.forward()}>
          <ArrowRight />
        </button>
        {!drawerTools && homeHref && <a href={homeHref} aria-label={translate("workbench.backToWorkspaces")} title={translate("workbench.workspaces")}>
          <Home />
        </a>}
        <div className="matter-topbar-search">{o.search ?? <button
          className="matter-search-trigger"
          aria-label={translate("workbench.searchConversation")}
          disabled={o.emptyWorkspace}
          onClick={o.onSearch}
        >
          <Search />
          <span>{translate("workbench.searchConversation")}</span>
        </button>}</div>
        <div className="matter-topbar-end">
          {mobile && deviceMonitor}
          {mobile && <>
            {!drawerTools && <button aria-label={translate("workbench.chat")} aria-pressed={!explorerOpen && (o.panels ? !chatCovered : o.activeView === 'chat')} onClick={showChat}><MessageSquare /></button>}
            {o.terminalEnabled && <button aria-label={translate("workbench.terminal")} aria-pressed={!explorerOpen && o.activeView === 'shell'} onClick={() => {
              // Over Files, the terminal button shows the terminal rather than hiding it unseen.
              if (explorerOpen) {
                setExplorerOpen(false);
                if (o.activeView === 'shell') return;
              }
              o.onViewChange('shell');
            }}><Terminal /></button>}
            {o.toolPanels?.map(panel => <button key={panel.id} aria-label={panel.label} title={panel.label} aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}</button>)}
            <button aria-label={translate("workbench.toggleExplorer")} aria-pressed={explorerOpen} aria-expanded={explorerOpen} title={translate("workbench.explorer")} onClick={() => setExplorerOpen(open => !open)}><FolderOpen /></button>
            {settings}
          </>}
          <div className="matter-connection">{connection}</div>
          {bell}
        </div>
      </header>}
      {sidebarOpen && (
        <button
          className="matter-sidebar-scrim"
          aria-label={translate("workbench.closeNavigation")}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`matter-sidebar ${sidebarOpen ? 'is-open' : ''}`}
        aria-label={translate("workbench.threadNavigation")}
      >
        <div className="matter-sidebar-heading">
          <span>{translate("workbench.workspace")}</span>
          <button className="matter-mobile-close" aria-label={translate("workbench.openExplorer")} onClick={() => {setExplorerOpen(true);setSidebarOpen(false);}}><FolderOpen /></button>
          <button
            className="matter-mobile-close"
            aria-label={translate("workbench.closeSidebar")}
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </button>
        </div>
        {drawerTools && (
          <div className="matter-drawer-tools" role="group" aria-label={translate("workbench.workspaceTools")}>
            {homeHref && <a href={homeHref}><Home /><span>{translate("workbench.workspaces")}</span></a>}
            <button aria-pressed={o.panels ? !chatCovered : o.activeView === 'chat'} onClick={() => { showChat(); setSidebarOpen(false); }}><MessageSquare /><span>{translate("workbench.chat")}</span></button>
          </div>
        )}
        {o.error && (
          <p className="matter-sidebar-error" role="alert">
            {o.error}
          </p>
        )}
        <button
          className="matter-section-heading"
          aria-expanded={shortcutsOpen}
          onClick={() => setShortcutsOpen(!shortcutsOpen)}
        >
          {shortcutsOpen ? <ChevronDown /> : <ChevronRight />}
          <span>{translate("workbench.shortcuts")}</span>
          <Star />
        </button>
        {shortcutsOpen && (
          <div className="matter-thread-section" data-testid="shortcuts">
            {o.threads.filter((t) => t.favorite).map(thread => renderThread(
              thread, threadGroupActivity(thread, o.threads.filter(child => child.rootKey === thread.key && child.key !== thread.key)),
            ))}
            {!o.threads.some((t) => t.favorite) && (
              <p className="matter-sidebar-hint">
                {translate("workbench.starAThreadToKeepItClose")}<br />
                {translate("workbench.acrossWorkspacesAndDevices")}</p>
            )}
          </div>
        )}
        <button
          className="matter-section-heading"
          aria-expanded={recentsOpen}
          onClick={() => setRecentsOpen(!recentsOpen)}
        >
          {recentsOpen ? <ChevronDown /> : <ChevronRight />}
          <span>{translate("workbench.recentChats")}</span>
          <span className="matter-section-count" title={translate("workbench.conversationsGroups", { value1: o.threads.length, value2: groupThreads(o.threads).length })}>{groupThreads(o.threads).length}</span>
        </button>
        {recentsOpen && (
          <div className="matter-thread-section" data-testid="recent-chats">
            {renderThreadGroups(o.threads)}
          </div>
        )}
        <div className="matter-sidebar-footer">
          {translate("workbench.yourConversationsTogether")}</div>
      </aside>
      <main className="matter-main">
        {!dock && <div className="matter-tabs-row">
        <div className="tab-scroll-surface matter-tab-scroll" {...tabScrollEdges}>
        <nav ref={tabsRef} className="matter-thread-tabs" aria-label={translate("workbench.workspaceThreads")}>
          <GroupedThreadTabs threads={tabs} currentKey={o.currentKey} onNavigate={navigate} />
          {newThread}
        </nav>
        </div>
        {!o.emptyWorkspace && <button className="matter-toolbar-toggle" aria-label={translate("workbench.threadTools")} aria-expanded={toolbarOpen} aria-controls="matter-thread-tools" onClick={() => setToolbarOpen(open => !open)} title={toolbarOpen ? translate("workbench.hideThreadTools") : translate("workbench.showThreadTools")}><SlidersHorizontal /></button>}
        {o.statusActions}
        {toolbarOpen && <div className="matter-breadcrumb" id="matter-thread-tools">
          <WorkbenchPath path={o.workspacePath} />
          <ChevronRight />
          <span className="matter-current-title" title={title}>
            {title}
          </span>
          <button
            aria-label={o.favorite ? translate("workbench.removeShortcut") : translate("workbench.addShortcut")}
            aria-pressed={o.favorite}
            disabled={o.favoriteBusy}
            onClick={o.onToggleFavorite}
          >
            <Star fill={o.favorite ? 'currentColor' : 'none'} />
          </button>
          <div className="matter-thread-actions">
            {actions}
            {threadMenu}
          </div>
        </div>}
        </div>}
        <PhoneDockContext.Provider value={dock}>
        {o.panels ? <WorkbenchContext.Provider value={true}><WorkbenchPanels options={dock ? { ...o.panels, onPaneSwitchChange: setPaneSwitch } : o.panels} explorer={explorer} revealExplorer={revealExplorer} toolPanel={toolPanel}>{children}</WorkbenchPanels></WorkbenchContext.Provider> : (
        <div ref={contentRef} style={{ '--explorer-width': `${explorerWidth}px` } as CSSProperties} className={`matter-content ${explorerOpen ? 'has-explorer' : ''}`}>
          <div className="matter-chat">
            <WorkbenchContext.Provider value={true}>
              {children}
            </WorkbenchContext.Provider>
          </div>
          {explorerOpen && (
            <aside className="matter-explorer" aria-label={translate("workbench.explorer")}>
              {!mobile && <div role="separator" aria-label={translate("workbench.resizeExplorer")} aria-orientation="vertical" aria-valuemin={260} aria-valuemax={Math.max(260, (contentRef.current?.clientWidth ?? 1000) - 320)} aria-valuenow={explorerWidth} tabIndex={0} className="matter-explorer-resize"
                onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); resizeOrigin.current = { x: e.clientX, width: explorerWidth }; }}
                onPointerMove={e => { if (resizeOrigin.current) resizeExplorer(resizeOrigin.current.width + resizeOrigin.current.x - e.clientX); }}
                onPointerUp={e => { resizeOrigin.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}
                onLostPointerCapture={() => { resizeOrigin.current = null; }}
                onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); resizeExplorer(explorerWidth + (e.key === 'ArrowLeft' ? 24 : -24)); } }}
              />}
              <div className="matter-explorer-heading">
                {translate("workbench.explorer")}<button
                  aria-label={translate("workbench.closeExplorer")}
                  onClick={() => setExplorerOpen(false)}
                >
                  <X />
                </button>
              </div>
              {explorer}
            </aside>
          )}
        </div>
        )}
        </PhoneDockContext.Provider>
      </main>
      {dock && <>
        <PhoneDock title={title} thread={currentThread} paneSwitch={paneSwitch} siblings={swipeSiblings} currentKey={o.currentKey} pane={pane}
          terminalEnabled={o.terminalEnabled} onPane={choosePane} onNavigate={navigate}
          onOpenThreads={() => { setMoreOpen(false); setThreadsOpen(true); }} onOpenMore={() => { setThreadsOpen(false); setMoreOpen(true); }}
          threadsOpen={threadsOpen} moreOpen={moreOpen} />
        <PhoneSheet open={threadsOpen} label={translate('workbench.threadSheet')} onClose={() => setThreadsOpen(false)}
          footer={<>
            <button type="button" className="matter-phone-sheet-wide" onClick={() => { setThreadsOpen(false); setSidebarOpen(true); }}><PanelLeft /><span>{translate('workbench.workspaceAndShortcuts')}</span></button>
            {newThread}
          </>}>
          {o.unreadCount > 0 && <>
            <h3>{translate('workbench.notifications')}</h3>
            <div className="matter-phone-sheet-notices">
              {[...o.notifications].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3).map(n => (
                <a key={n.id} href={n.href} onClick={e => { e.preventDefault(); o.onReadNotifications(); navigate(n.href); }}>
                  <span className="matter-status-dot" data-status="completed" />
                  <span><b>{n.title}</b>{n.summary && <small>{n.summary}</small>}</span>
                </a>
              ))}
            </div>
          </>}
          <h3>{translate('workbench.thisWorkspace')}</h3>
          <div className="matter-thread-section">{renderThreadGroups([...tabs].sort((a, b) => attention(a) - attention(b)))}</div>
          {o.threads.some(thread => !tabs.some(tab => tab.key === thread.key)) && <>
            <h3>{translate('workbench.recentChats')}</h3>
            <div className="matter-thread-section">{renderThreadGroups(o.threads.filter(thread => !tabs.some(tab => tab.key === thread.key)))}</div>
          </>}
        </PhoneSheet>
        <PhoneSheet open={moreOpen} label={translate('workbench.moreActions')} onClose={() => setMoreOpen(false)}>
          <h3 title={title}>{title}</h3>
          <div className="matter-phone-sheet-tools">
            {!o.emptyWorkspace && <button type="button" onClick={o.onSearch}><Search /><span>{translate('workbench.searchConversation')}</span></button>}
            {!o.emptyWorkspace && <button type="button" aria-pressed={o.favorite} disabled={o.favoriteBusy} onClick={o.onToggleFavorite}><Star fill={o.favorite ? 'currentColor' : 'none'} /><span>{o.favorite ? translate('workbench.removeShortcut') : translate('workbench.addShortcut')}</span></button>}
            {o.toolPanels?.map(panel => <button type="button" key={panel.id} aria-pressed={panel.active} onClick={panel.onToggle}>{panel.icon}<span>{panel.label}</span></button>)}
            {shellNav?.setPhoneHand && <button type="button" aria-pressed={leftHanded} onClick={() => shellNav.setPhoneHand?.(leftHanded ? 'right' : 'left')}><Hand className="matter-phone-hand-icon" /><span>{translate('workbench.leftHanded')}</span></button>}
            <div className="matter-phone-sheet-host">{actions}{threadMenu}{o.statusActions}</div>
          </div>
          <h3>{translate('workbench.app')}</h3>
          <div className="matter-phone-sheet-list">
            <button type="button" onClick={() => setSidebarOpen(true)}><PanelLeft /><span>{translate('workbench.workspaceAndShortcuts')}</span></button>
            {homeHref && <a href={homeHref}><Home /><span>{translate('workbench.backToWorkspaces')}</span></a>}
            <button type="button" onClick={() => history.back()}><ArrowLeft /><span>{translate('workbench.goBack')}</span></button>
            <div className="matter-phone-sheet-settings">{settings}<span>{translate('workbench.settings')}</span></div>
          </div>
        </PhoneSheet>
      </>}
      {bellOpen && (
        <>
          <button
            className="matter-popover-scrim"
            aria-label={translate("workbench.closeNotifications")}
            onClick={() => setBellOpen(false)}
          />
          <section
            className="matter-notifications"
            aria-label={translate("workbench.notifications")}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBellOpen(false);
            }}
          >
            <div className="matter-notifications-heading">
              {translate("workbench.notifications")}<button
                aria-label={translate("workbench.closeNotificationPanel")}
                onClick={() => setBellOpen(false)}
              >
                <X />
              </button>
            </div>
            {o.notifications.length ? (
              [...o.notifications].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 10).map((n) => (
                <a
                  key={n.id}
                  href={n.href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(n.href);
                  }}
                >
                  <span className="matter-status-dot" data-status="completed" />
                  <span>
                    {n.title}
                    {n.summary && <p className="matter-notification-summary">{n.summary}</p>}
                    <small>{new Date(n.occurredAt).toLocaleString(getLocale())}</small>
                  </span>
                </a>
              ))
            ) : (
              <p>{translate("workbench.allCaughtUpCompletedThreadsWillAppear")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
