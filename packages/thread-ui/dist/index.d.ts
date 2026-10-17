import { T as ThreadShellControlState$1, P as PromptAttachmentUpload, S as SettingsSection, a as ThreadTimelineAdapter, b as ThreadShellAdapter, c as ThreadGraphWorkspacePanelProps, d as PluginContextValue, e as ThreadDetailUiAdapter, f as ThreadGraphWorkspaceFeatures, g as SettingsPanels, h as ThreadWorkspaceAdapter } from './workspace-panel-_RvAvMtY.js';
export { i as PluginContext, j as PluginProvider, k as PluginProviderAdapter, l as SendPromptInput, m as ShellSocketConnection, n as ShellSocketHandlers, o as ThreadImageAssetVariant, W as WorkspaceDocumentSaveInput, p as WorkspaceDocumentSnapshot, q as WorkspaceSaveReceipt, r as WorkspaceTab, s as createDefaultPluginContextValue, t as mergePluginState } from './workspace-panel-_RvAvMtY.js';
import * as react from 'react';
import { Dispatch, SetStateAction, ReactNode, Component, ErrorInfo, RefObject, Ref, ComponentType, ForwardRefExoticComponent, RefAttributes, ComponentProps } from 'react';
import { ReasoningEffortDto, CollaborationModeDto, SandboxModeDto, ModelOptionDto, ThreadContextUsageDto, AgentProviderCapabilitiesDto, AgentBackendToolboxItemSchemaDto, AgentBackendHookCommandTemplateDto, AgentBackendManagementSchemaDto, PromptAttachmentKindDto, ThreadSkillsDto, ThreadMcpServersDto, ThreadHooksDto, ThreadForkTurnOptionDto, ThreadGoalDto, CreateThreadHookInput, UpdateThreadHookInput, ThreadGoalStatusDto, ProviderHostFileDto, AgentSubscriptionUsageDto, UpdateThreadSettingsInput, ThreadTurnTokenBreakdownDto, ThreadTurnPriceEstimateDto, AgentBackendIdDto, ThreadDto, AgentRuntimeStatusDto, ThreadTurnDto, ThreadActionRequestDto, ThreadHistoryItemDto, RespondThreadActionRequestInput, ThreadAnsweredRequestNoteDto, ThreadActivityNoteDto, ThreadPendingSteerDto, ThreadHistoryItemDetailDto, ShellStatusDto, ThreadExportTurnOptionsDto, ThreadExportFormatDto, ExportThreadTranscriptInput, ThreadDetailDto, PluginDto, ImportPluginInput } from '@pockymoe/shared';
import { P as PluginActionOutputContext, T as ThreadPluginAdapter } from './plugin-types-Ct5yq4qu.js';
export { A as ArtifactRenderContext, F as FrontendPluginModule, I as InlineCodeRenderContext, M as MessagePresentation, a as MessagePresentationContext, b as PluginSettingsContext, c as PluginSettingsContribution, d as PluginSettingsSnapshot, e as ThreadPanelContribution, f as ThreadPluginDto, g as ThreadPluginSettingsInput, h as ThreadPluginSettingsSnapshot, U as UpstreamConnectionHost, i as UpstreamConnectionPickerProps, j as UpstreamConnectionPickerValue, k as UpstreamConnectionProtocol } from './plugin-types-Ct5yq4qu.js';
import * as DialogPrimitive from '@radix-ui/react-dialog';
export { DEFAULT_LOCALE, I18nProvider, LOCALE_OPTIONS, LOCALE_STORAGE_KEY, LanguageSwitcher, Locale, SUPPORTED_LOCALES, TranslationKey, TranslationValues, detectLocale, formatDate, formatNumber, getLocale, initializeI18n, normalizeLocale, setLocale, t, translate, useI18n } from './i18n.js';

interface SlashPanelState<T> {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    data: T | null;
    error: string | null;
}

type ComposerSendShortcut = 'ctrlEnter' | 'enter';

