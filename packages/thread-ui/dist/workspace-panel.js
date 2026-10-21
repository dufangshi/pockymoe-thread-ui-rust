import {
  Button,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  ErrorMark,
  IMAGE_EXTENSIONS,
  MOLECULAR_EXTENSIONS,
  MarkdownImageLinkContext,
  PDF_EXTENSIONS,
  PathChip,
  RenameDialog,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  TabScrollButtons,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  WorkspaceFileLink,
  WorkspaceImagePreview,
  ZoomableImage,
  ancestorDirectoryPaths,
  buildMoleculePreviewSnapshot,
  cn,
  collectAncestorPaths,
  collectArtifacts,
  collectWorkspaceItems,
  confirmAsync,
  copyText,
  documentListeners,
  documentStores,
  downloadDraft,
  editDraft,
  extensionOf,
  externalLinkProps,
  findFirstPreviewNode,
  findFirstWorkspaceFile,
  flattenWorkspaceNodes,
  getGraphChatHighlighter,
  hasWorkspacePath,
  isProtected,
  languageForPath,
  localFileHref,
  markdownHtmlPlugins,
  newDraft,
  normalizeFileSystemPath,
  relativeWorkspacePath,
  settleSave,
  syntaxThemeFor,
  useFilePanel,
  useMenuKeyboard,
  useTabScrollEdges,
  workspaceRelativeFocusPath,
  workspaceTreeNodeToGraphNode
} from "./chunk-ZGQKIXMV.js";
import {
  shellThemeProps,
  surfaceBehind,
  useThemeFeature
} from "./chunk-JIPNJR2N.js";
import {
  en,
  getLocale,
  translate,
  useI18n
} from "./chunk-54AMJTYB.js";

// src/components/ThreadGraphWorkspacePanel.tsx
import { memo as memo2, useEffect as useEffect13, useMemo as useMemo11, useState as useState13 } from "react";
import {
  GitBranch,
  Paperclip,
  Terminal,
  Trash2 as Trash24,
  Wrench
} from "lucide-react";

// src/components/graph-workspace/explorer/useWorkspaceDocuments.ts
import { useCallback, useEffect, useReducer } from "react";
var listeners = documentListeners;
var notify = () => {
  for (const listener of listeners) listener();
};
function useWorkspaceDocuments(adapter, identity) {
  const source = JSON.stringify([
    adapter?.resourceScopeKey ?? identity.threadId,
    identity.workspaceId
  ]);
  let store = documentStores.get(source);
  if (!store) {
    store = /* @__PURE__ */ new Map();
    documentStores.set(source, store);
  }
  const documents = store;
  function replaceDocument(path, next) {
    const previous = documents.get(path);
    const key = JSON.stringify([source, next.snapshot.workspaceRevision, path]);
    if (previous && previous.key !== key)
      window.dispatchEvent(
        new CustomEvent("workspace-model-release", { detail: previous.key })
      );
    documents.set(path, { ...next, key });
  }
  const [, update] = useReducer((v) => v + 1, 0);
  useEffect(() => {
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const load = useCallback(
    async (path, signal) => {
      if (!adapter?.readDocument) return null;
      const existing = documents.get(path);
      if (existing) return existing.snapshot;
      const snapshot = await adapter.readDocument({
        ...identity,
        path,
        signal
      });
      if (signal?.aborted) return null;
      if (!documents.has(path)) {
        const all = [...documentStores.values()].flatMap(
          (store2) => [...store2].map(([path2, doc]) => ({ store: store2, path: path2, doc }))
        );
        if (all.length >= 32) {
          const clean = all.find(
            ({ doc }) => !isProtected(doc) && !doc.editing
          );
          if (clean) {
            clean.store.delete(clean.path);
            window.dispatchEvent(
              new CustomEvent("workspace-model-release", {
                detail: clean.doc.key
              })
            );
          } else throw new Error(translate("files.safeDraftBudget"));
        }
        documents.set(
          path,
          newDraft(
            JSON.stringify([source, snapshot.workspaceRevision, path]),
            snapshot
          )
        );
        notify();
      }
      return documents.get(path).snapshot;
    },
    [adapter, documents, identity, source]
  );
  function change(path, content) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, editDraft(doc, content));
    notify();
  }
  function setEditing(path, editing) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, { ...doc, editing });
    notify();
  }
  function discard(path) {
    const doc = documents.get(path);
    if (!doc) return true;
    if (doc.phase === "saving" || doc.phase === "unknown") return false;
    documents.delete(path);
    window.dispatchEvent(
      new CustomEvent("workspace-model-release", { detail: doc.key })
    );
    notify();
    return true;
  }
  async function reconcile(path) {
    const doc = documents.get(path);
    if (!doc?.submitted || !adapter?.getSaveOperation) return false;
    try {
      const receipt = await adapter.getSaveOperation({
        ...identity,
        operationId: doc.submitted.operationId
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
      return receipt.status === "saved";
    } catch {
      const current = documents.get(path);
      if (current)
        documents.set(path, {
          ...current,
          phase: "unknown",
          error: translate("files.safeUnknown")
        });
      notify();
      return false;
    }
  }
  async function save(path, useConflict = false) {
    const doc = documents.get(path);
    if (!doc || !adapter?.saveDocument || ["saving", "unknown"].includes(doc.phase) || doc.snapshot.readOnlyReason)
      return false;
    const base = useConflict ? doc.conflict : doc.snapshot;
    if (!base?.contentHash || useConflict && base.readOnlyReason)
      return false;
    const operationCreatedAt = Date.now();
    const submitted = {
      content: doc.content,
      revision: doc.revision,
      operationId: crypto.randomUUID()
    };
    documents.set(path, { ...doc, phase: "saving", submitted, error: null });
    notify();
    try {
      const receipt = await adapter.saveDocument({
        ...identity,
        path,
        content: submitted.content,
        draftRevision: submitted.revision,
        operationId: submitted.operationId,
        operationCreatedAt,
        workspaceRevision: base.workspaceRevision,
        fileIdentity: base.fileIdentity,
        expectedHash: base.contentHash
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (!current) return false;
      documents.set(path, {
        ...current,
        phase: "unknown",
        error: error instanceof Error ? error.message : translate("files.safeUnknown")
      });
      notify();
      await reconcile(path);
    }
    const latest = documents.get(path);
    return latest?.phase === "clean" && latest.revision === submitted.revision;
  }
  function adoptDisk(path, revision) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (!doc || !disk || disk.content == null || doc.revision !== revision || doc.phase === "saving")
      return;
    replaceDocument(path, {
      ...newDraft(JSON.stringify([source, disk.workspaceRevision, path]), disk),
      revision: doc.revision + 1,
      editing: doc.editing,
      needsVerification: true
    });
    notify();
  }
  async function checkDisk(path) {
    const doc = documents.get(path);
    if (!doc || !adapter?.readDocument || doc.phase === "saving") return;
    const revision = doc.revision;
    try {
      const disk = await adapter.readDocument({ ...identity, path });
      const current = documents.get(path);
      if (!current) return;
      if (current.error) current.error = null;
      if (isProtected(current) || current.revision !== revision) {
        if (current.phase === "unknown" || disk.contentHash !== current.snapshot.contentHash || disk.fileIdentity !== current.snapshot.fileIdentity)
          documents.set(path, {
            ...current,
            phase: current.phase === "unknown" ? "unknown" : "conflict",
            conflict: disk,
            conflictFrom: current.phase === "conflict" && current.conflictFrom === "save" ? "save" : "check"
          });
      } else
        replaceDocument(path, {
          ...newDraft(
            JSON.stringify([source, disk.workspaceRevision, path]),
            disk
          ),
          revision: current.revision + 1,
          editing: current.editing
        });
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (current) {
        documents.set(path, {
          ...current,
          error: error instanceof Error ? error.message : translate("files.safeMissing")
        });
        notify();
      }
    }
  }
  function acceptVerifiedDisk(path) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (!doc || !disk || doc.phase !== "unknown" || doc.operationPending) return;
    replaceDocument(path, {
      ...doc,
      snapshot: disk,
      baseContent: disk.content ?? "",
      submitted: void 0,
      phase: doc.content === disk.content ? "clean" : "dirty",
      conflict: void 0,
      error: null
    });
    notify();
  }
  return {
    documents,
    load,
    change,
    setEditing,
    discard,
    save,
    reconcile,
    adoptDisk,
    checkDisk,
    acceptVerifiedDisk,
    source
  };
}

// src/components/graph-workspace/GraphWorkspaceExplorer.tsx
import { useEffect as useEffect11, useLayoutEffect as useLayoutEffect3, useMemo as useMemo9, useRef as useRef11, useState as useState12 } from "react";

// src/components/graph-workspace/explorer/useWorkspaceExplorerController.ts
import { useCallback as useCallback2, useEffect as useEffect2, useMemo as useMemo2, useRef, useState } from "react";

// src/components/graph-workspace/explorer/workspaceExplorerModel.ts
function sourceWithoutChildren(node) {
  const source = { ...node };
  delete source.children;
  return source;
}
function childrenStateForNode(node) {
  if (node.kind !== "directory") {
    return "resolved";
  }
  if (node.childrenLoaded === true || node.children.length > 0) {
    return "resolved";
  }
  if (node.childrenLoaded === false || node.hasChildren) {
    return "unresolved";
  }
  return "resolved";
}
function copyPreviousSubtree(previous, nodeId, parentId, nodes, pathToId) {
  const previousNode = previous.nodes.get(nodeId);
  if (!previousNode) {
    return;
  }
  const copy = {
    ...previousNode,
    parentId,
    childIds: [...previousNode.childIds]
  };
  nodes.set(copy.id, copy);
  pathToId.set(copy.path, copy.id);
  for (const childId of copy.childIds) {
    copyPreviousSubtree(previous, childId, copy.id, nodes, pathToId);
  }
}
function createWorkspaceExplorerModel(root, previous = null) {
  const nodes = /* @__PURE__ */ new Map();
  const pathToId = /* @__PURE__ */ new Map();
  const visit = (node, parentId) => {
    const previousId = previous?.pathToId.get(node.path);
    const previousNode = previousId ? previous?.nodes.get(previousId) : void 0;
    const incomingChildrenState = childrenStateForNode(node);
    const canPreserveResolvedChildren = node.kind === "directory" && incomingChildrenState === "unresolved" && previousNode?.kind === "directory" && previousNode.childrenState === "resolved";
    const childIds = canPreserveResolvedChildren ? [...previousNode.childIds] : node.children.map((child) => child.id);
    const record = {
      id: node.id,
      parentId,
      name: node.name,
      path: node.path,
      kind: node.kind,
      childIds,
      childrenState: canPreserveResolvedChildren ? "resolved" : incomingChildrenState,
      hasChildren: node.hasChildren ?? (canPreserveResolvedChildren ? previousNode.hasChildren : childIds.length > 0),
      truncated: node.truncated ?? previousNode?.truncated ?? false,
      requestGeneration: previousNode?.requestGeneration ?? 0,
      source: sourceWithoutChildren(node)
    };
    nodes.set(record.id, record);
    pathToId.set(record.path, record.id);
    if (canPreserveResolvedChildren && previous) {
      for (const childId of childIds) {
        copyPreviousSubtree(previous, childId, record.id, nodes, pathToId);
      }
      return;
    }
    for (const child of node.children) {
      visit(child, record.id);
    }
  };
  visit(root, null);
  return { rootId: root.id, nodes, pathToId };
}
function workspaceExplorerModelToTree(model) {
  const visit = (nodeId) => {
    const record = model.nodes.get(nodeId);
    if (!record) {
      throw new Error(translate("files.workspaceExplorerNodeIsMissing", { value1: nodeId }));
    }
    const tree = {
      ...record.source,
      children: record.childIds.map(visit)
    };
    if (record.kind === "directory") {
      tree.childrenLoaded = record.childrenState === "resolved";
      tree.hasChildren = record.hasChildren;
    } else if (record.source.hasChildren !== void 0) {
      tree.hasChildren = record.hasChildren;
    }
    if (record.truncated || record.source.truncated !== void 0) {
      tree.truncated = record.truncated;
    }
    return tree;
  };
  return visit(model.rootId);
}
function findWorkspaceExplorerNodeByPath(model, path) {
  if (!model || path === null) {
    return null;
  }
  const id = model.pathToId.get(path);
  return id ? model.nodes.get(id) ?? null : null;
}
function hasWorkspaceExplorerPath(model, path) {
  return Boolean(model && path !== null && model.pathToId.has(path));
}
function replaceTreeNodeByPath(node, path, replacement) {
  if (node.path === path) {
    return replacement;
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = replaceTreeNodeByPath(child, path, replacement);
    changed ||= next !== child;
    return next;
  });
  return changed ? { ...node, children } : node;
}
function mergeWorkspaceExplorerSubtree(model, subtree) {
  const existing = findWorkspaceExplorerNodeByPath(model, subtree.path);
  if (!existing) {
    return model;
  }
  subtree = { ...subtree, id: existing.id, name: existing.name, path: existing.path };
  const root = workspaceExplorerModelToTree(model);
  return createWorkspaceExplorerModel(
    replaceTreeNodeByPath(root, subtree.path, subtree),
    model
  );
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerPersistence.ts
import { useMemo } from "react";
var STORAGE_PREFIX = "remote-codex:graphchat:workspace:expanded:";
var MAX_PERSISTED_EXPANDED_PATHS = 500;
function storageKey(identity) {
  return `${STORAGE_PREFIX}${identity.workspaceId ?? "workspace"}:${identity.threadId}`;
}
function readWorkspaceExplorerState(identity) {
  const fallback = {
    version: 2,
    expandedPaths: []
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(identity));
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        version: 2,
        expandedPaths: parsed.filter((value) => typeof value === "string").slice(0, MAX_PERSISTED_EXPANDED_PATHS)
      };
    }
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const candidate = parsed;
    if (candidate.version !== 2 || !Array.isArray(candidate.expandedPaths)) {
      return fallback;
    }
    const selectedPath = typeof candidate.selectedPath === "string" ? candidate.selectedPath : void 0;
    const filterMode = candidate.filterMode === "filter" || candidate.filterMode === "highlight" ? candidate.filterMode : void 0;
    return {
      version: 2,
      expandedPaths: candidate.expandedPaths.filter((value) => typeof value === "string").slice(0, MAX_PERSISTED_EXPANDED_PATHS),
      ...selectedPath ? { selectedPath } : {},
      ...filterMode ? { filterMode } : {}
    };
  } catch {
    return fallback;
  }
}
function writeWorkspaceExplorerState(identity, state) {
  if (typeof window === "undefined") {
    return;
  }
  const expandedPaths = [...new Set(state.expandedPaths)].filter((path) => path.length > 0).slice(0, MAX_PERSISTED_EXPANDED_PATHS);
  const value = {
    version: 2,
    expandedPaths,
    ...state.selectedPath ? { selectedPath: state.selectedPath } : {},
    ...state.filterMode ? { filterMode: state.filterMode } : {}
  };
  try {
    window.localStorage.setItem(storageKey(identity), JSON.stringify(value));
  } catch {
  }
}
function useWorkspaceExplorerPersistence(identity) {
  useI18n();
  return useMemo(
    () => ({
      key: storageKey(identity),
      read: () => readWorkspaceExplorerState(identity),
      write: (state) => writeWorkspaceExplorerState(identity, state)
    }),
    [identity]
  );
}

// src/components/graph-workspace/explorer/workspaceLinkedFiles.ts
var LINKED_DIRECTORY_ID_PREFIX = "linked-dir:";
function linkedParentDirectory(path) {
  const index = path.lastIndexOf("/");
  const parent = index >= 0 ? path.slice(0, index) : "";
  if (/^[a-z]:$/i.test(parent)) return `${parent}/`;
  return parent || "/";
}
function linkedDirectoryNodes(files) {
  const groups = /* @__PURE__ */ new Map();
  for (const file of files) {
    const parent = linkedParentDirectory(file.path);
    groups.set(parent, [...groups.get(parent) ?? [], file]);
  }
  return [...groups].map(([parent, children]) => ({
    id: `${LINKED_DIRECTORY_ID_PREFIX}${parent}`,
    name: parent,
    path: parent,
    kind: "directory",
    children: [...children].sort((left, right) => left.name.localeCompare(right.name)),
    childrenLoaded: true,
    hasChildren: true
  }));
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerController.ts
var RESTORE_WAIT_MS = 2500;
function selectedPathForId(selectedId, nodeMap) {
  if (!selectedId) {
    return null;
  }
  const mappedPath = nodeMap.get(selectedId)?.path;
  if (mappedPath !== void 0) {
    return mappedPath;
  }
  return selectedId.startsWith("workspace:") ? selectedId.slice("workspace:".length) : null;
}
function useWorkspaceExplorerController({
  activeView,
  detail,
  artifacts,
  status,
  focusPathRequest = null,
  workspaceAdapter
}) {
  const { locale } = useI18n();
  const workspaceIdentity = useMemo2(
    () => ({
      threadId: detail.thread.id,
      workspaceId: detail.workspace.id ?? detail.thread.workspaceId ?? null
    }),
    [detail.thread.id, detail.thread.workspaceId, detail.workspace.id]
  );
  const persistence = useWorkspaceExplorerPersistence(workspaceIdentity);
  const fallbackTree = useMemo2(
    () => collectWorkspaceItems(detail, artifacts, status, activeView),
    [activeView, artifacts, detail, status, locale]
  );
  const fallbackFirstSelectableNode = findFirstPreviewNode(fallbackTree);
  const initialPersistedState = useRef(persistence.read());
  const restorePathsRef = useRef(initialPersistedState.current.expandedPaths ?? []);
  const [adapterModel, setAdapterModel] = useState(null);
  const adapterTree = useMemo2(
    () => adapterModel ? workspaceExplorerModelToTree(adapterModel) : null,
    [adapterModel]
  );
  const [linkedFiles, setLinkedFiles] = useState([]);
  const tree = useMemo2(() => {
    const root = adapterTree ?? fallbackTree;
    return linkedFiles.length ? { ...root, children: [...root.children, ...linkedDirectoryNodes(linkedFiles)] } : root;
  }, [adapterTree, fallbackTree, linkedFiles, locale]);
  const nodeMap = useMemo2(() => flattenWorkspaceNodes(tree), [tree]);
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    const selectedPath = focusPathRequest ? workspaceRelativeFocusPath(focusPathRequest.path, detail.workspace.absPath) : initialPersistedState.current.selectedPath;
    return selectedPath ? `workspace:${selectedPath}` : fallbackFirstSelectableNode?.id ?? null;
  });
  const [expandedPaths, setExpandedPaths] = useState(
    () => /* @__PURE__ */ new Set([
      "",
      "artifacts",
      "thread-events",
      "live",
      ...initialPersistedState.current.expandedPaths,
      ...collectAncestorPaths(fallbackFirstSelectableNode?.path ?? "")
    ])
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [filterMode, setFilterMode] = useState(
    () => initialPersistedState.current.filterMode ?? "filter"
  );
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDirectoryPaths, setLoadingDirectoryPaths] = useState(() => /* @__PURE__ */ new Set());
  const [directoryErrors, setDirectoryErrors] = useState(
    () => /* @__PURE__ */ new Map()
  );
  const [workspaceError, setWorkspaceError] = useState(null);
  const [missingPath, setMissingPath] = useState(null);
  const activeNode = selectedNodeId === null ? null : nodeMap.get(selectedNodeId) ?? null;
  const liveNodes = useMemo2(
    () => tree.children.find((node) => node.path === "live")?.children ?? [],
    [tree]
  );
  const adapterModelRef = useRef(adapterModel);
  const nodeMapRef = useRef(nodeMap);
  const treeRef = useRef(tree);
  const activeNodeRef = useRef(activeNode);
  const expandedPathsRef = useRef(expandedPaths);
  const loadingDirectoryPathsRef = useRef(loadingDirectoryPaths);
  const fallbackFirstSelectableNodeRef = useRef(fallbackFirstSelectableNode);
  adapterModelRef.current = adapterModel;
  nodeMapRef.current = nodeMap;
  treeRef.current = tree;
  activeNodeRef.current = activeNode;
  expandedPathsRef.current = expandedPaths;
  loadingDirectoryPathsRef.current = loadingDirectoryPaths;
  fallbackFirstSelectableNodeRef.current = fallbackFirstSelectableNode;
  const refreshGenerationRef = useRef(0);
  const focusGenerationRef = useRef(0);
  const focusPendingRef = useRef(false);
  const handledFocusRequestRef = useRef(null);
  const workspaceGenerationRef = useRef(0);
  const directoryRequestGenerationsRef = useRef(/* @__PURE__ */ new Map());
  const skipPersistenceWriteRef = useRef(true);
  const restoreExpandedDirectories = useCallback2(
    async (model, isCurrent) => {
      if (!workspaceAdapter) return model;
      const saved = new Set(restorePathsRef.current);
      restorePathsRef.current = [];
      const levels = /* @__PURE__ */ new Map();
      for (const path of saved) {
        if (!path) continue;
        const depth = path.split("/").length;
        levels.set(depth, [...levels.get(depth) ?? [], path]);
      }
      let next = model;
      for (const depth of [...levels.keys()].sort((a, b) => a - b)) {
        const wanted = levels.get(depth).filter((path) => {
          const node = findWorkspaceExplorerNodeByPath(next, path);
          return node?.kind === "directory" && node.childrenState !== "resolved";
        });
        const listed = await Promise.all(wanted.map((path) => Promise.race([
          workspaceAdapter.listTree({ ...workspaceIdentity, path }).then(workspaceTreeNodeToGraphNode, () => null),
          new Promise((resolve) => window.setTimeout(() => resolve(null), RESTORE_WAIT_MS))
        ])));
        if (!isCurrent()) return null;
        for (const node of listed) if (node) next = mergeWorkspaceExplorerSubtree(next, node);
      }
      return next;
    },
    [workspaceAdapter, workspaceIdentity]
  );
  const refreshWorkspaceTree = useCallback2(
    async (preferredPath) => {
      if (!workspaceAdapter) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const refreshGeneration = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = refreshGeneration;
      const currentSelectedPath = preferredPath ?? activeNodeRef.current?.path ?? null;
      setLoadingTree(true);
      setWorkspaceError(null);
      try {
        const refreshedTree = workspaceTreeNodeToGraphNode(
          await workspaceAdapter.listTree({ ...workspaceIdentity, path: "" })
        );
        if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
          return;
        }
        const currentModel = adapterModelRef.current;
        let nextModel = createWorkspaceExplorerModel(
          refreshedTree,
          currentModel
        );
        if (!currentModel) {
          const restored = await restoreExpandedDirectories(nextModel, () => workspaceGenerationRef.current === workspaceGeneration && refreshGenerationRef.current === refreshGeneration);
          if (!restored) return;
          nextModel = restored;
        } else {
          const expandedDirectories = [...expandedPathsRef.current].filter((path) => path).sort(
            (left, right) => left.split("/").length - right.split("/").length
          );
          for (const path of expandedDirectories) {
            const previousNode = findWorkspaceExplorerNodeByPath(
              currentModel,
              path
            );
            if (previousNode?.kind !== "directory" || previousNode.childrenState !== "resolved") {
              continue;
            }
            const refreshedNode = workspaceTreeNodeToGraphNode(
              await workspaceAdapter.listTree({ ...workspaceIdentity, path })
            );
            if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
              return;
            }
            nextModel = mergeWorkspaceExplorerSubtree(nextModel, refreshedNode);
          }
        }
        const nextTree = workspaceExplorerModelToTree(nextModel);
        adapterModelRef.current = nextModel;
        setAdapterModel(nextModel);
        const firstFile = findFirstWorkspaceFile(nextTree);
        setSelectedNodeId((current) => {
          const fallbackPath = currentSelectedPath ?? selectedPathForId(current, nodeMapRef.current);
          if (fallbackPath !== null && hasWorkspaceExplorerPath(nextModel, fallbackPath)) {
            return `workspace:${fallbackPath}`;
          }
          return firstFile?.id ?? null;
        });
      } catch (error) {
        if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
          return;
        }
        setWorkspaceError(
          error instanceof Error ? error.message : translate("files.failedToLoadWorkspace")
        );
        setAdapterModel(null);
      } finally {
        if (workspaceGenerationRef.current === workspaceGeneration && refreshGenerationRef.current === refreshGeneration) {
          setLoadingTree(false);
        }
      }
    },
    [restoreExpandedDirectories, workspaceAdapter, workspaceIdentity]
  );
  const loadDirectoryChildren = useCallback2(
    async (path) => {
      if (!workspaceAdapter || !adapterModelRef.current) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation = (directoryRequestGenerationsRef.current.get(path) ?? 0) + 1;
      directoryRequestGenerationsRef.current.set(path, generation);
      setLoadingDirectoryPaths((current) => {
        if (current.has(path)) {
          return current;
        }
        const next = new Set(current);
        next.add(path);
        return next;
      });
      setWorkspaceError(null);
      setDirectoryErrors((current) => {
        if (!current.has(path)) {
          return current;
        }
        const next = new Map(current);
        next.delete(path);
        return next;
      });
      try {
        const loadedNode = workspaceTreeNodeToGraphNode(
          await workspaceAdapter.listTree({ ...workspaceIdentity, path })
        );
        if (workspaceGenerationRef.current !== workspaceGeneration || directoryRequestGenerationsRef.current.get(path) !== generation) {
          return;
        }
        setAdapterModel(
          (current) => current ? mergeWorkspaceExplorerSubtree(current, loadedNode) : current
        );
        setDirectoryErrors((current) => {
          if (!current.has(path)) {
            return current;
          }
          const next = new Map(current);
          next.delete(path);
          return next;
        });
      } catch (error) {
        if (workspaceGenerationRef.current !== workspaceGeneration || directoryRequestGenerationsRef.current.get(path) !== generation) {
          return;
        }
        const message = error instanceof Error ? error.message : translate("files.failedToLoadDirectory");
        setWorkspaceError(message);
        setDirectoryErrors((current) => new Map(current).set(path, message));
      } finally {
        if (workspaceGenerationRef.current === workspaceGeneration && directoryRequestGenerationsRef.current.get(path) === generation) {
          setLoadingDirectoryPaths((current) => {
            if (!current.has(path)) {
              return current;
            }
            const next = new Set(current);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [workspaceAdapter, workspaceIdentity]
  );
  const focusWorkspacePath = useCallback2(
    async (path) => {
      const targetPath = workspaceRelativeFocusPath(
        path,
        detail.workspace.absPath
      );
      if (!targetPath) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation = ++focusGenerationRef.current;
      ++refreshGenerationRef.current;
      focusPendingRef.current = true;
      const isCurrent = () => workspaceGenerationRef.current === workspaceGeneration && focusGenerationRef.current === generation;
      setSelectedNodeId(`workspace:${targetPath}`);
      setFilterQuery("");
      setMissingPath(null);
      const external = relativeWorkspacePath(path, detail.workspace.absPath) === null;
      const ancestors = external ? [linkedParentDirectory(targetPath)] : ancestorDirectoryPaths(targetPath);
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.add("");
        for (const ancestor of ancestors) {
          next.add(ancestor);
        }
        return next;
      });
      if (!workspaceAdapter) {
        if (hasWorkspacePath(treeRef.current, targetPath)) {
          setSelectedNodeId(`workspace:${targetPath}`);
        }
        return;
      }
      setLoadingTree(true);
      setWorkspaceError(null);
      try {
        const firstLoad = !adapterModelRef.current;
        let nextModel = adapterModelRef.current ?? createWorkspaceExplorerModel(
          workspaceTreeNodeToGraphNode(
            await workspaceAdapter.listTree({
              ...workspaceIdentity,
              path: ""
            })
          )
        );
        if (!isCurrent()) {
          return;
        }
        if (external) {
          if (!workspaceAdapter.statLinkedFile) throw new Error(translate("files.onlyTheDeviceOwnerCanPreviewFiles"));
          const node = await workspaceAdapter.statLinkedFile({ ...workspaceIdentity, path: targetPath });
          if (!isCurrent()) return;
          const linked = workspaceTreeNodeToGraphNode({ ...node, path: targetPath });
          setLinkedFiles((current) => [...current.filter((item) => item.path !== targetPath), linked]);
          adapterModelRef.current = nextModel;
          setAdapterModel(nextModel);
          return;
        }
        for (const ancestor of ancestors) {
          const existing = findWorkspaceExplorerNodeByPath(nextModel, ancestor);
          if (existing?.kind === "directory" && existing.childrenState === "resolved") {
            continue;
          }
          const loadedNode = workspaceTreeNodeToGraphNode(
            await workspaceAdapter.listTree({
              ...workspaceIdentity,
              path: ancestor
            })
          );
          if (!isCurrent()) {
            return;
          }
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
        }
        const target = findWorkspaceExplorerNodeByPath(nextModel, targetPath);
        if (target?.kind === "directory") {
          const loadedNode = workspaceTreeNodeToGraphNode(await workspaceAdapter.listTree({ ...workspaceIdentity, path: targetPath }));
          if (!isCurrent()) return;
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
          setExpandedPaths((current) => new Set(current).add(targetPath));
        }
        if (firstLoad) {
          const restored = await restoreExpandedDirectories(nextModel, isCurrent);
          if (!restored) return;
          nextModel = restored;
        }
        adapterModelRef.current = nextModel;
        setAdapterModel(nextModel);
        if (!hasWorkspaceExplorerPath(nextModel, targetPath)) {
          throw new MissingTargetError(translate("files.fileNotFound", { value1: targetPath }));
        }
        setSelectedNodeId(`workspace:${targetPath}`);
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (isMissingTarget(error)) {
          setMissingPath(external ? path : targetPath);
          return;
        }
        setWorkspaceError(
          error instanceof Error ? error.message : translate("files.failedToOpen", { value1: targetPath })
        );
      } finally {
        if (isCurrent()) {
          focusPendingRef.current = false;
          setLoadingTree(false);
        }
      }
    },
    [detail.workspace.absPath, restoreExpandedDirectories, workspaceAdapter, workspaceIdentity]
  );
  const toggleDirectory = useCallback2(
    (path) => {
      if (!path) {
        return;
      }
      const node = nodeMapRef.current.get(`workspace:${path}`);
      const isExpanded = expandedPathsRef.current.has(path);
      const shouldLoad = node?.kind === "directory" && node.hasChildren && !node.childrenLoaded && !loadingDirectoryPathsRef.current.has(path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      if (!isExpanded && shouldLoad) {
        void loadDirectoryChildren(path);
      }
    },
    [loadDirectoryChildren]
  );
  const collapseAll = useCallback2(() => {
    setExpandedPaths(/* @__PURE__ */ new Set([""]));
  }, []);
  useEffect2(() => {
    setLinkedFiles([]);
    skipPersistenceWriteRef.current = true;
    const persisted = persistence.read();
    restorePathsRef.current = persisted.expandedPaths ?? [];
    const fallbackNode = fallbackFirstSelectableNodeRef.current;
    const selectedPath = focusPathRequest ? workspaceRelativeFocusPath(focusPathRequest.path, detail.workspace.absPath) : persisted.selectedPath;
    const nextSelectedId = selectedPath ? `workspace:${selectedPath}` : fallbackNode?.id ?? null;
    setExpandedPaths(
      /* @__PURE__ */ new Set([
        "",
        "artifacts",
        "thread-events",
        "live",
        ...persisted.expandedPaths,
        ...collectAncestorPaths(fallbackNode?.path ?? "")
      ])
    );
    setSelectedNodeId(nextSelectedId);
    setFilterQuery("");
    setFilterMode(persisted.filterMode ?? "filter");
  }, [persistence]);
  useEffect2(() => {
    if (skipPersistenceWriteRef.current) {
      skipPersistenceWriteRef.current = false;
      return;
    }
    persistence.write({
      expandedPaths: [...expandedPaths],
      ...selectedPathForId(selectedNodeId, nodeMap) ? { selectedPath: selectedPathForId(selectedNodeId, nodeMap) } : {},
      filterMode
    });
  }, [expandedPaths, filterMode, nodeMap, persistence, selectedNodeId]);
  useEffect2(() => {
    if (!workspaceAdapter || !adapterModel || focusPendingRef.current) {
      return;
    }
    for (const node of nodeMap.values()) {
      if (node.path && node.kind === "directory" && expandedPaths.has(node.path) && node.hasChildren && !node.childrenLoaded && !loadingDirectoryPaths.has(node.path) && !directoryErrors.has(node.path)) {
        void loadDirectoryChildren(node.path);
      }
    }
  }, [
    adapterModel,
    directoryErrors,
    expandedPaths,
    loadDirectoryChildren,
    loadingDirectoryPaths,
    nodeMap,
    workspaceAdapter
  ]);
  useEffect2(() => {
    workspaceGenerationRef.current += 1;
    refreshGenerationRef.current += 1;
    directoryRequestGenerationsRef.current.clear();
    adapterModelRef.current = null;
    setAdapterModel(null);
    setLoadingDirectoryPaths(/* @__PURE__ */ new Set());
    setDirectoryErrors(/* @__PURE__ */ new Map());
    setWorkspaceError(null);
    handledFocusRequestRef.current = null;
    if (!focusPathRequest) {
      const persistedPath = persistence.read().selectedPath;
      if (persistedPath) void focusWorkspacePath(persistedPath);
      else void refreshWorkspaceTree();
    }
  }, [refreshWorkspaceTree]);
  useEffect2(() => {
    if (focusPathRequest) {
      const key = `${workspaceIdentity.threadId}:${focusPathRequest.requestId}`;
      if (handledFocusRequestRef.current === key) return;
      handledFocusRequestRef.current = key;
      void focusWorkspacePath(focusPathRequest.path);
    }
  }, [focusPathRequest, focusWorkspacePath]);
  useEffect2(() => {
    if (!workspaceAdapter?.subscribeWorkspaceChanged) {
      return;
    }
    let refreshTimer = null;
    const unsubscribe = workspaceAdapter.subscribeWorkspaceChanged(
      workspaceIdentity,
      () => {
        if (refreshTimer !== null) {
          window.clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          void refreshWorkspaceTree(activeNodeRef.current?.path ?? null);
        }, 180);
      }
    );
    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribe?.();
    };
  }, [refreshWorkspaceTree, workspaceAdapter, workspaceIdentity]);
  return {
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
    nodeMap,
    refreshWorkspaceTree,
    retryDirectory: loadDirectoryChildren,
    selectedNodeId,
    setFilterMode,
    setFilterQuery,
    setLoadingTree,
    setSelectedNodeId: (id) => {
      ++focusGenerationRef.current;
      ++refreshGenerationRef.current;
      focusPendingRef.current = false;
      setLoadingTree(false);
      setWorkspaceError(null);
      setMissingPath(null);
      setSelectedNodeId(id);
    },
    setWorkspaceError,
    toggleDirectory,
    tree,
    workspaceError,
    workspaceIdentity
  };
}
var MissingTargetError = class extends Error {
};
function isMissingTarget(error) {
  if (error instanceof MissingTargetError) return true;
  const code = error?.payload?.code ?? error?.code;
  return code === "file_unavailable" || error instanceof Error && /no such file|not found|cannot find/i.test(error.message);
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerActions.ts
import { useRef as useRef2, useState as useState2 } from "react";
function useWorkspaceExplorerActions({
  activeNode,
  adapter,
  identity,
  onError,
  onLoadingChange,
  refreshTree,
  workspaceRootPath
}) {
  useI18n();
  const fileInputRef = useRef2(null);
  const [showGarbageDialog, setShowGarbageDialog] = useState2(false);
  const [garbageFiles, setGarbageFiles] = useState2([]);
  async function uploadFile(file) {
    if (!adapter?.uploadFile || !file) {
      return;
    }
    onLoadingChange(true);
    onError(null);
    try {
      const result = await adapter.uploadFile({
        ...identity,
        path: file.name,
        file
      });
      const preferredPath = result.kind === "archive" ? result.paths[0] ?? null : result.file.path;
      await refreshTree(preferredPath);
    } catch (error) {
      onError(error instanceof Error ? error.message : translate("files.failedToUploadFile"));
    } finally {
      onLoadingChange(false);
    }
  }
  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
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
        upload: uploadFile
      });
      return;
    }
    defaultPick();
  }
  function downloadNode(node) {
    void adapter?.downloadNode?.({
      ...identity,
      path: node.path,
      kind: node.kind === "directory" ? "directory" : "file"
    });
  }
  async function copyPath(node, kind = "relative") {
    onError(null);
    if (!node.path) return false;
    const relative = relativeWorkspacePath(node.path, workspaceRootPath);
    if (kind === "relative" && relative === null) {
      onError(translate("files.thisFileIsOutsideTheWorkspaceCopy"));
      return false;
    }
    const path = kind === "relative" ? relative : relative === null ? normalizeFileSystemPath(node.path) : `${normalizeFileSystemPath(workspaceRootPath).replace(/\/+$/, "")}/${relative}`;
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
        error instanceof Error ? error.message : translate("files.failedToListGarbageFiles")
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
        error instanceof Error ? error.message : translate("files.failedToEmptyGarbage")
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
    showGarbageDialog
  };
}

