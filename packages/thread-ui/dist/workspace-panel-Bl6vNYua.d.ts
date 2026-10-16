import * as react from 'react';
import { ReactNode, MutableRefObject } from 'react';
import * as _pockymoe_shared from '@pockymoe/shared';
import { PromptAttachmentManifestEntryDto, ThreadDto, UpdateThreadSettingsInput, ThreadHistoryItemDetailDto, ThreadTurnDto, ThreadShellStateDto, ShellSessionDto, UpdateShellInput, ShellEventEnvelope, PluginDto, ImportPluginInput, ThreadArtifactDto, ThreadDetailDto, AgentRuntimeStatusDto } from '@pockymoe/shared';
import { A as ArtifactRenderContext, I as InlineCodeRenderContext, T as ThreadPanelContribution, b as MessagePresentationContext, M as MessagePresentation, a as PluginActionOutputContext, F as FrontendPluginModule } from './plugin-types-CgVfWBnd.js';

interface PromptAttachmentUpload extends PromptAttachmentManifestEntryDto {
    file: File;
}
type SendPromptInput = {
    prompt: string;
    attachments?: PromptAttachmentUpload[];
    delivery?: 'steer';
};
interface ThreadShellControlState {
    status: _pockymoe_shared.ShellStatusDto;
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

/**
 * `thumbnail` asks for a small preview for inline chips. Supervisors without
 * the variant answer with the original, so callers must not rely on its size.
 */
type ThreadImageAssetVariant = 'thumbnail';
interface ThreadTimelineAdapter {
    resolveWorkspacePath?: (path: string) => Promise<boolean>;
    workspaceRootPath?: string | undefined;
    getImageAssetUrl?: (input: {
        threadId: string;
        path: string;
        variant?: ThreadImageAssetVariant;
    }) => string;
    resolveHref?: (href: string) => string;
    onOpenLinkedThread?: (threadId: string) => void;
    /** An address for a thread on this device, so links to it can open in a new tab. */
    getThreadHref?: (threadId: string) => string;
    onOpenWorkspaceFile?: (input: {
        path: string;
        line?: number;
    }) => void;
    cancelPendingSteer?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    onLoadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    onLoadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
}
interface ShellSocketHandlers {
    onConnected?: (event: unknown) => void;
    onShellEvent?: (event: ShellEventEnvelope) => void;
}
interface ShellSocketConnection {
    socket: WebSocket;
    send(message: unknown): void;
    close?: () => void;
}
interface ThreadWorkspaceTreeNode {
    name: string;
    path: string;
    kind: 'file' | 'directory';
    size?: number;
    hasChildren?: boolean;
    childrenLoaded?: boolean;
    truncated?: boolean;
    children?: ThreadWorkspaceTreeNode[];
}
interface ThreadWorkspaceFilePreview {
    path: string;
    name: string;
    content: string;
    language: string;
    size: number;
    truncated: boolean;
    nextOffset: number;
}
type ThreadWorkspaceUploadResult = {
    kind: 'file';
    file: {
        path: string;
        name: string;
        size: number;
    };
} | {
    kind: 'archive';
    archiveName: string;
    extractedCount: number;
    paths: string[];
};
interface ThreadWorkspaceAdapter {
    /** Opaque owner/device source identity; must change when either changes. */
    resourceScopeKey?: string;
    readDocument?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        signal?: AbortSignal;
    }) => Promise<WorkspaceDocumentSnapshot>;
    saveDocument?: (input: WorkspaceDocumentSaveInput & {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<WorkspaceSaveReceipt>;
    getSaveOperation?: (input: {
        threadId: string;
        workspaceId?: string | null;
        operationId: string;
    }) => Promise<WorkspaceSaveReceipt>;
    textRangeRead?: boolean;
    /** Owner-only, read-only host files explicitly opened from a thread link. */
    statLinkedFile?: (input: {
        threadId: string;
        path: string;
    }) => Promise<ThreadWorkspaceTreeNode>;
    listTree(input: {
        threadId: string;
        workspaceId?: string | null;
        path?: string | null;
    }): Promise<ThreadWorkspaceTreeNode>;
    readFile(input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        offset?: number;
        limit?: number;
    }): Promise<ThreadWorkspaceFilePreview>;
    getRawFileUrl?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => string;
    /**
     * File bytes through the authenticated (on a relay: encrypted) API. Previews
     * that the browser would otherwise navigate to, such as PDF frames, use this:
     * a frame or new tab on another origin bypasses the Web origin's transport.
     */
    readRawFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        signal?: AbortSignal;
    }) => Promise<Blob>;
    uploadFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        file: File;
    }) => Promise<ThreadWorkspaceUploadResult>;
    pickUploadFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        defaultPick: () => void;
        upload: (file: File) => Promise<void>;
    }) => Promise<void> | void;
    writeFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        content: string;
    }) => Promise<void> | void;
    downloadNode?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        kind: 'file' | 'directory';
    }) => Promise<void> | void;
    renameNode?: (input: {
        threadId: string;
        workspaceId?: string | null;
        fromPath: string;
        toPath: string;
    }) => Promise<void>;
    /** Creates an empty file exclusively; an existing path must never be overwritten. */
    createFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => Promise<{
        path: string;
    }>;
    deleteNode?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => Promise<void>;
    listGarbage?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<string[]>;
    emptyGarbage?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<void> | void;
    subscribeWorkspaceChanged?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }, onChanged: () => void) => (() => void) | void;
}
interface ThreadShellAdapter {
    fetchState(threadId: string): Promise<ThreadShellStateDto>;
    createShell(threadId: string, input?: {
        cols?: number;
        rows?: number;
        label?: string;
    }): Promise<ThreadShellStateDto>;
    terminateShell(shellId: string): Promise<ShellSessionDto>;
    updateShell(shellId: string, input: UpdateShellInput): Promise<ShellSessionDto>;
    connectSocket(handlers: ShellSocketHandlers): ShellSocketConnection;
}
interface ThreadDetailUiAdapter {
    openThread(threadId: string): void;
    getThreadHref?: (threadId: string) => string;
    getNewThreadHref?: (workspaceId?: string | null) => string;
    renderNewThreadDialogContent?: (input: {
        close: () => void;
        closeNavigation: () => void;
        currentWorkspaceId?: string | null;
    }) => ReactNode;
    renameThread?: (threadId: string, title: string) => Promise<void> | void;
    deleteThread?: (thread: ThreadDto) => Promise<void> | void;
    cancelPendingSteer?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    steerPendingPrompt?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    sendPrompt(input: SendPromptInput): Promise<boolean | void> | boolean | void;
    interrupt?: () => Promise<void> | void;
    compact?: () => Promise<void> | void;
    updateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
    loadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    loadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
    getImageAssetUrl?: (path: string, variant?: ThreadImageAssetVariant) => string;
    openWorkspaceFile?: (input: {
        path: string;
        line?: number;
    }) => void;
    workspace?: ThreadWorkspaceAdapter | null;
    shell?: ThreadShellAdapter | null;
}
/** Safe small-file editing is an explicit capability, never a legacy PUT option. */
interface WorkspaceDocumentSnapshot {
    path: string;
    name: string;
    language: string;
    workspaceRevision: string;
    fileIdentity: string;
    contentHash: string | null;
    content: string | null;
    size: number;
    encoding: string;
    bom: boolean;
    eol: string;
    readOnlyReason: string | null;
    truncated: boolean;
}
interface WorkspaceDocumentSaveInput {
    path: string;
    workspaceRevision: string;
    fileIdentity: string;
    expectedHash: string;
    content: string;
    draftRevision: number;
    operationId: string;
    operationCreatedAt: number;
}
interface WorkspaceSaveReceipt {
    status: 'pending' | 'saved' | 'conflict' | 'failedBeforeWrite' | 'uncertain';
    operationId: string;
    draftRevision: number;
    path: string;
    contentHash?: string;
    fileIdentity?: string;
    size?: number;
    workspaceRevision?: string;
    encoding?: string;
    bom?: boolean;
    eol?: string;
    snapshot?: WorkspaceDocumentSnapshot;
    code?: string;
    message?: string;
}