type ThreadComposerAttachmentPicker = (input: {
    kind: PromptAttachmentKindDto;
    appendAttachments: (files: FileList | null, kind?: PromptAttachmentKindDto) => boolean;
    defaultPick: () => void;
}) => void;
interface ThreadComposerProps {
    activeView: 'chat' | 'shell';
    sendShortcut?: ComposerSendShortcut;
    edgeToEdgeMobile?: boolean;
    busy?: boolean;
    settingsBusy?: boolean;
    compactBusy?: boolean;
    error?: string | null;
    model?: string | null;
    agentLabel?: string | null;
    reasoningEffort?: ReasoningEffortDto | null;
    fastMode?: boolean;
    collaborationMode?: CollaborationModeDto;
    sandboxMode?: SandboxModeDto | null;
    hideSandboxModeControl?: boolean;
    modelOptions?: ModelOptionDto[];
    contextUsage?: ThreadContextUsageDto | null | undefined;
    capabilities?: AgentProviderCapabilitiesDto | null | undefined;
    toolboxItems?: AgentBackendToolboxItemSchemaDto[] | null | undefined;
    hookCommandTemplates?: AgentBackendHookCommandTemplateDto[] | null | undefined;
    mcpConfigFormat?: AgentBackendManagementSchemaDto['mcpConfigFormat'] | null | undefined;
    followTail?: boolean;
    threadConnected?: boolean;
    shellAvailable?: boolean;
    disabled?: boolean;
    disabledPlaceholder?: string | undefined;
    shellControlState?: ThreadShellControlState$1 | null;
    draftPrompt?: string | undefined;
    draftAttachments?: PromptAttachmentUpload[] | undefined;
    onPickAttachment?: ThreadComposerAttachmentPicker | undefined;
    skillsState?: SlashPanelState<ThreadSkillsDto>;
    mcpState?: SlashPanelState<ThreadMcpServersDto>;
    hooksState?: SlashPanelState<ThreadHooksDto>;
    forkTurnOptionsState?: SlashPanelState<ThreadForkTurnOptionDto[]>;
    goalState?: SlashPanelState<ThreadGoalDto | null | undefined>;
    goalHistory?: ThreadGoalDto[];
    onDraftChange?: Dispatch<SetStateAction<{
        prompt: string;
        attachments: PromptAttachmentUpload[];
    }>> | undefined;
    onSubmit: (input: {
        prompt: string;
        attachments?: PromptAttachmentUpload[];
        delivery?: 'steer';
    }) => Promise<boolean | void> | boolean | void;
    onInterrupt?: () => Promise<void> | void;
    onCompact?: () => Promise<void> | void;
    onOpenSkills?: () => Promise<void> | void;
    onOpenMcp?: () => Promise<void> | void;
    onOpenHarness?: (composerFocusOwner?: string) => Promise<void> | void;
    onOpenHooks?: () => Promise<void> | void;
    onCreateHook?: (input: CreateThreadHookInput) => Promise<void> | void;
    onUpdateHook?: (input: UpdateThreadHookInput) => Promise<void> | void;
    onTrustHook?: (input: {
        key: string;
        currentHash: string;
    }) => Promise<void> | void;
    onUntrustHook?: (input: {
        key: string;
    }) => Promise<void> | void;
    onOpenGoal?: () => Promise<void> | void;
    onPrepareGoalSubmit?: (input: {
        objective: string;
        tokenBudget: number | null;
    }) => Promise<boolean | void> | boolean | void;
    onUpdateGoal?: (input: {
        objective?: string | null;
        status?: ThreadGoalStatusDto | null;
        tokenBudget?: number | null;
    }) => Promise<void> | void;
    onOpenForkTurns?: () => Promise<void> | void;
    onForkLatest?: () => Promise<void> | void;
    onForkTurn?: (turnId: string) => Promise<void> | void;
    onReadProviderConfig?: (() => Promise<ProviderHostFileDto> | ProviderHostFileDto) | undefined;
    onWriteProviderConfig?: ((content: string) => Promise<ProviderHostFileDto> | ProviderHostFileDto) | undefined;
    onToggleFollow?: () => void;
    canJumpToPreviousTurn?: boolean;
    onJumpToPreviousTurn?: () => void;
    canJumpToNextTurn?: boolean;
    onJumpToNextTurn?: () => void;
    subscriptionUsage?: AgentSubscriptionUsageDto | null;
    onUpdateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
    onToggleView?: () => void;
    onShellCopy?: () => Promise<void> | void;
    onShellControl?: (action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down' | 'clear') => Promise<void> | void;
    canInterrupt?: boolean;
    pendingPrompts?: Array<{
        id: string;
        prompt: string;
        optimistic?: boolean;
    }>;
    onSteerPendingPrompt?: (pendingPromptId: string) => Promise<void> | void;
    onCancelPendingPrompt?: (pendingPromptId: string) => Promise<void> | void;
}
declare function ThreadComposer({ activeView, sendShortcut, edgeToEdgeMobile, busy, settingsBusy, compactBusy, error, model, agentLabel, reasoningEffort, fastMode, collaborationMode, sandboxMode, hideSandboxModeControl, modelOptions, contextUsage, capabilities, toolboxItems, hookCommandTemplates, mcpConfigFormat, followTail, threadConnected, shellAvailable, disabled, disabledPlaceholder, shellControlState, draftPrompt, draftAttachments, onPickAttachment, skillsState, mcpState, hooksState, goalState, goalHistory, forkTurnOptionsState, onDraftChange, onSubmit, onInterrupt, onCompact, onOpenSkills, onOpenMcp, onOpenHooks, onOpenHarness, onCreateHook, onUpdateHook, onTrustHook, onUntrustHook, onOpenGoal, onPrepareGoalSubmit, onUpdateGoal, onOpenForkTurns, onForkLatest, onForkTurn, onReadProviderConfig, onWriteProviderConfig, onToggleFollow, canJumpToPreviousTurn, onJumpToPreviousTurn, canJumpToNextTurn, onJumpToNextTurn, subscriptionUsage, onUpdateSettings, onToggleView, onShellCopy, onShellControl, canInterrupt, pendingPrompts, onSteerPendingPrompt, onCancelPendingPrompt, }: ThreadComposerProps): react.JSX.Element;

interface TokenUsageCostProps {
    usage?: ThreadTurnTokenBreakdownDto | null;
    price?: Pick<ThreadTurnPriceEstimateDto, 'totalUsd' | 'inputUsd' | 'cachedInputUsd' | 'cacheWriteInputUsd' | 'outputUsd'> | null;
    readOnly?: boolean;
    costLabel?: string;
    detailsNote?: string;
    tooltipZIndex?: number;
}
declare function TokenUsageCost({ usage, price, readOnly, costLabel, detailsNote, tooltipZIndex, }: TokenUsageCostProps): react.JSX.Element;

type ReferenceMode = 'focus' | 'thread' | 'files' | 'collaboration';
interface WorkbenchPresentation {
    referenceId: string | null;
    /** Null (and legacy absence) resolves to the host device. */
    referenceDeviceId?: string | null;
    mode: ReferenceMode;
    ratio: number;
}
/** Members and arrangement are independent. Pending identity never discards an explicit layout action. */
declare function useWorkbenchPresentation(scope: string | null, contextKey?: string | null): {
    value: WorkbenchPresentation;
    update: (patch: Partial<WorkbenchPresentation>) => void;
    storageFailed: boolean;
};

type WorkbenchPane = 'primary' | 'reference';
/** A phone split shows one conversation at a time; the composer switches it. */
interface WorkbenchPaneSwitch {
    pane: WorkbenchPane;
    active: WorkbenchPane;
    titles: Record<WorkbenchPane, string>;
    select: (pane: WorkbenchPane) => void;
    /** A rendered switch claims its pane, so the panels need no fallback there. */
    claim: (pane: WorkbenchPane) => () => void;
}

/** Passed to bottom-panel content so its title bar can own the panel actions. */
interface WorkbenchToolPanelControls {
    maximized: boolean;
    collapsed: boolean;
    /** Phone-sized workbench: no hover, touch-sized targets, stacked splits. */
    compact: boolean;
    toggleMaximized: () => void;
    toggleCollapsed: () => void;
    close: () => void;
}

interface WorkbenchPanelsOptions {
    deviceLabel: string;
    workspaceLabel: string;
    primaryTitle: string;
    /** Receives the phone split switch, for a dock that shows the pinned conversations. */
    onPaneSwitchChange?: ((value: WorkbenchPaneSwitch | null) => void) | undefined;
    primaryStatus: string;
    primaryHarness: string;
    presentation: WorkbenchPresentation;
    onPresentationChange: (patch: Partial<WorkbenchPresentation>) => boolean | void;
    candidates: Array<{
        id: string;
        title: string;
    }>;
    referenceTitle?: string;
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

interface WorkbenchThread {
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
    /** A shortcut's place in the account's own order; unordered ones follow by recency. */
    shortcutOrder?: number;
}
interface WorkbenchNotification {
    id: string;
    title: string;
    href: string;
    occurredAt: string;
    summary?: string;
    /** The thread it is about, and for an agent thread its conversation's root:
        such notifications are listed under that conversation. */
    threadKey?: string;
    rootKey?: string;
    rootTitle?: string;
    rootHref?: string;
}
/** A plugin's thread panel in the workbench rail (it opens in the tools drawer). */
interface WorkbenchToolPanel {
    id: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    onToggle: () => void;
}
interface MatterWorkbenchOptions {
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
    /** Threads that want the reader, for the running count and its sheet: running
        ones beyond `threads` (other workspaces and devices, threads never opened)
        and finished ones the reader opened before and has not read since. */
    activeThreads?: WorkbenchThread[];
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
    /** Warm a thread's detail before it is opened (a row is pressed, or it is a
        dock swipe away), so opening it shows the conversation at once. */
    onPrefetchThread?: (href: string) => void;
    /** Store a new shortcut order (thread keys, first to last). */
    onReorderShortcuts?: (keys: string[]) => void;
    onSearch: () => void;
    search?: ReactNode;
    searchOpen?: boolean;
    notifications: WorkbenchNotification[];
    unreadCount: number;
    onReadNotifications: () => void;
    renderThreadMenu?: (thread: WorkbenchThread) => ReactNode;
}
declare function MatterWorkbench({ options: o, title, homeHref, settings, newThread, actions, threadMenu, connection, deviceMonitor, explorer, revealExplorer, children, }: {
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
}): react.JSX.Element;

type ThemeMode = 'system' | 'light' | 'dark';
type PhoneHand = 'right' | 'left';
type AgentBackendId = AgentBackendIdDto;
interface AppShellNavContextValue {
    navOpen: boolean;
    openNav: () => void;
    toggleNav: () => void;
    closeNav: () => void;
    settingsOpen: boolean;
    openSettings: () => void;
    /** Opens settings on one section, such as `resources`. */
    openSettingsSection?: (sectionId: string) => void;
    /** The section the settings dialog opens on; the first one when unset. */
    settingsSection?: string | null;
    closeSettings: () => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    effectiveTheme: 'light' | 'dark';
    defaultBackend: AgentBackendId;
    setDefaultBackend: (backend: AgentBackendId) => void;
    autoCollapseCompletedTurns?: boolean;
    setAutoCollapseCompletedTurns?: (enabled: boolean) => void;
    /** One-handed phone layout: status-only top bar, controls in a bottom dock. */
    phoneDock?: boolean;
    setPhoneDock?: (enabled: boolean) => void;
    /** The thumb the one-handed layout is arranged for; left mirrors it. */
    phoneHand?: PhoneHand;
    setPhoneHand?: (hand: PhoneHand) => void;
    /** Opens the map of every thread on the account's devices. */
    openThreadMap?: () => void;
    showReasoningSummaries?: boolean;
    setShowReasoningSummaries?: (enabled: boolean) => void;
    sendShortcut?: ComposerSendShortcut;
    setSendShortcut?: (shortcut: ComposerSendShortcut) => Promise<void>;
    sendShortcutLoading?: boolean;
    sendShortcutSaving?: boolean;
    sendShortcutError?: string | null;
    refreshSendShortcut?: () => Promise<void>;
}
declare const AppShellNavContext: react.Context<AppShellNavContextValue | null>;
declare function useAppShellNav(): AppShellNavContextValue | null;

interface ThreadWorkspaceLayoutProps {
    workbench?: MatterWorkbenchOptions;
    threads: ThreadDto[];
    status: AgentRuntimeStatusDto | null;
    loading?: boolean;
    error?: string | null;
    viewportConstrained?: boolean;
    layoutMode?: "desktop" | "responsive" | "mobile";
    effectiveTheme?: "light" | "dark";
    themeMode?: ThemeMode;
    onThemeModeChange?: (mode: ThemeMode) => void;
    showMobileAppMenu?: boolean;
    showMobileThreadNavToggle?: boolean;
    showMobileNewThreadShortcut?: boolean;
    hideRoomsRail?: boolean;
    settingsDialogOpen?: boolean;
    onSettingsDialogOpenChange?: (open: boolean) => void;
    mobileHeaderAction?: ReactNode;
    currentThreadId?: string | undefined;
    currentThreadLabel?: string | null | undefined;
    currentWorkspaceId?: string | null | undefined;
    currentWorkspaceLabel?: string | null | undefined;
    harnessLabel?: string | null | undefined;
    sessionLabel?: string | null | undefined;
    usageLabel?: string | null | undefined;
    threadActionsButton?: ReactNode;
    topbarActions?: ReactNode;
    deviceMonitor?: ReactNode;
    workspaceLabels?: Record<string, string>;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    globalSettingsContent?: ReactNode;
    settingsSections?: SettingsSection[];
    appMenuButton?: ReactNode;
    appNavigationMenu?: ReactNode;
    workspaceReturnHref?: string;
    onWorkspaceReturn?: () => void;
    getThreadHref?: (threadId: string) => string;
    onOpenThread?: (threadId: string) => void;
    getNewThreadHref?: (workspaceId?: string | null) => string;
    newThreadHref?: string;
    newThreadLabel?: string;
    /** Host scope disables global settings and home navigation; conversation creation stays available. */
    restrictedNavigation?: boolean;
    onNewThread?: () => void;
    onNewThreadTitle?: (title: string) => Promise<void> | void;
    renderNewThreadDialogContent?: (input: {
        close: () => void;
        closeNavigation: () => void;
        currentWorkspaceId?: string | null;
    }) => ReactNode;
    renderThreadLink?: (input: {
        thread: ThreadDto;
        children: ReactNode;
        className: string;
        onClick: () => void;
    }) => ReactNode;
    onCloseAppNavigation?: () => void;
    onRenameThread?: ((threadId: string, title: string) => Promise<void> | void) | undefined;
    onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
    workspaceContent?: ReactNode;
    workspaceTitle?: string;
    workspaceActions?: ReactNode;
    workspaceRevealRequestKey?: number;
    children: ReactNode;
}
interface ThreadCardsProps {
    threads: ThreadDto[];
    currentThreadId?: string | undefined;
    currentWorkspaceId?: string | null | undefined;
    workspaceLabels?: Record<string, string>;
    onOpenThread: (threadId: string) => void;
    getThreadHref?: ((threadId: string) => string) | undefined;
    renderThreadLink?: ThreadWorkspaceLayoutProps["renderThreadLink"] | undefined;
    onBeginRenameThread?: ((thread: ThreadDto) => void) | undefined;
    onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
    scrollable?: boolean;
    maxHeightClassName?: string;
    showDeleteButton?: boolean;
    showSessionCopyButton?: boolean;
    collapsed?: boolean;
}
declare function ThreadCards({ threads, currentThreadId, currentWorkspaceId, workspaceLabels, onOpenThread, getThreadHref, renderThreadLink, onBeginRenameThread, onDeleteThread, scrollable, maxHeightClassName, showDeleteButton, showSessionCopyButton, collapsed, }: ThreadCardsProps): react.JSX.Element;
declare function ThreadWorkspaceLayout({ workbench, threads, status, loading, error, viewportConstrained, layoutMode, effectiveTheme: effectiveThemeProp, themeMode: themeModeProp, onThemeModeChange, showMobileNewThreadShortcut, hideRoomsRail, settingsDialogOpen, onSettingsDialogOpenChange, mobileHeaderAction, currentThreadId, currentThreadLabel, currentWorkspaceId, currentWorkspaceLabel, harnessLabel, sessionLabel, usageLabel, threadActionsButton, topbarActions, deviceMonitor, metaContent, settingsContent, globalSettingsContent, settingsSections, restrictedNavigation, workspaceLabels, workspaceReturnHref, onWorkspaceReturn, getThreadHref, onOpenThread, getNewThreadHref, newThreadHref: explicitNewThreadHref, newThreadLabel, onNewThread, onNewThreadTitle, renderNewThreadDialogContent, renderThreadLink, onCloseAppNavigation, onRenameThread, onDeleteThread, workspaceContent, workspaceTitle, workspaceActions, workspaceRevealRequestKey, children, }: ThreadWorkspaceLayoutProps): react.JSX.Element;

type TimelineTurn = Omit<ThreadTurnDto, "status"> & {
    status: ThreadTurnDto["status"] | "sending";
};

interface ThreadTimelineProps {
    threadId?: string | undefined;
    turns: ThreadTurnDto[];
    totalTurnCount?: number;
    pendingRequests?: ThreadActionRequestDto[];
    activeTurnId?: string | null;
    threadRunning?: boolean;
    backgroundAgentCount?: number;
    backendProgress?: {
        turnId: string;
        receivedAt: string;
    } | null;
    livePlan?: {
        turnId: string;
        explanation: string | null;
        plan: Array<{
            step: string;
            status: string;
        }>;
        updatedAt?: string | null;
    } | null;
    liveItems?: {
        turnId: string;
        items: ThreadHistoryItemDto[];
        updatedAt?: string | null;
    } | null;
    respondingRequestId?: string | null;
    onRespondToRequest?: (requestId: string, input: RespondThreadActionRequestInput) => Promise<void> | void;
    liveOutput: string;
    scrollRequestKey?: number;
    searchTarget?: {
        turnId: string;
        itemId: string;
        key: number;
    };
    previousTurnScrollRequestKey?: number;
    nextTurnScrollRequestKey?: number;
    bottomSpacer?: number;
    className?: string;
    onTailVisibilityChange?: (isVisible: boolean) => void;
    onPreviousTurnAvailabilityChange?: (available: boolean) => void;
    onNextTurnAvailabilityChange?: (available: boolean) => void;
    loadingEarlier?: boolean;
    onLoadEarlier?: () => void;
    ephemeralUserNote?: string | null;
    answeredRequestNotes?: ThreadAnsweredRequestNoteDto[];
    activityNotes?: ThreadActivityNoteDto[];
    pendingSteers?: ThreadPendingSteerDto[];
    optimisticSteers?: Array<{
        id: string;
        clientRequestId: string;
        turnId: string;
        prompt: string;
        createdAt: string;
        status: 'steering' | 'accepted';
    }>;
    optimisticTurn?: TimelineTurn | null;
    onLoadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    onLoadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
    onOpenThread?: (threadId: string) => void;
    onSelectArtifact?: (input: {
        item: ThreadHistoryItemDto & {
            kind: 'artifact';
        };
        artifact: NonNullable<ThreadHistoryItemDto['artifact']>;
    }) => void;
    onSelectHistoryItemDetail?: (input: {
        item: ThreadHistoryItemDto;
        detail: ThreadHistoryItemDetailDto;
    }) => void;
    adapter?: ThreadTimelineAdapter | undefined;
    autoCollapseCompletedTurns?: boolean;
}
declare function ThreadTimelineComponent({ threadId, turns, totalTurnCount, pendingRequests, activeTurnId, threadRunning, backgroundAgentCount, pendingSteers, livePlan, liveItems, backendProgress, respondingRequestId, onRespondToRequest, liveOutput, scrollRequestKey, searchTarget, previousTurnScrollRequestKey, nextTurnScrollRequestKey, bottomSpacer, className, onTailVisibilityChange, onPreviousTurnAvailabilityChange, onNextTurnAvailabilityChange, loadingEarlier, onLoadEarlier, ephemeralUserNote, answeredRequestNotes, activityNotes, optimisticSteers, optimisticTurn, onLoadHistoryItemDetail, onLoadTurnDetail, onOpenThread, onSelectArtifact, onSelectHistoryItemDetail, adapter, autoCollapseCompletedTurns, }: ThreadTimelineProps): react.JSX.Element;
declare const ThreadTimeline: react.MemoExoticComponent<typeof ThreadTimelineComponent>;

interface ThreadShellControlState {
    status: ShellStatusDto;
    connectionButtonDisabled: boolean;
    connectionButtonLabel: string;
    shellInputEnabled: boolean;
    isConnecting: boolean;
    isCommandRunning: boolean;
    promptLabel: string | null;
    isMobileShell: boolean;
    hasShell: boolean;
    busy: boolean;
    loading: boolean;
    error: string | null;
}

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
interface ThreadShellPanelHandle {
    toggleConnection: () => Promise<void>;
    sendInput: (data: string) => boolean;
    sendCommand: (command: string) => boolean;
    sendControl: (action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down' | 'clear') => boolean;
    copyLastCommandOutput: () => Promise<boolean>;
    terminate: () => Promise<void>;
    focus: () => void;
    refreshLayout: (options?: {
        focus?: boolean;
        syncBackendSize?: boolean;
    }) => void;
}
declare const ThreadShellPanel: react.ForwardRefExoticComponent<ThreadShellPanelProps & react.RefAttributes<ThreadShellPanelHandle>>;

declare function ThreadGraphWorkspacePanel(props: ThreadGraphWorkspacePanelProps): react.JSX.Element;
declare const MemoizedThreadGraphWorkspacePanel: react.MemoExoticComponent<typeof ThreadGraphWorkspacePanel>;

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    busyLabel?: string;
    busy?: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
}
declare function ConfirmDialog({ open, title, description, confirmLabel, busyLabel, busy, error, onCancel, onConfirm, }: ConfirmDialogProps): react.ReactPortal | null;

/** A page opened before a deployment asks for a build chunk that no longer exists. */
declare function isStaleBuildError(error: unknown): boolean;
declare function RenderErrorFallback({ error, className }: {
    error: unknown;
    className?: string;
}): react.JSX.Element;
/** Keeps a failed part of the page from unmounting everything around it. */
declare class RenderErrorBoundary extends Component<{
    children: ReactNode;
    className?: string;
}, {
    failed: boolean;
    error: unknown;
}> {
    state: {
        failed: boolean;
        error: unknown;
    };
    static getDerivedStateFromError(error: unknown): {
        failed: boolean;
        error: unknown;
    };
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | react.ReactPortal | react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | react.JSX.Element | null | undefined;
}

type ThreadActionMode = ThreadExportFormatDto | 'share' | 'link';
type RelayThreadAccess = 'read' | 'control';
type RelayWorkspaceAccess = 'none' | 'read' | 'write';
interface ExportTurnsState {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    data: ThreadExportTurnOptionsDto | null;
    error: string | null;
}
interface CreateThreadShareInput {
    scope?: 'thread' | 'device';
    targetIdentifier: string;
    threadAccess: RelayThreadAccess;
    workspaceAccess: RelayWorkspaceAccess;
    label?: string | null;
}
interface ThreadShareSummary {
    trustContent?: ReactNode;
    scope?: 'thread' | 'device';
    id: string;
    targetUsername: string;
    label: string | null;
    threadAccess?: RelayThreadAccess;
    workspaceAccess?: RelayWorkspaceAccess;
    createdAt?: string | null;
}
interface ShareState {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    shares: ThreadShareSummary[];
    error: string | null;
}
interface ThreadActionsDialogProps {
    appearance?: 'default' | 'matter';
    open: boolean;
    busy?: boolean;
    turnsState: ExportTurnsState;
    shareAvailable?: boolean;
    shareUnavailableMessage?: string;
    shareState?: ShareState;
    initialMode?: ThreadActionMode;
    onCancel: () => void;
    onLoadTurns: () => void | Promise<void>;
    onExport: (input: ExportThreadTranscriptInput) => void | Promise<void>;
    onCreateShare?: (input: CreateThreadShareInput) => void | Promise<void>;
    onRevokeShare?: (shareId: string) => void | Promise<void>;
    onOpenDeviceSharing?: () => void;
    deviceShareAvailable?: boolean;
    linkContent?: ReactNode;
    onUpdateShare?: (id: string, input: CreateThreadShareInput) => void | Promise<void>;
}
declare function ThreadActionsDialog({ appearance, open, busy, turnsState, shareAvailable, shareUnavailableMessage, shareState, initialMode, onCancel, onLoadTurns, onExport, onCreateShare, onRevokeShare, deviceShareAvailable, linkContent, onUpdateShare, }: ThreadActionsDialogProps): react.ReactPortal | null;
declare const ExportTranscriptDialog: typeof ThreadActionsDialog;

interface LongTextDialogProps {
    open: boolean;
    title: string;
    text: string;
    kind?: string | undefined;
    onClose: () => void;
}
declare function LongTextDialog({ open, title, text, kind, onClose, }: LongTextDialogProps): react.ReactPortal | null;

declare function formatShortTimestamp(value: string | null): string;
declare function formatLongTimestamp(value: string | null): string;
declare function threadStatusLabel(status: ThreadDto['status']): string;
declare function threadStatusClassName(status: ThreadDto['status']): "ui-status-warning" | "ui-status-neutral" | "ui-status-info" | "ui-status-danger";
declare function turnStatusLabel(status: ThreadTurnDto['status'] | 'sending'): string;
declare function historyItemAccentClassName(kind: ThreadHistoryItemDto['kind']): "ui-status-neutral" | "timeline-kind-user" | "timeline-kind-agent" | "timeline-kind-action" | "timeline-kind-command" | "timeline-kind-search" | "timeline-kind-file-read" | "timeline-kind-reasoning" | "timeline-kind-agent-tool" | "timeline-kind-skill-tool" | "timeline-kind-plan" | "timeline-kind-file";
declare function historyItemLabel(kind: ThreadHistoryItemDto['kind']): string;

declare function hasLikelyMarkdownSyntax(text: string): boolean;

interface ThreadDetailSurfaceProps {
    threads: ThreadDto[];
    detail: ThreadDetailDto | null;
    loading: boolean;
    error: string | null;
    status?: AgentRuntimeStatusDto | null;
    capabilities?: AgentProviderCapabilitiesDto | null;
    managementSchema?: AgentBackendManagementSchemaDto | null;
    plugins?: PluginContextValue;
    adapter: ThreadDetailUiAdapter;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    globalSettingsContent?: ReactNode;
    settingsSections?: SettingsSection[];
    settingsDialogOpen?: boolean;
    onSettingsDialogOpenChange?: (open: boolean) => void;
    mobileHeaderAction?: ReactNode;
    appMenuButton?: ReactNode;
    appNavigationMenu?: ReactNode;
    workspaceReturnHref?: string;
    restrictedNavigation?: boolean;
    onWorkspaceReturn?: () => void;
    threadActionsButton?: ReactNode;
    surfaceActions?: ReactNode;
    workbench?: MatterWorkbenchOptions;
    deviceMonitor?: ReactNode;
    floatingPanel?: ReactNode;
    workspaceContent?: ReactNode;
    workspaceTitle?: string;
    workspaceActions?: ReactNode;
    workspaceFeatures?: ThreadGraphWorkspaceFeatures;
    workspaceFocusPathRequest?: {
        path: string;
        line?: number;
        requestId: number;
    } | null;
    onNewThreadTitle?: (title: string) => Promise<void> | void;
    beforeTimelineContent?: ReactNode;
    errorContent?: ReactNode;
    workspaceMissingContent?: ReactNode;
    dialogs?: ReactNode;
    currentThreadId?: string;
    currentWorkspaceId?: string | null;
    currentWorkspaceLabel?: string | null;
    onCloseAppNavigation?: () => void;
    presentation?: "workspace" | "embedded-single-thread";
    className?: string;
    activeView?: "chat" | "shell";
    liveOutput?: string;
    timelineProps?: Partial<Omit<ThreadTimelineProps, "threadId" | "turns" | "liveOutput" | "adapter">>;
    composerProps?: Omit<ThreadComposerProps, "activeView" | "onSubmit">;
    shellComposerProps?: Omit<ThreadComposerProps, "activeView" | "onSubmit">;
    useFloatingMobileComposer?: boolean;
    floatingMobileComposerBottomOffset?: number;
    composerHostRef?: RefObject<HTMLDivElement | null>;
    shellPanelRef?: Ref<ThreadShellPanelHandle>;
    shellEffectiveTheme?: "light" | "dark";
    shellThemeMode?: ThemeMode;
    onShellThemeModeChange?: (mode: ThemeMode) => void;
    onShellStateChange?: (state: ThreadShellControlState) => void;
    shellUnavailableContent?: ReactNode;
    shellDisconnectedContent?: ReactNode;
    timelineComponent?: ComponentType<ThreadTimelineProps>;
    shellPanelComponent?: ForwardRefExoticComponent<{
        threadId: string;
        shellAdapter: NonNullable<ThreadDetailUiAdapter["shell"]>;
        isVisible?: boolean;
        showHeader?: boolean;
        showFloatingToolbox?: boolean;
        onBackToChat?: (() => void) | undefined;
        effectiveTheme?: "light" | "dark";
        onStateChange?: (state: ThreadShellControlState) => void;
    } & RefAttributes<ThreadShellPanelHandle>>;
    shellContent?: ReactNode;
    loadingContent?: ReactNode;
    emptyContent?: ReactNode;
}
declare function ThreadDetailSurface({ threads, detail: rawDetail, loading, error, status, plugins: providedPlugins, adapter, metaContent, settingsContent, globalSettingsContent, settingsSections, settingsDialogOpen, onSettingsDialogOpenChange, mobileHeaderAction, appMenuButton, appNavigationMenu, workspaceReturnHref, restrictedNavigation, onWorkspaceReturn, threadActionsButton, surfaceActions, workbench, deviceMonitor, floatingPanel, workspaceContent, workspaceTitle, workspaceActions, workspaceFeatures, workspaceFocusPathRequest, onNewThreadTitle, beforeTimelineContent, errorContent, workspaceMissingContent, dialogs, currentThreadId, currentWorkspaceId, currentWorkspaceLabel, onCloseAppNavigation, presentation, className, activeView, liveOutput, timelineProps, composerProps, shellComposerProps, useFloatingMobileComposer, floatingMobileComposerBottomOffset, composerHostRef, shellPanelRef, shellEffectiveTheme, shellThemeMode, onShellThemeModeChange, onShellStateChange, shellUnavailableContent, shellDisconnectedContent, timelineComponent: TimelineComponent, shellPanelComponent: ShellPanelComponent, shellContent, loadingContent, emptyContent, }: ThreadDetailSurfaceProps): react.JSX.Element;

declare function usePlugins(): PluginContextValue;

/** A plugin's own report when it renders one, otherwise bounded JSON; raw JSON stays one click away. */
declare function PluginActionOutput({ pluginId, action, output, }: PluginActionOutputContext & {
    pluginId: string;
}): react.JSX.Element;

/**
 * Opens one plugin's settings above the host dialog. Renders nothing for plugins that
 * contribute no settings or are unavailable on this device; disabled plugins stay
 * configurable.
 */
declare function PluginSettingsButton({ plugin, className }: {
    plugin: Pick<PluginDto, 'id' | 'name' | 'description'>;
    className?: string;
}): react.JSX.Element | null;

/** The device-wide plugin context, even inside a conversation scope. */
declare function useDevicePlugins(): PluginContextValue;
/**
 * Gives one conversation its effective plugins: renderers, panels and actions below
 * follow its switches, while global management (switches, device settings) still
 * reaches the device. Each conversation gets its own scope, keyed by the host.
 */
declare function ThreadPluginScope({ threadId, adapter, children, }: {
    threadId: string;
    /** For a conversation on another route or device; defaults to the provider's. */
    adapter?: ThreadPluginAdapter;
    children: ReactNode;
}): react.JSX.Element;

/**
 * The conversation's plugin button: one place to see which plugins work here, follow
 * or override the global switch, and edit this conversation's own settings.
 */
declare function ThreadPluginsControl({ readOnly, onOpenGlobalSettings, }: {
    /** View-only sessions see the effective state but cannot change it. */
    readOnly?: boolean;
    onOpenGlobalSettings?: () => void;
}): react.JSX.Element | null;

/** Right or left thumb for the one-handed phone layout, as a two-way switch. */
declare function PhoneHandChoice({ hand, onChange }: {
    hand: PhoneHand;
    onChange: (hand: PhoneHand) => void;
}): react.JSX.Element;

interface AppShellNavigationItem {
    label: string;
    href: string;
}
interface AppShellNavigationMenuProps {
    className?: string;
    currentPath?: string;
    items?: AppShellNavigationItem[];
    onNavigate?: (href: string) => void;
}
declare function AppShellMenuButton({ className }: {
    className?: string;
}): react.JSX.Element | null;
declare function AppShellNavigationMenu({ className, currentPath, items, onNavigate, }: AppShellNavigationMenuProps): react.JSX.Element | null;
interface AppShellSettingsDialogProps {
    extraContent?: ReactNode;
    importPluginInput?: (draft: string) => ImportPluginInput;
}
declare function AppShellSettingsDialog({ extraContent, importPluginInput, }?: AppShellSettingsDialogProps): react.JSX.Element | null;

type ThreadMapPrice = Pick<ThreadTurnPriceEstimateDto, 'inputUsd' | 'cachedInputUsd' | 'cacheWriteInputUsd' | 'outputUsd' | 'totalUsd'>;
/** One conversation on the map: a root thread with its agent threads folded in. */
interface ThreadMapThread {
    key: string;
    title: string;
    href: string;
    /** Theme agent key (`codex`, `claude`, …), see themeAgentKey. */
    agent?: string | undefined;
    agentName?: string | undefined;
    running: boolean;
    /** Turns ever started, agent threads included; null when the device cannot say. */
    turns: number | null;
    /** Time turns ran inside the activity window; null when the device cannot say. */
    activeMs: number | null;
    /** Time every turn ever ran; null when the device cannot say. */
    totalMs?: number | null | undefined;
    /** The window's running time hour by hour, oldest first. */
    hourlyMs?: number[] | undefined;
    createdAt?: string | undefined;
    /** When a turn last started or finished. */
    lastActiveAt?: string | undefined;
    model?: string | undefined;
    /** The person's latest prompt. */
    lastPrompt?: string | undefined;
    /** The last turn failed. */
    failed?: boolean | undefined;
    /** Tokens of every turn, agent threads included. */
    tokenUsage?: ThreadTurnTokenBreakdownDto | undefined;
    /** The API price of those tokens. */
    priceEstimate?: ThreadMapPrice | undefined;
    /** Some turns had no known price; the price leaves them out. */
    pricePartial?: boolean | undefined;
    /** Agent threads this one started, each on its own; shown when the tile is opened up. */
    children?: ThreadMapThread[] | undefined;
    /** Agent threads folded into this one. */
    agentThreads?: number | undefined;
}
interface ThreadMapWorkspace {
    id: string;
    label: string;
    path?: string | undefined;
    threads: ThreadMapThread[];
}
interface ThreadMapDevice {
    id: string;
    name: string;
    state: 'ready' | 'loading' | 'offline' | 'error';
    error?: string | null | undefined;
    workspaces: ThreadMapWorkspace[];
}

/**
 * Every thread on every device as a zoomable treemap: devices hold workspaces,
 * workspaces hold threads. A thread's area follows its turns and its color the
 * time it ran in the last `hours`; running threads breathe. Tapping a device or a
 * workspace fills the map with it (what is inside shows as a preview until
 * then), tapping a thread opens it. On touch, pinching in goes up a level,
 * spreading opens the block under the fingers and dragging down dismisses.
 */
declare function ThreadMap({ devices, currentKey, hours, heading, actions, onOpen, onRetry, onDismiss }: {
    devices: ThreadMapDevice[];
    currentKey?: string | undefined;
    hours?: number;
    heading?: ReactNode;
    actions?: ReactNode;
    onOpen: (thread: ThreadMapThread) => void;
    onRetry?: ((deviceId: string) => void) | undefined;
    /** Closes the map; a downward drag on it asks for this. */
    onDismiss?: (() => void) | undefined;
}): react.JSX.Element;

/** The thread map in a dialog: full screen on a phone, a large panel elsewhere. */
declare function ThreadMapDialog({ open, onOpenChange, themeMode, effectiveTheme, ...map }: Omit<ComponentProps<typeof ThreadMap>, 'heading' | 'actions'> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    themeMode?: string | undefined;
    effectiveTheme?: 'light' | 'dark' | undefined;
}): react.JSX.Element;

interface PublicTranscriptMessage {
    role: 'user' | 'assistant';
    text: string;
    createdAt?: string | null;
}
interface PublicTranscriptTurn {
    messages: PublicTranscriptMessage[];
    startedAt?: string | null;
    completedAt?: string | null;
    model?: ThreadTurnDto['model'];
    reasoningEffort?: ThreadTurnDto['reasoningEffort'];
    tokenUsage?: ThreadTurnDto['tokenUsage'];
    priceEstimate?: ThreadTurnDto['priceEstimate'];
}
interface PublicTranscriptSnapshot {
    title: string;
    createdAt: string;
    turnCount: number;
    turns: PublicTranscriptTurn[];
    theme?: 'light' | 'dark';
    images?: Record<string, string>;
    live?: boolean;
    stale?: boolean;
    updatedAt?: string;
}
declare function transcriptSnapshot(title: string, turns: ThreadTurnDto[], theme: 'light' | 'dark'): PublicTranscriptSnapshot;
declare function PublicTranscript({ snapshot }: {
    snapshot: PublicTranscriptSnapshot;
}): react.JSX.Element;

declare function Dialog({ ...props }: ComponentProps<typeof DialogPrimitive.Root>): react.JSX.Element;
declare function DialogContent({ children, className, showCloseButton, overlayClassName, ...props }: ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    overlayClassName?: string;
}): react.JSX.Element;
declare function DialogHeader({ className, ...props }: ComponentProps<'div'>): react.JSX.Element;
declare function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): react.JSX.Element;
declare function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>): react.JSX.Element;