// src/components/graph-workspace/explorer/useWorkspaceFilePreview.ts
import { useLayoutEffect, useState as useState3 } from "react";

// src/components/graph-workspace/explorer/filePreviewPolicy.ts
var DRAWIO_MAX_BYTES = 8 * 1024 * 1024;
function isDrawioPath(path) {
  return ["drawio", "dio"].includes(extensionOf(path));
}
var DOWNLOAD_EXTENSIONS = /* @__PURE__ */ new Set([
  "zip",
  "7z",
  "rar",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "zst",
  "br",
  "exe",
  "dll",
  "so",
  "dylib",
  "dmg",
  "iso",
  "pkg",
  "deb",
  "rpm",
  "msi",
  "bin",
  "wasm",
  "class",
  "jar",
  "pyc",
  "o",
  "a",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "db",
  "sqlite",
  "sqlite3",
  "parquet",
  "arrow",
  "npy",
  "npz",
  "h5",
  "hdf5",
  "mp3",
  "wav",
  "flac",
  "ogg",
  "m4a",
  "mp4",
  "mov",
  "mkv",
  "webm",
  "avi",
  "psd",
  "ai",
  "sketch",
  "heic",
  "tif",
  "tiff",
  "woff",
  "woff2",
  "ttf",
  "otf"
]);
function isDownloadOnlyPath(path) {
  return DOWNLOAD_EXTENSIONS.has(extensionOf(path));
}
function isBinaryPreview(content) {
  if (content.includes("\0")) return true;
  const sample = content.slice(0, 8e3);
  const suspicious = sample.match(/[\x01-\x08\x0e-\x1f\ufffd]/g)?.length ?? 0;
  return suspicious >= 3 && suspicious / sample.length > 0.02;
}

// src/components/graph-workspace/explorer/useWorkspaceFilePreview.ts
var PREVIEW_CHUNK_BYTES = 24e3;
function useWorkspaceFilePreview({
  activeNode,
  adapter,
  identity,
  onError,
  documents
}) {
  useI18n();
  const [previewFile, setPreviewFile] = useState3(null);
  const [downloadOnly, setDownloadOnly] = useState3(false);
  const [downloadReason, setDownloadReason] = useState3(null);
  const [imageUrl, setImageUrl] = useState3(null);
  const [pdfUrl, setPdfUrl] = useState3(null);
  const [previewLoading, setPreviewLoading] = useState3(false);
  const [loadingMore, setLoadingMore] = useState3(false);
  useLayoutEffect(() => {
    const selectedPath = activeNode?.kind === "file" ? activeNode.path : null;
    if (!adapter || !selectedPath) {
      setDownloadOnly(false);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      setPreviewLoading(false);
      return;
    }
    const currentAdapter = adapter;
    const currentPath = selectedPath;
    let cancelled = false;
    let objectUrl = null;
    const abort = new AbortController();
    async function loadPreview() {
      setPreviewLoading(true);
      onError(null);
      setDownloadOnly(false);
      setDownloadReason(null);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      try {
        if (isDownloadOnlyPath(currentPath)) {
          setDownloadOnly(true);
          return;
        }
        const extension = extensionOf(currentPath);
        if (isDrawioPath(currentPath) && (activeNode?.size ?? 0) > DRAWIO_MAX_BYTES) {
          throw new Error(translate("files.diagramPreviewSupportsFilesUpTo8"));
        }
        const rawUrl = currentAdapter.getRawFileUrl?.({
          ...identity,
          path: currentPath
        });
        if (rawUrl && IMAGE_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setImageUrl(rawUrl);
          }
          return;
        }
        if (PDF_EXTENSIONS.has(extension) && currentAdapter.readRawFile) {
          const blob = await currentAdapter.readRawFile({ ...identity, path: currentPath, signal: abort.signal });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
          setPdfUrl(objectUrl);
          return;
        }
        if (rawUrl && PDF_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setPdfUrl(rawUrl);
          }
          return;
        }
        const safe = !currentPath.startsWith("/") && !/^[a-z]:[\\/]/i.test(currentPath) && !isDrawioPath(currentPath) ? await documents.load(currentPath, abort.signal) : null;
        if (safe && safe.content == null && !["fileTooLarge", "safeUnavailable"].includes(safe.readOnlyReason ?? "")) {
          if (!cancelled) setDownloadOnly(true);
          return;
        }
        const file = safe?.content != null ? { ...safe, content: safe.content, nextOffset: safe.size } : await currentAdapter.readFile({
          ...identity,
          path: currentPath,
          limit: isDrawioPath(currentPath) ? DRAWIO_MAX_BYTES : PREVIEW_CHUNK_BYTES
        });
        if (!cancelled) {
          if (isBinaryPreview(file.content)) {
            setDownloadOnly(true);
            setDownloadReason("unsupportedEncodingOrBinaryFile");
          } else setPreviewFile(file);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof Error && /unsupportedEncodingOrBinaryFile/.test(error.message)) {
            setDownloadOnly(true);
            setDownloadReason("unsupportedEncodingOrBinaryFile");
          } else onError(
            error instanceof Error ? error.message : translate("files.failedToReadFile")
          );
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    activeNode?.id,
    activeNode?.kind,
    activeNode?.path,
    adapter,
    identity,
    onError,
    documents.load
  ]);
  async function loadMore() {
    if (!adapter?.textRangeRead || !previewFile?.truncated) {
      return;
    }
    const requestedPath = previewFile.path;
    setLoadingMore(true);
    try {
      const chunk = await adapter.readFile({
        ...identity,
        path: requestedPath,
        offset: previewFile.nextOffset,
        limit: PREVIEW_CHUNK_BYTES
      });
      setPreviewFile(
        (current) => current?.path === requestedPath ? {
          ...current,
          content: current.content + chunk.content,
          truncated: chunk.truncated,
          nextOffset: chunk.nextOffset,
          size: chunk.size
        } : current
      );
    } finally {
      setLoadingMore(false);
    }
  }
  return {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore,
    pdfUrl,
    previewFile,
    previewLoading
  };
}

// src/components/graph-workspace/explorer/WorkspaceExplorerPanel.tsx
import {
  FileCode2 as FileCode22,
  FilePlus2,
  ListCollapse,
  Maximize2,
  Minus,
  MoreHorizontal as MoreHorizontal2,
  RefreshCw,
  Search,
  PanelLeftClose,
  PanelRightOpen,
  Trash2 as Trash22,
  Upload,
  X as X2
} from "lucide-react";
import {
  useCallback as useCallback5,
  useEffect as useEffect6,
  useMemo as useMemo4,
  useRef as useRef6,
  useState as useState7
} from "react";

// src/components/graph-workspace/explorer/WorkspaceExplorerTree.tsx
import { measureElement, useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback as useCallback4,
  useEffect as useEffect5,
  useMemo as useMemo3,
  useRef as useRef5,
  useState as useState6
} from "react";

// src/components/graph-workspace/explorer/workspaceExplorerFilter.ts
function mergeMatchIndexes(indexes) {
  const ranges = [];
  for (const index of indexes) {
    const previous = ranges.at(-1);
    if (previous && previous.end === index) {
      previous.end = index + 1;
    } else {
      ranges.push({ start: index, end: index + 1 });
    }
  }
  return ranges;
}
function matchWorkspaceExplorerNode(node, rawQuery) {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) {
    return { score: 0, ranges: [] };
  }
  const candidate = (query.includes("/") ? node.path : node.name).toLocaleLowerCase();
  const indexes = [];
  let cursor = 0;
  let consecutive = 0;
  let segmentStarts = 0;
  for (const character of query) {
    const index = candidate.indexOf(character, cursor);
    if (index < 0) {
      return null;
    }
    indexes.push(index);
    if (indexes.length > 1 && index === indexes[indexes.length - 2] + 1) {
      consecutive += 1;
    }
    if (index === 0 || candidate[index - 1] === "/" || candidate[index - 1] === "-") {
      segmentStarts += 1;
    }
    cursor = index + 1;
  }
  const first = indexes[0] ?? 0;
  const prefixBonus = first === 0 ? 200 : 0;
  const exactBonus = candidate === query ? 500 : 0;
  return {
    score: exactBonus + prefixBonus + consecutive * 20 + segmentStarts * 30 - first - candidate.length,
    ranges: mergeMatchIndexes(indexes)
  };
}

// src/components/graph-workspace/explorer/workspaceExplorerProjection.ts
function sortedChildIds(model, childIds) {
  return [...childIds].sort((leftId, rightId) => {
    const left = model.nodes.get(leftId);
    const right = model.nodes.get(rightId);
    if (!left || !right) {
      return left ? -1 : right ? 1 : 0;
    }
    if (left.kind === "directory" && right.kind !== "directory") {
      return -1;
    }
    if (left.kind !== "directory" && right.kind === "directory") {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}
function projectWorkspaceExplorerRows(model, expandedPaths, options = {}) {
  const rows = [];
  const indexById = /* @__PURE__ */ new Map();
  const matches = /* @__PURE__ */ new Map();
  const includedIds = /* @__PURE__ */ new Set();
  const query = options.filterQuery?.trim() ?? "";
  if (query) {
    for (const node of model.nodes.values()) {
      const match = matchWorkspaceExplorerNode(node, query);
      if (!match) {
        continue;
      }
      matches.set(node.id, match);
      let current = node;
      while (current) {
        includedIds.add(current.id);
        current = current.parentId ? model.nodes.get(current.parentId) : void 0;
      }
    }
  }
  const filtering = Boolean(query && options.filterMode === "filter");
  const hasUnresolvedDirectories = [...model.nodes.values()].some(
    (node) => node.kind === "directory" && node.childrenState !== "resolved"
  );
  const visit = (nodeId, depth, posInSet, setSize) => {
    const node = model.nodes.get(nodeId);
    if (!node || filtering && !includedIds.has(node.id)) {
      return;
    }
    let projectedNode = node;
    const compactPathSegments = [node.name];
    if (options.compactFolders && !query && depth > 0 && node.kind === "directory") {
      while (projectedNode.kind === "directory" && projectedNode.childrenState === "resolved" && !projectedNode.truncated && projectedNode.childIds.length === 1) {
        const child = model.nodes.get(projectedNode.childIds[0]);
        if (!child || child.kind !== "directory") {
          break;
        }
        compactPathSegments.push(child.name);
        projectedNode = child;
      }
    }
    const expanded = projectedNode.kind === "directory" ? filtering || projectedNode.path === "" || expandedPaths.has(projectedNode.path) : void 0;
    indexById.set(projectedNode.id, rows.length);
    const match = matches.get(projectedNode.id);
    rows.push({
      id: projectedNode.id,
      parentId: node.parentId,
      depth,
      posInSet,
      setSize,
      expanded,
      ...compactPathSegments.length > 1 ? { compactPathSegments } : {},
      ...match?.ranges.length && !query.includes("/") ? { matchRanges: match.ranges } : {},
      node: projectedNode
    });
    if (!expanded) {
      return;
    }
    const childIds = sortedChildIds(model, projectedNode.childIds).filter(
      (childId) => !filtering || includedIds.has(childId)
    );
    childIds.forEach((childId, index) => {
      visit(childId, depth + 1, index + 1, childIds.length);
    });
  };
  visit(model.rootId, 0, 1, 1);
  return {
    rows,
    indexById,
    matchCount: matches.size,
    hasUnresolvedDirectories
  };
}

// src/components/graph-workspace/explorer/workspaceExplorerCommands.ts
function workspaceExplorerCommandForKey(input) {
  const currentIndex = input.focusedId ? input.rows.findIndex((row) => row.id === input.focusedId) : -1;
  const current = currentIndex >= 0 ? input.rows[currentIndex] : null;
  const focusAt = (index) => {
    const row = input.rows[index];
    return row ? { type: "focus", id: row.id } : null;
  };
  if ((input.metaKey || input.ctrlKey) && input.key.toLowerCase() === "f") {
    return { type: "open-filter" };
  }
  switch (input.key) {
    case "ArrowDown":
      return focusAt(Math.min(input.rows.length - 1, currentIndex + 1));
    case "ArrowUp":
      return focusAt(Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1));
    case "Home":
      return focusAt(0);
    case "End":
      return focusAt(input.rows.length - 1);
    case "ArrowRight": {
      if (!current) {
        return focusAt(0);
      }
      if (current.node.kind === "directory" && current.expanded === false) {
        return { type: "expand", path: current.node.path };
      }
      const next = input.rows[currentIndex + 1];
      return next?.parentId === current.id ? { type: "focus", id: next.id } : null;
    }
    case "ArrowLeft":
      if (!current) {
        return null;
      }
      if (current.node.kind === "directory" && current.expanded) {
        return { type: "collapse", path: current.node.path };
      }
      return current.parentId ? { type: "focus", id: current.parentId } : null;
    case "Enter":
      return current ? { type: "activate", id: current.id } : null;
    case " ":
      return current ? { type: "select", id: current.id } : null;
    default:
      return null;
  }
}

// src/components/graph-workspace/explorer/WorkspaceExplorerRow.tsx
import {
  ChevronDown,
  ChevronRight,
  File as File2,
  FileArchive,
  FileCode2,
  FileImage,
  Folder as Folder2,
  FolderOpen,
  FolderSymlink,
  LoaderCircle
} from "lucide-react";

// src/components/graph-workspace/explorer/WorkspaceNodeActions.tsx
import {
  Copy,
  Check,
  Download,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { useEffect as useEffect3, useRef as useRef3, useState as useState4 } from "react";
import { createPortal } from "react-dom";

// src/components/graph-workspace/explorer/WorkspaceNodeProperties.tsx
import { File, Folder, X } from "lucide-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var bytes = (size) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size, unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const short = `${value.toLocaleString(getLocale(), { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
  return unit ? translate("files.propertiesBytes", { size: short, bytes: size.toLocaleString(getLocale()) }) : short;
};
var when = (at) => {
  const date = at ? new Date(at) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString(getLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
};
function WorkspaceNodeProperties({ node, open, onOpenChange }) {
  useI18n();
  const info = node.workspaceNode;
  const directory = node.kind === "directory";
  const extension = !directory && node.name.includes(".") && !node.name.startsWith(".") ? node.name.split(".").pop().toUpperCase() : null;
  const folder = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : translate("files.propertiesRoot");
  const size = node.size ?? info?.size;
  const loaded = directory && node.childrenLoaded ? node.children.length : null;
  const rows = [
    [translate("files.propertiesKind"), directory ? translate("files.propertiesFolder") : extension ? translate("files.propertiesFileOf", { kind: extension }) : translate("files.propertiesFile")],
    [translate("files.propertiesLocation"), node.path.includes("/") ? /* @__PURE__ */ jsx(PathChip, { path: folder }) : folder],
    ...size !== void 0 ? [[translate("files.propertiesSize"), bytes(size)]] : [],
    ...loaded !== null ? [[translate("files.propertiesContains"), translate("files.propertiesItems", { count: loaded })]] : [],
    ...[["files.propertiesCreated", info?.createdAt], ["files.propertiesModified", info?.modifiedAt], ["files.propertiesAccessed", info?.accessedAt]].flatMap(([label, at]) => when(at) ? [[translate(label), when(at)]] : []),
    ...info?.mode || info?.readonly !== void 0 ? [[translate("files.propertiesPermissions"), /* @__PURE__ */ jsxs(Fragment, { children: [
      info?.mode ? /* @__PURE__ */ jsx("code", { children: info.mode }) : null,
      info?.readonly ? /* @__PURE__ */ jsx("span", { className: "workspace-properties-tag", children: translate("files.propertiesReadonly") }) : null
    ] })]] : [],
    ...info?.symlink ? [[translate("files.propertiesLink"), translate("files.propertiesLinkYes")]] : []
  ];
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange, children: /* @__PURE__ */ jsxs(DialogContent, { showCloseButton: false, "aria-describedby": void 0, className: "workspace-properties", overlayClassName: "workspace-properties-overlay", children: [
    /* @__PURE__ */ jsxs("header", { children: [
      directory ? /* @__PURE__ */ jsx(Folder, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx(File, { "aria-hidden": "true" }),
      /* @__PURE__ */ jsx(DialogTitle, { className: "workspace-properties-title", title: node.name, children: node.name }),
      /* @__PURE__ */ jsx(DialogClose, { className: "workspace-properties-close", "aria-label": translate("files.propertiesClose"), children: /* @__PURE__ */ jsx(X, { "aria-hidden": "true" }) })
    ] }),
    /* @__PURE__ */ jsx("dl", { children: rows.map(([label, value]) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("dt", { children: label }),
      /* @__PURE__ */ jsx("dd", { children: value })
    ] }, label)) }),
    !info?.modifiedAt ? /* @__PURE__ */ jsx("p", { className: "workspace-properties-note", children: translate("files.propertiesOlderDevice") }) : null
  ] }) });
}