type SettingsSection = {
    id: string;
    label: string;
    description?: string;
    content: ReactNode;
};
declare function SettingsPanels({ sections, initialId, selected: selectedId, onSelect, scroll }: {
    sections: SettingsSection[];
    initialId?: string;
    /** Held by the owner when the panels may remount while open. */
    selected?: string | undefined;
    onSelect?: ((id: string) => void) | undefined;
    /** The panel's scroll offset, kept by the owner across such a remount. */
    scroll?: MutableRefObject<number> | undefined;
}): react.JSX.Element | null;

interface PluginContextValue {
    plugins: PluginDto[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    importPluginManifest: (input: ImportPluginInput) => Promise<void>;
    setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
    uninstallPlugin: (pluginId: string) => Promise<void>;
    renderArtifact: (context: ArtifactRenderContext) => ReactNode | null;
    renderInlineCode: (context: InlineCodeRenderContext) => ReactNode | null;
    hasRendererForArtifact: (artifact: ThreadArtifactDto) => boolean;
    getThreadPanels: () => ThreadPanelContribution[];
    getSettingsSections: () => SettingsSection[];
    presentMessage: (context: MessagePresentationContext) => MessagePresentation | null;
    renderActionOutput: (pluginId: string, context: PluginActionOutputContext) => ReactNode | null;
}
declare function mergePluginState(modules: FrontendPluginModule[], serverPlugins: PluginDto[]): PluginDto[];
declare function createDefaultPluginContextValue(modules?: FrontendPluginModule[]): PluginContextValue;
declare const PluginContext: react.Context<PluginContextValue>;

interface ThreadGraphWorkspacePanelProps {
    detail: ThreadDetailDto;
    status: AgentRuntimeStatusDto | null;
    plugins: PluginContextValue;
    workspaceAdapter?: ThreadWorkspaceAdapter | null;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    activeView?: 'chat' | 'shell';
    features?: ThreadGraphWorkspaceFeatures;
    focusPathRequest?: {
        path: string;
        line?: number;
        requestId: number;
    } | null;
}
type WorkspaceTab = 'workspace' | 'tools' | 'guide' | 'graph' | 'extensions';
interface ThreadGraphWorkspaceFeatures {
    workspace?: boolean;
    toolUsage?: boolean;
    guide?: boolean;
    threadGraph?: boolean;
    extensions?: boolean;
    defaultTab?: WorkspaceTab;
}
declare function ThreadGraphWorkspacePanel({ detail, status, plugins, workspaceAdapter, metaContent, settingsContent, activeView, features: featureConfig, focusPathRequest, }: ThreadGraphWorkspacePanelProps): react.JSX.Element | null;
declare const MemoizedThreadGraphWorkspacePanel: react.MemoExoticComponent<typeof ThreadGraphWorkspacePanel>;

export { MemoizedThreadGraphWorkspacePanel as M, type PromptAttachmentUpload as P, type SettingsSection as S, type ThreadShellControlState as T, type WorkspaceDocumentSaveInput as W, type ThreadTimelineAdapter as a, type ThreadShellAdapter as b, type ThreadGraphWorkspacePanelProps as c, type PluginContextValue as d, type ThreadDetailUiAdapter as e, type ThreadGraphWorkspaceFeatures as f, SettingsPanels as g, type ThreadWorkspaceAdapter as h, PluginContext as i, type SendPromptInput as j, type ShellSocketConnection as k, type ShellSocketHandlers as l, type ThreadImageAssetVariant as m, type WorkspaceDocumentSnapshot as n, type WorkspaceSaveReceipt as o, type WorkspaceTab as p, createDefaultPluginContextValue as q, mergePluginState as r, ThreadGraphWorkspacePanel as s };