type ConversationSearchScope = 'thread' | 'workspace' | 'device';
/** Host supplies labels and permissions; this picker never infers access. */
declare function ConversationSearchScopePicker({ value, onChange, labels, allowGlobal }: {
    value: ConversationSearchScope;
    onChange: (scope: ConversationSearchScope) => void;
    labels: {
        scope: string;
        thread: string;
        workspace: string;
        device: string;
    };
    allowGlobal: boolean;
}): react.JSX.Element;
declare function ConversationSearchExcerpt({ text, query }: {
    text: string;
    query: string;
}): react.JSX.Element;

/** Drafts are only in memory; confirm before intentional app/source navigation. */
declare function confirmWorkspaceDocumentLeave(): boolean;

/** One settings shell for the workbench and pages outside conversations. */
declare function SettingsDialog({ sections, themeMode, effectiveTheme, trigger, extraContent, initialId, section, onSectionChange, panelScroll, contentProps, ...rootProps }: ComponentProps<typeof Dialog> & {
    sections: SettingsSection[];
    section?: string | undefined;
    onSectionChange?: ((id: string) => void) | undefined;
    panelScroll?: ComponentProps<typeof SettingsPanels>['scroll'];
    themeMode?: string;
    effectiveTheme?: 'light' | 'dark';
    trigger?: ReactNode;
    extraContent?: ReactNode;
    initialId?: string;
    contentProps?: Omit<ComponentProps<typeof DialogContent>, 'children' | 'className' | 'overlayClassName'> & {
        'data-testid'?: string;
    };
}): react.JSX.Element;