// src/components/graph-workspace/explorer/WorkspaceNodeActions.tsx
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function WorkspaceNodeActions({
  node,
  onCopyPath,
  onDownload,
  onRename,
  onDelete
}) {
  useI18n();
  const [menu, setMenu] = useState4(null);
  const [copied, setCopied] = useState4(null);
  useEffect3(() => {
    if (!menu) setCopied(null);
  }, [menu]);
  const [dialog, setDialog] = useState4(null);
  const [name, setName] = useState4(node.name);
  const [error, setError] = useState4(null);
  const [busy, setBusy] = useState4(false);
  const trigger = useRef3(null);
  const popup = useRef3(null);
  const close = () => {
    setMenu(null);
    trigger.current?.focus();
  };
  useMenuKeyboard(popup, Boolean(menu), (restore) => restore ? close() : setMenu(null));
  useEffect3(() => {
    if (!menu) return;
    const outside = (event) => {
      if (!popup.current?.contains(event.target) && !trigger.current?.contains(event.target))
        setMenu(null);
    };
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    const resize = () => setMenu(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", resize);
    popup.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", resize);
    };
  }, [menu]);
  const actionClass = "thread-graph-tree-action flex shrink-0 items-center justify-center rounded transition";
  const mutate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === "rename") await onRename?.(node, name);
      else await onDelete?.(node);
      setDialog(null);
      trigger.current?.focus();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : translate("files.fileOperationFailed")
      );
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      className: "thread-graph-tree-actions flex shrink-0 items-center gap-0.5",
      onDoubleClick: (event) => event.stopPropagation(),
      onKeyDown: (event) => event.stopPropagation(),
      children: [
        onCopyPath && /* @__PURE__ */ jsxs2(Fragment2, { children: [
          /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              onClick: () => onCopyPath(node, "relative"),
              className: `${actionClass} workspace-node-quick-action`,
              title: translate("files.copyRelativePathFor", { value1: node.name }),
              "aria-label": translate("files.copyRelativePathFor", { value1: node.name }),
              children: /* @__PURE__ */ jsx2(Copy, { "data-icon": "copy-path", size: 14 })
            }
          ),
          /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              onClick: () => onCopyPath(node, "absolute"),
              className: `${actionClass} workspace-node-quick-action`,
              title: translate("files.copyAbsolutePathFor", { value1: node.name }),
              "aria-label": translate("files.copyAbsolutePathFor", { value1: node.name }),
              children: /* @__PURE__ */ jsx2(Copy, { "data-icon": "copy-absolute-path", size: 14 })
            }
          )
        ] }),
        (onRename || onDelete || onCopyPath || onDownload) && /* @__PURE__ */ jsx2(
          "button",
          {
            ref: trigger,
            type: "button",
            "aria-label": translate("files.moreActionsFor", { value1: node.name }),
            "aria-haspopup": "menu",
            "aria-expanded": !!menu,
            className: actionClass,
            onClick: () => {
              const box = trigger.current.getBoundingClientRect();
              setMenu(
                menu ? null : {
                  left: Math.max(
                    8,
                    Math.min(box.right - 208, window.innerWidth - 216)
                  ),
                  top: Math.max(
                    8,
                    Math.min(box.bottom + 4, window.innerHeight - 260)
                  )
                }
              );
            },
            children: /* @__PURE__ */ jsx2(MoreHorizontal, { "data-icon": "more", size: 14 })
          }
        ),
        menu && createPortal(
          /* @__PURE__ */ jsxs2(
            "div",
            {
              ref: popup,
              role: "menu",
              "aria-label": translate("files.actionsFor", { value1: node.name }),
              className: `thread-ui-shell workspace-node-menu ${shellThemeProps(trigger.current).themeClass}`,
              "data-theme-effective": shellThemeProps(trigger.current)["data-theme-effective"],
              "data-theme-mode": shellThemeProps(trigger.current)["data-theme-mode"],
              style: {
                position: "fixed",
                left: menu.left,
                top: menu.top,
                zIndex: 1e3,
                minWidth: 176,
                maxWidth: 260,
                maxHeight: "calc(100dvh - 16px)",
                overflowX: "hidden",
                overflowY: "auto",
                background: "var(--theme-panel)",
                color: "var(--theme-fg)",
                border: "1px solid var(--theme-border)",
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 8px 24px #0004"
              },
              children: [
                onDownload && /* @__PURE__ */ jsxs2("button", { role: "menuitem", type: "button", onClick: () => {
                  onDownload(node);
                  close();
                }, children: [
                  /* @__PURE__ */ jsx2(Download, { "data-icon": "download", size: 14 }),
                  translate("files.downloadFile")
                ] }),
                onCopyPath && /* @__PURE__ */ jsx2(Fragment2, { children: ["relative", "absolute"].map((kind) => /* @__PURE__ */ jsxs2(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    "data-copy-state": copied?.kind === kind ? copied.state : void 0,
                    "aria-label": translate(kind === "relative" ? "files.copyRelativePathFor" : "files.copyAbsolutePathFor", { value1: node.name }),
                    onClick: async () => {
                      const ok = await onCopyPath(node, kind) !== false;
                      setCopied({ kind, state: ok ? "copied" : "failed" });
                      if (ok) window.setTimeout(() => {
                        setCopied(null);
                        close();
                      }, 700);
                    },
                    children: [
                      copied?.kind === kind ? copied.state === "copied" ? /* @__PURE__ */ jsx2(Check, { size: 14 }) : /* @__PURE__ */ jsx2(TriangleAlert, { size: 14 }) : /* @__PURE__ */ jsx2(Copy, { "data-icon": kind === "relative" ? "copy-path" : "copy-absolute-path", size: 14 }),
                      copied?.kind === kind ? translate(copied.state === "copied" ? "common.copied" : "common.copyFailed") : translate(kind === "relative" ? "files.copyRelativePath" : "files.copyAbsolutePath")
                    ]
                  },
                  kind
                )) }),
                onRename && /* @__PURE__ */ jsxs2(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    onClick: () => {
                      setName(node.name);
                      setError(null);
                      setDialog("rename");
                      setMenu(null);
                    },
                    children: [
                      /* @__PURE__ */ jsx2(Pencil, { "data-icon": "rename", size: 14 }),
                      " ",
                      translate("files.rename_d3f4cb")
                    ]
                  }
                ),
                onDelete && /* @__PURE__ */ jsxs2(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    onClick: () => {
                      setError(null);
                      setDialog("delete");
                      setMenu(null);
                    },
                    children: [
                      /* @__PURE__ */ jsx2(Trash2, { "data-icon": "delete", size: 14 }),
                      " ",
                      translate("files.delete")
                    ]
                  }
                ),
                /* @__PURE__ */ jsx2("div", { role: "separator", className: "workspace-node-menu-separator" }),
                /* @__PURE__ */ jsxs2("button", { role: "menuitem", type: "button", onClick: () => {
                  setDialog("properties");
                  setMenu(null);
                }, children: [
                  /* @__PURE__ */ jsx2(Info, { "data-icon": "properties", size: 14 }),
                  translate("files.propertiesMenu")
                ] })
              ]
            }
          ),
          document.body
        ),
        /* @__PURE__ */ jsx2(WorkspaceNodeProperties, { node, open: dialog === "properties", onOpenChange: (next) => {
          if (!next) {
            setDialog(null);
            trigger.current?.focus();
          }
        } }),
        /* @__PURE__ */ jsx2(
          RenameDialog,
          {
            open: dialog === "rename",
            title: translate("files.rename", { value1: translate(node.kind === "directory" ? "files.kindFolder" : "files.kindFile") }),
            label: translate("files.name"),
            value: name,
            onChange: setName,
            onCancel: () => setDialog(null),
            onSubmit: mutate,
            busy,
            error
          }
        ),
        /* @__PURE__ */ jsx2(
          ConfirmDialog,
          {
            open: dialog === "delete",
            title: translate("files.delete_c93ae0", { value1: translate(node.kind === "directory" ? "files.kindFolder" : "files.kindFile") }),
            description: translate("files.permanentlyDelete", { value1: node.path, value2: node.kind === "directory" ? translate("files.andItsContents") : "" }),
            onCancel: () => setDialog(null),
            onConfirm: mutate,
            busy,
            error
          }
        )
      ]
    }
  );
}

// src/components/graph-workspace/explorer/ExplorerNameBubble.tsx
import { useCallback as useCallback3, useEffect as useEffect4, useRef as useRef4, useState as useState5 } from "react";
import { createPortal as createPortal2 } from "react-dom";
import { jsx as jsx3 } from "react/jsx-runtime";
var HOVER_DELAY_MS = 400;
var PRESS_DELAY_MS = 400;
var MOVE_SLOP_PX = 10;
function useExplorerNameBubble(name) {
  const label = useRef4(null);
  const timer = useRef4(void 0);
  const press = useRef4(null);
  const shown = useRef4(false);
  const [place, setPlace] = useState5(null);
  const clear = () => window.clearTimeout(timer.current);
  const hide = useCallback3(() => {
    clear();
    press.current = null;
    shown.current = false;
    setPlace(null);
  }, []);
  useEffect4(() => hide, [hide]);
  const show = () => {
    const element = label.current;
    if (!element || !truncated(element)) return;
    const row = element.closest('[role="treeitem"]');
    const rowBox = (row ?? element).getBoundingClientRect();
    const start = element.getBoundingClientRect().left;
    const actions = row?.querySelector(".thread-graph-tree-actions")?.getBoundingClientRect();
    const end = Math.min(actions && actions.width > 0 ? actions.left : rowBox.right, window.innerWidth) - 6;
    const left = Math.max(6, Math.min(start - 6, end - 160));
    const above = rowBox.top > 64;
    const ink = getComputedStyle(element).color;
    shown.current = true;
    setPlace({
      theme: shellThemeProps(element),
      style: {
        color: ink,
        background: surfaceBehind(element),
        borderColor: `color-mix(in srgb, ${ink} 22%, transparent)`,
        position: "fixed",
        left,
        maxWidth: Math.max(160, end - left),
        zIndex: 1e3,
        ...above ? { bottom: window.innerHeight - rowBox.top + 4 } : { top: rowBox.bottom + 4 }
      }
    });
  };
  const handlers = {
    onMouseEnter: () => {
      clear();
      timer.current = window.setTimeout(show, HOVER_DELAY_MS);
    },
    onMouseLeave: hide,
    onTouchStart: (event) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      press.current = { x: touch.clientX, y: touch.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        if (press.current) show();
      }, PRESS_DELAY_MS);
    },
    onTouchMove: (event) => {
      const touch = event.touches[0];
      if (press.current && touch && Math.hypot(touch.clientX - press.current.x, touch.clientY - press.current.y) > MOVE_SLOP_PX) hide();
    },
    onTouchEnd: hide,
    onTouchCancel: hide,
    // A hold that showed the name is only a look: no tap, no system menu.
    onClickCapture: (event) => {
      if (shown.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onContextMenu: (event) => {
      if (press.current) event.preventDefault();
    }
  };
  const bubble = place ? createPortal2(
    /* @__PURE__ */ jsx3(
      "div",
      {
        role: "tooltip",
        className: `thread-ui-shell explorer-name-bubble ${place.theme.themeClass}`,
        "data-theme-effective": place.theme["data-theme-effective"],
        style: place.style,
        children: name
      }
    ),
    document.body
  ) : null;
  return { label, handlers, bubble };
}
function truncated(element) {
  return [element, ...element.querySelectorAll("*")].some((node) => node.scrollWidth > node.clientWidth + 1);
}

// src/components/copy/MiddleName.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function MiddleName({ name, className }) {
  const keep = Math.min(name.length, Math.max(8, name.length - name.lastIndexOf(".") + 5));
  if (name.length <= keep + 2) return /* @__PURE__ */ jsx4("span", { className: `middle-name${className ? ` ${className}` : ""}`, children: /* @__PURE__ */ jsx4("span", { className: "middle-name-head", children: name }) });
  return /* @__PURE__ */ jsxs3("span", { className: `middle-name${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx4("span", { className: "middle-name-head", children: name.slice(0, -keep) }),
    /* @__PURE__ */ jsx4("span", { className: "middle-name-tail", children: name.slice(-keep) })
  ] });
}

// src/components/graph-workspace/explorer/WorkspaceExplorerRow.tsx
import { Fragment as Fragment3, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function iconForNode(node, expanded) {
  if (node.kind === "directory") {
    return expanded ? /* @__PURE__ */ jsx5(FolderOpen, { "data-icon": "folder-open", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" }) : /* @__PURE__ */ jsx5(Folder2, { "data-icon": "folder", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" });
  }
  const extension = extensionOf(node.name);
  if (extension === "zip") {
    return /* @__PURE__ */ jsx5(FileArchive, { "data-icon": "archive", className: "workspace-node-icon is-archive h-4 w-4 text-amber-600" });
  }
  if (node.kind === "file" && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return /* @__PURE__ */ jsx5(FileImage, { "data-icon": "image", className: "workspace-node-icon is-image h-4 w-4 text-sky-500" });
  }
  if (node.kind === "artifact" || [
    "xyz",
    "extxyz",
    "cif",
    "pdf",
    "json",
    "ts",
    "tsx",
    "js",
    "jsx",
    "md",
    "yaml",
    "yml",
    "py"
  ].includes(extension)) {
    return /* @__PURE__ */ jsx5(FileCode2, { "data-icon": "code", className: "workspace-node-icon is-code h-4 w-4 text-emerald-600" });
  }
  return /* @__PURE__ */ jsx5(File2, { "data-icon": "file", className: "workspace-node-icon is-file h-4 w-4 text-slate-400 dark:text-slate-500" });
}
function openRowMenu(row) {
  const trigger = row.querySelector('button[aria-haspopup="menu"]');
  if (!trigger) return false;
  trigger.click();
  return true;
}
function WorkspaceExplorerRow({
  row,
  selected,
  focused,
  loading,
  error,
  rowRef,
  onFocus,
  onKeyDown,
  onSelect,
  onToggle,
  onPreview,
  onPin,
  onRetry,
  onDownload,
  onCopyPath,
  onRename,
  onDelete
}) {
  useI18n();
  const nameBubble = useExplorerNameBubble(row.compactPathSegments?.join("/") ?? row.node.source.name);
  const node = {
    ...row.node.source,
    children: []
  };
  const isDirectory = node.kind === "directory";
  const linkedDirectory = node.id.startsWith(LINKED_DIRECTORY_ID_PREFIX);
  const canToggleDirectory = isDirectory && Boolean(node.path);
  const expanded = Boolean(row.expanded);
  const paddingLeft = `${row.depth * 0.5 + 0.5}rem`;
  const displayName = row.compactPathSegments?.join("/") ?? node.name;
  const label = row.matchRanges?.length ? /* @__PURE__ */ jsx5(Fragment3, { children: row.matchRanges.reduce((parts, range, index) => {
    const previousEnd = row.matchRanges?.[index - 1]?.end ?? 0;
    if (range.start > previousEnd) {
      parts.push(displayName.slice(previousEnd, range.start));
    }
    parts.push(
      /* @__PURE__ */ jsx5(
        "span",
        {
          className: "font-semibold text-[var(--theme-fg)]",
          children: displayName.slice(range.start, range.end)
        },
        `${range.start}:${range.end}`
      )
    );
    if (index === row.matchRanges.length - 1 && range.end < displayName.length) {
      parts.push(displayName.slice(range.end));
    }
    return parts;
  }, []) }) : displayName;
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      ref: rowRef,
      role: "treeitem",
      "aria-label": displayName,
      "aria-level": row.depth + 1,
      "aria-posinset": row.posInSet,
      "aria-setsize": row.setSize,
      "aria-selected": selected,
      ...isDirectory ? { "aria-expanded": expanded } : {},
      tabIndex: focused ? 0 : -1,
      "data-explorer-node-id": node.id,
      "data-explorer-path": node.path,
      className: `thread-graph-tree-row group relative flex min-w-0 items-center text-sm transition ${selected ? "is-selected" : ""} ${focused ? "is-focused" : ""}`,
      style: { paddingLeft },
      onFocus,
      onKeyDown: (event) => {
        if ((event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) && openRowMenu(event.currentTarget)) {
          event.preventDefault();
          return;
        }
        onKeyDown(event);
      },
      onContextMenu: (event) => {
        if (openRowMenu(event.currentTarget)) event.preventDefault();
      },
      onDoubleClick: () => {
        if (isDirectory && node.path) {
          onToggle(node.path);
        } else if (!isDirectory) {
          onPin?.(node);
        }
      },
      children: [
        row.depth > 0 ? /* @__PURE__ */ jsx5(
          "span",
          {
            className: "thread-graph-tree-indent-guides pointer-events-none absolute inset-y-0 left-0",
            "aria-hidden": "true",
            children: Array.from({ length: row.depth }, (_, index) => /* @__PURE__ */ jsx5(
              "span",
              {
                className: "absolute inset-y-0 border-l",
                style: { left: `${index * 0.5 + 0.75}rem` }
              },
              index
            ))
          }
        ) : null,
        canToggleDirectory ? /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            tabIndex: -1,
            "aria-label": `${expanded ? translate("files.collapse") : translate("files.expand")} ${node.name}`,
            className: "inline-flex h-7 w-7 shrink-0 items-center justify-center sm:h-6 sm:w-6",
            onClick: () => {
              if (node.path) {
                onToggle(node.path);
              }
            },
            children: loading ? /* @__PURE__ */ jsx5(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin text-slate-400 motion-reduce:animate-none" }) : expanded ? /* @__PURE__ */ jsx5(ChevronDown, { className: "h-3.5 w-3.5 text-slate-400" }) : /* @__PURE__ */ jsx5(ChevronRight, { className: "h-3.5 w-3.5 text-slate-400" })
          }
        ) : /* @__PURE__ */ jsx5("span", { className: "h-7 w-7 shrink-0 sm:h-6 sm:w-6", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs4(
          "button",
          {
            type: "button",
            tabIndex: -1,
            className: "flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left sm:min-h-7 sm:py-1",
            onClick: () => {
              onSelect(node);
              if (canToggleDirectory && window.matchMedia?.("(max-width: 639px)").matches) onToggle(node.path);
            },
            children: [
              linkedDirectory ? /* @__PURE__ */ jsx5(FolderSymlink, { "data-icon": "folder-link", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400", "aria-hidden": "true" }) : iconForNode(node, expanded),
              linkedDirectory ? (
                // Long host paths keep their meaningful tail visible.
                /* @__PURE__ */ jsx5("span", { className: "workspace-linked-directory-label min-w-0 flex-1", title: `${displayName}
${translate("files.linkedFilesAreReadOnlyPreviews")}`, children: /* @__PURE__ */ jsx5("bdi", { children: displayName }) })
              ) : /* @__PURE__ */ jsx5("span", { ref: nameBubble.label, className: "explorer-name flex min-w-0 flex-1", ...nameBubble.handlers, children: row.matchRanges?.length ? /* @__PURE__ */ jsx5("span", { className: "min-w-0 truncate", children: label }) : /* @__PURE__ */ jsx5(MiddleName, { name: displayName }) })
            ]
          }
        ),
        isDirectory && error ? /* @__PURE__ */ jsx5(
          ErrorMark,
          {
            className: "mr-1",
            tabIndex: -1,
            message: error,
            onRetry: onRetry ? () => onRetry(node.path) : void 0,
            retryLabel: translate("files.retryLoading", { value1: node.name })
          }
        ) : null,
        !linkedDirectory && node.path ? /* @__PURE__ */ jsx5(
          WorkspaceNodeActions,
          {
            node,
            ...onDownload ? { onDownload } : {},
            ...onCopyPath ? { onCopyPath } : {},
            ...onRename && !node.path.startsWith("/") && !/^[a-z]:/i.test(node.path) ? { onRename } : {},
            ...onDelete && !node.path.startsWith("/") && !/^[a-z]:/i.test(node.path) ? { onDelete } : {}
          }
        ) : null,
        nameBubble.bubble
      ]
    }
  );
}

// src/components/graph-workspace/explorer/WorkspaceExplorerTree.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
function WorkspaceExplorerTree({
  tree,
  expandedPaths,
  filterMode = "filter",
  filterQuery = "",
  compactFolders = false,
  directoryErrors,
  loadingPaths,
  selectedNodeId,
  revealRequestKey,
  scrollerRef,
  scrollTopRef,
  onCopyPath,
  onDownload,
  onRename,
  onDelete,
  onOpenFilter,
  onFilterResultsChange,
  onPreview,
  onPin,
  onRetryDirectory,
  onSelect,
  onToggle,
  virtualize = true
}) {
  useI18n();
  const model = useMemo3(() => createWorkspaceExplorerModel(tree), [tree]);
  const projection = useMemo3(
    () => projectWorkspaceExplorerRows(model, expandedPaths, {
      filterMode,
      filterQuery,
      compactFolders
    }),
    [compactFolders, expandedPaths, filterMode, filterQuery, model]
  );
  const { rows } = projection;
  const [focusedId, setFocusedId] = useState6(
    () => selectedNodeId ?? rows[0]?.id ?? null
  );
  const rowElementsRef = useRef5(/* @__PURE__ */ new Map());
  const canVirtualize = virtualize && typeof window !== "undefined" && "ResizeObserver" in window;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    getItemKey: (index) => rows[index]?.id ?? index,
    estimateSize: () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? 44 : 28,
    overscan: 6,
    enabled: canVirtualize,
    useFlushSync: false,
    // A hidden drawer (`display: none`) reports 0px rows. Caching those sizes
    // collapses rows and shifts everything after them once it is shown again.
    measureElement: (element, entry, instance) => {
      const size = measureElement(element, entry, instance);
      if (size > 0) return size;
      const index = instance.indexFromElement(element);
      return instance.measurementsCache[index]?.size ?? instance.options.estimateSize(index);
    }
  });
  const lastVisibleScrollTopRef = useRef5(0);
  useEffect5(() => {
    const scroller = scrollerRef.current;
    if (!canVirtualize || !scroller) return;
    let hidden = scroller.clientHeight === 0;
    const observer = new ResizeObserver(() => {
      const nowHidden = scroller.clientHeight === 0;
      if (hidden && !nowHidden) {
        const target = lastVisibleScrollTopRef.current;
        if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target;
        scroller.dispatchEvent(new Event("scroll"));
      }
      hidden = nowHidden;
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [canVirtualize, scrollerRef]);
  useEffect5(() => {
    onFilterResultsChange?.({
      matchCount: projection.matchCount,
      hasUnresolvedDirectories: projection.hasUnresolvedDirectories
    });
  }, [
    onFilterResultsChange,
    projection.hasUnresolvedDirectories,
    projection.matchCount
  ]);
  useEffect5(() => {
    if (focusedId && projection.indexById.has(focusedId)) {
      return;
    }
    setFocusedId(
      selectedNodeId && projection.indexById.has(selectedNodeId) ? selectedNodeId : rows[0]?.id ?? null
    );
  }, [focusedId, projection.indexById, rows, selectedNodeId]);
  const focusRow = useCallback4(
    (id) => {
      setFocusedId(id);
      const index = projection.indexById.get(id);
      if (canVirtualize && index !== void 0) {
        virtualizer.scrollToIndex(index, { align: "auto" });
      }
      window.requestAnimationFrame(
        () => rowElementsRef.current.get(id)?.focus()
      );
    },
    [canVirtualize, projection.indexById, virtualizer]
  );
  const revealedSelectionRef = useRef5(null);
  const revealUntilRef = useRef5(0);
  const revealTarget = useCallback4((id, toTop) => {
    const index = projection.indexById.get(id);
    if (index === void 0) return false;
    if (!toTop) {
      if (canVirtualize) virtualizer.scrollToIndex(index, { align: "auto" });
      else rowElementsRef.current.get(id)?.scrollIntoView?.({ block: "nearest" });
    } else if (canVirtualize) {
      virtualizer.scrollToIndex(Math.max(0, index - 1), { align: "start" });
    } else {
      const row = rowElementsRef.current.get(id);
      const scroller = scrollerRef.current;
      if (row && scroller) {
        const offset = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += offset - row.offsetHeight;
      }
    }
    return true;
  }, [projection.indexById, canVirtualize, virtualizer, scrollerRef]);
  const revealedRequestRef = useRef5(void 0);
  useEffect5(() => {
    const key = `${selectedNodeId}:${revealRequestKey ?? 0}`;
    if (!selectedNodeId || revealedSelectionRef.current === key) return;
    const requested = revealRequestKey !== void 0 && revealRequestKey !== revealedRequestRef.current;
    if (!revealTarget(selectedNodeId, requested)) return;
    revealedSelectionRef.current = key;
    revealedRequestRef.current = revealRequestKey;
    setFocusedId(selectedNodeId);
    revealUntilRef.current = requested ? performance.now() + 1500 : 0;
  }, [selectedNodeId, revealRequestKey, revealTarget]);
  useEffect5(() => {
    if (!selectedNodeId || performance.now() > revealUntilRef.current) return;
    const frame = window.requestAnimationFrame(() => revealTarget(selectedNodeId, true));
    return () => window.cancelAnimationFrame(frame);
  }, [projection, selectedNodeId, revealTarget]);
  useEffect5(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const stop = () => {
      revealUntilRef.current = 0;
    };
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchstart", stop, { passive: true });
    scroller.addEventListener("keydown", stop);
    return () => {
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
      scroller.removeEventListener("keydown", stop);
    };
  }, [scrollerRef]);
  const handleKeyDown = useCallback4(
    (event) => {
      const command = workspaceExplorerCommandForKey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        focusedId,
        rows
      });
      if (!command) {
        return;
      }
      event.preventDefault();
      switch (command.type) {
        case "focus":
          focusRow(command.id);
          break;
        case "expand":
        case "collapse":
          onToggle(command.path);
          break;
        case "activate": {
          const row = model.nodes.get(command.id);
          if (!row) {
            break;
          }
          if (row.kind === "directory" && row.path) {
            onToggle(row.path);
          } else {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case "select": {
          const row = model.nodes.get(command.id);
          if (row) {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case "open-filter":
          onOpenFilter?.();
          break;
      }
    },
    [focusRow, focusedId, model.nodes, onOpenFilter, onSelect, onToggle, rows]
  );
  const virtualItems = canVirtualize ? virtualizer.getVirtualItems() : [];
  const renderedRows = canVirtualize ? virtualItems.map((item) => ({
    index: item.index,
    key: item.key,
    start: item.start
  })) : rows.map((row, index) => ({ index, key: row.id, start: 0 }));
  return /* @__PURE__ */ jsx6(
    "div",
    {
      ref: scrollerRef,
      role: "tree",
      "aria-label": translate("files.workspaceFiles"),
      className: "thread-graph-workspace-tree-scroll min-h-0 flex-1 overflow-y-auto py-1 outline-none",
      onScroll: (event) => {
        if (event.currentTarget.clientHeight > 0) {
          lastVisibleScrollTopRef.current = event.currentTarget.scrollTop;
        }
        if (scrollTopRef) {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }
      },
      children: /* @__PURE__ */ jsx6(
        "div",
        {
          style: canVirtualize ? {
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%"
          } : void 0,
          children: renderedRows.map((rendered) => {
            const row = rows[rendered.index];
            if (!row) {
              return null;
            }
            return /* @__PURE__ */ jsx6(
              "div",
              {
                role: "none",
                "data-index": rendered.index,
                ref: canVirtualize ? virtualizer.measureElement : void 0,
                style: canVirtualize ? {
                  left: 0,
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${rendered.start}px)`,
                  width: "100%"
                } : void 0,
                children: /* @__PURE__ */ jsx6(
                  WorkspaceExplorerRow,
                  {
                    row,
                    selected: selectedNodeId === row.id,
                    focused: focusedId === row.id,
                    loading: loadingPaths.has(row.node.path),
                    ...directoryErrors?.get(row.node.path) ? { error: directoryErrors.get(row.node.path) } : {},
                    rowRef: (element) => {
                      if (element) {
                        rowElementsRef.current.set(row.id, element);
                      } else {
                        rowElementsRef.current.delete(row.id);
                      }
                    },
                    onFocus: () => setFocusedId(row.id),
                    onKeyDown: handleKeyDown,
                    onSelect,
                    onToggle,
                    ...onPreview ? { onPreview } : {},
                    ...onPin ? { onPin } : {},
                    ...onRetryDirectory ? { onRetry: onRetryDirectory } : {},
                    ...onDownload ? { onDownload } : {},
                    ...onCopyPath ? { onCopyPath } : {},
                    ...onRename ? { onRename } : {},
                    ...onDelete ? { onDelete } : {}
                  }
                )
              },
              rendered.key
            );
          })
        }
      )
    }
  );
}

