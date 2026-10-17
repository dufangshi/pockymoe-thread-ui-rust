import { useWorkspaceDocuments } from "./explorer/useWorkspaceDocuments";
import { isProtected } from "./explorer/workspaceDocuments";
import { translate, useI18n } from '../../i18n';
import { relativeWorkspacePath } from '../workspacePaths';
import { RenameDialog } from '../RenameDialog';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  AgentRuntimeStatusDto,
  ThreadArtifactDto,
  ThreadDetailDto,
} from '@pockymoe/shared';
import type { ThreadWorkspaceAdapter } from '../../adapters';
import type { PluginContextValue } from '../../plugins/plugin-context';
import { type WorkspaceTreeNode } from './workspaceTree';
import { useWorkspaceExplorerController } from './explorer/useWorkspaceExplorerController';
import { useWorkspaceExplorerActions } from './explorer/useWorkspaceExplorerActions';
import { useWorkspaceFilePreview } from './explorer/useWorkspaceFilePreview';
import { WorkspaceExplorerPanel } from './explorer/WorkspaceExplorerPanel';
import type { WorkspaceFileTab } from './WorkspaceFileTabs';
import {
  GraphWorkspacePreviewPane,
  graphWorkspacePreviewTargetFromNode,
} from './GraphWorkspacePreviewPane';
import { GraphEmptyGarbageDialog } from './GraphEmptyGarbageDialog';
import { useFilePanel } from '../workbench/FilePanelContext';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './GraphResizablePanels';