type WorkspacePathResolver = (path: string) => Promise<boolean>;
/** A resolver belongs to one adapter/device/workspace; never cache across scopes. */
declare function createWorkspacePathResolver(adapter: Pick<ThreadWorkspaceAdapter, 'listTree' | 'statLinkedFile'>, identity: {
    threadId: string;
    workspaceId?: string | null;
}, workspaceRoot: string): WorkspacePathResolver;

interface GraphChatThreadChatPanelProps {
    detail: ThreadDetailDto;
    adapter: ThreadDetailUiAdapter;
    timelineAdapter: ThreadTimelineAdapter;
    TimelineComponent?: ComponentType<ThreadTimelineProps>;
    liveOutput?: string;
    beforeTimelineContent?: ReactNode;
    composerProps?: Omit<ThreadComposerProps, 'activeView' | 'onSubmit'>;
    timelineProps?: Partial<Omit<ThreadTimelineProps, 'threadId' | 'turns' | 'liveOutput' | 'adapter'>>;
    transcriptItemCount: number;
    useFloatingMobileComposer?: boolean;
    floatingDesktopComposer?: boolean;
    floatingMobileComposerBottomOffset?: number;
    composerHostRef?: RefObject<HTMLDivElement | null>;
}
declare function GraphChatThreadChatPanel({ detail, adapter, timelineAdapter, TimelineComponent, liveOutput, beforeTimelineContent, composerProps, timelineProps, transcriptItemCount, useFloatingMobileComposer, floatingDesktopComposer, floatingMobileComposerBottomOffset, composerHostRef, }: GraphChatThreadChatPanelProps): react.JSX.Element;