// src/components/graph-workspace/explorer/WorkspaceExplorerPanel.tsx
import { Fragment as Fragment4, jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
var iconButtonClassName = "thread-graph-explorer-icon-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40";
var collapseButtonClassName = "thread-graph-explorer-collapse-button flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222733] dark:hover:text-slate-100";
function WorkspaceExplorerPanel({
  canEmptyGarbage,
  canUpload,
  compactFolders,
  directoryErrors,
  expandedPaths,
  filterMode,
  filterQuery,
  initialLoading,
  loadingPaths,
  loading,
  liveNodes = [],
  onCollapse,
  onCollapseAll,
  onCopyPath,
  onDownload,
  onRename,
  onDelete,
  onEmptyGarbage,
  onExpandViewer,
  expandViewerAvailable = true,
  onFilterModeChange,
  onFilterQueryChange,
  onPreview,
  onPin,
  onRefresh,
  onRetryDirectory,
  onSelect,
  onSelectNode,
  onToggle,
  onUpload,
  onCreateFile,
  explorerScrollTopRef,
  explorerScrollerRef,
  selectedNodeId,
  revealRequestKey,
  tree,
  rootError
}) {
  useI18n();
  const filePanel = useFilePanel();
  const visibleTree = useMemo4(
    () => ({
      ...tree,
      children: tree.children.filter((node) => node.path !== "live")
    }),
    [tree]
  );
  const [filterOpen, setFilterOpen] = useState7(Boolean(filterQuery));
  const [filterResult, setFilterResult] = useState7({
    matchCount: 0,
    hasUnresolvedDirectories: false
  });
  const filterInputRef = useRef6(null);
  const openFilter = useCallback5(() => setFilterOpen(true), []);
  const handleFilterResultsChange = useCallback5(
    (result) => setFilterResult(result),
    []
  );
  useEffect6(() => {
    if (filterOpen) {
      window.requestAnimationFrame(() => filterInputRef.current?.focus());
    }
  }, [filterOpen]);
  function closeFilter() {
    onFilterQueryChange("");
    setFilterOpen(false);
  }
  return /* @__PURE__ */ jsxs5("aside", { className: "thread-graph-explorer flex h-full min-h-0 flex-col overflow-hidden rounded-md", children: [
    /* @__PURE__ */ jsxs5("div", { title: filePanel?.label, className: "thread-graph-explorer-header flex h-9 shrink-0 items-center justify-between border-b px-2", children: [
      /* @__PURE__ */ jsx7("h2", { className: "text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300", children: translate("files.explorer") }),
      /* @__PURE__ */ jsxs5("div", { className: "thread-graph-explorer-toolbar flex items-center gap-1", children: [
        filePanel?.setMinimized ? /* @__PURE__ */ jsxs5("span", { className: "thread-graph-window-controls", children: [
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              "data-testid": "workbench-close-files",
              className: "is-close",
              onClick: filePanel.close,
              "aria-label": translate("workbench.closeFiles"),
              title: translate("workbench.closeFiles"),
              children: /* @__PURE__ */ jsx7(X2, { "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              className: "is-minimize",
              "aria-pressed": Boolean(filePanel.minimized),
              onClick: () => filePanel.setMinimized?.(!filePanel.minimized),
              "aria-label": translate(filePanel.minimized ? "workbench.restoreFiles" : "workbench.minimizeFiles"),
              title: translate(filePanel.minimized ? "workbench.restoreFiles" : "workbench.minimizeFiles"),
              children: filePanel.minimized ? /* @__PURE__ */ jsx7(Maximize2, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx7(Minus, { "aria-hidden": "true" })
            }
          )
        ] }) : filePanel && onExpandViewer && /* @__PURE__ */ jsx7("button", { type: "button", "data-testid": "workbench-close-files", className: iconButtonClassName, onClick: filePanel.close, "aria-label": translate("workbench.closeFiles"), title: translate("workbench.closeFiles"), children: /* @__PURE__ */ jsx7(X2, { "data-icon": "close", size: 16 }) }),
        onCreateFile && /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onCreateFile,
            className: iconButtonClassName,
            title: translate("files.newFile"),
            "aria-label": translate("files.newFile"),
            children: /* @__PURE__ */ jsx7(FilePlus2, { "data-icon": "new-file", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: openFilter,
            className: iconButtonClassName,
            title: translate("files.filterWorkspace"),
            "aria-label": translate("files.filterWorkspace"),
            "aria-pressed": filterOpen,
            children: /* @__PURE__ */ jsx7(Search, { "data-icon": "filter", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onCollapseAll,
            className: iconButtonClassName,
            title: translate("files.collapseFolders"),
            "aria-label": translate("files.collapseFolders"),
            children: /* @__PURE__ */ jsx7(ListCollapse, { "data-icon": "collapse-folders", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onRefresh,
            disabled: !onRefresh,
            className: iconButtonClassName,
            title: translate("files.refreshWorkspace"),
            "aria-label": translate("files.refreshWorkspace"),
            children: /* @__PURE__ */ jsx7(
              RefreshCw,
              {
                "data-icon": "refresh",
                className: `h-4 w-4 motion-reduce:animate-none ${loading ? "animate-spin" : ""}`
              }
            )
          }
        ),
        canUpload || onEmptyGarbage ? /* @__PURE__ */ jsx7(ExplorerMoreMenu, { triggerClassName: iconButtonClassName, children: (close) => /* @__PURE__ */ jsxs5(Fragment4, { children: [
          canUpload ? /* @__PURE__ */ jsxs5(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onUpload?.();
              },
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none",
              children: [
                /* @__PURE__ */ jsx7(Upload, { "data-icon": "upload", className: "h-4 w-4" }),
                translate("files.uploadFile")
              ]
            }
          ) : null,
          onEmptyGarbage ? /* @__PURE__ */ jsxs5(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onEmptyGarbage();
              },
              disabled: !canEmptyGarbage,
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-50 dark:text-rose-300",
              children: [
                /* @__PURE__ */ jsx7(Trash22, { "data-icon": "delete", className: "h-4 w-4" }),
                translate("files.emptyGarbage_b701de")
              ]
            }
          ) : null
        ] }) }) : null,
        onExpandViewer ? expandViewerAvailable ? /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            "data-testid": "expand-viewer",
            onClick: onExpandViewer,
            className: collapseButtonClassName,
            title: translate("files.showEditor"),
            "aria-label": translate("files.showEditor"),
            children: /* @__PURE__ */ jsx7(PanelRightOpen, { "data-icon": "expand-viewer", className: "h-4 w-4" })
          }
        ) : null : onCollapse ? /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            "data-testid": "collapse-explorer",
            onClick: onCollapse,
            className: collapseButtonClassName,
            title: translate("files.hideExplorer"),
            "aria-label": translate("files.hideExplorer"),
            children: /* @__PURE__ */ jsx7(PanelLeftClose, { "data-icon": "collapse-explorer", className: "h-4 w-4" })
          }
        ) : null
      ] })
    ] }),
    filterOpen ? /* @__PURE__ */ jsxs5("div", { className: "thread-graph-explorer-filter shrink-0 border-b border-[var(--theme-border)] px-3 py-2", children: [
      /* @__PURE__ */ jsxs5("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsxs5("div", { className: "flex w-full min-w-0 items-center gap-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-2", children: [
          /* @__PURE__ */ jsx7(Search, { className: "h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" }),
          /* @__PURE__ */ jsx7(
            "input",
            {
              ref: filterInputRef,
              value: filterQuery,
              onChange: (event) => onFilterQueryChange(event.currentTarget.value),
              onKeyDown: (event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  if (filterQuery) {
                    onFilterQueryChange("");
                  } else {
                    closeFilter();
                  }
                }
              },
              className: "h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--theme-fg)] outline-none",
              placeholder: translate("files.filterLoadedFiles"),
              "aria-label": translate("files.filterWorkspaceFiles")
            }
          ),
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              onClick: closeFilter,
              className: "inline-flex h-7 w-7 items-center justify-center rounded text-[var(--theme-fg-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
              title: translate("files.closeFilter"),
              "aria-label": translate("files.closeFilter"),
              children: /* @__PURE__ */ jsx7(X2, { className: "h-3.5 w-3.5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx7(
          "div",
          {
            className: "thread-graph-explorer-filter-mode inline-flex shrink-0 self-end rounded-md border border-[var(--theme-border)] p-0.5",
            role: "group",
            "aria-label": translate("files.explorerFilterMode"),
            children: ["filter", "highlight"].map((mode) => /* @__PURE__ */ jsx7(
              "button",
              {
                type: "button",
                onClick: () => onFilterModeChange(mode),
                className: `h-7 rounded px-2 text-xs ${filterMode === mode ? "is-active" : ""}`,
                "aria-pressed": filterMode === mode,
                title: mode === "filter" ? translate("files.showMatchesOnly") : translate("files.highlightMatches"),
                children: mode === "filter" ? translate("files.filter") : translate("files.highlight")
              },
              mode
            ))
          }
        )
      ] }),
      filterQuery ? /* @__PURE__ */ jsxs5(
        "div",
        {
          className: "mt-1.5 text-xs text-[var(--theme-fg-muted)]",
          "aria-live": "polite",
          children: [
            filterResult.matchCount,
            " ",
            filterResult.matchCount === 1 ? translate("files.match") : translate("files.matches"),
            filterResult.hasUnresolvedDirectories ? translate("files.inLoadedFolders") : ""
          ]
        }
      ) : null
    ] }) : null,
    liveNodes.length > 0 ? /* @__PURE__ */ jsxs5("div", { className: "shrink-0 border-b border-slate-200 py-2 dark:border-[#2a2f3a]", children: [
      /* @__PURE__ */ jsx7("div", { className: "thread-graph-workspace-label px-3 pb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400", children: translate("files.live") }),
      liveNodes.map((node) => /* @__PURE__ */ jsxs5(
        "button",
        {
          type: "button",
          "data-testid": "live-molecule-item",
          "data-molecule-id": node.artifact?.id ?? node.id,
          onClick: () => onSelect(node.id),
          className: `thread-graph-tree-row flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm transition sm:min-h-7 sm:py-1 ${selectedNodeId === node.id ? "is-selected" : ""}`,
          children: [
            /* @__PURE__ */ jsx7(FileCode22, { className: "h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" }),
            /* @__PURE__ */ jsx7("span", { className: "min-w-0 flex-1 truncate", children: node.name })
          ]
        },
        node.id
      ))
    ] }) : null,
    initialLoading ? /* @__PURE__ */ jsx7(
      "div",
      {
        className: "workspace-loading-skeleton flex-1 space-y-1 px-3 py-2",
        role: "status",
        "aria-label": translate("files.loadingWorkspaceFiles"),
        children: [0, 1, 2, 3, 4].map((index) => /* @__PURE__ */ jsx7(
          "div",
          {
            className: "h-7 animate-pulse rounded bg-[var(--theme-surface-strong)] motion-reduce:animate-none",
            style: { width: `${72 - index * 6}%` }
          },
          index
        ))
      }
    ) : rootError ? (
      // Nothing loaded yet: a short line in the tree's place, the reason (and
      // Retry) behind its mark; Refresh in the toolbar stays the way out too.
      /* @__PURE__ */ jsxs5("p", { className: "thread-graph-workspace-failed mx-4 my-3 flex items-center gap-1 text-sm text-[var(--theme-fg-muted)]", children: [
        /* @__PURE__ */ jsx7("span", { className: "min-w-0", children: translate("files.failedToLoadWorkspace") }),
        /* @__PURE__ */ jsx7(ErrorMark, { message: rootError, onRetry: onRefresh, retryLabel: translate("files.retry") })
      ] })
    ) : /* @__PURE__ */ jsx7(
      WorkspaceExplorerTree,
      {
        tree: visibleTree,
        expandedPaths,
        filterMode,
        filterQuery,
        compactFolders,
        directoryErrors,
        loadingPaths,
        selectedNodeId,
        revealRequestKey,
        scrollerRef: explorerScrollerRef,
        scrollTopRef: explorerScrollTopRef,
        ...onCopyPath ? { onCopyPath } : {},
        ...onRename ? { onRename } : {},
        ...onDelete ? { onDelete } : {},
        ...onDownload ? { onDownload } : {},
        onOpenFilter: openFilter,
        onFilterResultsChange: handleFilterResultsChange,
        ...onPreview ? { onPreview } : {},
        ...onPin ? { onPin } : {},
        ...onRetryDirectory ? { onRetryDirectory } : {},
        onSelect: (node) => {
          onSelect(node.id);
          onSelectNode?.(node);
        },
        onToggle
      }
    ),
    !initialLoading && !rootError && filterQuery && filterMode === "filter" && filterResult.matchCount === 0 ? /* @__PURE__ */ jsx7("p", { className: "thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400", children: translate("files.noMatchesInLoadedFolders") }) : !rootError && visibleTree.children.length === 0 ? /* @__PURE__ */ jsx7("p", { className: "thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400", children: translate("files.thisWorkspaceIsEmptyAgentToolRuns") }) : null
  ] });
}
function ExplorerMoreMenu({ triggerClassName, children }) {
  const [open, setOpen] = useState7(false);
  const trigger = useRef6(null);
  const menu = useRef6(null);
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  useMenuKeyboard(menu, open, close);
  useEffect6(() => {
    if (!open) return;
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return /* @__PURE__ */ jsxs5("div", { className: "thread-graph-explorer-more relative", children: [
    /* @__PURE__ */ jsx7(
      "button",
      {
        ref: trigger,
        type: "button",
        className: triggerClassName,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        title: translate("files.moreExplorerActions"),
        "aria-label": translate("files.moreExplorerActions"),
        onClick: () => setOpen((value) => !value),
        children: /* @__PURE__ */ jsx7(MoreHorizontal2, { "data-icon": "more", className: "h-4 w-4" })
      }
    ),
    open ? /* @__PURE__ */ jsx7(
      "div",
      {
        ref: menu,
        role: "menu",
        "aria-label": translate("files.moreExplorerActions"),
        className: "absolute right-0 top-7 z-40 min-w-44 rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1 shadow-lg",
        children: children(() => close(true))
      }
    ) : null
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import {
  createContext,
  useContext,
  lazy,
  memo,
  Suspense,
  useEffect as useEffect10,
  useLayoutEffect as useLayoutEffect2,
  useMemo as useMemo8,
  useRef as useRef10,
  useState as useState11
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Download as Download4,
  ExternalLink,
  FileQuestion,
  FileText,
  Pencil as Pencil2,
  PanelLeftOpen,
  MoreHorizontal as MoreHorizontal3,
  PanelRightClose,
  Save,
  X as X4
} from "lucide-react";

// src/components/graph-workspace/WorkspaceFileMenu.tsx
import { Download as Download2, RefreshCw as RefreshCw2 } from "lucide-react";
import { useEffect as useEffect7, useRef as useRef7, useState as useState8 } from "react";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
function WorkspaceFileActions({ children, metadata, path, relativePath, onDownload, onRefresh }) {
  useI18n();
  const [busy, setBusy] = useState8(false);
  const [feedback, setFeedback] = useState8(null);
  const [error, setError] = useState8(null);
  const generation = useRef7(0);
  useEffect7(() => () => {
    generation.current++;
  }, []);
  const reload = onRefresh ? async () => {
    const current = generation.current;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const result = await onRefresh();
      if (current === generation.current) setFeedback(result);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : translate("files.fileOperationFailed"));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  } : void 0;
  return /* @__PURE__ */ jsxs6("div", { className: "workspace-file-actions", role: "toolbar", "aria-label": translate("files.fileActions"), title: metadata, children: [
    children,
    reload && /* @__PURE__ */ jsx8("button", { type: "button", className: "thread-graph-editor-toolbar-button", disabled: busy, title: translate("files.reloadFile"), "aria-label": translate("files.reloadFile"), onClick: () => void reload(), children: /* @__PURE__ */ jsx8(RefreshCw2, { size: 15, className: busy ? "animate-spin motion-reduce:animate-none" : "" }) }),
    reload && error && /* @__PURE__ */ jsx8(ErrorMark, { message: error, onRetry: () => void reload() }),
    onDownload && /* @__PURE__ */ jsx8("button", { type: "button", className: "thread-graph-editor-toolbar-button", title: translate("files.downloadFile"), "aria-label": translate("files.downloadFile"), onClick: onDownload, children: /* @__PURE__ */ jsx8(Download2, { size: 15 }) }),
    /* @__PURE__ */ jsx8(CopyButton, { value: relativePath || path, label: translate("common.copyPath") }),
    feedback && /* @__PURE__ */ jsx8("span", { role: "status", className: "workspace-file-action-feedback", title: feedback, children: feedback })
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

// src/components/graph-workspace/GraphWorkspaceCards.tsx
import { jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
function WorkspaceInfoCard({
  label,
  children
}) {
  return /* @__PURE__ */ jsxs7("section", { className: "thread-workspace-card rounded-lg border p-3", children: [
    /* @__PURE__ */ jsx9("p", { className: "text-xs font-medium uppercase tracking-[0.14em] text-[var(--theme-fg-muted)]", children: label }),
    /* @__PURE__ */ jsx9("div", { className: "mt-2 text-sm text-[var(--theme-fg)]", children })
  ] });
}

// src/components/graph-workspace/GraphMoleculeViewer.tsx
import { Pause, Play } from "lucide-react";
import { useCallback as useCallback6, useEffect as useEffect8, useMemo as useMemo6, useRef as useRef8, useState as useState9 } from "react";

// src/components/graph-workspace/GraphMoleculeViewerLowerButtonGroup.tsx
import {
  AlignVerticalDistributeCenter,
  ArrowUpRight,
  Box,
  Boxes,
  Bubbles,
  CircleX,
  Eraser,
  Rotate3d,
  Send,
  Share2,
  Spline,
  Trash2 as Trash23,
  Waypoints
} from "lucide-react";

// src/components/graph-ui/ButtonGroup.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

// src/components/graph-ui/Separator.tsx
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { jsx as jsx10 } from "react/jsx-runtime";
function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...props
}) {
  return /* @__PURE__ */ jsx10(
    SeparatorPrimitive.Root,
    {
      "data-slot": "separator",
      decorative,
      orientation,
      className: cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      ),
      ...props
    }
  );
}

// src/components/graph-ui/ButtonGroup.tsx
import { jsx as jsx11 } from "react/jsx-runtime";
var buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md",
  {
    variants: {
      orientation: {
        horizontal: "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical: "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none"
      }
    },
    defaultVariants: {
      orientation: "horizontal"
    }
  }
);
function ButtonGroup({
  className,
  orientation,
  ...props
}) {
  return /* @__PURE__ */ jsx11(
    "div",
    {
      role: "group",
      "data-slot": "button-group",
      "data-orientation": orientation,
      className: cn(buttonGroupVariants({ orientation }), className),
      ...props
    }
  );
}
function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsx11(
    Separator,
    {
      "data-slot": "button-group-separator",
      orientation,
      className: cn(
        "relative !m-0 self-stretch bg-input data-[orientation=vertical]:h-auto",
        className
      ),
      ...props
    }
  );
}

// src/components/graph-workspace/GraphMoleculeViewerControls.tsx
import { jsx as jsx12, jsxs as jsxs8 } from "react/jsx-runtime";
function moleculeSlug(value) {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "molecule";
}
function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function GraphMoleculeIconButton({
  children,
  disabled,
  label,
  onClick
}) {
  return /* @__PURE__ */ jsxs8(Tooltip, { children: [
    /* @__PURE__ */ jsx12(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx12(
      Button,
      {
        type: "button",
        variant: "outline",
        size: "icon",
        className: "thread-graph-molecule-button size-8",
        disabled,
        onClick,
        title: label,
        "aria-label": label,
        children
      }
    ) }),
    /* @__PURE__ */ jsx12(TooltipContent, { children: /* @__PURE__ */ jsx12("p", { children: label }) })
  ] });
}
function GraphMoleculeButtonGroup({
  children,
  className = ""
}) {
  return /* @__PURE__ */ jsx12(ButtonGroup, { className: `thread-graph-molecule-button-group ${className}`, children });
}

// src/components/graph-workspace/GraphMoleculeViewerLowerButtonGroup.tsx
import { Fragment as Fragment5, jsx as jsx13, jsxs as jsxs9 } from "react/jsx-runtime";
function GraphMoleculeViewerLowerButtonGroup({
  cameraInfo,
  onClearSelection,
  onClearStaged,
  onSendSelection,
  onSendStaged,
  onStageSelection,
  onToggleUnitCell,
  selectedAtomLabels,
  selectedSerials,
  stagedAtoms,
  stagedMolecules,
  unitCellAvailable,
  unitCellVisible
}) {
  useI18n();
  const hasSelection = selectedSerials.length > 0;
  const hasStaged = stagedAtoms > 0;
  return /* @__PURE__ */ jsxs9(Fragment5, { children: [
    /* @__PURE__ */ jsxs9("div", { className: "flex w-full justify-between gap-2 overflow-x-auto", children: [
      /* @__PURE__ */ jsxs9(GraphMoleculeButtonGroup, { children: [
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.distance"), children: /* @__PURE__ */ jsx13(AlignVerticalDistributeCenter, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.connectivity"), children: /* @__PURE__ */ jsx13(Share2, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.angle"), children: /* @__PURE__ */ jsx13(Waypoints, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.dihedral"), children: /* @__PURE__ */ jsx13(Spline, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.addDummyAtoms"), children: /* @__PURE__ */ jsx13(Bubbles, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.deleteAtoms"), children: /* @__PURE__ */ jsx13(CircleX, { className: "size-4" }) }),
        /* @__PURE__ */ jsx13(GraphMoleculeIconButton, { label: translate("files.rotate"), children: /* @__PURE__ */ jsx13(Rotate3d, { className: "size-4" }) })
      ] }),
      /* @__PURE__ */ jsxs9(GraphMoleculeButtonGroup, { children: [
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: unitCellVisible ? translate("files.hideUnitCell") : translate("files.showUnitCell"),
            disabled: !unitCellAvailable,
            onClick: onToggleUnitCell,
            children: /* @__PURE__ */ jsx13(Boxes, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: translate("files.clearSelection"),
            disabled: !hasSelection,
            onClick: onClearSelection,
            children: /* @__PURE__ */ jsx13(Trash23, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: translate("files.sendSelection"),
            disabled: !hasSelection,
            onClick: onSendSelection,
            children: /* @__PURE__ */ jsx13(Send, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: translate("files.stageCurrentSelection"),
            disabled: !hasSelection,
            onClick: onStageSelection,
            children: /* @__PURE__ */ jsx13(Box, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: translate("files.clearStagedSelections"),
            disabled: !hasStaged,
            onClick: onClearStaged,
            children: /* @__PURE__ */ jsx13(Eraser, { className: "size-4" })
          }
        ),
        /* @__PURE__ */ jsx13(
          GraphMoleculeIconButton,
          {
            label: translate("files.sendStagedSelections"),
            disabled: !hasStaged,
            onClick: onSendStaged,
            children: /* @__PURE__ */ jsx13(ArrowUpRight, { className: "size-4" })
          }
        )
      ] })
    ] }),
    cameraInfo ? /* @__PURE__ */ jsxs9("div", { className: "thread-graph-molecule-camera", children: [
      /* @__PURE__ */ jsxs9("div", { children: [
        /* @__PURE__ */ jsx13("strong", { children: "XYZ: " }),
        "x=",
        cameraInfo.position.x.toFixed(1),
        " y=",
        cameraInfo.position.y.toFixed(1),
        " z=",
        cameraInfo.position.z.toFixed(1),
        /* @__PURE__ */ jsx13("br", {}),
        /* @__PURE__ */ jsx13("strong", { children: "Quat: " }),
        "qx=",
        cameraInfo.position.qx.toFixed(2),
        " qy=",
        cameraInfo.position.qy.toFixed(2),
        " qz=",
        cameraInfo.position.qz.toFixed(2),
        " qw=",
        cameraInfo.position.qw.toFixed(2)
      ] }),
      /* @__PURE__ */ jsx13("div", { className: "thread-graph-molecule-camera-divider" }),
      /* @__PURE__ */ jsxs9("div", { className: "flex flex-col gap-1 text-[10px]", children: [
        /* @__PURE__ */ jsxs9("div", { children: [
          translate("files.selectedAtoms"),
          " ",
          selectedSerials.length > 0 ? selectedSerials.map(
            (serial) => `${selectedAtomLabels[serial] ?? "Atom"}(${serial})`
          ).join(", ") : translate("files.none")
        ] }),
        /* @__PURE__ */ jsxs9("div", { children: [
          translate("files.staged"),
          " ",
          stagedMolecules,
          " ",
          translate("files.moleculeS"),
          " ",
          stagedAtoms,
          " ",
          translate("files.atomS")
        ] })
      ] })
    ] }) : null
  ] });
}

// src/components/graph-workspace/GraphMoleculeViewerUpperButtonGroup.tsx
import { Box as Box2, Camera, Copy as Copy2, Download as Download3, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { jsx as jsx14, jsxs as jsxs10 } from "react/jsx-runtime";
function GraphMoleculeViewerUpperButtonGroup({
  currentIndex,
  exportContent,
  moleculeId,
  onScreenshot,
  viewerRef,
  xyzContent,
  xyzFormat
}) {
  useI18n();
  const slug = moleculeSlug(moleculeId);
  async function handleCopyXYZ() {
    if (!xyzContent) {
      return;
    }
    await navigator.clipboard.writeText(xyzContent);
  }
  function handleDownloadXYZ() {
    if (!xyzContent) {
      return;
    }
    downloadTextFile(
      xyzContent,
      `${slug}_step_${currentIndex + 1}.${xyzFormat || "xyz"}`
    );
  }
  function handleDownloadAllXYZ() {
    if (!exportContent) {
      return;
    }
    downloadTextFile(exportContent, `${slug}_trajectory.${xyzFormat || "xyz"}`);
  }
  function handleZoomIn() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoom(1.2);
    viewerRef.current.render();
  }
  function handleZoomOut() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoom(0.8);
    viewerRef.current.render();
  }
  function handleReset() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoomTo();
    viewerRef.current.setCameraParameters({});
    viewerRef.current.render();
  }
  return /* @__PURE__ */ jsxs10(GraphMoleculeButtonGroup, { className: "ml-auto justify-end", children: [
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.copyCurrentStructure"),
        onClick: () => void handleCopyXYZ(),
        disabled: !xyzContent,
        children: /* @__PURE__ */ jsx14(Copy2, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.downloadCurrentStructure"),
        onClick: handleDownloadXYZ,
        disabled: !xyzContent,
        children: /* @__PURE__ */ jsx14(Download3, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.downloadFullTrajectory"),
        onClick: handleDownloadAllXYZ,
        disabled: !exportContent,
        children: /* @__PURE__ */ jsx14(Box2, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.copyScreenshot"),
        onClick: onScreenshot,
        disabled: !viewerRef.current || !xyzContent,
        children: /* @__PURE__ */ jsx14(Camera, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(ButtonGroupSeparator, { className: "thread-graph-molecule-button-divider" }),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.zoomIn"),
        onClick: handleZoomIn,
        disabled: !viewerRef.current || !xyzContent,
        children: /* @__PURE__ */ jsx14(ZoomIn, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.zoomOut"),
        onClick: handleZoomOut,
        disabled: !viewerRef.current || !xyzContent,
        children: /* @__PURE__ */ jsx14(ZoomOut, { className: "size-3.5" })
      }
    ),
    /* @__PURE__ */ jsx14(
      GraphMoleculeIconButton,
      {
        label: translate("files.resetCamera"),
        onClick: handleReset,
        disabled: !viewerRef.current || !xyzContent,
        children: /* @__PURE__ */ jsx14(RotateCcw, { className: "size-3.5" })
      }
    )
  ] });
}

// src/components/graph-workspace/load3Dmol.ts
var threeDmolPromise = null;
async function load3Dmol() {
  if (typeof window === "undefined") {
    throw new Error(translate("files.3DmolIsOnlyAvailableInABrowser"));
  }
  if (window["3Dmol"]) {
    return window["3Dmol"];
  }
  if (!threeDmolPromise) {
    threeDmolPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-pockymoe-3dmol="true"]'
      );
      const handleLoad = () => {
        if (window["3Dmol"]) {
          resolve(window["3Dmol"]);
          return;
        }
        reject(new Error(translate("files.3DmolLoadedWithoutExposingTheExpectedGlobal")));
      };
      if (existingScript) {
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
          { once: true }
        );
        return;
      }
      const script = document.createElement("script");
      script.src = "/vendor/3Dmol-min.js";
      script.async = true;
      script.dataset.pockymoe3dmol = "true";
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
        { once: true }
      );
      document.head.appendChild(script);
    });
  }
  return threeDmolPromise;
}

// src/components/graph-ui/Slider.tsx
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useMemo as useMemo5 } from "react";
import { jsx as jsx15, jsxs as jsxs11 } from "react/jsx-runtime";
function Slider({
  className,
  defaultValue,
  max = 100,
  min = 0,
  value,
  ...props
}) {
  const values = useMemo5(
    () => Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max],
    [defaultValue, max, min, value]
  );
  return /* @__PURE__ */ jsxs11(
    SliderPrimitive.Root,
    {
      "data-slot": "slider",
      ...defaultValue !== void 0 ? { defaultValue } : {},
      ...value !== void 0 ? { value } : {},
      min,
      max,
      className: cn(
        "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx15(
          SliderPrimitive.Track,
          {
            "data-slot": "slider-track",
            className: "relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
            children: /* @__PURE__ */ jsx15(
              SliderPrimitive.Range,
              {
                "data-slot": "slider-range",
                className: "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
              }
            )
          }
        ),
        Array.from({ length: values.length }, (_, index) => /* @__PURE__ */ jsx15(
          SliderPrimitive.Thumb,
          {
            "data-slot": "slider-thumb",
            className: "block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:outline-hidden focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50"
          },
          index
        ))
      ]
    }
  );
}