export function GraphWorkspaceExplorer({
  activeView,
  detail,
  artifacts,
  plugins,
  status,
  focusPathRequest,
  workspaceAdapter,
  onActiveFileChange,
}: {
  activeView: 'chat' | 'shell';
  detail: ThreadDetailDto;
  artifacts: ThreadArtifactDto[];
  plugins: PluginContextValue;
  status: AgentRuntimeStatusDto | null;
  focusPathRequest?: { path: string; line?: number; requestId: number } | null;
  workspaceAdapter?: ThreadWorkspaceAdapter | null;
  onActiveFileChange?: (relativePath: string | null) => void;
}) {
  useI18n();
  const {
    activeNode,
    adapterModel,
    collapseAll,
    directoryErrors,
    expandedPaths,
    filterMode,
    filterQuery,
    focusWorkspacePath,
    liveNodes,
    loadingDirectoryPaths,
    loadingTree,
    missingPath,
    refreshWorkspaceTree,
    retryDirectory,
    setLoadingTree,
    setFilterMode,
    setFilterQuery,
    setSelectedNodeId,
    setWorkspaceError,
    toggleDirectory,
    tree,
    workspaceError,
    workspaceIdentity,
  } = useWorkspaceExplorerController({
    activeView,
    detail,
    artifacts,
    status,
    focusPathRequest,
    workspaceAdapter,
  });
  const [collapsedPanel, setCollapsedPanel] = useState<
    'explorer' | 'viewer' | null
  >(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 639px)').matches
      ? 'viewer'
      : null,
  );
  const [focusedLine, setFocusedLine] = useState<number | null>(null);
  const [fileTabs, setFileTabs] = useState<WorkspaceFileTab[]>([]);
  const documents = useWorkspaceDocuments(workspaceAdapter, workspaceIdentity);
  const readingPositions = useMemo(() => new Map<string, number>(), [documents.source]);
  const [navigation, setNavigation] = useState<{ scope: string; paths: string[]; index: number }>({ scope: documents.source, paths: [], index: -1 });
  const selectedFilePath = activeNode?.kind === 'file' ? activeNode.path : null;
  const activeFileChange = useRef(onActiveFileChange);
  activeFileChange.current = onActiveFileChange;
  useEffect(() => {
    activeFileChange.current?.(selectedFilePath ? relativeWorkspacePath(selectedFilePath, detail.workspace.absPath) : null);
  }, [selectedFilePath, detail.workspace.absPath]);
  useEffect(() => () => activeFileChange.current?.(null), []);
  useLayoutEffect(() => {
    setNavigation(current => {
      if (current.scope !== documents.source) return { scope: documents.source, paths: selectedFilePath ? [selectedFilePath] : [], index: selectedFilePath ? 0 : -1 };
      if (!selectedFilePath || current.paths[current.index] === selectedFilePath) return current;
      const paths = [...current.paths.slice(0, current.index + 1), selectedFilePath].slice(-100);
      return { ...current, paths, index: paths.length - 1 };
    });
  }, [documents.source, selectedFilePath]);
  function navigatePreview(direction: -1 | 1) {
    const index = navigation.index + direction;
    const path = navigation.paths[index];
    if (!path) return;
    setNavigation(current => ({ ...current, index }));
    setFocusedLine(null);
    setCollapsedPanel(isMobileViewport ? 'explorer' : null);
    void focusWorkspacePath(path);
  }
  const [newFilePath, setNewFilePath] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingFile, setCreatingFile] = useState(false);
  const createSource = JSON.stringify([workspaceAdapter?.resourceScopeKey, workspaceIdentity.workspaceId, workspaceIdentity.threadId]);
  const createOwnerRef = useRef({ source: createSource, busy: false });
  if (createOwnerRef.current.source !== createSource) createOwnerRef.current = { source: createSource, busy: false };
  useEffect(() => { setNewFilePath(null); setCreateError(null); setCreatingFile(false); }, [createSource]);
  function openCreateFile() {
    const relative = activeNode ? relativeWorkspacePath(activeNode.path, detail.workspace.absPath) : null;
    const directory = relative
      ? activeNode?.kind === 'directory' ? relative : relative.slice(0, Math.max(0, relative.lastIndexOf('/')))
      : '';
    setNewFilePath(directory ? `${directory}/` : '');
    setCreateError(null);
  }
  async function handleCreateFile() {
    if (!workspaceAdapter?.createFile || newFilePath === null) return;
    const owner = createOwnerRef.current;
    if (owner.busy) return;
    const path = newFilePath.trim();
    if (!path || path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(path) || /^[a-z]:/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
      setCreateError(translate('files.invalidNewFilePath')); return;
    }
    if (dirtyFilePaths.has(path)) { setCreateError(translate('files.createHasDraft')); return; }
    owner.busy = true; setCreatingFile(true); setCreateError(null);
    let created = false;
    try {
      await workspaceAdapter.createFile({ ...workspaceIdentity, path });
      created = true;
      if (createOwnerRef.current !== owner) return;
      // Another pane may edit an old cached draft while creation is in flight.
      const currentDraft = documents.documents.get(path);
      if ((currentDraft && isProtected(currentDraft)) || !documents.discard(path)) {
        throw new Error(translate('files.createHasDraft'));
      }
      setNewFilePath(null);
      setFilterQuery('');
      await refreshWorkspaceTree(path);
      if (createOwnerRef.current !== owner) return;
      await focusWorkspacePath(path);
      if (createOwnerRef.current !== owner) return;
      const snapshot = await documents.load(path);
      if (createOwnerRef.current !== owner) return;
      if (snapshot && !snapshot.readOnlyReason && workspaceAdapter.saveDocument) documents.setEditing(path, true);
      setFileTabs(tabs => [...tabs.filter(tab => tab.path !== path), { path, name: path.split('/').pop()!, pinned: true }]);
      setCollapsedPanel(isMobileViewport ? 'explorer' : null);
    } catch (error) {
      if (createOwnerRef.current !== owner) return;
      const message = error instanceof Error ? error.message : translate('files.fileOperationFailed');
      if (created) setWorkspaceError(translate('files.createdButOpenFailed', { path, error: message }));
      else setCreateError(message);
    } finally {
      owner.busy = false;
      if (createOwnerRef.current === owner) setCreatingFile(false);
    }
  }
  const createDialog = <RenameDialog open={newFilePath !== null} title={translate('files.newFile')}
    label={translate('files.newFilePath')} description={translate('files.newFileDescription')}
    submitLabel={translate('files.createFile')} value={newFilePath ?? ''}
    onChange={setNewFilePath} onCancel={() => { if (!creatingFile) setNewFilePath(null); }}
    onSubmit={handleCreateFile} busy={creatingFile} error={createError} />;
  const dirtyFilePaths = new Set([...documents.documents].filter(([,doc]) => isProtected(doc)).map(([path]) => path));
  const dirtyKey = [...dirtyFilePaths].join('\0');
  useEffect(() => {
    setFileTabs(tabs => tabs.map(tab => dirtyFilePaths.has(tab.path) ? {...tab,pinned:true}:tab));
  }, [dirtyKey]);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches);
  const explorerScrollerRef = useRef<HTMLDivElement | null>(null);
  const explorerScrollTopRef = useRef(0);
  const restoredRevealRef = useRef<number | null>(null);
  const scrollRestoreGenerationRef = useRef(0);
  useLayoutEffect(() => {
    ++scrollRestoreGenerationRef.current;
    return () => { ++scrollRestoreGenerationRef.current; };
  }, [focusPathRequest]);
  const pendingExplorerScrollRestoreRef = useRef<number | null>(null);
  const {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore: handleLoadMore,
    pdfUrl,
    previewFile,
    previewLoading,
  } = useWorkspaceFilePreview({
    activeNode,
    adapter: workspaceAdapter,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    documents,
  });
  const activeDocument = previewFile ? documents.documents.get(previewFile.path) : undefined;
  const currentPreviewFile = previewFile && activeDocument?.snapshot.content != null
    ? {...previewFile,...activeDocument.snapshot,content:activeDocument.snapshot.content} : previewFile;
  const {
    confirmEmptyGarbage: handleConfirmEmptyGarbage,
    copyPath: handleCopyPath,
    downloadNode: handleDownload,
    fileInputRef,
    garbageFiles,
    handleUpload,
    openGarbage: handleOpenGarbage,
    pickUploadFile,
    setShowGarbageDialog,
    showGarbageDialog,
  } = useWorkspaceExplorerActions({
    activeNode,
    adapter: workspaceAdapter,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    onLoadingChange: setLoadingTree,
    refreshTree: refreshWorkspaceTree,
    workspaceRootPath: detail.workspace.absPath,
  });

  useEffect(() => {
    explorerScrollTopRef.current = 0;
    pendingExplorerScrollRestoreRef.current = null;
    setFileTabs([]);
  }, [workspaceIdentity.threadId, workspaceIdentity.workspaceId]);

  useEffect(() => {
    if (activeNode?.kind !== 'file' || !activeNode.path) {
      return;
    }
    setFileTabs((current) => {
      if (current.some((tab) => tab.path === activeNode.path)) {
        return current;
      }
      return [...current, { name: activeNode.name, path: activeNode.path, pinned: true }];
    });
  }, [activeNode]);

  // Minimized, only the tree shows; opening another file from it brings the editor back.
  const filePanel = useFilePanel();
  const minimized = Boolean(filePanel?.minimized);
  const pathWhenMinimized = useRef<string | null>(null);
  useEffect(() => { if (minimized) pathWhenMinimized.current = activeNode?.path ?? null; }, [minimized]);
  useEffect(() => {
    if (minimized && activeNode?.kind === 'file' && activeNode.path !== pathWhenMinimized.current) filePanel?.setMinimized?.(false);
  }, [activeNode?.path]);

  useEffect(() => {
    if (focusPathRequest) {
      setFocusedLine(focusPathRequest.line ?? null);
      setCollapsedPanel(isMobileViewport && activeNode?.kind !== 'directory' ? 'explorer' : null);
    }
  }, [focusPathRequest, isMobileViewport, activeNode?.kind]);

  function rememberExplorerScroll() {
    const currentScrollTop =
      explorerScrollerRef.current?.scrollTop ?? explorerScrollTopRef.current;
    explorerScrollTopRef.current = currentScrollTop;
    pendingExplorerScrollRestoreRef.current = currentScrollTop;
  }

  function restoreExplorerScroll() {
    const generation = ++scrollRestoreGenerationRef.current;
    const target =
      pendingExplorerScrollRestoreRef.current ?? explorerScrollTopRef.current;
    const scroller = explorerScrollerRef.current;
    if (!scroller) {
      return;
    }

    let frame = 0;
    const cancel = () => {
      ++scrollRestoreGenerationRef.current;
      pendingExplorerScrollRestoreRef.current = null;
      removeListeners();
    };
    const removeListeners = () => {
      scroller.removeEventListener('wheel', cancel);
      scroller.removeEventListener('touchstart', cancel);
      scroller.removeEventListener('pointerdown', cancel);
    };
    scroller.addEventListener('wheel', cancel, { passive: true });
    scroller.addEventListener('touchstart', cancel, { passive: true });
    scroller.addEventListener('pointerdown', cancel, { passive: true });
    const restore = () => {
      const current = explorerScrollerRef.current;
      if (!current || generation !== scrollRestoreGenerationRef.current) {
        removeListeners();
        return;
      }
      current.scrollTop = Math.min(
        target,
        Math.max(0, current.scrollHeight - current.clientHeight),
      );
      explorerScrollTopRef.current = current.scrollTop;
      frame += 1;
      if (frame < 8) {
        window.requestAnimationFrame(restore);
      } else {
        pendingExplorerScrollRestoreRef.current = null;
        removeListeners();
      }
    };
    window.requestAnimationFrame(restore);
  }

  const treeShownForRevealRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (collapsedPanel === 'explorer' || (focusPathRequest && restoredRevealRef.current !== focusPathRequest.requestId)) {
      return;
    }
    // The first time the list shows after a link opened a file (a phone shows
    // one or the other), it brings that file into view instead of the old place.
    if (focusPathRequest && treeShownForRevealRef.current !== focusPathRequest.requestId) {
      treeShownForRevealRef.current = focusPathRequest.requestId;
      return;
    }
    restoreExplorerScroll();
    // Restore after panel changes. These transitions can
    // remount the scroller or let WebView apply delayed scroll anchoring.
  }, [collapsedPanel]);
  useLayoutEffect(() => {
    if (focusPathRequest && !loadingTree && activeNode) {
      restoredRevealRef.current = focusPathRequest.requestId;
    }
  }, [focusPathRequest, loadingTree, activeNode]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  function handlePreview(node: WorkspaceTreeNode) {
    if (node.kind !== 'file') {
      return;
    }
    rememberExplorerScroll();
    setFocusedLine(null);
    setSelectedNodeId(node.id);
    setCollapsedPanel('explorer');
  }

  function handlePin(node: WorkspaceTreeNode) {
    if (node.kind !== 'file' || !node.path) {
      return;
    }
    setSelectedNodeId(node.id);
    setFileTabs((current) => {
      const existing = current.find((tab) => tab.path === node.path);
      if (existing) {
        return current.map((tab) =>
          tab.path === node.path ? { ...tab, pinned: true } : tab,
        );
      }
      return [...current, { name: node.name, path: node.path, pinned: true }];
    });
  }

  function handleCloseTab(path: string) {
    const closingIndex = fileTabs.findIndex((tab) => tab.path === path);
    const nextTabs = fileTabs.filter((tab) => tab.path !== path);
    if (!documents.discard(path)) return;
    setFileTabs(nextTabs);
    if (activeNode?.path !== path) {
      return;
    }
    const replacement =
      nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
    if (replacement) {
      void focusWorkspacePath(replacement.path);
    } else {
      setSelectedNodeId(null);
      if (isMobileViewport) setCollapsedPanel('viewer');
    }
  }

  const explorerActions = {
    onCopyPath: handleCopyPath,
    ...(workspaceAdapter?.renameNode ? {onRename: async (node: WorkspaceTreeNode, name: string) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative || !name.trim() || name === '.' || name === '..' || /[\\/\x00-\x1f]/.test(name)) throw new Error(translate("files.enterAValidFilenameWithoutPathSeparators"));
      if ([...dirtyFilePaths].some(path => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeRenaming"));
      const prefix = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/') + 1) : '';
      const toPath = prefix + name.trim();
      await workspaceAdapter.renameNode!({...workspaceIdentity, fromPath: relative, toPath});
      for (const path of documents.documents.keys()) if(path===node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs(tabs => tabs.map(tab => tab.path === node.path || tab.path.startsWith(`${node.path}/`) ? {...tab, path: toPath + tab.path.slice(node.path.length), name: tab.path === node.path ? name.trim() : tab.name} : tab));
      await refreshWorkspaceTree(toPath);
    }} : {}),
    ...(workspaceAdapter?.deleteNode ? {onDelete: async (node: WorkspaceTreeNode) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative) throw new Error(translate("files.theWorkspaceRootCannotBeDeleted"));
      if ([...dirtyFilePaths].some(path => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeDeleting"));
      await workspaceAdapter.deleteNode!({...workspaceIdentity, path: relative});
      for (const path of documents.documents.keys()) if(path===node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs(tabs => tabs.filter(tab => tab.path !== node.path && !tab.path.startsWith(`${node.path}/`)));
      if (activeNode?.path === node.path || activeNode?.path.startsWith(`${node.path}/`)) setSelectedNodeId(null);
      await refreshWorkspaceTree();
    }} : {}),
    ...(workspaceAdapter?.downloadNode ? { onDownload: handleDownload } : {}),
    ...(workspaceAdapter?.emptyGarbage
      ? { onEmptyGarbage: handleOpenGarbage }
      : {}),
    ...(workspaceAdapter
      ? { onRefresh: () => void refreshWorkspaceTree(activeNode?.path ?? null) }
      : {}),
    ...(workspaceAdapter?.uploadFile ? { onUpload: pickUploadFile } : {}),
    ...(workspaceAdapter?.createFile ? { onCreateFile: openCreateFile } : {}),
  };

  const explorerPanel = (
    <WorkspaceExplorerPanel
      canEmptyGarbage={Boolean(workspaceAdapter?.emptyGarbage)}
      canUpload={Boolean(workspaceAdapter?.uploadFile)}
      compactFolders={!isMobileViewport}
      directoryErrors={directoryErrors}
      filterMode={filterMode}
      filterQuery={filterQuery}
      initialLoading={Boolean(workspaceAdapter && !adapterModel && loadingTree)}
      rootError={workspaceAdapter && !adapterModel ? workspaceError : null}
      {...(minimized ? {} : collapsedPanel === 'viewer'
        ? {
            onExpandViewer: () => { if (!isMobileViewport || activeNode?.kind === 'file') setCollapsedPanel(isMobileViewport ? 'explorer' : null); },
            // On phones the editor can only be shown for an open file.
            expandViewerAvailable: !isMobileViewport || activeNode?.kind === 'file',
          }
        : {
            onCollapse: () => {
              rememberExplorerScroll();
              setCollapsedPanel('explorer');
            },
          })}
      expandedPaths={expandedPaths}
      loadingPaths={loadingDirectoryPaths}
      loading={loadingTree}
      explorerScrollTopRef={explorerScrollTopRef}
      explorerScrollerRef={explorerScrollerRef}
      {...explorerActions}
      onCollapseAll={collapseAll}
      onFilterModeChange={setFilterMode}
      onFilterQueryChange={setFilterQuery}
      onRetryDirectory={(path) => void retryDirectory(path)}
      onPreview={handlePreview}
      onPin={handlePin}
      onSelect={(nodeId) => {
        setSelectedNodeId(nodeId);
      }}
      onSelectNode={(node) => {
        setNavigation(current => ({ ...current, paths: [], index: -1 }));
        setFocusedLine(null);
        if ((isMobileViewport || collapsedPanel === 'viewer') && node.kind !== 'directory') {
          rememberExplorerScroll();
          setCollapsedPanel('explorer');
        }
      }}
      onToggle={(path) => {
        toggleDirectory(path);
        setFocusedLine(null);
      }}
      selectedNodeId={activeNode?.id ?? null}
      revealRequestKey={focusPathRequest?.requestId}
      tree={tree}
      liveNodes={liveNodes}
    />
  );

  const viewerPanel = (
    <GraphWorkspacePreviewPane
      mobileNavigation={isMobileViewport}
      readingPositions={readingPositions}
      {...(navigation.index > 0 ? { onNavigateBack: () => navigatePreview(-1), previousFilePath: navigation.paths[navigation.index - 1] } : {})}
      {...(navigation.index < navigation.paths.length - 1 ? { onNavigateForward: () => navigatePreview(1) } : {})}
      activeFilePath={activeNode?.kind === 'file' ? activeNode.path : null}
      dirtyFilePaths={dirtyFilePaths}
      error={workspaceError}
      missingPath={missingPath}
      fileTabs={fileTabs}
      downloadOnly={downloadOnly}
      downloadReason={downloadReason}
      {...(workspaceAdapter?.downloadNode && activeNode?.kind === 'file'
        ? { onDownloadFile: () => workspaceAdapter.downloadNode!({...workspaceIdentity, path: activeNode.path, kind: 'file'}) }
        : {})}
      imageUrl={imageUrl}
      loadingMore={loadingMore}
      focusLine={focusedLine}
      onOpenWorkspaceFile={(path) => {
        // Returning to the directory ends a preview chain. A link opened from
        // that same document starts a fresh chain with its current position.
        if (selectedFilePath) setNavigation(current => current.index < 0 ? { ...current, paths: [selectedFilePath], index: 0 } : current);
        setFocusedLine(null);
        setCollapsedPanel(isMobileViewport ? 'explorer' : null);
        void focusWorkspacePath(path);
      }}
      {...(workspaceAdapter?.textRangeRead ? { onLoadMore: handleLoadMore } : {})}
      onReturnToFiles={() => { setNavigation(current => ({ ...current, paths: [], index: -1 })); setCollapsedPanel('viewer'); }}
      onCloseFileTab={handleCloseTab}
      onSelectFileTab={(path) => {
        setNavigation(current => ({ ...current, paths: [], index: -1 }));
        void focusWorkspacePath(path);
      }}
      documents={documents}
      resourceScopeKey={documents.source}
      canSaveDocument={Boolean(workspaceAdapter?.saveDocument)}
      onSaveAndClose={async (path) => { if (await documents.save(path)) handleCloseTab(path); }}
      {...(collapsedPanel === 'explorer' || isMobileViewport
        ? { onExpandExplorer: () => { setNavigation(current => ({ ...current, paths: [], index: -1 })); setCollapsedPanel(isMobileViewport ? 'viewer' : null); } }
        : {
            onCollapse: () => {
              rememberExplorerScroll();
              setCollapsedPanel('viewer');
            },
          })}
      pdfUrl={pdfUrl}
      previewFile={currentPreviewFile}
      previewLoading={previewLoading}
      plugins={plugins}
      {...(workspaceAdapter?.getRawFileUrl
        ? {
            resolveWorkspaceFileUrl: (path: string) =>
              workspaceAdapter.getRawFileUrl?.({
                ...workspaceIdentity,
                path,
              }) ?? null,
          }
        : {})}
      selectedTarget={graphWorkspacePreviewTargetFromNode(activeNode)}
      workspaceRootPath={detail.workspace.absPath}
    />
  );

  const overlays = <>
    <input ref={fileInputRef} type="file" aria-label={translate("files.workspaceUploadFileInput")} data-testid="workspace-upload-file-input" className="hidden" onChange={event => void handleUpload(event)} />
    {showGarbageDialog && <GraphEmptyGarbageDialog files={garbageFiles} onCancel={() => setShowGarbageDialog(false)} onConfirm={() => void handleConfirmEmptyGarbage()} />}
    {createDialog}
  </>;

  if (minimized) {
    return (
      <div data-testid="workspace-panel" data-minimized="true" className="relative h-full min-h-0 w-full overflow-hidden p-1">
        {explorerPanel}
        {overlays}
      </div>
    );
  }

  if (collapsedPanel === 'explorer' || (isMobileViewport && collapsedPanel === null && activeNode?.kind === 'file')) {
    return (
      <div
        data-testid="workspace-panel"
        className="relative h-full min-h-0 w-full overflow-hidden p-1"
      >
        {viewerPanel}
        {overlays}
      </div>
    );
  }

  if (collapsedPanel === 'viewer' || isMobileViewport) {
    return (
      <div
        data-testid="workspace-panel"
        className="relative h-full min-h-0 w-full overflow-hidden p-1"
      >
        {explorerPanel}
        {overlays}
      </div>
    );
  }

  return (
    <div
      data-testid="workspace-panel"
      className="flex h-full min-h-0 w-full overflow-hidden bg-transparent p-1"
    >
      <ResizablePanelGroup
          direction="horizontal"
          className="thread-graph-workspace-resizable"
        >
          <ResizablePanel defaultSize={28} minSize={18}>
            <div className="thread-graph-workspace-explorer-pane h-full min-h-0 overflow-hidden">
              {explorerPanel}
            </div>
          </ResizablePanel>
          <ResizableHandle className="thread-graph-workspace-resize-handle w-1 bg-transparent after:w-px after:bg-slate-200/80 after:transition-colors hover:after:bg-slate-300 dark:after:bg-[#303642] dark:hover:after:bg-[#475063]" />
          <ResizablePanel defaultSize={72} minSize={40}>
            <div className="thread-graph-workspace-viewer-pane h-full min-h-0 overflow-hidden">
              {viewerPanel}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      {overlays}
    </div>
  );
}