/** Capability flags a theme pack may declare in `theme.json` `features`. Unknown
 *  flags are ignored. Version 1 of the catalog; see docs/theme-packs.md. */
declare const THEME_FEATURES: readonly ["workbench.phoneDrawerTools", "composer.modelAvatar", "composer.richMenus", "composer.intentIcons", "transcript.agentByline", "explorer.shortMenuLabels", "code.cssSyntaxPalette"];
type ThemeFeature = (typeof THEME_FEATURES)[number];
declare function isThemeFeature(value: unknown): value is ThemeFeature;
/** The flags of the applied theme pack. */
declare function documentThemeFeatures(): ThemeFeature[];
/** Whether the applied theme pack declares `flag`; re-renders when the theme changes. */
declare function useThemeFeature(flag: ThemeFeature): boolean;

/** Keys a theme pack may declare art for: lowercase letters and digits in dash-separated words. */
declare const THEME_AGENT_KEY_PATTERN: RegExp;
/** The theme agent key for a thread's agent id, provider or harness label;
 *  undefined for nothing or the bare `acp` provider. */
declare function themeAgentKey(value: string | null | undefined): string | undefined;
/** The key for a thread: its agent id, else its provider. */
declare function threadThemeAgentKey(thread: {
    provider?: string | null;
    agentId?: string | null;
}): string | undefined;
/** Display name for an agent: the family name, else the raw id in title case. */
declare function themeAgentName(raw: string, key?: string | undefined): string;