// src/components/graph-workspace/GraphMoleculeViewerData.ts
function normalizeFormat(format) {
  const normalized = format?.trim().toLowerCase();
  if (!normalized || normalized === "extxyz") {
    return "xyz";
  }
  return normalized;
}
function splitXyzTrajectory(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const frames = [];
  let cursor = 0;
  while (cursor < lines.length) {
    while (cursor < lines.length && lines[cursor]?.trim() === "") {
      cursor += 1;
    }
    if (cursor >= lines.length) {
      break;
    }
    const atomCount = Number.parseInt(lines[cursor]?.trim() ?? "", 10);
    if (!Number.isFinite(atomCount) || atomCount < 0) {
      return [content];
    }
    const frameLineCount = atomCount + 2;
    if (cursor + frameLineCount > lines.length) {
      return [content];
    }
    frames.push(`${lines.slice(cursor, cursor + frameLineCount).join("\n")}
`);
    cursor += frameLineCount;
  }
  return frames.length > 0 ? frames : [content];
}
function normalizeSnapshotFrames(content, format) {
  if (format !== "xyz") {
    return content;
  }
  return content.flatMap((frame) => splitXyzTrajectory(frame));
}
function joinFramesForExport(content) {
  return content.map((frame) => `${frame.replace(/\s+$/g, "")}
`).join("");
}
function readGraphMoleculeViewerData(source) {
  if (!source) {
    return {
      format: "xyz",
      frames: [],
      exportContent: ""
    };
  }
  if (typeof source === "string") {
    const frames2 = normalizeSnapshotFrames([source], "xyz");
    return {
      frames: frames2,
      format: "xyz",
      exportContent: joinFramesForExport(frames2)
    };
  }
  const format = normalizeFormat(source.format);
  const content = source.content.filter((frame) => frame.trim().length > 0);
  const frames = normalizeSnapshotFrames(content, format);
  return {
    frames,
    format,
    exportContent: joinFramesForExport(content)
  };
}

