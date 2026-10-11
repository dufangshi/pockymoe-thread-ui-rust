import type {
  ShellEventEnvelope,
  ShellSessionDto,
  ThreadDto,
  ThreadHistoryItemDetailDto,
  ThreadShellStateDto,
  ThreadTurnDto,
  UpdateShellInput,
  UpdateThreadSettingsInput,
} from '@pockymoe/shared';
import type { ReactNode } from 'react';
import type { SendPromptInput } from './types';

/**
 * `thumbnail` asks for a small preview for inline chips. Supervisors without
 * the variant answer with the original, so callers must not rely on its size.
 */
export type ThreadImageAssetVariant = 'thumbnail';

export interface ThreadTimelineAdapter {
  resolveWorkspacePath?: (path: string) => Promise<boolean>;
  workspaceRootPath?: string | undefined;
  getImageAssetUrl?: (input: {
    threadId: string;
    path: string;
    variant?: ThreadImageAssetVariant;
  }) => string;
  resolveHref?: (href: string) => string;
  onOpenLinkedThread?: (threadId: string) => void;
  onOpenWorkspaceFile?: (input: { path: string; line?: number }) => void;
  cancelPendingSteer?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  onLoadHistoryItemDetail?: (
    itemId: string,
  ) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
  onLoadTurnDetail?: (
    turnId: string,
  ) => Promise<ThreadTurnDto> | ThreadTurnDto;
}

export interface ShellSocketHandlers {
  onConnected?: (event: unknown) => void;
  onShellEvent?: (event: ShellEventEnvelope) => void;
}

export interface ShellSocketConnection {
  socket: WebSocket;
  send(message: unknown): void;
  close?: () => void;
}

export interface ThreadWorkspaceTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  truncated?: boolean;
  children?: ThreadWorkspaceTreeNode[];
}

export interface ThreadWorkspaceFilePreview {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  truncated: boolean;
  nextOffset: number;
}

export type ThreadWorkspaceUploadResult =
  | {
      kind: 'file';
      file: {
        path: string;
        name: string;
        size: number;
      };
    }
  | {
      kind: 'archive';
      archiveName: string;
      extractedCount: number;
      paths: string[];
    };

export interface ThreadWorkspaceAdapter {
  /** Opaque owner/device source identity; must change when either changes. */
  resourceScopeKey?: string;
  readDocument?: (input: { threadId: string; workspaceId?: string | null; path: string; signal?: AbortSignal }) => Promise<WorkspaceDocumentSnapshot>;
  saveDocument?: (input: WorkspaceDocumentSaveInput & { threadId: string; workspaceId?: string | null }) => Promise<WorkspaceSaveReceipt>;
  getSaveOperation?: (input: { threadId: string; workspaceId?: string | null; operationId: string }) => Promise<WorkspaceSaveReceipt>;
  textRangeRead?: boolean;
  /** Owner-only, read-only host files explicitly opened from a thread link. */
  statLinkedFile?: (input: { threadId: string; path: string }) => Promise<ThreadWorkspaceTreeNode>;
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
  renameNode?: (input: { threadId: string; workspaceId?: string | null; fromPath: string; toPath: string }) => Promise<void>;
  /** Creates an empty file exclusively; an existing path must never be overwritten. */
  createFile?: (input: { threadId: string; workspaceId?: string | null; path: string }) => Promise<{ path: string }>;
  deleteNode?: (input: { threadId: string; workspaceId?: string | null; path: string }) => Promise<void>;
  listGarbage?: (input: {
    threadId: string;
    workspaceId?: string | null;
  }) => Promise<string[]>;
  emptyGarbage?: (input: {
    threadId: string;
    workspaceId?: string | null;
  }) => Promise<void> | void;
  subscribeWorkspaceChanged?: (
    input: {
      threadId: string;
      workspaceId?: string | null;
    },
    onChanged: () => void,
  ) => (() => void) | void;
}

export interface ThreadShellAdapter {
  fetchState(threadId: string): Promise<ThreadShellStateDto>;
  createShell(
    threadId: string,
    input?: { cols?: number; rows?: number; label?: string },
  ): Promise<ThreadShellStateDto>;
  terminateShell(shellId: string): Promise<ShellSessionDto>;
  updateShell(
    shellId: string,
    input: UpdateShellInput,
  ): Promise<ShellSessionDto>;
  connectSocket(handlers: ShellSocketHandlers): ShellSocketConnection;
}

export interface ThreadDetailUiAdapter {
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
  cancelPendingSteer?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  steerPendingPrompt?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  sendPrompt(input: SendPromptInput): Promise<boolean | void> | boolean | void;
  interrupt?: () => Promise<void> | void;
  compact?: () => Promise<void> | void;
  updateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
  loadHistoryItemDetail?: (
    itemId: string,
  ) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
  loadTurnDetail?: (
    turnId: string,
  ) => Promise<ThreadTurnDto> | ThreadTurnDto;
  getImageAssetUrl?: (path: string, variant?: ThreadImageAssetVariant) => string;
  openWorkspaceFile?: (input: { path: string; line?: number }) => void;
  workspace?: ThreadWorkspaceAdapter | null;
  shell?: ThreadShellAdapter | null;
}

/** Safe small-file editing is an explicit capability, never a legacy PUT option. */
export interface WorkspaceDocumentSnapshot {
  path: string; name: string; language: string; workspaceRevision: string;
  fileIdentity: string; contentHash: string | null; content: string | null;
  size: number; encoding: string; bom: boolean; eol: string;
  readOnlyReason: string | null; truncated: boolean;
}
export interface WorkspaceDocumentSaveInput {
  path: string; workspaceRevision: string; fileIdentity: string;
  expectedHash: string; content: string; draftRevision: number; operationId: string; operationCreatedAt: number;
}
export interface WorkspaceSaveReceipt {
  status: 'pending' | 'saved' | 'conflict' | 'failedBeforeWrite' | 'uncertain';
  operationId: string; draftRevision: number; path: string;
  contentHash?: string; fileIdentity?: string; size?: number;
  workspaceRevision?: string; encoding?: string; bom?: boolean; eol?: string;
  snapshot?: WorkspaceDocumentSnapshot; code?: string; message?: string;
}