declare function ThreadLoadingIndicator({ inline, label }: {
    inline?: boolean;
    label?: string;
}): react.JSX.Element;

export { type AgentBackendId, AppShellMenuButton, AppShellNavContext, type AppShellNavContextValue, type AppShellNavigationItem, AppShellNavigationMenu, type AppShellNavigationMenuProps, AppShellSettingsDialog, type AppShellSettingsDialogProps, type ComposerSendShortcut, ConfirmDialog, ConversationSearchExcerpt, type ConversationSearchScope, ConversationSearchScopePicker, type CreateThreadShareInput, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, ExportTranscriptDialog, GraphChatThreadChatPanel, LongTextDialog, MatterWorkbench, type MatterWorkbenchOptions, MemoizedThreadGraphWorkspacePanel, type PhoneHand, PhoneHandChoice, PluginActionOutput, PluginActionOutputContext, PluginContextValue, PluginSettingsButton, PromptAttachmentUpload, PublicTranscript, type PublicTranscriptSnapshot, type ReferenceMode, RenderErrorBoundary, RenderErrorFallback, SettingsDialog, SettingsPanels, SettingsSection, THEME_AGENT_KEY_PATTERN, THEME_FEATURES, type ThemeFeature, type ThemeMode, ThreadActionsDialog, type ThreadActionsDialogProps, ThreadCards, ThreadComposer, type ThreadComposerProps, ThreadDetailSurface, type ThreadDetailSurfaceProps, ThreadDetailUiAdapter, ThreadGraphWorkspaceFeatures, ThreadGraphWorkspacePanel, ThreadGraphWorkspacePanelProps, ThreadLoadingIndicator, ThreadMap, type ThreadMapDevice, ThreadMapDialog, type ThreadMapPrice, type ThreadMapThread, type ThreadMapWorkspace, ThreadPluginAdapter, ThreadPluginScope, ThreadPluginsControl, type ThreadShareSummary, ThreadShellAdapter, ThreadShellControlState$1 as ThreadShellControlState, ThreadShellPanel, type ThreadShellPanelHandle, ThreadTimeline, ThreadTimelineAdapter, type ThreadTimelineProps, ThreadWorkspaceAdapter, ThreadWorkspaceLayout, TokenUsageCost, type TokenUsageCostProps, type WorkbenchNotification, type WorkbenchPanelsOptions, type WorkbenchPresentation, type WorkbenchThread, type WorkbenchToolPanel, type WorkbenchToolPanelControls, confirmWorkspaceDocumentLeave, createWorkspacePathResolver, documentThemeFeatures, formatLongTimestamp, formatShortTimestamp, hasLikelyMarkdownSyntax, historyItemAccentClassName, historyItemLabel, isStaleBuildError, isThemeFeature, themeAgentKey, themeAgentName, threadStatusClassName, threadStatusLabel, threadThemeAgentKey, transcriptSnapshot, turnStatusLabel, useAppShellNav, useDevicePlugins, usePlugins, useThemeFeature, useWorkbenchPresentation };