// src/components/graph-workspace/GraphMoleculeViewer.tsx
import { jsx as jsx16, jsxs as jsxs12 } from "react/jsx-runtime";
function GraphMoleculeViewer({
  className = "",
  moleculeId = null,
  onScreenshot,
  onSelectionChange,
  source,
  title = translate("files.pyMOLStylePDBCIF")
}) {
  useI18n();
  const viewerHostRef = useRef8(null);
  const viewerRef = useRef8(null);
  const modelRef = useRef8(null);
  const zoomedRef = useRef8(false);
  const unitCellPreferenceRef = useRef8(true);
  const [cameraInfo, setCameraInfo] = useState9(
    null
  );
  const [currentIndex, setCurrentIndex] = useState9(0);
  const [hoveredAtom, setHoveredAtom] = useState9(null);
  const [isPlaying, setIsPlaying] = useState9(false);
  const [selectedAtomLabels, setSelectedAtomLabels] = useState9({});
  const [selectedSerials, setSelectedSerials] = useState9([]);
  const [stagedSelections, setStagedSelections] = useState9({});
  const [unitCellAvailable, setUnitCellAvailable] = useState9(false);
  const [unitCellVisible, setUnitCellVisible] = useState9(false);
  const [viewerInitError, setViewerInitError] = useState9(null);
  const viewerData = useMemo6(() => readGraphMoleculeViewerData(source), [source]);
  const xyzArray = viewerData.frames;
  const xyzFormat = viewerData.format;
  const xyzContent = xyzArray[currentIndex] ?? null;
  const isLive = xyzArray.length > 0 && currentIndex === xyzArray.length - 1;
  const moleculeKey = moleculeId ?? "current";
  const stagedAtoms = Object.values(stagedSelections).reduce(
    (sum, atoms) => sum + atoms.length,
    0
  );
  const stagedMolecules = Object.keys(stagedSelections).length;
  useEffect8(() => {
    if (xyzArray.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex(xyzArray.length - 1);
  }, [xyzArray.length]);
  useEffect8(() => {
    if (!isPlaying || xyzArray.length <= 1) {
      return;
    }
    const interval = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= xyzArray.length - 1) {
          window.clearInterval(interval);
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 200);
    return () => window.clearInterval(interval);
  }, [isPlaying, xyzArray.length]);
  useEffect8(() => {
    const host = viewerHostRef.current;
    if (!host || viewerRef.current) {
      return;
    }
    let cancelled = false;
    try {
      const canvas = document.createElement("canvas");
      const webGl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!webGl) {
        setViewerInitError(
          translate("files.webGLIsUnavailableInThisBrowserEnvironment")
        );
        return;
      }
    } catch {
      setViewerInitError(
        translate("files.webGLIsUnavailableInThisBrowserEnvironment")
      );
      return;
    }
    const resizeViewer = () => {
      viewerRef.current?.resize();
      viewerRef.current?.render();
    };
    load3Dmol().then(($3Dmol) => {
      if (cancelled || viewerRef.current) {
        return;
      }
      try {
        const viewer = $3Dmol.createViewer(host, {});
        viewerRef.current = viewer;
        viewer.setBackgroundColor("#f8fafc", 0.8);
        window.addEventListener("resize", resizeViewer);
        window.setTimeout(resizeViewer, 100);
      } catch (error) {
        console.error("Failed to initialize 3Dmol viewer:", error);
        setViewerInitError(
          translate("files.failedToInitialize3DViewerPleaseRefresh")
        );
      }
    }).catch((error) => {
      console.error("Failed to load 3Dmol viewer runtime:", error);
      setViewerInitError(
        translate("files.failedToLoad3DViewerRuntimePlease")
      );
    });
    return () => {
      cancelled = true;
      window.removeEventListener("resize", resizeViewer);
      viewerRef.current = null;
      modelRef.current = null;
    };
  }, []);
  useEffect8(() => {
    const viewer = viewerRef.current;
    if (!viewer || !xyzContent) {
      return;
    }
    try {
      viewer.removeAllModels();
      viewer.removeAllShapes();
      viewer.removeAllLabels();
      const model = viewer.addModel(xyzContent, xyzFormat || "xyz");
      modelRef.current = model;
      model.setStyle({}, { stick: { radius: 0.2 }, sphere: { scale: 0.3 } });
      const crystalData = model.getCrystData();
      const hasUnitCell = Boolean(
        crystalData && typeof crystalData === "object" && Object.keys(crystalData).length
      );
      setUnitCellAvailable(hasUnitCell);
      setUnitCellVisible(hasUnitCell ? unitCellPreferenceRef.current : false);
      setSelectedSerials([]);
      setSelectedAtomLabels({});
      const frameAtomLabels = xyzContent.split("\n").slice(2).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/\s+/)[0] ?? "Atom");
      if (!zoomedRef.current) {
        viewer.zoomTo();
        zoomedRef.current = true;
      }
      model.setClickable(
        {},
        true,
        (atom, _viewer, event) => {
          const serial = atom.serial ?? atom.index;
          if (serial === void 0) {
            return;
          }
          const label = atom.atom || atom.elem || frameAtomLabels[serial] || "Atom";
          setSelectedSerials((previous) => {
            const isMulti = Boolean(
              event?.shiftKey || event?.metaKey || event?.ctrlKey
            );
            const next = !isMulti ? previous.length === 1 && previous[0] === serial ? [] : [serial] : previous.includes(serial) ? previous.filter((entry) => entry !== serial) : [...previous, serial];
            setSelectedAtomLabels((current) => {
              if (next.length === 0) {
                return {};
              }
              const labelsBySerial = {};
              next.forEach((entry) => {
                labelsBySerial[entry] = current[entry] || frameAtomLabels[entry] || label;
              });
              return labelsBySerial;
            });
            return next;
          });
        }
      );
      model.setHoverable(
        {},
        true,
        (atom, _viewer, event) => {
          if (!event || !atom) {
            return;
          }
          setHoveredAtom({
            x: event.clientX,
            y: event.clientY,
            label: `${atom.atom || atom.elem || "Atom"} (${atom.serial ?? atom.index ?? "?"})`,
            coords: {
              x: atom.x.toFixed(2),
              y: atom.y.toFixed(2),
              z: atom.z.toFixed(2)
            }
          });
        },
        () => setHoveredAtom(null)
      );
      viewer.render();
    } catch (error) {
      console.error("Failed to render molecule:", error);
      setViewerInitError(translate("files.unableToRenderThisMolecularStructure"));
    }
  }, [xyzContent, xyzFormat]);
  useEffect8(() => {
    const viewer = viewerRef.current;
    const model = modelRef.current;
    if (!viewer || !model) {
      return;
    }
    try {
      viewer.removeUnitCell(model);
    } catch {
    }
    if (unitCellVisible && unitCellAvailable) {
      try {
        viewer.addUnitCell(model, {
          box: { color: "black", opacity: 1, linewidth: 5 },
          astyle: { radius: 0.12, mid: 0.85, color: "red", opacity: 0.6 },
          bstyle: { radius: 0.12, mid: 0.85, color: "green", opacity: 0.6 },
          cstyle: { radius: 0.12, mid: 0.85, color: "blue", opacity: 0.6 },
          alabel: "a",
          blabel: "b",
          clabel: "c"
        });
      } catch {
        setUnitCellAvailable(false);
        setUnitCellVisible(false);
      }
    }
    viewer.render();
  }, [unitCellAvailable, unitCellVisible, xyzContent, xyzFormat]);
  useEffect8(() => {
    const viewer = viewerRef.current;
    const model = modelRef.current;
    if (!viewer || !model || !xyzContent) {
      return;
    }
    model.setStyle({}, { stick: { radius: 0.2 }, sphere: { scale: 0.3 } });
    if (selectedSerials.length > 0) {
      model.setStyle(
        { serial: selectedSerials },
        {
          stick: { radius: 0.3, color: "yellow" },
          sphere: { scale: 0.4, color: "yellow" }
        }
      );
    }
    viewer.render();
    onSelectionChange?.({ moleculeId, atoms: selectedSerials });
  }, [moleculeId, onSelectionChange, selectedSerials, xyzContent]);
  useEffect8(() => {
    if (!xyzContent) {
      return;
    }
    let animationFrame = 0;
    const tick = () => {
      const view = viewerRef.current?.getView?.();
      if (Array.isArray(view) && view.length >= 8) {
        const [x, y, z, zoom, qx, qy, qz, qw] = view;
        if (typeof x === "number" && typeof y === "number" && typeof z === "number" && typeof zoom === "number" && typeof qx === "number" && typeof qy === "number" && typeof qz === "number" && typeof qw === "number") {
          const magnitude = Math.sqrt(qx * qx + qy * qy + qz * qz);
          const lookAt = magnitude > 0 ? { x: qx / magnitude, y: qy / magnitude, z: qz / magnitude } : { x: 0, y: 0, z: 0 };
          setCameraInfo({
            position: { x, y, z, qx, qy, qz, qw },
            lookAt,
            zoom
          });
        }
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [xyzContent]);
  const handleScreenshot = useCallback6(async () => {
    const viewer = viewerRef.current;
    if (!viewer?.pngURI) {
      return;
    }
    viewer.render();
    const image = viewer.pngURI();
    if (!image) {
      return;
    }
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      const clipboardItem = new ClipboardItem({
        [blob.type || "image/png"]: blob
      });
      await navigator.clipboard.write([clipboardItem]);
    } catch {
    }
    onScreenshot?.({ moleculeId, image });
  }, [moleculeId, onScreenshot]);
  function handleToggleUnitCell() {
    if (!unitCellAvailable) {
      return;
    }
    setUnitCellVisible((previous) => {
      const next = !previous;
      unitCellPreferenceRef.current = next;
      return next;
    });
  }
  function handleStageSelection() {
    if (selectedSerials.length === 0) {
      return;
    }
    setStagedSelections((current) => {
      const existing = current[moleculeKey] ?? [];
      return {
        ...current,
        [moleculeKey]: Array.from(/* @__PURE__ */ new Set([...existing, ...selectedSerials]))
      };
    });
  }
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      className: `thread-graph-molecule-viewer flex h-full min-h-0 flex-col bg-white ${className}`,
      children: [
        /* @__PURE__ */ jsxs12("div", { className: "thread-graph-molecule-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3", children: [
          /* @__PURE__ */ jsxs12("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx16("h2", { className: "truncate text-sm font-semibold text-slate-900", children: title }),
            /* @__PURE__ */ jsx16("p", { className: "mt-1 hidden text-[11px] text-slate-400 sm:block", children: translate("files.cartoonSurface") })
          ] }),
          /* @__PURE__ */ jsx16("span", { className: "shrink-0 text-[11px] text-slate-400", children: translate("files.workspacePreview") })
        ] }),
        /* @__PURE__ */ jsxs12("div", { className: "thread-graph-molecule-body min-h-0 flex-1", children: [
          /* @__PURE__ */ jsxs12(
            "div",
            {
              ref: viewerHostRef,
              "data-testid": "molecule-viewer",
              className: "thread-graph-molecule-stage relative min-h-0 flex-1 overflow-hidden",
              children: [
                viewerInitError ? /* @__PURE__ */ jsxs12(
                  "div",
                  {
                    "data-testid": "molecule-viewer-error",
                    className: "thread-graph-molecule-empty thread-graph-molecule-failed absolute inset-0 flex items-center justify-center gap-1 p-4 text-sm text-slate-400",
                    children: [
                      /* @__PURE__ */ jsx16("span", { children: translate("files.unableToRenderThisMolecularStructure") }),
                      /* @__PURE__ */ jsx16(ErrorMark, { message: viewerInitError })
                    ]
                  }
                ) : null,
                !viewerInitError && !xyzContent ? /* @__PURE__ */ jsx16("div", { className: "thread-graph-molecule-empty absolute inset-0 flex items-center justify-center p-4 text-sm text-slate-400", children: translate("files.noMoleculeDataAvailable") }) : null,
                hoveredAtom ? /* @__PURE__ */ jsxs12(
                  "div",
                  {
                    className: "thread-graph-molecule-tooltip pointer-events-none fixed z-[1000] rounded-md border border-gray-300 bg-white/95 px-2 py-1.5 text-[10px] text-gray-800 shadow-md",
                    style: { left: hoveredAtom.x - 20, top: hoveredAtom.y - 50 },
                    children: [
                      /* @__PURE__ */ jsx16("div", { className: "mb-0.5 font-semibold text-gray-900", children: hoveredAtom.label }),
                      /* @__PURE__ */ jsxs12("div", { className: "space-x-2 text-gray-600", children: [
                        /* @__PURE__ */ jsxs12("span", { children: [
                          "x: ",
                          hoveredAtom.coords.x
                        ] }),
                        /* @__PURE__ */ jsxs12("span", { children: [
                          "y: ",
                          hoveredAtom.coords.y
                        ] }),
                        /* @__PURE__ */ jsxs12("span", { children: [
                          "z: ",
                          hoveredAtom.coords.z
                        ] })
                      ] })
                    ]
                  }
                ) : null
              ]
            }
          ),
          /* @__PURE__ */ jsxs12("div", { className: "thread-graph-molecule-controls shrink-0", children: [
            /* @__PURE__ */ jsxs12("div", { className: "thread-graph-molecule-control-row", children: [
              /* @__PURE__ */ jsxs12("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx16("p", { className: "thread-graph-molecule-control-title", children: translate("files.ballStick") }),
                /* @__PURE__ */ jsx16("p", { className: "thread-graph-molecule-control-subtitle", children: translate("files.xYZPDBCIFPreview") })
              ] }),
              /* @__PURE__ */ jsx16(
                GraphMoleculeViewerUpperButtonGroup,
                {
                  currentIndex,
                  exportContent: viewerData.exportContent,
                  moleculeId,
                  onScreenshot: () => void handleScreenshot(),
                  viewerRef,
                  xyzContent,
                  xyzFormat
                }
              )
            ] }),
            xyzArray.length > 1 ? /* @__PURE__ */ jsxs12("div", { className: "thread-graph-molecule-trajectory", children: [
              /* @__PURE__ */ jsxs12("div", { className: "mb-2 flex justify-between gap-3 text-xs", children: [
                /* @__PURE__ */ jsxs12("span", { className: "flex min-w-0 items-center gap-2", children: [
                  translate("files.trajectory"),
                  " ",
                  currentIndex + 1,
                  " / ",
                  xyzArray.length,
                  /* @__PURE__ */ jsx16(
                    Button,
                    {
                      type: "button",
                      variant: "ghost",
                      size: "icon",
                      className: "thread-graph-molecule-button h-5 w-5",
                      onClick: () => {
                        setIsPlaying((previous) => {
                          const next = !previous;
                          if (next && currentIndex === xyzArray.length - 1) {
                            setCurrentIndex(0);
                          }
                          return next;
                        });
                      },
                      "aria-label": isPlaying ? translate("files.pauseTrajectory") : translate("files.playTrajectory"),
                      title: isPlaying ? translate("files.pauseTrajectory") : translate("files.playTrajectory"),
                      children: isPlaying && currentIndex !== xyzArray.length - 1 ? /* @__PURE__ */ jsx16(Pause, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx16(Play, { className: "h-3 w-3" })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs12(
                  Button,
                  {
                    type: "button",
                    variant: "ghost",
                    onClick: () => setCurrentIndex(xyzArray.length - 1),
                    className: "thread-graph-molecule-live-button",
                    children: [
                      /* @__PURE__ */ jsx16(
                        "span",
                        {
                          className: `h-2.5 w-2.5 rounded-full ${isLive ? "animate-pulse bg-red-600" : "bg-gray-300"}`
                        }
                      ),
                      translate("files.live")
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx16(
                Slider,
                {
                  value: [currentIndex],
                  max: xyzArray.length - 1,
                  step: 1,
                  onValueChange: (value) => setCurrentIndex(value[0] ?? 0),
                  "aria-label": translate("files.trajectoryFrame")
                }
              )
            ] }) : null,
            /* @__PURE__ */ jsx16(
              GraphMoleculeViewerLowerButtonGroup,
              {
                cameraInfo,
                onClearSelection: () => setSelectedSerials([]),
                onClearStaged: () => setStagedSelections({}),
                onSendSelection: () => onSelectionChange?.({ moleculeId, atoms: selectedSerials }),
                onSendStaged: () => {
                  Object.entries(stagedSelections).forEach(([key, atoms]) => {
                    onSelectionChange?.({
                      moleculeId: key === "current" ? moleculeId : key,
                      atoms
                    });
                  });
                },
                onStageSelection: handleStageSelection,
                onToggleUnitCell: handleToggleUnitCell,
                selectedAtomLabels,
                selectedSerials,
                stagedAtoms,
                stagedMolecules,
                unitCellAvailable,
                unitCellVisible
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/components/graph-workspace/GraphDrawioPreview.tsx
import { useMemo as useMemo7 } from "react";
import { jsx as jsx17 } from "react/jsx-runtime";
var DRAWIO_VIEWER_PATH = "/vendor/drawio/viewer-static.v32.3.0.min.js";
var DRAWIO_BOOTSTRAP_PATH = "/vendor/drawio/bootstrap.v1.js";
function drawioPreviewDocument(xml, origin) {
  const viewerUrl = new URL(DRAWIO_VIEWER_PATH, origin).href;
  const bootstrapUrl = new URL(DRAWIO_BOOTSTRAP_PATH, origin).href;
  const data = JSON.stringify(xml).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${viewerUrl} ${bootstrapUrl}; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'">
<style>html,body{height:100%;margin:0;background:#fff;color:#222;font:14px system-ui;overflow:hidden}#diagram{position:absolute;inset:0;overflow:auto}#error{padding:20px;white-space:pre-wrap}button,select{font:inherit}</style>
</head><body><div id="diagram"></div><p id="loading" role="status">${translate("files.loadingDiagram")}</p><div id="error" role="alert" hidden></div>
<script id="diagram-data" type="application/json">${data}</script>
<script src="${bootstrapUrl}"></script></body></html>`;
}
function GraphDrawioPreview({ content, name, truncated: truncated2 }) {
  const { locale } = useI18n();
  const srcDoc = useMemo7(() => drawioPreviewDocument(content, typeof window === "undefined" ? "http://localhost" : window.location.origin), [content, locale]);
  if (truncated2) return /* @__PURE__ */ jsx17("p", { role: "status", className: "p-5 text-sm", children: translate("files.diagramPreviewRequiresTheCompleteFileLoad") });
  return /* @__PURE__ */ jsx17(
    "iframe",
    {
      title: translate("files.drawIoPreview", { value1: name }),
      sandbox: "allow-scripts",
      referrerPolicy: "no-referrer",
      srcDoc,
      className: "min-h-0 w-full flex-1 border-0",
      style: { minHeight: 260, background: "#fff" }
    }
  );
}

// src/components/graph-workspace/WorkspaceFileTabs.tsx
import { Circle, FileCode2 as FileCode23, X as X3 } from "lucide-react";
import { useEffect as useEffect9, useRef as useRef9, useState as useState10 } from "react";
import { jsx as jsx18, jsxs as jsxs13 } from "react/jsx-runtime";
function WorkspaceFileTabs({
  activePath,
  dirtyPaths,
  onClose,
  onSelect,
  tabs,
  trailingAction,
  leadingAction,
  onSaveAndClose,
  blockedClosePaths = /* @__PURE__ */ new Set()
}) {
  useI18n();
  const tabsRef = useRef9(null);
  const scrollEdges = useTabScrollEdges(tabsRef);
  useEffect9(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activePath, tabs.length]);
  const [pendingClosePath, setPendingClosePath] = useState10(null);
  const [savingClose, setSavingClose] = useState10(false);
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) ?? null;
  if (tabs.length === 0) {
    return null;
  }
  function requestClose(path) {
    if (dirtyPaths.has(path)) {
      setPendingClosePath(path);
      return;
    }
    onClose(path);
  }
  return /* @__PURE__ */ jsxs13("div", { className: "thread-graph-editor-tabs-shell shrink-0", children: [
    /* @__PURE__ */ jsxs13("div", { className: "workspace-file-toolbar flex min-w-0 border-b border-[var(--theme-border)]", children: [
      leadingAction && /* @__PURE__ */ jsx18("div", { className: "workspace-file-navigation flex shrink-0 items-center", children: leadingAction }),
      /* @__PURE__ */ jsxs13("div", { className: "tab-scroll-surface workspace-tab-scroll", ...scrollEdges, children: [
        /* @__PURE__ */ jsx18(
          "div",
          {
            ref: tabsRef,
            className: "thread-graph-editor-tabs flex min-w-0 flex-1 overflow-x-auto",
            role: "tablist",
            "aria-label": translate("files.openWorkspaceFiles"),
            children: tabs.map((tab) => {
              const active = tab.path === activePath;
              const dirty = dirtyPaths.has(tab.path);
              return /* @__PURE__ */ jsxs13(
                "div",
                {
                  className: `thread-graph-editor-tab group/tab flex h-8 min-w-0 max-w-52 shrink-0 items-center border-r ${active ? "is-active" : ""} ${tab.pinned ? "is-pinned" : "is-preview"}`,
                  role: "presentation",
                  children: [
                    /* @__PURE__ */ jsxs13(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": active,
                        title: tab.path,
                        onClick: () => onSelect(tab.path),
                        className: `flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left text-xs ${tab.pinned ? "" : "italic"}`,
                        children: [
                          /* @__PURE__ */ jsx18(FileCode23, { "data-icon": "code", className: "h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" }),
                          /* @__PURE__ */ jsx18(MiddleName, { name: tab.name, className: "workspace-file-tab-name" })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx18(
                      "button",
                      {
                        type: "button",
                        onClick: () => requestClose(tab.path),
                        className: "thread-graph-editor-tab-close mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                        title: translate("files.close_069e97", { value1: tab.name }),
                        "aria-label": translate("files.close_069e97", { value1: tab.name }),
                        children: dirty ? /* @__PURE__ */ jsx18(Circle, { "data-icon": "unsaved", className: "h-2.5 w-2.5 fill-current" }) : /* @__PURE__ */ jsx18(X3, { "data-icon": "close", className: "h-3.5 w-3.5" })
                      }
                    )
                  ]
                },
                tab.path
              );
            })
          }
        ),
        /* @__PURE__ */ jsx18(TabScrollButtons, { targetRef: tabsRef, edges: scrollEdges })
      ] }),
      trailingAction ? /* @__PURE__ */ jsx18("div", { className: "thread-graph-editor-tabs-action flex h-8 shrink-0 items-center px-1", children: trailingAction }) : null
    ] }),
    /* @__PURE__ */ jsx18(
      ConfirmDialog,
      {
        open: Boolean(pendingTab),
        title: pendingTab ? `${translate("files.discardUnsavedChangesIn")} ${pendingTab.name}?` : "",
        description: translate("files.safeDiscard"),
        cancelLabel: translate("files.keepEditing"),
        confirmLabel: translate("files.discard"),
        busy: savingClose,
        ...onSaveAndClose && pendingTab && !blockedClosePaths.has(pendingTab.path) ? {
          secondaryLabel: translate("files.safeSaveClose"),
          onSecondary: async () => {
            setSavingClose(true);
            try {
              await onSaveAndClose(pendingTab.path);
            } finally {
              setSavingClose(false);
              setPendingClosePath(null);
            }
          }
        } : {},
        onCancel: () => setPendingClosePath(null),
        onConfirm: () => {
          if (!pendingTab || blockedClosePaths.has(pendingTab.path)) return;
          setPendingClosePath(null);
          onClose(pendingTab.path);
        }
      }
    )
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import { Fragment as Fragment6, jsx as jsx19, jsxs as jsxs14 } from "react/jsx-runtime";
var GraphWorkspaceMonacoEditor = lazy(
  () => import("./GraphWorkspaceMonacoEditor-LENNUQ53.js")
);
var isHostFilePath = (path) => path.startsWith("/") || /^[a-z]:[\\/]/i.test(path);
function fileSizeLabel(size) {
  return size === void 0 ? null : size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function canShowInlinePdf(nav = typeof navigator === "undefined" ? void 0 : navigator) {
  return nav?.pdfViewerEnabled !== false;
}
function WorkspacePdfPreview({ src, node }) {
  useI18n();
  const name = node.name || node.path.split("/").pop() || node.path;
  if (canShowInlinePdf()) {
    return /* @__PURE__ */ jsx19("div", { className: "thread-graph-file-preview-frame min-h-0 flex-1 overflow-hidden", children: /* @__PURE__ */ jsx19("iframe", { src, title: translate("files.pDFPreview", { value1: node.path || node.name }), className: "h-full w-full border-0" }) });
  }
  const sizeLabel = fileSizeLabel(node.size);
  return /* @__PURE__ */ jsxs14("div", { className: "thread-graph-download-preview", "data-testid": "workspace-pdf-actions", children: [
    /* @__PURE__ */ jsx19(FileText, { "aria-hidden": "true", className: "thread-graph-download-preview-icon" }),
    /* @__PURE__ */ jsx19("strong", { children: name }),
    sizeLabel ? /* @__PURE__ */ jsx19("span", { children: sizeLabel }) : null,
    /* @__PURE__ */ jsx19("p", { children: translate("files.pdfOpenOrDownload") }),
    /* @__PURE__ */ jsxs14("div", { className: "thread-graph-download-preview-actions", children: [
      /* @__PURE__ */ jsxs14("a", { href: src, target: "_blank", rel: "noopener", "aria-label": translate("files.openPdfInNewTab", { value1: name }), children: [
        /* @__PURE__ */ jsx19(ExternalLink, { "aria-hidden": "true", size: 16 }),
        translate("files.openPdf")
      ] }),
      /* @__PURE__ */ jsxs14("a", { href: src, download: name, "aria-label": translate("files.download", { value1: name }), children: [
        /* @__PURE__ */ jsx19(Download4, { "aria-hidden": "true", size: 16 }),
        translate("files.downloadFile")
      ] })
    ] })
  ] });
}
function DownloadFilePreview({ node, onDownload, readOnlyReason }) {
  const { locale: i18nLocale } = useI18n();
  const [pending, setPending] = useState11(false);
  const [error, setError] = useState11(null);
  const sizeLabel = fileSizeLabel(node.size);
  return /* @__PURE__ */ jsxs14("div", { className: "thread-graph-download-preview", children: [
    /* @__PURE__ */ jsx19(Download4, { "aria-hidden": "true", className: "thread-graph-download-preview-icon" }),
    /* @__PURE__ */ jsx19("strong", { children: node.name }),
    sizeLabel ? /* @__PURE__ */ jsx19("span", { children: sizeLabel }) : null,
    /* @__PURE__ */ jsx19("p", { children: translate("files.thisFileIsAvailableToDownload") }),
    readOnlyReason ? /* @__PURE__ */ jsx19("p", { children: translateReadOnly(readOnlyReason) }) : null,
    /* @__PURE__ */ jsxs14("span", { className: "inline-flex items-center gap-1", children: [
      /* @__PURE__ */ jsxs14(
        "button",
        {
          type: "button",
          disabled: pending || !onDownload,
          "aria-label": translate("files.download", { value1: node.name }),
          onClick: async () => {
            if (!onDownload) return;
            setPending(true);
            setError(null);
            try {
              await onDownload();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : translate("files.downloadFailedPleaseTryAgain"));
            } finally {
              setPending(false);
            }
          },
          children: [
            /* @__PURE__ */ jsx19(Download4, { "aria-hidden": "true", size: 16 }),
            pending ? translate("files.downloading") : translate("files.downloadFile")
          ]
        }
      ),
      !onDownload ? /* @__PURE__ */ jsx19(ErrorMark, { kind: "unavailable", message: translate("files.downloadsAreUnavailableForThisConnection") }) : error ? /* @__PURE__ */ jsx19(ErrorMark, { message: error }) : null
    ] })
  ] });
}
function AlertDownloadButton({ name, onDownload }) {
  const [pending, setPending] = useState11(false);
  return /* @__PURE__ */ jsxs14(
    "button",
    {
      type: "button",
      className: "workspace-file-alert-download",
      disabled: pending,
      "aria-label": translate("files.download", { value1: name }),
      onClick: async () => {
        setPending(true);
        try {
          await onDownload();
        } catch {
        } finally {
          setPending(false);
        }
      },
      children: [
        /* @__PURE__ */ jsx19(Download4, { "aria-hidden": "true", size: 14 }),
        pending ? translate("files.downloading") : translate("files.downloadShort")
      ]
    }
  );
}
function translateReadOnly(reason) {
  const key = `files.safeReason.${reason}`;
  return Object.hasOwn(en, key) ? translate(key) : reason;
}
var WorkspaceDocumentDiff = lazy(() => import("./GraphWorkspaceMonacoDiff-OGVERKKR.js"));
var SMALL_TEXT_FILE_MAX_BYTES = 50 * 1024;
var SMALL_TEXT_FILE_MAX_LINES = 1e3;
var MARKDOWN_EXTENSIONS = /* @__PURE__ */ new Set(["md", "markdown"]);
var CODE_LANGUAGE_ALIASES = {
  cs: "csharp",
  jsonl: "json",
  md: "markdown",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  yml: "yaml"
};
function transparentHighlightBackground(html) {
  return html.replace(/background-color:[^;"]+;?/g, "background-color: transparent;").replace(/background:[^;"]+;?/g, "background: transparent;");
}
function resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath = "" }) {
  const raw = localFileHref(resourceUrl, typeof window === "undefined" ? void 0 : window.location.origin);
  if (!raw) return null;
  const path = raw.split("#")[0] ?? "";
  if (path.startsWith("/") || /^[a-z]:\//i.test(path)) {
    return workspaceRootPath ? relativeWorkspacePath(path, workspaceRootPath) : path.replace(/^\/+/, "");
  }
  const base = workspaceRootPath ? relativeWorkspacePath(markdownPath, workspaceRootPath) : normalizeFileSystemPath(markdownPath);
  if (base === null) return null;
  const directory = base.slice(0, Math.max(0, base.lastIndexOf("/")));
  return relativeWorkspacePath(directory ? `${directory}/${path}` : path, workspaceRootPath);
}
function resolveLinkedMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath = "" }) {
  const markdown = normalizeFileSystemPath(markdownPath);
  const prefix = /^[a-z]:\//i.exec(markdown)?.[0] ?? (markdown.startsWith("/") && !markdown.startsWith("//") ? "/" : null);
  if (!prefix || workspaceRootPath && relativeWorkspacePath(markdown, workspaceRootPath) !== null) return null;
  const raw = localFileHref(resourceUrl, typeof window === "undefined" ? void 0 : window.location.origin);
  const path = raw?.split("#")[0] ?? "";
  if (!path || path.startsWith("/") || /^[a-z]:\//i.test(path)) return null;
  const segments = [];
  const parts = markdown.slice(prefix.length).split("/");
  for (const part of [...parts.slice(0, -1), ...path.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(part);
  }
  return segments.length ? prefix + segments.join("/") : null;
}
function isSmallEditableTextFile(file) {
  return !file.truncated && file.size <= SMALL_TEXT_FILE_MAX_BYTES && file.content.split("\n").length <= SMALL_TEXT_FILE_MAX_LINES;
}
function previewTargetTitle(target) {
  if (!target) {
    return null;
  }
  return target.node.path || target.node.name || null;
}
function graphWorkspacePreviewTargetFromNode(node) {
  if (!node) {
    return null;
  }
  switch (node.kind) {
    case "live-artifact":
      return { kind: "live-molecule", node };
    case "file":
      return { kind: "workspace-file", node };
    case "artifact":
      return { kind: "artifact", node };
    case "event":
      return { kind: "event", node };
    case "meta":
      return { kind: "meta", node };
    case "directory":
      return null;
  }
}
var GraphWorkspaceCodePreview = memo(function GraphWorkspaceCodePreview2({
  content,
  focusLine,
  language = "text"
}) {
  const { locale: i18nLocale } = useI18n();
  const rootRef = useRef10(null);
  const [highlighter, setHighlighter] = useState11(null);
  const [dark, setDark] = useState11(false);
  useEffect10(() => {
    let alive = true;
    getGraphChatHighlighter().then((loadedHighlighter) => {
      if (alive) {
        setHighlighter(loadedHighlighter);
      }
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);
  useEffect10(() => {
    const shell = rootRef.current?.closest(".thread-ui-shell");
    const readDark = () => shell ? shell.getAttribute("data-theme-effective") === "dark" || shell.classList.contains("dark") || shell.classList.contains("thread-ui-theme-dark") : document.documentElement.classList.contains("dark");
    setDark(readDark());
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(() => setDark(readDark()));
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ["class", "data-theme-effective"]
    });
    return () => observer.disconnect();
  }, []);
  const syntaxTheme = syntaxThemeFor(dark, useThemeFeature("code.cssSyntaxPalette"));
  const highlightedHtml = useMemo8(() => {
    if (!highlighter) {
      return "";
    }
    const loadedLanguages = highlighter.getLoadedLanguages?.() ?? [];
    const normalizedLanguage = CODE_LANGUAGE_ALIASES[language] ?? language;
    const resolvedLanguage = loadedLanguages.includes(normalizedLanguage) ? normalizedLanguage : "text";
    try {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: resolvedLanguage,
          theme: syntaxTheme
        })
      );
    } catch {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: "text",
          theme: syntaxTheme
        })
      );
    }
  }, [content, highlighter, language, syntaxTheme]);
  useEffect10(() => {
    const root = rootRef.current;
    root?.querySelectorAll(".is-focused-line").forEach((element) => element.classList.remove("is-focused-line"));
    if (!root || !focusLine || focusLine < 1) {
      return;
    }
    const target = root.querySelector(`[data-line="${focusLine}"]`) ?? root.querySelector(`.line:nth-child(${focusLine})`);
    target?.classList.add("is-focused-line");
    target?.scrollIntoView?.({ block: "center" });
  }, [focusLine, highlightedHtml]);
  const lines = content.split("\n");
  return /* @__PURE__ */ jsx19(
    "div",
    {
      ref: rootRef,
      className: "thread-graph-code-preview min-h-0 flex-1 overflow-auto",
      role: "region",
      "aria-label": translate("files.sourceCode"),
      children: highlightedHtml ? /* @__PURE__ */ jsx19(
        "div",
        {
          className: "thread-graph-highlighted-code-preview",
          dangerouslySetInnerHTML: { __html: highlightedHtml }
        }
      ) : /* @__PURE__ */ jsx19("pre", { className: "thread-graph-plain-code-preview", children: /* @__PURE__ */ jsx19("code", { children: lines.map((line, index) => /* @__PURE__ */ jsxs14(
        "span",
        {
          className: `thread-graph-code-line ${focusLine === index + 1 ? "is-focused-line" : ""}`,
          "data-line": index + 1,
          children: [
            /* @__PURE__ */ jsx19(
              "span",
              {
                className: "thread-graph-code-line-number",
                "aria-hidden": "true",
                children: index + 1
              }
            ),
            /* @__PURE__ */ jsx19("span", { children: line || " " })
          ]
        },
        index
      )) }) })
    }
  );
});
var MarkdownResourceContext = createContext({ markdownPath: "" });
function markdownResourcePath(markdownPath, resourceUrl, workspaceRootPath = "") {
  return resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath }) ?? resolveLinkedMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath });
}
var workspaceMarkdownComponents = {
  a({ href, children: originalChildren, node: _node, ...props }) {
    const { markdownPath, workspaceRootPath, onOpenWorkspaceFile } = useContext(MarkdownResourceContext);
    const children = /* @__PURE__ */ jsx19(MarkdownImageLinkContext.Provider, { value: true, children: originalChildren });
    const workspacePath = href ? markdownResourcePath(markdownPath, href, workspaceRootPath) : null;
    if (workspacePath && onOpenWorkspaceFile) {
      return /* @__PURE__ */ jsx19(WorkspaceFileLink, { path: workspacePath, onOpen: ({ path }) => onOpenWorkspaceFile(path), children });
    }
    return /* @__PURE__ */ jsx19("a", { ...props, ...externalLinkProps(href), href, children });
  },
  img({ src, alt, ...props }) {
    const { markdownPath, workspaceRootPath, resolveWorkspaceFileUrl } = useContext(MarkdownResourceContext);
    const workspacePath = src ? markdownResourcePath(markdownPath, src, workspaceRootPath) : null;
    const resolvedSrc = workspacePath ? resolveWorkspaceFileUrl?.(workspacePath) ?? src : src;
    return resolvedSrc ? /* @__PURE__ */ jsx19(
      ZoomableImage,
      {
        src: resolvedSrc,
        alt: alt ?? "",
        loading: "lazy",
        className: props.className,
        width: props.width,
        height: props.height
      }
    ) : null;
  }
};
var GraphWorkspaceMarkdownPreview = memo(
  function GraphWorkspaceMarkdownPreview2({
    content,
    markdownPath,
    readingPositions,
    onOpenWorkspaceFile,
    resolveWorkspaceFileUrl,
    workspaceRootPath
  }) {
    const { locale: i18nLocale } = useI18n();
    const scrollRef = useRef10(null);
    const lastScrollTop = useRef10(0);
    useLayoutEffect2(() => {
      const element = scrollRef.current;
      if (!element) return;
      const target = readingPositions?.get(markdownPath) ?? 0;
      lastScrollTop.current = target;
      let restoring = true;
      const restore = () => {
        if (restoring) element.scrollTop = target;
      };
      restore();
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(restore);
      if (element.firstElementChild) observer?.observe(element.firstElementChild);
      const stop = () => {
        restoring = false;
        observer?.disconnect();
      };
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) element.addEventListener(type, stop, { passive: true });
      element.addEventListener("load", restore, true);
      return () => {
        readingPositions?.set(markdownPath, lastScrollTop.current);
        observer?.disconnect();
        for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) element.removeEventListener(type, stop);
        element.removeEventListener("load", restore, true);
      };
    }, [markdownPath, readingPositions]);
    return /* @__PURE__ */ jsx19("div", { ref: scrollRef, onScroll: (event) => {
      lastScrollTop.current = event.currentTarget.scrollTop;
      readingPositions?.set(markdownPath, lastScrollTop.current);
    }, className: "thread-graph-markdown thread-graph-markdown-preview min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-7 sm:py-6", children: /* @__PURE__ */ jsx19("div", { className: "thread-graph-markdown-document", children: /* @__PURE__ */ jsx19(MarkdownResourceContext.Provider, { value: { markdownPath, workspaceRootPath, onOpenWorkspaceFile, resolveWorkspaceFileUrl }, children: /* @__PURE__ */ jsx19(
      ReactMarkdown,
      {
        urlTransform: (url) => localFileHref(url, typeof window === "undefined" ? void 0 : window.location.origin) ? url : defaultUrlTransform(url),
        remarkPlugins: [remarkGfm],
        rehypePlugins: [...markdownHtmlPlugins],
        components: workspaceMarkdownComponents,
        children: content
      }
    ) }) }) });
  }
);
function MissingLinkedFile({ path }) {
  const [copied, setCopied] = useState11(false);
  const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) || path;
  return /* @__PURE__ */ jsxs14("div", { className: "workspace-missing-file", role: "status", children: [
    /* @__PURE__ */ jsx19(FileQuestion, { className: "workspace-missing-file-icon", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx19("p", { className: "workspace-missing-file-title", children: translate("files.linkMissingTitle", { name }) }),
    /* @__PURE__ */ jsx19("p", { className: "workspace-missing-file-hint", children: translate("files.linkMissingHint") }),
    /* @__PURE__ */ jsx19("code", { className: "workspace-missing-file-path", children: path }),
    /* @__PURE__ */ jsx19("button", { type: "button", className: "workspace-missing-file-copy", onClick: () => {
      void navigator.clipboard?.writeText(path).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }, () => void 0);
    }, children: copied ? translate("files.copied") : translate("files.copyPathShort") })
  ] });
}
function GraphWorkspacePreviewPane({
  activeFilePath,
  dirtyFilePaths = /* @__PURE__ */ new Set(),
  error,
  missingPath = null,
  fileTabs = [],
  focusLine,
  downloadOnly,
  downloadReason = null,
  onDownloadFile,
  imageUrl,
  loadingMore,
  documents,
  resourceScopeKey,
  canSaveDocument,
  onSaveAndClose,
  onReturnToFiles,
  onCloseFileTab,
  onDirtyChange,
  mobileNavigation = false,
  readingPositions,
  onNavigateBack,
  previousFilePath,
  onNavigateForward,
  onExpandExplorer,
  onOpenWorkspaceFile,
  onLoadMore,
  onSelectFileTab,
  onCollapse,
  pdfUrl,
  previewFile,
  previewLoading,
  plugins,
  resolveWorkspaceFileUrl,
  selectedTarget,
  workspaceRootPath
}) {
  const { locale: i18nLocale } = useI18n();
  const filePanel = useFilePanel();
  const surfaceRef = useRef10(null);
  const document2 = previewFile ? documents?.documents.get(previewFile.path) : void 0;
  const editing = document2?.editing ?? false;
  const draftContent = document2?.content ?? previewFile?.content ?? "";
  const saving = document2?.phase === "saving";
  const saveError = document2?.error;
  const setDraftContent = (content) => {
    if (previewFile) documents?.change(previewFile.path, content);
  };
  const setEditing = (value) => {
    if (previewFile) documents?.setEditing(previewFile.path, value);
  };
  const actionTrigger = useRef10(null);
  const [actionsOpen, setActionsOpen] = useState11(false);
  const [showConflict, setShowConflict] = useState11(true);
  const [diffMode, setDiffMode] = useState11("draftDisk");
  const [markdownView, setMarkdownView] = useState11(
    "preview"
  );
  const [compactViewer, setCompactViewer] = useState11(
    () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(max-width: 639px)").matches
  );
  const [dark, setDark] = useState11(false);
  const activeNode = selectedTarget?.node ?? null;
  const renderedArtifact = activeNode?.artifact ? plugins.renderArtifact({
    artifact: activeNode.artifact,
    expanded: true,
    onToggleExpanded: () => void 0
  }) : null;
  const moleculeSnapshot = buildMoleculePreviewSnapshot(previewFile ?? null);
  const fileLanguage = previewFile?.language || languageForPath(previewFile?.path ?? "");
  const extension = previewFile ? extensionOf(previewFile.path) : "";
  const isMarkdownFile = MARKDOWN_EXTENSIONS.has(extension);
  const isDrawioFile = isDrawioPath(previewFile?.path ?? "");
  const renderedViewLabel = isDrawioFile ? translate("files.diagram") : "Markdown";
  const title = previewTargetTitle(selectedTarget);
  const canEditFile = Boolean(previewFile && canSaveDocument && document2 && !document2.snapshot.readOnlyReason && document2.snapshot.contentHash) && !(previewFile && MOLECULAR_EXTENSIONS.has(extension)) && isSmallEditableTextFile(previewFile);
  const isLiveArtifactPreview = selectedTarget?.kind === "live-molecule";
  const isArtifactPreview = Boolean(activeNode?.artifact && renderedArtifact);
  const isMoleculePreview = Boolean(moleculeSnapshot) || isArtifactPreview;
  useEffect10(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setCompactViewer(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);
  useEffect10(() => {
    const shell = surfaceRef.current?.closest(".thread-ui-shell");
    const update = () => setDark(
      shell?.getAttribute("data-theme-effective") === "dark" || shell?.classList.contains("dark") || shell?.classList.contains("thread-ui-theme-dark") || false
    );
    update();
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(update);
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ["class", "data-theme-effective"]
    });
    return () => observer.disconnect();
  }, []);
  useEffect10(() => {
    setMarkdownView("preview");
    setShowConflict(true);
    setDiffMode("draftDisk");
    setActionsOpen(false);
  }, [activeNode?.path]);
  useEffect10(() => {
    if (!actionsOpen) return;
    const escape = (event) => {
      if (event.key !== "Escape" || event.target instanceof HTMLElement && event.target.closest(".monaco-editor")) return;
      event.preventDefault();
      event.stopPropagation();
      setActionsOpen(false);
      actionTrigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [actionsOpen]);
  async function handleSaveFile() {
    if (previewFile) await documents?.save(previewFile.path);
  }
  const fileToolbar = previewFile && (isMarkdownFile || isDrawioFile || canEditFile) ? /* @__PURE__ */ jsxs14("div", { className: "flex shrink-0 items-center gap-1", children: [
    (isMarkdownFile || isDrawioFile) && !editing ? /* @__PURE__ */ jsx19("button", { type: "button", className: "thread-graph-editor-toolbar-button workspace-mobile-view-toggle", "aria-label": translate(markdownView === "preview" ? "files.source" : "files.preview", { value1: renderedViewLabel }), title: translate(markdownView === "preview" ? "files.source" : "files.preview", { value1: renderedViewLabel }), onClick: () => setMarkdownView((view) => view === "preview" ? "source" : "preview"), children: markdownView === "preview" ? /* @__PURE__ */ jsx19(Code2, { "data-icon": "source", size: 16 }) : /* @__PURE__ */ jsx19(BookOpen, { "data-icon": "preview", size: 16 }) }) : null,
    canEditFile ? /* @__PURE__ */ jsx19("div", { className: "flex shrink-0 items-center gap-0.5", children: editing ? /* @__PURE__ */ jsxs14(Fragment6, { children: [
      /* @__PURE__ */ jsx19(
        "button",
        {
          type: "button",
          onClick: async () => {
            if (document2 && isProtected(document2) && !await confirmAsync({ title: translate("files.safeDiscardTitle"), description: translate("files.safeDiscard"), confirmLabel: translate("files.safeDiscardAction") })) return;
            setDraftContent(document2?.baseContent ?? previewFile.content);
            setEditing(false);
          },
          disabled: saving || document2?.phase === "unknown",
          className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40",
          title: translate("files.cancelEdits"),
          "aria-label": translate("files.cancelEdits"),
          children: /* @__PURE__ */ jsx19(X4, { "data-icon": "close", className: "h-3.5 w-3.5" })
        }
      ),
      /* @__PURE__ */ jsx19(
        "button",
        {
          type: "button",
          onClick: () => void handleSaveFile(),
          disabled: saving || document2?.phase === "unknown" || draftContent === document2?.baseContent,
          className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40",
          title: translate("files.saveFile"),
          "aria-label": translate("files.saveFile"),
          children: /* @__PURE__ */ jsx19(Save, { "data-icon": "save", className: "h-3.5 w-3.5" })
        }
      )
    ] }) : /* @__PURE__ */ jsx19(
      "button",
      {
        type: "button",
        onClick: () => {
          setMarkdownView("source");
          setEditing(true);
        },
        className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition",
        title: translate("files.editFile"),
        "aria-label": translate("files.editFile"),
        children: /* @__PURE__ */ jsx19(Pencil2, { "data-icon": "edit", className: "h-3.5 w-3.5" })
      }
    ) }) : null
  ] }) : null;
  const documentState = document2 ? translate(document2.snapshot.readOnlyReason ? "files.safeReadOnly" : document2.needsVerification && document2.phase === "clean" ? "files.safeAdoptedSnapshot" : `files.safePhase.${document2.phase}`, { reason: document2.snapshot.readOnlyReason ? translateReadOnly(document2.snapshot.readOnlyReason) : "" }) : null;
  const documentMetadata = document2 ? `${documentState} \xB7 ${document2.snapshot.encoding === "utf-8" ? "UTF-8" : translate("files.safeUnknownEncoding")}${document2.snapshot.bom ? " BOM" : ""} \xB7 ${document2.snapshot.eol.toUpperCase()}` : void 0;
  const inlineStatus = document2 && /* @__PURE__ */ jsx19("span", { role: "status", "data-testid": "workspace-document-status", className: "sr-only", "data-phase": document2.phase, children: documentState });
  const backLabel = previousFilePath ? translate("files.backToDocument", { name: previousFilePath.split("/").pop() ?? previousFilePath }) : translate("workbench.goBack");
  const navigationControls = /* @__PURE__ */ jsx19(Fragment6, { children: onNavigateForward && /* @__PURE__ */ jsx19("button", { type: "button", onClick: onNavigateForward, "aria-label": translate("files.goForward"), title: translate("files.goForward"), className: "thread-graph-editor-toolbar-button flex h-6 w-6 shrink-0 items-center justify-center rounded", children: /* @__PURE__ */ jsx19(ArrowRight, { "data-icon": "forward", size: 14 }) }) });
  const copyPath = activeNode?.path && !/^(?:\/|[a-z]:[\\/])/i.test(activeNode.path) && workspaceRootPath ? `${workspaceRootPath.replace(/[\\/]+$/, "")}/${activeNode.path}` : activeNode?.path ?? "";
  const fileActions = activeNode && /* @__PURE__ */ jsxs14(
    WorkspaceFileActions,
    {
      path: copyPath,
      relativePath: workspaceRootPath ? relativeWorkspacePath(copyPath, workspaceRootPath) : null,
      ...documentMetadata || filePanel?.label ? { metadata: [filePanel?.label, documentMetadata].filter(Boolean).join(" \xB7 ") } : {},
      ...document2 ? { onDownload: () => {
        if (!isProtected(document2) && onDownloadFile) void onDownloadFile();
        else downloadDraft(document2);
      }, onRefresh: async () => {
        const previous = document2.snapshot.contentHash;
        await documents?.checkDisk(document2.snapshot.path);
        const current = documents?.documents.get(document2.snapshot.path);
        if (current?.error) throw new Error(current.error);
        return translate(current?.phase === "conflict" ? "files.safePhase.conflict" : current?.snapshot.contentHash === previous ? "files.fileAlreadyCurrent" : "files.fileReloaded");
      } } : onDownloadFile ? { onDownload: () => void onDownloadFile() } : {},
      children: [
        fileToolbar,
        inlineStatus,
        navigationControls
      ]
    },
    activeNode.path
  );
  const viewerPaneToggle = onExpandExplorer ? /* @__PURE__ */ jsx19(
    "button",
    {
      type: "button",
      onClick: onExpandExplorer,
      "data-testid": "expand-explorer",
      className: "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
      title: translate("files.showExplorer"),
      "aria-label": translate("files.showExplorer"),
      children: /* @__PURE__ */ jsx19(PanelLeftOpen, { "data-icon": "expand-explorer", className: "h-3.5 w-3.5" })
    }
  ) : onCollapse ? /* @__PURE__ */ jsx19(
    "button",
    {
      type: "button",
      onClick: onCollapse,
      "data-testid": "collapse-viewer",
      className: "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
      title: translate("files.hideEditor"),
      "aria-label": translate("files.hideEditor"),
      children: /* @__PURE__ */ jsx19(PanelRightClose, { "data-icon": "collapse-viewer", className: "h-3.5 w-3.5" })
    }
  ) : null;
  const previewNavigation = (onNavigateBack || onReturnToFiles || onExpandExplorer) && /* @__PURE__ */ jsx19("button", { type: "button", className: "workspace-preview-back", onClick: onNavigateBack ?? onReturnToFiles ?? onExpandExplorer, "aria-label": onNavigateBack ? backLabel : translate("files.backToFiles"), title: onNavigateBack ? backLabel : translate("files.backToFiles"), "data-testid": "expand-explorer", children: /* @__PURE__ */ jsx19(ArrowLeft, { "data-icon": "back", size: 18 }) });
  const failureMarks = error || saveError ? /* @__PURE__ */ jsxs14(Fragment6, { children: [
    error ? /* @__PURE__ */ jsx19(ErrorMark, { message: translateReadOnly(error) }) : null,
    saveError && saveError !== error ? /* @__PURE__ */ jsx19(ErrorMark, { message: saveError }) : null,
    error && onDownloadFile && selectedTarget?.kind === "workspace-file" ? /* @__PURE__ */ jsx19(AlertDownloadButton, { name: selectedTarget.node.name, onDownload: onDownloadFile }) : null
  ] }) : null;
  const fileHeaderShown = fileTabs.length === 0 || Boolean(onCloseFileTab && onSelectFileTab);
  const previewActions = /* @__PURE__ */ jsxs14(Fragment6, { children: [
    failureMarks,
    /* @__PURE__ */ jsx19("button", { ref: actionTrigger, type: "button", className: "thread-graph-editor-toolbar-button workspace-file-more", "aria-label": translate("files.fileActions"), title: translate("files.fileActions"), "aria-expanded": actionsOpen, onClick: () => setActionsOpen((open) => !open), children: /* @__PURE__ */ jsx19(MoreHorizontal3, { "data-icon": "more", size: 18 }) })
  ] });
  return /* @__PURE__ */ jsxs14(
    "section",
    {
      ref: surfaceRef,
      className: "thread-graph-viewer flex h-full min-h-0 flex-col overflow-hidden rounded-md",
      "data-preview-target-kind": selectedTarget?.kind ?? "none",
      children: [
        !mobileNavigation && selectedTarget?.kind !== "workspace-file" ? /* @__PURE__ */ jsxs14("div", { className: "thread-graph-viewer-header flex h-9 shrink-0 items-center justify-between gap-2 border-b px-2.5", children: [
          /* @__PURE__ */ jsx19("span", { className: "min-w-0 truncate text-xs font-medium text-[var(--theme-fg)]", children: title ?? translate("files.preview_f1fbb2") }),
          viewerPaneToggle
        ] }) : null,
        fileTabs.length === 0 && /* @__PURE__ */ jsxs14("div", { className: "workspace-file-toolbar flex min-h-9 shrink-0 items-center justify-between border-b px-1", children: [
          /* @__PURE__ */ jsx19("div", { className: "workspace-file-navigation flex items-center", children: previewNavigation }),
          /* @__PURE__ */ jsx19("span", { className: "min-w-0 flex-1 truncate text-xs", title: filePanel?.label, children: title }),
          /* @__PURE__ */ jsx19("div", { className: "flex shrink-0 items-center", children: previewActions })
        ] }),
        fileTabs.length > 0 && onCloseFileTab && onSelectFileTab ? /* @__PURE__ */ jsx19(
          WorkspaceFileTabs,
          {
            activePath: activeFilePath ?? null,
            dirtyPaths: dirtyFilePaths,
            onClose: onCloseFileTab,
            onSelect: onSelectFileTab,
            tabs: fileTabs,
            ...onSaveAndClose ? { onSaveAndClose } : {},
            blockedClosePaths: new Set([...documents?.documents ?? []].filter(([, doc]) => ["saving", "unknown"].includes(doc.phase)).map(([path]) => path)),
            leadingAction: previewNavigation,
            trailingAction: previewActions
          }
        ) : null,
        actionsOpen && fileActions,
        /* @__PURE__ */ jsxs14("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [
          failureMarks && !fileHeaderShown ? /* @__PURE__ */ jsx19("div", { className: "workspace-file-alert flex shrink-0 items-center justify-end gap-2 border-b border-[var(--theme-border)] px-3 py-1", children: failureMarks }) : null,
          !selectedTarget && missingPath ? /* @__PURE__ */ jsx19(MissingLinkedFile, { path: missingPath }) : !selectedTarget ? /* @__PURE__ */ jsx19("div", { className: "flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500", children: translate("files.pickALiveMoleculeWorkspaceFileArtifact") }) : selectedTarget.kind === "workspace-file" && previewLoading ? /* @__PURE__ */ jsx19("div", { className: "flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500", children: translate("files.loadingFilePreview") }) : selectedTarget.kind === "workspace-file" && downloadOnly ? /* @__PURE__ */ jsx19(DownloadFilePreview, { node: selectedTarget.node, onDownload: onDownloadFile, ...downloadReason ? { readOnlyReason: downloadReason } : activeFilePath && documents?.documents.get(activeFilePath)?.snapshot.readOnlyReason ? { readOnlyReason: documents.documents.get(activeFilePath).snapshot.readOnlyReason } : {} }, selectedTarget.node.path) : selectedTarget.kind === "workspace-file" && moleculeSnapshot ? /* @__PURE__ */ jsx19("div", { className: "thread-graph-molecule-preview min-h-0 flex-1 overflow-hidden", children: /* @__PURE__ */ jsx19(
            GraphMoleculeViewer,
            {
              source: moleculeSnapshot,
              moleculeId: moleculeSnapshot.uuid ?? selectedTarget.node.path,
              title: translate("files.pyMOLStylePDBCIF")
            }
          ) }) : selectedTarget.kind === "workspace-file" && imageUrl ? /* @__PURE__ */ jsx19(WorkspaceImagePreview, { src: imageUrl, alt: selectedTarget.node.path || selectedTarget.node.name }, imageUrl) : selectedTarget.kind === "workspace-file" && pdfUrl ? /* @__PURE__ */ jsx19(WorkspacePdfPreview, { src: pdfUrl, node: selectedTarget.node }, pdfUrl) : selectedTarget.kind === "workspace-file" && previewFile ? /* @__PURE__ */ jsxs14("div", { className: "flex min-h-0 flex-1 flex-col", children: [
            document2 && (document2.snapshot.readOnlyReason || ["conflict", "unknown", "error"].includes(document2.phase)) ? /* @__PURE__ */ jsxs14("div", { className: "workspace-document-status", role: "status", children: [
              /* @__PURE__ */ jsxs14("span", { children: [
                document2.snapshot.readOnlyReason ? translate("files.safeReadOnly", { reason: translateReadOnly(document2.snapshot.readOnlyReason) }) : translate(document2.needsVerification && document2.phase === "clean" ? "files.safeAdoptedSnapshot" : `files.safePhase.${document2.phase}`),
                " \xB7 ",
                document2.snapshot.encoding === "utf-8" ? "UTF-8" : translate("files.safeUnknownEncoding"),
                document2.snapshot.bom ? " BOM" : "",
                " \xB7 ",
                document2.snapshot.eol.toUpperCase(),
                " \xB7 r",
                document2.revision
              ] }),
              /* @__PURE__ */ jsxs14("div", { className: "workspace-document-actions", children: [
                document2.phase === "unknown" ? /* @__PURE__ */ jsx19("button", { type: "button", onClick: () => void documents?.reconcile(document2.snapshot.path), children: translate("files.safeVerifySave") }) : null,
                document2.phase === "unknown" && document2.conflict ? /* @__PURE__ */ jsx19("button", { type: "button", disabled: document2.operationPending, onClick: async () => {
                  if (await confirmAsync({ title: translate("files.safeUseCheckedBase"), description: translate("files.safeManualRebase"), confirmLabel: translate("files.safeUseCheckedBase") })) documents?.acceptVerifiedDisk(document2.snapshot.path);
                }, children: translate("files.safeUseCheckedBase") }) : null,
                document2.phase === "conflict" && !showConflict ? /* @__PURE__ */ jsx19("button", { type: "button", onClick: () => setShowConflict(true), children: translate("files.safeViewConflict") }) : null
              ] })
            ] }) : !document2 && canSaveDocument ? /* @__PURE__ */ jsx19("div", { className: "workspace-document-status", children: translate(isHostFilePath(previewFile.path) ? "files.linkedFileReadOnly" : "files.safeUnavailable") }) : null,
            document2 && (document2.phase === "conflict" || document2.phase === "unknown" && document2.conflict) && showConflict ? /* @__PURE__ */ jsxs14("div", { className: "workspace-document-conflict", "data-testid": "workspace-document-conflict", children: [
              /* @__PURE__ */ jsx19("strong", { children: translate(document2.phase === "unknown" ? "files.safePhase.unknown" : "files.safeConflictTitle") }),
              /* @__PURE__ */ jsx19("p", { children: translate(document2.phase === "unknown" ? "files.safeUnknown" : document2.conflictFrom === "check" ? "files.safeChangedBody" : "files.safeConflictBody") }),
              /* @__PURE__ */ jsxs14("div", { className: "workspace-document-actions", children: [
                /* @__PURE__ */ jsx19("button", { type: "button", onClick: () => setShowConflict(false), children: translate("files.safeKeepDraft") }),
                /* @__PURE__ */ jsx19("button", { type: "button", disabled: document2.phase === "unknown" || document2.conflict?.content == null, onClick: async () => {
                  const revision = document2.revision;
                  if (await confirmAsync({ title: translate("files.safeAdoptDisk"), description: translate("files.safeDiscard"), confirmLabel: translate("files.safeAdoptDisk") })) documents?.adoptDisk(document2.snapshot.path, revision);
                }, children: translate("files.safeAdoptDisk") }),
                /* @__PURE__ */ jsx19("button", { type: "button", disabled: document2.phase === "unknown" || !document2.conflict?.contentHash || Boolean(document2.conflict.readOnlyReason), onClick: async () => {
                  if (await confirmAsync({ title: translate("files.safeOverwriteShown"), description: translate("files.safeOverwriteConfirm"), confirmLabel: translate("files.safeOverwriteShown") })) void documents?.save(document2.snapshot.path, true);
                }, children: translate("files.safeOverwriteShown") }),
                /* @__PURE__ */ jsx19("button", { type: "button", disabled: document2.conflict?.content == null, onClick: () => downloadDraft(document2, true), children: translate("files.safeDownloadDisk") })
              ] }),
              document2.conflict?.content != null ? /* @__PURE__ */ jsxs14(Fragment6, { children: [
                /* @__PURE__ */ jsxs14("label", { children: [
                  translate("files.safeCompare"),
                  " ",
                  /* @__PURE__ */ jsxs14("select", { value: diffMode, onChange: (e) => setDiffMode(e.target.value), children: [
                    /* @__PURE__ */ jsx19("option", { value: "draftDisk", children: translate("files.safeDraftDisk") }),
                    /* @__PURE__ */ jsx19("option", { value: "baseDraft", children: translate("files.safeBaseDraft") }),
                    /* @__PURE__ */ jsx19("option", { value: "baseDisk", children: translate("files.safeBaseDisk") })
                  ] })
                ] }),
                /* @__PURE__ */ jsx19("div", { className: "workspace-document-diff", children: /* @__PURE__ */ jsx19(Suspense, { fallback: /* @__PURE__ */ jsx19("span", { children: translate("files.loadingEditor") }), children: /* @__PURE__ */ jsx19(
                  WorkspaceDocumentDiff,
                  {
                    original: diffMode === "draftDisk" ? document2.content : document2.baseContent,
                    modified: diffMode === "baseDraft" ? document2.content : document2.conflict.content,
                    language: fileLanguage,
                    dark,
                    compact: compactViewer
                  }
                ) }) }),
                /* @__PURE__ */ jsxs14("p", { className: "workspace-document-snapshot", children: [
                  translate("files.safeFixedSnapshot"),
                  " \xB7 ",
                  document2.conflict.contentHash?.slice(0, 23)
                ] })
              ] }) : /* @__PURE__ */ jsx19("p", { children: translate("files.safeMissing") })
            ] }) : null,
            editing && compactViewer ? /* @__PURE__ */ jsx19(
              "textarea",
              {
                value: draftContent,
                onChange: (event) => setDraftContent(event.currentTarget.value),
                spellCheck: false,
                "aria-label": translate("files.workspaceFileEditor"),
                className: "thread-graph-file-editor min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-5 text-slate-900 outline-none dark:text-slate-100"
              }
            ) : isDrawioFile && markdownView === "preview" && !editing ? /* @__PURE__ */ jsx19(GraphDrawioPreview, { content: previewFile.content, name: previewFile.name, truncated: previewFile.truncated }) : isMarkdownFile && markdownView === "preview" && !editing ? /* @__PURE__ */ jsx19(
              GraphWorkspaceMarkdownPreview,
              {
                content: previewFile.content,
                markdownPath: previewFile.path,
                ...readingPositions ? { readingPositions } : {},
                ...onOpenWorkspaceFile ? { onOpenWorkspaceFile } : {},
                ...resolveWorkspaceFileUrl ? { resolveWorkspaceFileUrl } : {},
                ...workspaceRootPath ? { workspaceRootPath } : {}
              },
              previewFile.path
            ) : compactViewer ? /* @__PURE__ */ jsx19(
              GraphWorkspaceCodePreview,
              {
                content: previewFile.content,
                focusLine,
                language: fileLanguage
              }
            ) : /* @__PURE__ */ jsx19(
              Suspense,
              {
                fallback: /* @__PURE__ */ jsx19("div", { className: "flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--theme-fg-muted)]", children: translate("files.loadingEditor") }),
                children: /* @__PURE__ */ jsx19(
                  GraphWorkspaceMonacoEditor,
                  {
                    resourceKey: document2?.key ?? `${resourceScopeKey}:${previewFile.path}`,
                    retainModel: Boolean(document2),
                    content: editing ? draftContent : previewFile.content,
                    dark,
                    focusLine,
                    language: fileLanguage,
                    onChange: setDraftContent,
                    onSave: () => void handleSaveFile(),
                    path: previewFile.path,
                    readOnly: !editing
                  },
                  document2?.key ?? `${resourceScopeKey}:${previewFile.path}`
                )
              }
            ),
            previewFile.truncated && !onLoadMore ? /* @__PURE__ */ jsx19("div", { className: "workspace-document-status", children: translate("files.safeFirstPreview") }) : null,
            previewFile.truncated && onLoadMore ? /* @__PURE__ */ jsx19("div", { className: "thread-graph-file-preview-footer flex justify-center border-t px-4 py-3", children: /* @__PURE__ */ jsx19(
              "button",
              {
                type: "button",
                onClick: onLoadMore,
                disabled: loadingMore,
                title: translate("files.loadMoreWorkspacePreview"),
                "aria-label": translate("files.loadMoreWorkspacePreview"),
                className: "thread-graph-load-more-button rounded-md px-4 py-1.5 text-xs disabled:opacity-50",
                children: loadingMore ? translate("files.loading") : translate("files.loadMoreBytesRemaining", { value1: (previewFile.size - previewFile.nextOffset).toLocaleString(getLocale()) })
              }
            ) }) : null
          ] }) : (selectedTarget.kind === "live-molecule" || selectedTarget.kind === "artifact") && selectedTarget.node.artifact ? /* @__PURE__ */ jsx19(
            "div",
            {
              className: isMoleculePreview || isLiveArtifactPreview ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto p-3",
              children: renderedArtifact
            }
          ) : selectedTarget.kind === "meta" ? /* @__PURE__ */ jsx19("div", { className: "min-h-0 flex-1 overflow-auto p-3", children: /* @__PURE__ */ jsx19("div", { className: "grid gap-3", children: /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.workspaceData"), children: /* @__PURE__ */ jsx19(
            GraphWorkspaceCodePreview,
            {
              content: selectedTarget.node.detail ?? ""
            }
          ) }) }) }) : /* @__PURE__ */ jsxs14("div", { className: "flex min-h-0 flex-1 flex-col", children: [
            /* @__PURE__ */ jsx19("div", { className: "thread-graph-file-preview-header border-b px-4 py-3 text-xs uppercase tracking-[0.12em]", children: selectedTarget.node.kind }),
            /* @__PURE__ */ jsx19(
              GraphWorkspaceCodePreview,
              {
                content: selectedTarget.node.detail ?? selectedTarget.node.preview ?? selectedTarget.node.name
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/components/graph-workspace/GraphEmptyGarbageDialog.tsx
import { jsx as jsx20, jsxs as jsxs15 } from "react/jsx-runtime";
function GraphEmptyGarbageDialog({
  files,
  onCancel,
  onConfirm
}) {
  useI18n();
  return /* @__PURE__ */ jsx20("div", { className: "thread-graph-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4", children: /* @__PURE__ */ jsxs15("div", { className: "thread-graph-dialog w-full max-w-sm rounded-xl border bg-[var(--theme-panel)] p-6 shadow-xl", children: [
    /* @__PURE__ */ jsx20("h3", { className: "text-base font-semibold text-[var(--theme-fg)]", children: translate("files.emptyGarbage") }),
    /* @__PURE__ */ jsxs15("p", { className: "mt-1 text-sm leading-5 text-[var(--theme-fg-muted)]", children: [
      translate("files.permanentlyDeleteAllFilesInThe"),
      " ",
      /* @__PURE__ */ jsx20("code", { className: "rounded bg-[var(--theme-muted)] px-1 text-xs text-[var(--theme-fg-soft)]", children: "garbage/" }),
      " ",
      translate("files.folder")
    ] }),
    files.length === 0 ? /* @__PURE__ */ jsx20("p", { className: "mt-3 text-sm text-[var(--theme-fg-muted)]", children: translate("files.garbageIsEmpty") }) : /* @__PURE__ */ jsx20("ul", { className: "mt-3 max-h-40 overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 text-xs text-[var(--theme-fg-soft)]", children: files.map((file) => /* @__PURE__ */ jsx20("li", { className: "truncate py-0.5", title: file, children: file }, file)) }),
    /* @__PURE__ */ jsxs15("div", { className: "mt-4 flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx20(
        "button",
        {
          type: "button",
          onClick: onCancel,
          className: "thread-secondary-action rounded-md px-3 py-1.5 text-sm",
          children: translate("files.cancel")
        }
      ),
      files.length > 0 ? /* @__PURE__ */ jsx20(
        "button",
        {
          type: "button",
          onClick: onConfirm,
          className: "ui-action-danger rounded-md px-3 py-1.5 text-sm font-medium",
          children: translate("files.yesEmptyGarbage")
        }
      ) : null
    ] })
  ] }) });
}

// src/components/graph-workspace/GraphWorkspaceExplorer.tsx
import { Fragment as Fragment7, jsx as jsx21, jsxs as jsxs16 } from "react/jsx-runtime";
var TREE_MIN_PX = 220;
function GraphWorkspaceExplorer({
  activeView,
  detail,
  artifacts,
  plugins,
  status,
  focusPathRequest,
  workspaceAdapter,
  onActiveFileChange
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
    workspaceIdentity
  } = useWorkspaceExplorerController({
    activeView,
    detail,
    artifacts,
    status,
    focusPathRequest,
    workspaceAdapter
  });
  const [collapsedPanel, setCollapsedPanel] = useState12(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches ? "viewer" : null
  );
  const [focusedLine, setFocusedLine] = useState12(null);
  const [fileTabs, setFileTabs] = useState12([]);
  const documents = useWorkspaceDocuments(workspaceAdapter, workspaceIdentity);
  const readingPositions = useMemo9(() => /* @__PURE__ */ new Map(), [documents.source]);
  const [navigation, setNavigation] = useState12({ scope: documents.source, paths: [], index: -1 });
  const selectedFilePath = activeNode?.kind === "file" ? activeNode.path : null;
  const workspacePanelRef = useRef11(null);
  const treePanelRef = useRef11(null);
  useLayoutEffect3(() => {
    const width = workspacePanelRef.current?.clientWidth ?? 0;
    const tree2 = treePanelRef.current;
    if (!tree2 || width <= 0 || tree2.getSize() / 100 * width >= TREE_MIN_PX) return;
    tree2.resize(Math.min(50, TREE_MIN_PX / width * 100));
  }, []);
  const activeFileChange = useRef11(onActiveFileChange);
  activeFileChange.current = onActiveFileChange;
  useEffect11(() => {
    activeFileChange.current?.(selectedFilePath ? relativeWorkspacePath(selectedFilePath, detail.workspace.absPath) : null);
  }, [selectedFilePath, detail.workspace.absPath]);
  useEffect11(() => () => activeFileChange.current?.(null), []);
  useLayoutEffect3(() => {
    setNavigation((current) => {
      if (current.scope !== documents.source) return { scope: documents.source, paths: selectedFilePath ? [selectedFilePath] : [], index: selectedFilePath ? 0 : -1 };
      if (!selectedFilePath || current.paths[current.index] === selectedFilePath) return current;
      const paths = [...current.paths.slice(0, current.index + 1), selectedFilePath].slice(-100);
      return { ...current, paths, index: paths.length - 1 };
    });
  }, [documents.source, selectedFilePath]);
  function navigatePreview(direction) {
    const index = navigation.index + direction;
    const path = navigation.paths[index];
    if (!path) return;
    setNavigation((current) => ({ ...current, index }));
    setFocusedLine(null);
    setCollapsedPanel(isMobileViewport ? "explorer" : null);
    void focusWorkspacePath(path);
  }
  const [newFilePath, setNewFilePath] = useState12(null);
  const [createError, setCreateError] = useState12(null);
  const [creatingFile, setCreatingFile] = useState12(false);
  const createSource = JSON.stringify([workspaceAdapter?.resourceScopeKey, workspaceIdentity.workspaceId, workspaceIdentity.threadId]);
  const createOwnerRef = useRef11({ source: createSource, busy: false });
  if (createOwnerRef.current.source !== createSource) createOwnerRef.current = { source: createSource, busy: false };
  useEffect11(() => {
    setNewFilePath(null);
    setCreateError(null);
    setCreatingFile(false);
  }, [createSource]);
  function openCreateFile() {
    const relative = activeNode ? relativeWorkspacePath(activeNode.path, detail.workspace.absPath) : null;
    const directory = relative ? activeNode?.kind === "directory" ? relative : relative.slice(0, Math.max(0, relative.lastIndexOf("/"))) : "";
    setNewFilePath(directory ? `${directory}/` : "");
    setCreateError(null);
  }
  async function handleCreateFile() {
    if (!workspaceAdapter?.createFile || newFilePath === null) return;
    const owner = createOwnerRef.current;
    if (owner.busy) return;
    const path = newFilePath.trim();
    if (!path || path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(path) || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
      setCreateError(translate("files.invalidNewFilePath"));
      return;
    }
    if (dirtyFilePaths.has(path)) {
      setCreateError(translate("files.createHasDraft"));
      return;
    }
    owner.busy = true;
    setCreatingFile(true);
    setCreateError(null);
    let created = false;
    try {
      await workspaceAdapter.createFile({ ...workspaceIdentity, path });
      created = true;
      if (createOwnerRef.current !== owner) return;
      const currentDraft = documents.documents.get(path);
      if (currentDraft && isProtected(currentDraft) || !documents.discard(path)) {
        throw new Error(translate("files.createHasDraft"));
      }
      setNewFilePath(null);
      setFilterQuery("");
      await refreshWorkspaceTree(path);
      if (createOwnerRef.current !== owner) return;
      await focusWorkspacePath(path);
      if (createOwnerRef.current !== owner) return;
      const snapshot = await documents.load(path);
      if (createOwnerRef.current !== owner) return;
      if (snapshot && !snapshot.readOnlyReason && workspaceAdapter.saveDocument) documents.setEditing(path, true);
      setFileTabs((tabs) => [...tabs.filter((tab) => tab.path !== path), { path, name: path.split("/").pop(), pinned: true }]);
      setCollapsedPanel(isMobileViewport ? "explorer" : null);
    } catch (error) {
      if (createOwnerRef.current !== owner) return;
      const message = error instanceof Error ? error.message : translate("files.fileOperationFailed");
      if (created) setWorkspaceError(translate("files.createdButOpenFailed", { path, error: message }));
      else setCreateError(message);
    } finally {
      owner.busy = false;
      if (createOwnerRef.current === owner) setCreatingFile(false);
    }
  }
  const createDialog = /* @__PURE__ */ jsx21(
    RenameDialog,
    {
      open: newFilePath !== null,
      title: translate("files.newFile"),
      label: translate("files.newFilePath"),
      description: translate("files.newFileDescription"),
      submitLabel: translate("files.createFile"),
      value: newFilePath ?? "",
      onChange: setNewFilePath,
      onCancel: () => {
        if (!creatingFile) setNewFilePath(null);
      },
      onSubmit: handleCreateFile,
      busy: creatingFile,
      error: createError
    }
  );
  const dirtyFilePaths = new Set([...documents.documents].filter(([, doc]) => isProtected(doc)).map(([path]) => path));
  const dirtyKey = [...dirtyFilePaths].join("\0");
  useEffect11(() => {
    setFileTabs((tabs) => tabs.map((tab) => dirtyFilePaths.has(tab.path) ? { ...tab, pinned: true } : tab));
  }, [dirtyKey]);
  const [isMobileViewport, setIsMobileViewport] = useState12(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches);
  const explorerScrollerRef = useRef11(null);
  const explorerScrollTopRef = useRef11(0);
  const restoredRevealRef = useRef11(null);
  const scrollRestoreGenerationRef = useRef11(0);
  useLayoutEffect3(() => {
    ++scrollRestoreGenerationRef.current;
    return () => {
      ++scrollRestoreGenerationRef.current;
    };
  }, [focusPathRequest]);
  const pendingExplorerScrollRestoreRef = useRef11(null);
  const {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore: handleLoadMore,
    pdfUrl,
    previewFile,
    previewLoading
  } = useWorkspaceFilePreview({
    activeNode,
    adapter: workspaceAdapter,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    documents
  });
  const activeDocument = previewFile ? documents.documents.get(previewFile.path) : void 0;
  const currentPreviewFile = previewFile && activeDocument?.snapshot.content != null ? { ...previewFile, ...activeDocument.snapshot, content: activeDocument.snapshot.content } : previewFile;
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
    showGarbageDialog
  } = useWorkspaceExplorerActions({
    activeNode,
    adapter: workspaceAdapter,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    onLoadingChange: setLoadingTree,
    refreshTree: refreshWorkspaceTree,
    workspaceRootPath: detail.workspace.absPath
  });
  useEffect11(() => {
    explorerScrollTopRef.current = 0;
    pendingExplorerScrollRestoreRef.current = null;
    setFileTabs([]);
  }, [workspaceIdentity.threadId, workspaceIdentity.workspaceId]);
  useEffect11(() => {
    if (activeNode?.kind !== "file" || !activeNode.path) {
      return;
    }
    setFileTabs((current) => {
      if (current.some((tab) => tab.path === activeNode.path)) {
        return current;
      }
      return [...current, { name: activeNode.name, path: activeNode.path, pinned: true }];
    });
  }, [activeNode]);
  const filePanel = useFilePanel();
  const minimized = Boolean(filePanel?.minimized);
  const pathWhenMinimized = useRef11(null);
  useEffect11(() => {
    if (minimized) pathWhenMinimized.current = activeNode?.path ?? null;
  }, [minimized]);
  useEffect11(() => {
    if (minimized && activeNode?.kind === "file" && activeNode.path !== pathWhenMinimized.current) filePanel?.setMinimized?.(false);
  }, [activeNode?.path]);
  useEffect11(() => {
    if (focusPathRequest) {
      setFocusedLine(focusPathRequest.line ?? null);
      setCollapsedPanel(isMobileViewport && activeNode?.kind !== "directory" ? "explorer" : null);
    }
  }, [focusPathRequest, isMobileViewport, activeNode?.kind]);
  function rememberExplorerScroll() {
    const currentScrollTop = explorerScrollerRef.current?.scrollTop ?? explorerScrollTopRef.current;
    explorerScrollTopRef.current = currentScrollTop;
    pendingExplorerScrollRestoreRef.current = currentScrollTop;
  }
  function restoreExplorerScroll() {
    const generation = ++scrollRestoreGenerationRef.current;
    const target = pendingExplorerScrollRestoreRef.current ?? explorerScrollTopRef.current;
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
      scroller.removeEventListener("wheel", cancel);
      scroller.removeEventListener("touchstart", cancel);
      scroller.removeEventListener("pointerdown", cancel);
    };
    scroller.addEventListener("wheel", cancel, { passive: true });
    scroller.addEventListener("touchstart", cancel, { passive: true });
    scroller.addEventListener("pointerdown", cancel, { passive: true });
    const restore = () => {
      const current = explorerScrollerRef.current;
      if (!current || generation !== scrollRestoreGenerationRef.current) {
        removeListeners();
        return;
      }
      current.scrollTop = Math.min(
        target,
        Math.max(0, current.scrollHeight - current.clientHeight)
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
  const treeShownForRevealRef = useRef11(null);
  useLayoutEffect3(() => {
    if (collapsedPanel === "explorer" || focusPathRequest && restoredRevealRef.current !== focusPathRequest.requestId) {
      return;
    }
    if (focusPathRequest && treeShownForRevealRef.current !== focusPathRequest.requestId) {
      treeShownForRevealRef.current = focusPathRequest.requestId;
      return;
    }
    restoreExplorerScroll();
  }, [collapsedPanel]);
  useLayoutEffect3(() => {
    if (focusPathRequest && !loadingTree && activeNode) {
      restoredRevealRef.current = focusPathRequest.requestId;
    }
  }, [focusPathRequest, loadingTree, activeNode]);
  useEffect11(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);
  function handlePreview(node) {
    if (node.kind !== "file") {
      return;
    }
    rememberExplorerScroll();
    setFocusedLine(null);
    setSelectedNodeId(node.id);
    setCollapsedPanel("explorer");
  }
  function handlePin(node) {
    if (node.kind !== "file" || !node.path) {
      return;
    }
    setSelectedNodeId(node.id);
    setFileTabs((current) => {
      const existing = current.find((tab) => tab.path === node.path);
      if (existing) {
        return current.map(
          (tab) => tab.path === node.path ? { ...tab, pinned: true } : tab
        );
      }
      return [...current, { name: node.name, path: node.path, pinned: true }];
    });
  }
  function handleCloseTab(path) {
    const closingIndex = fileTabs.findIndex((tab) => tab.path === path);
    const nextTabs = fileTabs.filter((tab) => tab.path !== path);
    if (!documents.discard(path)) return;
    setFileTabs(nextTabs);
    if (activeNode?.path !== path) {
      return;
    }
    const replacement = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
    if (replacement) {
      void focusWorkspacePath(replacement.path);
    } else {
      setSelectedNodeId(null);
      if (isMobileViewport) setCollapsedPanel("viewer");
    }
  }
  const explorerActions = {
    onCopyPath: handleCopyPath,
    ...workspaceAdapter?.renameNode ? { onRename: async (node, name) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative || !name.trim() || name === "." || name === ".." || /[\\/\x00-\x1f]/.test(name)) throw new Error(translate("files.enterAValidFilenameWithoutPathSeparators"));
      if ([...dirtyFilePaths].some((path) => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeRenaming"));
      const prefix = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/") + 1) : "";
      const toPath = prefix + name.trim();
      await workspaceAdapter.renameNode({ ...workspaceIdentity, fromPath: relative, toPath });
      for (const path of documents.documents.keys()) if (path === node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs((tabs) => tabs.map((tab) => tab.path === node.path || tab.path.startsWith(`${node.path}/`) ? { ...tab, path: toPath + tab.path.slice(node.path.length), name: tab.path === node.path ? name.trim() : tab.name } : tab));
      await refreshWorkspaceTree(toPath);
    } } : {},
    ...workspaceAdapter?.deleteNode ? { onDelete: async (node) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative) throw new Error(translate("files.theWorkspaceRootCannotBeDeleted"));
      if ([...dirtyFilePaths].some((path) => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeDeleting"));
      await workspaceAdapter.deleteNode({ ...workspaceIdentity, path: relative });
      for (const path of documents.documents.keys()) if (path === node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs((tabs) => tabs.filter((tab) => tab.path !== node.path && !tab.path.startsWith(`${node.path}/`)));
      if (activeNode?.path === node.path || activeNode?.path.startsWith(`${node.path}/`)) setSelectedNodeId(null);
      await refreshWorkspaceTree();
    } } : {},
    ...workspaceAdapter?.downloadNode ? { onDownload: handleDownload } : {},
    ...workspaceAdapter?.emptyGarbage ? { onEmptyGarbage: handleOpenGarbage } : {},
    ...workspaceAdapter ? { onRefresh: () => void refreshWorkspaceTree(activeNode?.path ?? null) } : {},
    ...workspaceAdapter?.uploadFile ? { onUpload: pickUploadFile } : {},
    ...workspaceAdapter?.createFile ? { onCreateFile: openCreateFile } : {}
  };
  const explorerPanel = /* @__PURE__ */ jsx21(
    WorkspaceExplorerPanel,
    {
      canEmptyGarbage: Boolean(workspaceAdapter?.emptyGarbage),
      canUpload: Boolean(workspaceAdapter?.uploadFile),
      compactFolders: !isMobileViewport,
      directoryErrors,
      filterMode,
      filterQuery,
      initialLoading: Boolean(workspaceAdapter && !adapterModel && loadingTree),
      rootError: workspaceAdapter && !adapterModel ? workspaceError : null,
      ...minimized ? {} : collapsedPanel === "viewer" ? {
        onExpandViewer: () => {
          if (!isMobileViewport || activeNode?.kind === "file") setCollapsedPanel(isMobileViewport ? "explorer" : null);
        },
        // On phones the editor can only be shown for an open file.
        expandViewerAvailable: !isMobileViewport || activeNode?.kind === "file"
      } : {
        onCollapse: () => {
          rememberExplorerScroll();
          setCollapsedPanel("explorer");
        }
      },
      expandedPaths,
      loadingPaths: loadingDirectoryPaths,
      loading: loadingTree,
      explorerScrollTopRef,
      explorerScrollerRef,
      ...explorerActions,
      onCollapseAll: collapseAll,
      onFilterModeChange: setFilterMode,
      onFilterQueryChange: setFilterQuery,
      onRetryDirectory: (path) => void retryDirectory(path),
      onPreview: handlePreview,
      onPin: handlePin,
      onSelect: (nodeId) => {
        setSelectedNodeId(nodeId);
      },
      onSelectNode: (node) => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setFocusedLine(null);
        if ((isMobileViewport || collapsedPanel === "viewer") && node.kind !== "directory") {
          rememberExplorerScroll();
          setCollapsedPanel("explorer");
        }
      },
      onToggle: (path) => {
        toggleDirectory(path);
        setFocusedLine(null);
      },
      selectedNodeId: activeNode?.id ?? null,
      revealRequestKey: focusPathRequest?.requestId,
      tree,
      liveNodes
    }
  );
  const viewerPanel = /* @__PURE__ */ jsx21(
    GraphWorkspacePreviewPane,
    {
      mobileNavigation: isMobileViewport,
      readingPositions,
      ...navigation.index > 0 ? { onNavigateBack: () => navigatePreview(-1), previousFilePath: navigation.paths[navigation.index - 1] } : {},
      ...navigation.index < navigation.paths.length - 1 ? { onNavigateForward: () => navigatePreview(1) } : {},
      activeFilePath: activeNode?.kind === "file" ? activeNode.path : null,
      dirtyFilePaths,
      error: workspaceError,
      missingPath,
      fileTabs,
      downloadOnly,
      downloadReason,
      ...workspaceAdapter?.downloadNode && activeNode?.kind === "file" ? { onDownloadFile: () => workspaceAdapter.downloadNode({ ...workspaceIdentity, path: activeNode.path, kind: "file" }) } : {},
      imageUrl,
      loadingMore,
      focusLine: focusedLine,
      onOpenWorkspaceFile: (path) => {
        if (selectedFilePath) setNavigation((current) => current.index < 0 ? { ...current, paths: [selectedFilePath], index: 0 } : current);
        setFocusedLine(null);
        setCollapsedPanel(isMobileViewport ? "explorer" : null);
        void focusWorkspacePath(path);
      },
      ...workspaceAdapter?.textRangeRead ? { onLoadMore: handleLoadMore } : {},
      onReturnToFiles: () => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setCollapsedPanel("viewer");
      },
      onCloseFileTab: handleCloseTab,
      onSelectFileTab: (path) => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        void focusWorkspacePath(path);
      },
      documents,
      resourceScopeKey: documents.source,
      canSaveDocument: Boolean(workspaceAdapter?.saveDocument),
      onSaveAndClose: async (path) => {
        if (await documents.save(path)) handleCloseTab(path);
      },
      ...collapsedPanel === "explorer" || isMobileViewport ? { onExpandExplorer: () => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setCollapsedPanel(isMobileViewport ? "viewer" : null);
      } } : {
        onCollapse: () => {
          rememberExplorerScroll();
          setCollapsedPanel("viewer");
        }
      },
      pdfUrl,
      previewFile: currentPreviewFile,
      previewLoading,
      plugins,
      ...workspaceAdapter?.getRawFileUrl ? {
        resolveWorkspaceFileUrl: (path) => workspaceAdapter.getRawFileUrl?.({
          ...workspaceIdentity,
          path
        }) ?? null
      } : {},
      selectedTarget: graphWorkspacePreviewTargetFromNode(activeNode),
      workspaceRootPath: detail.workspace.absPath
    }
  );
  const overlays = /* @__PURE__ */ jsxs16(Fragment7, { children: [
    /* @__PURE__ */ jsx21("input", { ref: fileInputRef, type: "file", "aria-label": translate("files.workspaceUploadFileInput"), "data-testid": "workspace-upload-file-input", className: "hidden", onChange: (event) => void handleUpload(event) }),
    showGarbageDialog && /* @__PURE__ */ jsx21(GraphEmptyGarbageDialog, { files: garbageFiles, onCancel: () => setShowGarbageDialog(false), onConfirm: () => void handleConfirmEmptyGarbage() }),
    createDialog
  ] });
  if (minimized) {
    return /* @__PURE__ */ jsxs16("div", { "data-testid": "workspace-panel", "data-minimized": "true", className: "relative h-full min-h-0 w-full overflow-hidden p-1", children: [
      explorerPanel,
      overlays
    ] });
  }
  if (collapsedPanel === "explorer" || isMobileViewport && collapsedPanel === null && activeNode?.kind === "file") {
    return /* @__PURE__ */ jsxs16(
      "div",
      {
        "data-testid": "workspace-panel",
        className: "relative h-full min-h-0 w-full overflow-hidden p-1",
        children: [
          viewerPanel,
          overlays
        ]
      }
    );
  }
  if (collapsedPanel === "viewer" || isMobileViewport) {
    return /* @__PURE__ */ jsxs16(
      "div",
      {
        "data-testid": "workspace-panel",
        className: "relative h-full min-h-0 w-full overflow-hidden p-1",
        children: [
          explorerPanel,
          overlays
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs16(
    "div",
    {
      ref: workspacePanelRef,
      "data-testid": "workspace-panel",
      className: "flex h-full min-h-0 w-full overflow-hidden bg-transparent p-1",
      children: [
        /* @__PURE__ */ jsxs16(
          ResizablePanelGroup,
          {
            direction: "horizontal",
            className: "thread-graph-workspace-resizable",
            children: [
              /* @__PURE__ */ jsx21(ResizablePanel, { ref: treePanelRef, defaultSize: 28, minSize: 18, children: /* @__PURE__ */ jsx21("div", { className: "thread-graph-workspace-explorer-pane h-full min-h-0 overflow-hidden", children: explorerPanel }) }),
              /* @__PURE__ */ jsx21(ResizableHandle, { className: "thread-graph-workspace-resize-handle w-1 bg-transparent after:w-px after:bg-slate-200/80 after:transition-colors hover:after:bg-slate-300 dark:after:bg-[#303642] dark:hover:after:bg-[#475063]" }),
              /* @__PURE__ */ jsx21(ResizablePanel, { defaultSize: 72, minSize: 40, children: /* @__PURE__ */ jsx21("div", { className: "thread-graph-workspace-viewer-pane h-full min-h-0 overflow-hidden", children: viewerPanel }) })
            ]
          }
        ),
        overlays
      ]
    }
  );
}

// src/components/graph-chat/GraphVisualization.tsx
import { useCallback as useCallback7, useEffect as useEffect12, useMemo as useMemo10 } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType as MarkerType2,
  Position as Position4,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// src/components/graph-chat/FloatingConnectionLine.tsx
import { getBezierPath } from "@xyflow/react";

// src/components/graph-chat/FloatingHelper.tsx
import { MarkerType, Position } from "@xyflow/react";
import { jsx as jsx22, jsxs as jsxs17 } from "react/jsx-runtime";
function getNodeIntersection(intersectionNode, targetNode) {
  const intersectionNodeWidth = Math.max(intersectionNode.measured.width ?? 1, 1);
  const intersectionNodeHeight = Math.max(
    intersectionNode.measured.height ?? 1,
    1
  );
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;
  const targetNodeWidth = Math.max(targetNode.measured.width ?? 1, 1);
  const targetNodeHeight = Math.max(targetNode.measured.height ?? 1, 1);
  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;
  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + targetNodeWidth / 2;
  const y1 = targetPosition.y + targetNodeHeight / 2;
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;
  return { x, y };
}
function getEdgePosition(node, intersectionPoint) {
  const n = { ...node.internals.positionAbsolute, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + (node.measured.width ?? 1) - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= n.y + (node.measured.height ?? 1) - 1) {
    return Position.Bottom;
  }
  return Position.Top;
}
function getEdgeParams(source, target) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);
  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);
  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos
  };
}
function buildGraph(inputNodes, width = 900, height = 620) {
  if (!inputNodes || !Array.isArray(inputNodes)) {
    return { nodes: [], edges: [] };
  }
  const forceLayout = (nodes2, edges2, layoutWidth, layoutHeight) => {
    const nodePositions = /* @__PURE__ */ new Map();
    const nodeCount = nodes2.length;
    nodes2.forEach((node, index) => {
      const hash = node.id.split("").reduce((value, character) => {
        const nextValue = (value << 5) - value + character.charCodeAt(0);
        return nextValue & nextValue;
      }, 0);
      nodePositions.set(node.id, {
        x: Math.abs(hash) % layoutWidth + index * 100 % layoutWidth,
        y: Math.abs(hash >> 16) % layoutHeight + index * 150 % layoutHeight,
        vx: 0,
        vy: 0
      });
    });
    for (let iteration = 0; iteration < 200; iteration += 1) {
      for (let i = 0; i < nodeCount; i += 1) {
        for (let j = i + 1; j < nodeCount; j += 1) {
          const firstNode = nodes2[i];
          const secondNode = nodes2[j];
          if (!firstNode || !secondNode) {
            continue;
          }
          const pos1 = nodePositions.get(firstNode.id);
          const pos2 = nodePositions.get(secondNode.id);
          if (!pos1 || !pos2) {
            continue;
          }
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const optimalDistance = 200;
          const force = (optimalDistance - distance) * 0.5;
          const fx = dx / distance * force;
          const fy = dy / distance * force;
          pos1.vx += fx;
          pos1.vy += fy;
          pos2.vx -= fx;
          pos2.vy -= fy;
        }
      }
      edges2.forEach((edge) => {
        const pos1 = nodePositions.get(edge.source);
        const pos2 = nodePositions.get(edge.target);
        if (!pos1 || !pos2) {
          return;
        }
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLength = 120;
        const springForce = (distance - targetLength) * 0.3;
        const fx = dx / distance * springForce;
        const fy = dy / distance * springForce;
        pos1.vx += fx;
        pos1.vy += fy;
        pos2.vx -= fx;
        pos2.vy -= fy;
      });
      nodePositions.forEach((position) => {
        position.x += position.vx * 0.1;
        position.y += position.vy * 0.1;
        position.vx *= 0.9;
        position.vy *= 0.9;
        position.x = Math.max(80, Math.min(layoutWidth - 80, position.x));
        position.y = Math.max(80, Math.min(layoutHeight - 80, position.y));
      });
    }
    return nodePositions;
  };
  const inputIds = new Set(inputNodes.map((node) => node.id));
  const edges = [];
  inputNodes.forEach((node) => {
    if (!node.out_node_id) {
      return;
    }
    const outNodes = Array.isArray(node.out_node_id) ? node.out_node_id : [node.out_node_id];
    outNodes.forEach((outNodeId) => {
      if (!inputIds.has(outNodeId)) {
        return;
      }
      edges.push({
        id: `${node.id}-${outNodeId}`,
        source: node.id,
        target: outNodeId,
        type: "floating",
        sourceHandle: null,
        targetHandle: null,
        markerEnd: { type: MarkerType.Arrow }
      });
    });
  });
  const positions = forceLayout(inputNodes, edges, width, height);
  const nodes = inputNodes.map((node) => ({
    id: node.id,
    type: "styledNode",
    position: positions.get(node.id) ?? { x: 100, y: 100 },
    data: {
      label: /* @__PURE__ */ jsxs17("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx22("div", { className: "text-sm font-semibold", children: node.name }),
        node.description ? /* @__PURE__ */ jsx22("div", { className: "mt-1 max-w-32 overflow-hidden text-ellipsis text-xs text-slate-500 dark:text-slate-400", children: node.description }) : null
      ] })
    }
  }));
  return { nodes, edges };
}

// src/components/graph-chat/FloatingConnectionLine.tsx
import { jsx as jsx23, jsxs as jsxs18 } from "react/jsx-runtime";
function FloatingConnectionLine({
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode
}) {
  useI18n();
  if (!fromNode) {
    return null;
  }
  const targetNode = {
    id: "connection-target",
    measured: {
      width: 1,
      height: 1
    },
    internals: {
      positionAbsolute: { x: toX, y: toY }
    }
  };
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    fromNode,
    targetNode
  );
  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos || fromPosition,
    targetPosition: targetPos || toPosition,
    targetX: tx || toX,
    targetY: ty || toY
  });
  return /* @__PURE__ */ jsxs18("g", { children: [
    /* @__PURE__ */ jsx23(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.5,
        className: "animated",
        d: edgePath
      }
    ),
    /* @__PURE__ */ jsx23(
      "circle",
      {
        cx: tx || toX,
        cy: ty || toY,
        fill: "var(--theme-panel)",
        r: 3,
        stroke: "currentColor",
        strokeWidth: 1.5
      }
    )
  ] });
}

// src/components/graph-chat/FloatingEdge.tsx
import { getBezierPath as getBezierPath2, useInternalNode } from "@xyflow/react";
import { jsx as jsx24 } from "react/jsx-runtime";
function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) {
    return null;
  }
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );
  const [edgePath] = getBezierPath2({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty
  });
  return /* @__PURE__ */ jsx24(
    "path",
    {
      id,
      className: "react-flow__edge-path",
      d: edgePath,
      markerEnd,
      style
    }
  );
}

// src/components/graph-chat/GraphVisualization.tsx
import { jsx as jsx25, jsxs as jsxs19 } from "react/jsx-runtime";
function GraphVisualization({ nodes: inputNodes }) {
  useI18n();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const graph = useMemo10(() => buildGraph(inputNodes), [inputNodes]);
  const edgeTypes = useMemo10(() => ({ floating: FloatingEdge }), []);
  const nodeTypes = useMemo10(
    () => ({
      styledNode: ({ data, isConnectable }) => /* @__PURE__ */ jsxs19("div", { className: "thread-graph-flow-node", children: [
        data.label,
        /* @__PURE__ */ jsx25(
          Handle,
          {
            type: "target",
            position: Position4.Top,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        ),
        /* @__PURE__ */ jsx25(
          Handle,
          {
            type: "source",
            position: Position4.Bottom,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        )
      ] })
    }),
    []
  );
  useEffect12(() => {
    setFlowNodes(graph.nodes);
    setFlowEdges(graph.edges);
  }, [graph.edges, graph.nodes, setFlowEdges, setFlowNodes]);
  const onConnect = useCallback7(
    (params) => setFlowEdges(
      (edges) => addEdge(
        {
          ...params,
          type: "floating",
          sourceHandle: null,
          targetHandle: null,
          markerEnd: { type: MarkerType2.Arrow }
        },
        edges
      )
    ),
    [setFlowEdges]
  );
  return /* @__PURE__ */ jsx25("div", { className: "thread-graph-flow h-full min-h-0", children: /* @__PURE__ */ jsx25(ReactFlowProvider, { children: /* @__PURE__ */ jsxs19(
    ReactFlow,
    {
      nodes: flowNodes,
      edges: flowEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      fitView: true,
      nodeTypes,
      edgeTypes,
      connectionLineComponent: FloatingConnectionLine,
      children: [
        /* @__PURE__ */ jsx25(Controls, {}),
        /* @__PURE__ */ jsx25(Background, { gap: 16 })
      ]
    }
  ) }) });
}

// src/components/ThreadGraphWorkspacePanel.tsx
import { jsx as jsx26, jsxs as jsxs20 } from "react/jsx-runtime";
var DEFAULT_WORKSPACE_FEATURES = {
  workspace: true,
  toolUsage: false,
  guide: false,
  threadGraph: true,
  extensions: true
};
function resolveWorkspaceFeatures(features) {
  return {
    ...DEFAULT_WORKSPACE_FEATURES,
    ...features
  };
}
function firstEnabledWorkspaceTab(features, preferred) {
  const isEnabled = (tab) => {
    switch (tab) {
      case "workspace":
        return features.workspace;
      case "tools":
        return false;
      case "guide":
        return false;
      case "graph":
        return features.threadGraph;
      case "extensions":
        return features.extensions;
    }
  };
  if (preferred && isEnabled(preferred)) {
    return preferred;
  }
  return [
    "workspace",
    "graph",
    "extensions"
  ].find(isEnabled) ?? null;
}
function isWorkspaceTabEnabled(features, tab) {
  switch (tab) {
    case "workspace":
      return features.workspace;
    case "tools":
      return false;
    case "guide":
      return false;
    case "graph":
      return features.threadGraph;
    case "extensions":
      return features.extensions;
  }
}
function collectToolEvents(detail) {
  const events = [];
  const toolKinds = /* @__PURE__ */ new Set([
    "toolCall",
    "commandExecution",
    "webSearch",
    "fileRead",
    "fileChange",
    "agentToolCall",
    "skillToolCall",
    "hook"
  ]);
  let sequence = 0;
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (!toolKinds.has(item.kind)) {
        continue;
      }
      events.push({
        id: item.id,
        kind: item.kind,
        label: formatToolKind(item.kind),
        preview: item.previewText ?? item.text ?? item.kind,
        detail: item.detailText ?? item.text ?? item.previewText ?? item.kind,
        turnId: item.sourceTurnId ?? turn.id,
        status: item.status ?? null,
        sequence
      });
      sequence += 1;
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    if (!toolKinds.has(item.kind)) {
      continue;
    }
    events.push({
      id: item.id,
      kind: item.kind,
      label: formatToolKind(item.kind),
      preview: item.previewText ?? item.text ?? item.kind,
      detail: item.detailText ?? item.text ?? item.previewText ?? item.kind,
      turnId: item.sourceTurnId ?? null,
      status: item.status ?? null,
      sequence
    });
    sequence += 1;
  }
  return events;
}
function formatToolKind(value) {
  switch (value) {
    case "toolCall":
      return translate("files.toolCall");
    case "agentToolCall":
      return translate("files.agentTool");
    case "skillToolCall":
      return translate("files.skillTool");
    case "commandExecution":
      return translate("files.command");
    case "webSearch":
      return translate("files.search");
    case "fileRead":
      return translate("files.fileRead");
    case "fileChange":
      return translate("files.fileChange");
    case "hook":
      return translate("files.hook");
    default:
      return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
  }
}
function itemGraphLabel(item) {
  switch (item.kind) {
    case "userMessage":
      return translate("files.user");
    case "agentMessage":
      return translate("files.agent");
    default:
      return formatToolKind(item.kind);
  }
}
function itemGraphDescription(item) {
  const source = item.previewText ?? item.text ?? item.detailText ?? item.kind;
  return source.replace(/\s+/g, " ").slice(0, 96);
}
function collectGraphNodes(detail, toolEvents) {
  const nodes = [
    {
      id: `thread:${detail.thread.id}`,
      name: detail.thread.title || translate("files.thread"),
      description: detail.thread.model ?? detail.thread.status
    },
    {
      id: `workspace:${detail.workspace.id}`,
      name: detail.workspace.label ?? translate("files.workspace"),
      description: detail.workspace.absPath,
      out_node_id: `thread:${detail.thread.id}`
    }
  ];
  let previousTurnId = null;
  for (const turn of detail.turns) {
    const turnId = `turn:${turn.id}`;
    nodes.push({
      id: turnId,
      name: `Turn ${nodes.filter((node) => node.id.startsWith("turn:")).length + 1}`,
      description: turn.status,
      out_node_id: previousTurnId ? [`thread:${detail.thread.id}`, previousTurnId] : `thread:${detail.thread.id}`
    });
    previousTurnId = turnId;
    let previousItemId = null;
    for (const item of turn.items) {
      const itemId = `item:${item.id}`;
      const outNodeIds = [turnId];
      if (previousItemId) {
        outNodeIds.push(previousItemId);
      }
      nodes.push({
        id: itemId,
        name: itemGraphLabel(item),
        description: itemGraphDescription(item),
        out_node_id: outNodeIds
      });
      previousItemId = itemId;
      if (item.kind === "artifact" && item.artifact) {
        nodes.push({
          id: `artifact:${item.artifact.id}`,
          name: item.artifact.title || item.artifact.type,
          description: item.artifact.summaryText ?? item.artifact.type,
          out_node_id: itemId
        });
      }
    }
  }
  const toolNodeIds = new Set(nodes.map((node) => node.id));
  for (const event of toolEvents) {
    const eventId = `tool:${event.id}`;
    if (toolNodeIds.has(eventId) || toolNodeIds.has(`item:${event.id}`)) {
      continue;
    }
    nodes.push({
      id: eventId,
      name: event.label,
      description: event.preview,
      out_node_id: event.turnId ? `turn:${event.turnId}` : `thread:${detail.thread.id}`
    });
  }
  return nodes.slice(0, 120);
}
function ThreadGraphWorkspacePanel({
  detail,
  status,
  plugins,
  workspaceAdapter,
  metaContent,
  settingsContent,
  activeView = "chat",
  features: featureConfig,
  focusPathRequest = null,
  onActiveFileChange
}) {
  const { locale: i18nLocale } = useI18n();
  const features = useMemo11(
    () => resolveWorkspaceFeatures(featureConfig),
    [featureConfig]
  );
  const initialTab = firstEnabledWorkspaceTab(features, featureConfig?.defaultTab);
  const [activeTab, setActiveTab] = useState13(initialTab);
  const artifacts = useMemo11(() => collectArtifacts(detail), [detail]);
  const toolEvents = useMemo11(() => collectToolEvents(detail), [detail, i18nLocale]);
  const threadPanels = plugins.getThreadPanels();
  const graphNodes = useMemo11(
    () => collectGraphNodes(detail, toolEvents),
    [detail, toolEvents, i18nLocale]
  );
  const primaryTabs = useMemo11(() => {
    const tabs = [];
    if (features.workspace) {
      tabs.push({ id: "workspace", label: translate("files.workspace"), icon: null });
    }
    return tabs;
  }, [features.workspace, i18nLocale]);
  const secondaryTabs = useMemo11(() => {
    const tabs = [];
    if (features.threadGraph) {
      tabs.push({ id: "graph", label: translate("files.threadGraph"), icon: GitBranch });
    }
    if (features.extensions) {
      tabs.push({ id: "extensions", label: translate("files.pockymoeExtensions"), icon: Wrench });
    }
    return tabs;
  }, [features.extensions, features.threadGraph, i18nLocale]);
  useEffect13(() => {
    if (!activeTab || !isWorkspaceTabEnabled(features, activeTab)) {
      setActiveTab(firstEnabledWorkspaceTab(features, featureConfig?.defaultTab));
    }
  }, [activeTab, featureConfig?.defaultTab, features]);
  useEffect13(() => {
    if (focusPathRequest && features.workspace) {
      setActiveTab("workspace");
    }
  }, [features.workspace, focusPathRequest?.requestId]);
  if (!activeTab) {
    return null;
  }
  return /* @__PURE__ */ jsxs20("div", { className: "thread-graph-right-panel flex h-full min-h-0 flex-col overflow-hidden", children: [
    primaryTabs.length + secondaryTabs.length > 1 && /* @__PURE__ */ jsxs20("div", { className: "thread-graph-right-tabs flex h-9 shrink-0 items-center gap-0 overflow-hidden border-b px-1", children: [
      primaryTabs.map((tab) => {
        const Icon = tab.icon;
        return /* @__PURE__ */ jsxs20(
          "button",
          {
            type: "button",
            onClick: () => setActiveTab(tab.id),
            className: `thread-graph-right-tab inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-xs font-medium transition ${activeTab === tab.id ? "is-active" : ""}`,
            children: [
              Icon ? /* @__PURE__ */ jsx26(Icon, { className: "h-3.5 w-3.5" }) : null,
              tab.label
            ]
          },
          tab.id
        );
      }),
      secondaryTabs.length ? /* @__PURE__ */ jsx26(
        "div",
        {
          className: "thread-graph-right-tab-secondary ml-auto flex h-6 min-w-0 shrink items-center gap-0.5 border-l pl-1",
          "aria-label": translate("files.pockymoeWorkspaceExtensions"),
          children: secondaryTabs.map((tab) => {
            const Icon = tab.icon;
            return /* @__PURE__ */ jsx26(
              "button",
              {
                type: "button",
                onClick: () => setActiveTab(tab.id),
                className: `thread-graph-right-tab inline-flex h-8 w-8 shrink-0 items-center justify-center text-xs font-medium transition ${activeTab === tab.id ? "is-active" : ""}`,
                title: tab.label,
                "aria-label": tab.label,
                children: /* @__PURE__ */ jsx26(Icon, { className: "h-3.5 w-3.5" })
              },
              tab.id
            );
          })
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsxs20("div", { className: "min-h-0 flex-1 overflow-hidden", children: [
      activeTab === "workspace" ? /* @__PURE__ */ jsx26(
        GraphWorkspaceExplorer,
        {
          activeView,
          detail,
          artifacts,
          plugins,
          status,
          focusPathRequest,
          workspaceAdapter: workspaceAdapter ?? null,
          ...onActiveFileChange ? { onActiveFileChange } : {}
        }
      ) : null,
      activeTab === "graph" ? /* @__PURE__ */ jsx26("div", { className: "thread-graph-visualization-panel h-full min-h-0 p-3", children: /* @__PURE__ */ jsx26(GraphVisualization, { nodes: graphNodes }) }) : null,
      activeTab === "extensions" ? /* @__PURE__ */ jsx26("div", { className: "h-full min-h-0 overflow-y-auto p-3", children: /* @__PURE__ */ jsxs20("div", { className: "grid gap-3", children: [
        /* @__PURE__ */ jsx26(WorkspaceInfoCard, { label: translate("files.pluginPanels"), children: threadPanels.length ? /* @__PURE__ */ jsx26("div", { className: "flex flex-wrap gap-2", children: threadPanels.map((panel) => /* @__PURE__ */ jsx26(
          "span",
          {
            className: "rounded-full border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-fg-soft)]",
            children: panel.label
          },
          panel.id
        )) }) : /* @__PURE__ */ jsx26("p", { className: "text-[var(--theme-fg-muted)]", children: translate("files.noThreadPanelsAreEnabled") }) }),
        /* @__PURE__ */ jsx26(WorkspaceInfoCard, { label: translate("files.enabledRenderers"), children: /* @__PURE__ */ jsx26("div", { className: "flex flex-wrap gap-2", children: plugins.plugins.filter((plugin) => plugin.enabled).map((plugin) => /* @__PURE__ */ jsx26(
          "span",
          {
            className: "rounded-full border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-fg-soft)]",
            children: plugin.name
          },
          plugin.id
        )) }) }),
        /* @__PURE__ */ jsx26(WorkspaceInfoCard, { label: translate("files.pockymoeTools"), children: /* @__PURE__ */ jsxs20("div", { className: "grid gap-2 text-[var(--theme-fg-muted)]", children: [
          /* @__PURE__ */ jsxs20("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx26(Terminal, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx26("p", { children: translate("files.terminalStaysAvailableWhenTheTerminalPlugin") })
          ] }),
          /* @__PURE__ */ jsxs20("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx26(Paperclip, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx26("p", { children: translate("files.composerAttachmentsSlashPanelsHooksMCPGoals") })
          ] }),
          /* @__PURE__ */ jsxs20("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx26(Trash24, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx26("p", { children: translate("files.destructiveActionsStayExplicitDeleteThreadInterrupt") })
          ] })
        ] }) }),
        metaContent ? /* @__PURE__ */ jsx26(WorkspaceInfoCard, { label: translate("files.threadMeta"), children: metaContent }) : null,
        settingsContent ? /* @__PURE__ */ jsx26(WorkspaceInfoCard, { label: translate("files.settings"), children: settingsContent }) : null
      ] }) }) : null
    ] })
  ] });
}
var MemoizedThreadGraphWorkspacePanel = memo2(
  ThreadGraphWorkspacePanel
);
export {
  MemoizedThreadGraphWorkspacePanel,
  ThreadGraphWorkspacePanel
};
