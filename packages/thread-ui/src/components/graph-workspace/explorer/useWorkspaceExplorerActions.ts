import { copyText } from '../../shell/terminalClipboard';
import { translate, useI18n } from '../../../i18n';
import { useRef, useState, type ChangeEvent } from 'react';

import { normalizeFileSystemPath, relativeWorkspacePath } from '../../workspacePaths';
import type { ThreadWorkspaceAdapter } from '../../../adapters';
import type { WorkspaceTreeNode } from '../workspaceTree';
import type { WorkspaceExplorerIdentity } from './useWorkspaceExplorerPersistence';

export function useWorkspaceExplorerActions({
  activeNode,
  adapter,
  identity,
  onError,
  onLoadingChange,
  refreshTree,
  workspaceRootPath,
}: {
  activeNode: WorkspaceTreeNode | null;
  adapter?: ThreadWorkspaceAdapter | null;
  identity: WorkspaceExplorerIdentity;
  onError: (error: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
  refreshTree: (preferredPath?: string | null) => Promise<void>;
  workspaceRootPath: string;
}) {
  useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showGarbageDialog, setShowGarbageDialog] = useState(false);
  const [garbageFiles, setGarbageFiles] = useState<string[]>([]);

  async function uploadFile(file: File) {
    if (!adapter?.uploadFile || !file) {
      return;
    }
    onLoadingChange(true);
    onError(null);
    try {
      const result = await adapter.uploadFile({
        ...identity,
        path: file.name,
        file,
      });
      const preferredPath =
        result.kind === 'archive'
          ? (result.paths[0] ?? null)
          : result.file.path;
      await refreshTree(preferredPath);
    } catch (error) {
      onError(error instanceof Error ? error.message : translate("files.failedToUploadFile"));
    } finally {
      onLoadingChange(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await uploadFile(file);
    }
  }

  function pickUploadFile() {
    if (!adapter?.uploadFile) {
      return;
    }
    const defaultPick = () => fileInputRef.current?.click();
    if (adapter.pickUploadFile) {
      void adapter.pickUploadFile({
        ...identity,
        defaultPick,
        upload: uploadFile,
      });
      return;
    }
    defaultPick();
  }

  function downloadNode(node: WorkspaceTreeNode) {
    void adapter?.downloadNode?.({
      ...identity,
      path: node.path,
      kind: node.kind === 'directory' ? 'directory' : 'file',
    });
  }

  /** Copies a node's path; resolves whether it was copied, for the menu's feedback. */
  async function copyPath(node: WorkspaceTreeNode, kind: 'relative' | 'absolute' = 'relative') {
    onError(null);
    if (!node.path) return false;
    const relative = relativeWorkspacePath(node.path, workspaceRootPath);
    if (kind === 'relative' && relative === null) { onError(translate("files.thisFileIsOutsideTheWorkspaceCopy")); return false; }
    const path = kind === 'relative' ? relative! : relative === null ? normalizeFileSystemPath(node.path) : `${normalizeFileSystemPath(workspaceRootPath).replace(/\/+$/, '')}/${relative}`;
    return copyText(path);
  }

  async function openGarbage() {
    if (!adapter?.emptyGarbage) {
      return;
    }
    onError(null);
    if (!adapter.listGarbage) {
      setGarbageFiles([]);
      setShowGarbageDialog(true);
      return;
    }
    try {
      const files = await adapter.listGarbage(identity);
      setGarbageFiles(files.map((file) => `garbage/${file}`));
    } catch (error) {
      setGarbageFiles([]);
      onError(
        error instanceof Error ? error.message : translate("files.failedToListGarbageFiles"),
      );
    } finally {
      setShowGarbageDialog(true);
    }
  }

  async function confirmEmptyGarbage() {
    if (!adapter?.emptyGarbage) {
      return;
    }
    setShowGarbageDialog(false);
    onError(null);
    try {
      await adapter.emptyGarbage(identity);
      await refreshTree(activeNode?.path ?? null);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : translate("files.failedToEmptyGarbage"),
      );
    }
  }

  return {
    confirmEmptyGarbage,
    copyPath,
    downloadNode,
    fileInputRef,
    garbageFiles,
    handleUpload,
    openGarbage,
    pickUploadFile,
    setShowGarbageDialog,
    showGarbageDialog,
  };
}
