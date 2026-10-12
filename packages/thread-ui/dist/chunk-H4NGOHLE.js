import {
  translate,
  useI18n
} from "./chunk-KHQQUKCU.js";

// src/components/graph-workspace/explorer/workspaceDocuments.ts
var storeKey = /* @__PURE__ */ Symbol.for("remote-codex.workspace-documents");
var documentGlobal = globalThis;
var memory = documentGlobal[storeKey] ??= {
  stores: /* @__PURE__ */ new Map(),
  listeners: /* @__PURE__ */ new Set()
};
var documentStores = memory.stores;
var documentListeners = memory.listeners;
if (typeof window !== "undefined" && !memory.unloadInstalled) {
  memory.unloadInstalled = true;
  window.addEventListener("beforeunload", (event) => {
    if ([...documentStores.values()].some(
      (store) => [...store.values()].some(isProtected)
    )) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
function isProtected(doc) {
  return doc.content !== doc.baseContent || ["saving", "unknown", "conflict"].includes(doc.phase);
}
function newDraft(key, snapshot) {
  return {
    key,
    snapshot,
    content: snapshot.content ?? "",
    baseContent: snapshot.content ?? "",
    revision: 0,
    editing: false,
    phase: "clean",
    error: null
  };
}
function editDraft(doc, content) {
  return {
    ...doc,
    content,
    revision: doc.revision + 1,
    phase: ["saving", "conflict", "unknown"].includes(doc.phase) ? doc.phase : content === doc.baseContent ? "clean" : "dirty"
  };
}
function settleSave(doc, receipt) {
  const submitted = doc.submitted;
  if (!submitted || submitted.operationId !== receipt.operationId || submitted.revision !== receipt.draftRevision)
    return doc;
  if (receipt.status === "saved" && receipt.contentHash && receipt.fileIdentity) {
    return {
      ...doc,
      baseContent: submitted.content,
      snapshot: {
        ...doc.snapshot,
        content: submitted.content,
        contentHash: receipt.contentHash,
        fileIdentity: receipt.fileIdentity,
        size: receipt.size ?? doc.snapshot.size,
        workspaceRevision: receipt.workspaceRevision ?? doc.snapshot.workspaceRevision,
        encoding: receipt.encoding ?? doc.snapshot.encoding,
        bom: receipt.bom ?? doc.snapshot.bom,
        eol: receipt.eol ?? doc.snapshot.eol
      },
      phase: doc.content === submitted.content ? "clean" : "dirty",
      submitted: void 0,
      conflict: void 0,
      needsVerification: false,
      operationPending: false,
      error: null
    };
  }
  if (receipt.status === "conflict")
    return {
      ...doc,
      phase: "conflict",
      conflict: receipt.snapshot,
      submitted: void 0,
      error: receipt.snapshot ? null : translate("files.safeMissing")
    };
  if (receipt.status === "failedBeforeWrite")
    return {
      ...doc,
      phase: "error",
      submitted: void 0,
      snapshot: receipt.code === "forbidden" ? { ...doc.snapshot, readOnlyReason: "permissionDenied" } : doc.snapshot,
      error: receipt.message ?? translate("files.failedToSaveFile")
    };
  return {
    ...doc,
    phase: "unknown",
    operationPending: receipt.status === "pending",
    error: translate(
      receipt.status === "pending" ? "files.safeWaitBeforeLeave" : "files.safeUnknown"
    )
  };
}
function confirmWorkspaceDocumentLeave() {
  const protectedDocs = [...documentStores.values()].flatMap((store) => [...store.values()]).filter(isProtected);
  if (!protectedDocs.length) return true;
  if (protectedDocs.some(
    (doc) => doc.phase === "saving" || doc.phase === "unknown"
  )) {
    window.alert(translate("files.safeWaitBeforeLeave"));
    return false;
  }
  if (!window.confirm(translate("files.safeLeave"))) return false;
  for (const store of documentStores.values())
    for (const [path, doc] of store)
      if (isProtected(doc)) {
        store.delete(path);
        window.dispatchEvent(
          new CustomEvent("workspace-model-release", { detail: doc.key })
        );
      }
  for (const listener of documentListeners) listener();
  return true;
}
function downloadDraft(doc, disk = false) {
  const content = disk ? doc.conflict?.content : doc.content;
  if (content == null) return;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.snapshot.name}.${disk ? "disk-snapshot" : "draft"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// src/components/ConfirmDialog.tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { jsx, jsxs } from "react/jsx-runtime";
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = translate("workbench.delete"),
  busyLabel = translate("workbench.deleting"),
  busy = false,
  error,
  onCancel,
  onConfirm
}) {
  useI18n();
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onCancel, open]);
  if (!open) {
    return null;
  }
  return createPortal(
    /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          "aria-label": translate("workbench.closeConfirmationDialog"),
          onClick: onCancel,
          disabled: busy,
          className: "absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          className: "relative z-[1] w-full max-w-md rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:p-6",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--theme-fg-muted)]", children: description }),
                error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "mt-2 text-sm text-rose-500", children: error }) : null
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  "aria-label": translate("workbench.closeDialog"),
                  onClick: onCancel,
                  disabled: busy,
                  className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border)] text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: /* @__PURE__ */ jsx("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", className: "h-4 w-4 fill-current", children: /* @__PURE__ */ jsx("path", { d: "M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" }) })
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex items-center justify-end gap-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: onCancel,
                  disabled: busy,
                  className: "rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: translate("workbench.cancel")
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => void onConfirm(),
                  disabled: busy,
                  className: "ui-action-danger rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
                  children: busy ? busyLabel : confirmLabel
                }
              )
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/components/graph-ui/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/components/graph-ui/Tooltip.tsx
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function TooltipProvider({
  delayDuration = 0,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    TooltipPrimitive.Provider,
    {
      "data-slot": "tooltip-provider",
      delayDuration,
      ...props
    }
  );
}
function Tooltip({ ...props }) {
  return /* @__PURE__ */ jsx2(TooltipProvider, { children: /* @__PURE__ */ jsx2(TooltipPrimitive.Root, { "data-slot": "tooltip", ...props }) });
}
function TooltipTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsx2(TooltipPrimitive.Trigger, { "data-slot": "tooltip-trigger", ...props });
}
function TooltipContent({
  children,
  className,
  sideOffset = 0,
  arrowStyle,
  ...props
}) {
  return /* @__PURE__ */ jsx2(TooltipPrimitive.Portal, { children: /* @__PURE__ */ jsxs2(
    TooltipPrimitive.Content,
    {
      "data-slot": "tooltip-content",
      sideOffset,
      className: cn(
        "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md bg-foreground px-3 py-1.5 text-balance text-xs text-background animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx2(TooltipPrimitive.Arrow, { "data-slot": "tooltip-arrow", width: 10, height: 5, className: "fill-foreground", style: arrowStyle })
      ]
    }
  ) });
}

// src/components/RenameDialog.tsx
import { useEffect as useEffect2 } from "react";
import { createPortal as createPortal2 } from "react-dom";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function RenameDialog({
  open,
  title,
  label,
  value,
  busy = false,
  error,
  description,
  submitLabel,
  onChange,
  onCancel,
  onSubmit
}) {
  useI18n();
  useEffect2(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onCancel, open]);
  if (!open) {
    return null;
  }
  function handleSubmit(event) {
    event.preventDefault();
    void onSubmit();
  }
  return createPortal2(
    /* @__PURE__ */ jsxs3("div", { className: "fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6", children: [
      /* @__PURE__ */ jsx3(
        "button",
        {
          type: "button",
          "aria-label": translate("workbench.closeRenameDialog"),
          onClick: onCancel,
          disabled: busy,
          className: "absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
        }
      ),
      /* @__PURE__ */ jsxs3(
        "form",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          onSubmit: handleSubmit,
          onKeyDown: (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (!busy) onCancel();
            }
          },
          className: "relative z-[1] w-full max-w-md rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:p-6",
          children: [
            /* @__PURE__ */ jsxs3("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs3("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx3("p", { className: "text-sm font-medium", children: title }),
                /* @__PURE__ */ jsx3("p", { className: "mt-1 text-sm text-[var(--theme-fg-muted)]", children: description ?? translate("workbench.changesAreSavedOnlyAfterConfirmation") })
              ] }),
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  "aria-label": translate("workbench.closeDialog"),
                  onClick: onCancel,
                  disabled: busy,
                  className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border)] text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: /* @__PURE__ */ jsx3("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", className: "h-4 w-4 fill-current", children: /* @__PURE__ */ jsx3("path", { d: "M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" }) })
                }
              )
            ] }),
            /* @__PURE__ */ jsxs3("div", { className: "mt-5", children: [
              /* @__PURE__ */ jsx3("label", { htmlFor: "rename-dialog-input", className: "text-sm font-medium", children: label }),
              /* @__PURE__ */ jsx3(
                "input",
                {
                  id: "rename-dialog-input",
                  "aria-label": label,
                  autoFocus: true,
                  value,
                  onChange: (event) => onChange(event.target.value),
                  className: "mt-2 w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-[var(--theme-fg)] outline-none transition focus:border-[var(--theme-accent-solid)]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs3("div", { className: "mt-5 flex items-center justify-end gap-2", children: [
              error ? /* @__PURE__ */ jsx3("p", { role: "alert", className: "text-sm text-rose-500", children: error }) : null,
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  onClick: onCancel,
                  disabled: busy,
                  className: "rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: translate("workbench.cancel")
                }
              ),
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "submit",
                  disabled: busy || !value.trim(),
                  className: "ui-action-success rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
                  children: submitLabel ?? translate("workbench.save")
                }
              )
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/components/useTabScrollEdges.ts
import { useLayoutEffect, useState } from "react";
function useTabScrollEdges(ref) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft > 2;
      const end = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      setEdges((current) => current.start === start && current.end === end ? current : { start, end });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resize?.observe(element);
    const mutation = new MutationObserver(update);
    mutation.observe(element, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);
  return { "data-overflow-start": edges.start, "data-overflow-end": edges.end };
}

// src/components/graph-workspace/GraphResizablePanels.tsx
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { jsx as jsx4 } from "react/jsx-runtime";
function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
function ResizablePanelGroup({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx4(
    ResizablePrimitive.PanelGroup,
    {
      "data-slot": "resizable-panel-group",
      className: classNames(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      ),
      ...props
    }
  );
}
function ResizablePanel({
  ...props
}) {
  return /* @__PURE__ */ jsx4(ResizablePrimitive.Panel, { "data-slot": "resizable-panel", ...props });
}
function ResizableHandle({
  withHandle,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx4(
    ResizablePrimitive.PanelResizeHandle,
    {
      "data-slot": "resizable-handle",
      className: classNames(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      ),
      ...props,
      children: withHandle ? /* @__PURE__ */ jsx4("div", { className: "bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border", children: /* @__PURE__ */ jsx4(GripVerticalIcon, { className: "size-2.5" }) }) : null
    }
  );
}

// src/components/workspacePaths.ts
function normalizeFileSystemPath(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\/([a-z]:\/)/i, "$1");
}
var APP_LOCAL_PATH_PREFIXES = [
  "/api/",
  "/assets/",
  "/control-plane",
  "/devices/",
  "/relay/",
  "/relay-account",
  "/relay-admin",
  "/relay-devices",
  "/relay-portal",
  "/threads",
  "/workspaces"
];
function localFileHref(value, origin) {
  let candidate = value.trim();
  if (!candidate || candidate.startsWith("#") || candidate.startsWith("//")) return null;
  if (/^(https?:|file:)/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "file:" && url.origin !== origin) return null;
      candidate = (url.protocol === "file:" && url.hostname ? `//${url.hostname}` : "") + url.pathname + url.hash;
    } catch {
      return null;
    }
  } else {
    candidate = candidate.split("?")[0] ?? "";
  }
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
  }
  candidate = normalizeFileSystemPath(candidate);
  if (/^[a-z][a-z+.-]*:/i.test(candidate) && !/^[a-z]:\//i.test(candidate)) return null;
  if (APP_LOCAL_PATH_PREFIXES.some((prefix) => candidate === prefix || candidate.startsWith(prefix))) return null;
  return candidate || null;
}
function relativeWorkspacePath(value, workspaceRoot) {
  let path = normalizeFileSystemPath(value);
  const root = normalizeFileSystemPath(workspaceRoot).replace(/\/+$/, "");
  const absolute = path.startsWith("/") || /^[a-z]:\//i.test(path);
  if (absolute) {
    const windows = /^[a-z]:\//i.test(root) || root.startsWith("//");
    const comparePath = windows ? path.toLowerCase() : path;
    const compareRoot = windows ? root.toLowerCase() : root;
    if (comparePath === compareRoot) return "";
    if (!comparePath.startsWith(`${compareRoot}/`)) return null;
    path = path.slice(root.length + 1);
  }
  const segments = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(part);
  }
  return segments.join("/");
}

// src/components/graph-workspace/workspaceTree.ts
var MOLECULAR_EXTENSIONS = /* @__PURE__ */ new Set(["xyz", "extxyz", "cif", "pdb"]);
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg"
]);
var PDF_EXTENSIONS = /* @__PURE__ */ new Set(["pdf"]);
function collectArtifacts(detail) {
  const artifacts = [];
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (item.kind === "artifact" && item.artifact) {
        artifacts.push(item.artifact);
      }
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    if (item.kind === "artifact" && item.artifact) {
      artifacts.push(item.artifact);
    }
  }
  return artifacts;
}
function sanitizePathSegment(value) {
  return value.trim().replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
function extensionOf(path) {
  return path.split(".").pop()?.toLowerCase() || "";
}
function fileNameFromPath(path) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
function workspaceTreeNodeToGraphNode(node) {
  const kind = node.kind === "directory" ? "directory" : "file";
  const normalized = normalizeFileSystemPath(node.path);
  const path = normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) ? normalized : relativeWorkspacePath(normalized, "") ?? normalized;
  const children = (node.children ?? []).map(workspaceTreeNodeToGraphNode);
  return {
    id: `workspace:${path}`,
    name: node.name,
    path,
    kind,
    ...node.size !== void 0 ? { size: node.size } : {},
    ...node.hasChildren !== void 0 ? { hasChildren: node.hasChildren } : kind === "directory" ? { hasChildren: children.length > 0 } : {},
    ...node.childrenLoaded !== void 0 ? { childrenLoaded: node.childrenLoaded } : kind === "directory" ? { childrenLoaded: node.children !== void 0 } : {},
    ...node.truncated !== void 0 ? { truncated: node.truncated } : {},
    workspaceNode: { ...node, path },
    children
  };
}
function findFirstWorkspaceFile(node) {
  if (node.kind === "file") {
    return node;
  }
  for (const child of node.children) {
    const found = findFirstWorkspaceFile(child);
    if (found) {
      return found;
    }
  }
  return null;
}
function normalizeWorkspacePath(path) {
  return path.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}
function workspaceRelativeFocusPath(path, workspaceRootPath) {
  return relativeWorkspacePath(path, workspaceRootPath) ?? normalizeFileSystemPath(path);
}
function ancestorDirectoryPaths(path) {
  const normalized = normalizeWorkspacePath(path);
  const segments = normalized.split("/").filter(Boolean);
  segments.pop();
  const paths = [];
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  }
  return paths;
}
function hasWorkspacePath(node, targetPath) {
  if (!node || !targetPath) {
    return false;
  }
  if (node.path === targetPath) {
    return true;
  }
  return node.children.some((child) => hasWorkspacePath(child, targetPath));
}
function buildMoleculePreviewSnapshot(file) {
  if (!file) {
    return null;
  }
  const extension = extensionOf(file.path);
  if (!MOLECULAR_EXTENSIONS.has(extension)) {
    return null;
  }
  return {
    content: [file.content.endsWith("\n") ? file.content : `${file.content}
`],
    format: extension === "extxyz" ? "xyz" : extension,
    name: file.name,
    uuid: file.path
  };
}
function languageForPath(path) {
  const extension = extensionOf(path);
  if (extension === "tsx" || extension === "jsx") {
    return "tsx";
  }
  if (extension === "yml") {
    return "yaml";
  }
  return extension || "text";
}
function ensureDirectory(root, segments) {
  let current = root;
  let path = "";
  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment;
    let child = current.children.find(
      (node) => node.kind === "directory" && node.name === segment
    );
    if (!child) {
      child = {
        id: `dir:${path}`,
        name: segment,
        path,
        kind: "directory",
        children: []
      };
      current.children.push(child);
    }
    current = child;
  }
  return current;
}
function addPathNode(root, path, node) {
  const segments = path.split("/").filter(Boolean);
  const fileName = segments.pop() ?? node.name;
  const parent = ensureDirectory(root, segments);
  parent.children.push({
    ...node,
    name: node.name || fileName,
    path
  });
}
function compareWorkspaceNodes(left, right) {
  if (left.kind === "directory" && right.kind !== "directory") {
    return -1;
  }
  if (left.kind !== "directory" && right.kind === "directory") {
    return 1;
  }
  return left.name.localeCompare(right.name);
}
function sortWorkspaceTree(node) {
  node.children.sort(compareWorkspaceNodes);
  for (const child of node.children) {
    sortWorkspaceTree(child);
  }
  return node;
}
function collectWorkspaceItems(detail, artifacts, status, activeView) {
  const root = {
    id: "root",
    name: detail.workspace.label ?? translate("files.workspace"),
    path: "",
    kind: "directory",
    children: []
  };
  const artifactRoot = {
    id: "artifacts",
    name: "artifacts",
    path: "artifacts",
    kind: "directory",
    children: []
  };
  for (const artifact of artifacts) {
    const title = artifact.title || artifact.id;
    const safeName = sanitizePathSegment(title) || artifact.id;
    artifactRoot.children.push({
      id: `artifact:${artifact.id}`,
      name: `${safeName}.artifact`,
      path: `artifacts/${safeName}.artifact`,
      kind: "artifact",
      artifact,
      preview: artifact.summaryText ?? artifact.type,
      detail: JSON.stringify(artifact.payload, null, 2),
      children: []
    });
  }
  const eventRoot = {
    id: "thread-events",
    name: "thread-events",
    path: "thread-events",
    kind: "directory",
    children: []
  };
  const liveRoot = {
    id: "live",
    name: "live",
    path: "live",
    kind: "directory",
    children: []
  };
  let sequence = 0;
  const addEventNode = (turnId, item, live = false) => {
    sequence += 1;
    const label = item.kind.replace(/([A-Z])/g, "-$1").toLowerCase();
    const eventPath = `${live ? "live" : `thread-events/${turnId}`}/${String(
      sequence
    ).padStart(3, "0")}-${label}.json`;
    const preview = "text" in item && typeof item.text === "string" ? item.text.slice(0, 160) : item.kind;
    const artifact = item.kind === "artifact" && item.artifact ? item.artifact : null;
    const node = artifact && live ? {
      id: `live-artifact:${artifact.id}`,
      name: artifact.title || artifact.id,
      path: eventPath,
      kind: "live-artifact",
      artifact,
      item,
      preview: artifact.summaryText ?? artifact.type,
      detail: JSON.stringify(artifact.payload, null, 2),
      children: []
    } : {
      id: `event:${item.id}`,
      name: fileNameFromPath(eventPath),
      path: eventPath,
      kind: "event",
      item,
      preview,
      detail: JSON.stringify(item, null, 2),
      children: []
    };
    if (live) {
      liveRoot.children.push(node);
      return;
    }
    addPathNode(eventRoot, eventPath.replace(/^thread-events\//, ""), node);
  };
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (item.kind === "commandExecution" || item.kind === "webSearch" || item.kind === "fileRead" || item.kind === "fileChange" || item.kind === "agentToolCall" || item.kind === "skillToolCall" || item.kind === "toolCall" || item.kind === "hook" || item.kind === "plan" || item.kind === "reasoning") {
        addEventNode(turn.id, item);
      }
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    addEventNode(detail.thread.activeTurnId ?? "live", item, true);
  }
  void status;
  void activeView;
  root.children.push(artifactRoot, eventRoot, liveRoot);
  return sortWorkspaceTree(root);
}
function flattenWorkspaceNodes(root) {
  const map = /* @__PURE__ */ new Map();
  const visit = (node) => {
    map.set(node.id, node);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return map;
}
function findFirstPreviewNode(node) {
  if (node.kind === "artifact" || node.kind === "live-artifact" || node.kind === "event" || node.kind === "file") {
    return node;
  }
  for (const child of node.children) {
    const found = findFirstPreviewNode(child);
    if (found) {
      return found;
    }
  }
  return null;
}
function collectAncestorPaths(path) {
  const segments = path.split("/").filter(Boolean);
  const paths = [];
  for (let index = 1; index <= segments.length; index += 1) {
    paths.push(segments.slice(0, index).join("/"));
  }
  return paths;
}

// src/components/graph-ui/Button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { jsx as jsx5 } from "react/jsx-runtime";
var buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ jsx5(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/components/ZoomableImage.tsx
import { createContext, useContext, useEffect as useEffect3, useRef as useRef2, useState as useState3 } from "react";
import { createPortal as createPortal3 } from "react-dom";

// src/components/useImageViewport.ts
import { useRef, useState as useState2 } from "react";
var MIN_SCALE = 0.5;
var MAX_SCALE = 5;
var clamp = (scale) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
function useImageViewport() {
  const viewportRef = useRef(null);
  const [view, setView] = useState2({ x: 0, y: 0, scale: 1 });
  const current = useRef(view);
  const pointers = useRef(/* @__PURE__ */ new Map());
  const baseline = useRef(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState2(false);
  const commit = (next) => {
    current.current = next;
    setView(next);
  };
  function centerAndDistance() {
    const points = [...pointers.current.values()].slice(0, 2);
    const a = points[0];
    if (!a) return null;
    const b = points[1] ?? a;
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function restartGesture() {
    const points = centerAndDistance();
    baseline.current = points ? { ...points, view: current.current } : null;
    setDragging(pointers.current.size > 0);
  }
  function local(point) {
    const element = viewportRef.current;
    if (!element) return point;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: point.x - rect.left - (rect.width + parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0")) / 2,
      y: point.y - rect.top - (rect.height + parseFloat(style.paddingTop || "0") - parseFloat(style.paddingBottom || "0")) / 2
    };
  }
  function updateScale(scale, clientX, clientY) {
    const old = current.current;
    const next = clamp(scale);
    const anchor = clientX === void 0 || clientY === void 0 ? { x: 0, y: 0 } : local({ x: clientX, y: clientY });
    const ratio = next / old.scale;
    commit({ scale: next, x: anchor.x - (anchor.x - old.x) * ratio, y: anchor.y - (anchor.y - old.y) * ratio });
  }
  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    restartGesture();
  }
  function onPointerMove(event) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const base = baseline.current;
    const points = centerAndDistance();
    if (!base || !points) return;
    const dx = points.center.x - base.center.x;
    const dy = points.center.y - base.center.y;
    if (Math.hypot(dx, dy) > 3 || Math.abs(points.distance - base.distance) > 3) moved.current = true;
    if (pointers.current.size >= 2 && base.distance > 0) {
      const scale = clamp(base.view.scale * points.distance / base.distance);
      const ratio = scale / base.view.scale;
      const start = local(base.center);
      const end = local(points.center);
      commit({ scale, x: end.x - (start.x - base.view.x) * ratio, y: end.y - (start.y - base.view.y) * ratio });
    } else if (base.view.scale > 1) {
      commit({ ...base.view, x: base.view.x + dx, y: base.view.y + dy });
    }
  }
  function onPointerEnd(event) {
    if (!pointers.current.delete(event.pointerId)) return;
    restartGesture();
  }
  return {
    viewportRef,
    scale: view.scale,
    dragging,
    moved,
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
    reset: () => {
      commit({ x: 0, y: 0, scale: 1 });
      restartGesture();
    },
    updateScale,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
      onWheel: (event) => {
        event.preventDefault();
        updateScale(current.current.scale + (event.deltaY < 0 ? 0.25 : -0.25), event.clientX, event.clientY);
      }
    }
  };
}

// src/components/ZoomableImage.tsx
import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Fragment, jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var MarkdownImageLinkContext = createContext(false);
var IMAGE_LIGHTBOX_MIN_SCALE = 0.5;
var IMAGE_LIGHTBOX_MAX_SCALE = 5;
var IMAGE_LIGHTBOX_SCALE_STEP = 0.25;
function GraphWorkspaceImageLightbox({
  alt,
  backgroundColor,
  onClose,
  src
}) {
  const { locale: i18nLocale } = useI18n();
  const { viewportRef, scale, dragging, transform, reset: resetView, updateScale, handlers, moved } = useImageViewport();
  const closeButtonRef = useRef2(null);
  const backdropPointer = useRef2(true);
  useEffect3(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);
  return createPortal3(
    /* @__PURE__ */ jsxs4(
      "div",
      {
        className: "thread-graph-image-lightbox",
        style: backgroundColor ? { backgroundColor } : void 0,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": translate("files.imagePreview", { value1: alt || translate("files.workspaceImage") }),
        children: [
          /* @__PURE__ */ jsxs4(
            "div",
            {
              className: "thread-graph-image-lightbox-toolbar",
              role: "toolbar",
              "aria-label": translate("files.imageZoomControls"),
              children: [
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    onClick: () => updateScale(scale - IMAGE_LIGHTBOX_SCALE_STEP),
                    disabled: scale <= IMAGE_LIGHTBOX_MIN_SCALE,
                    title: translate("files.zoomOut"),
                    "aria-label": translate("files.zoomOut"),
                    children: /* @__PURE__ */ jsx6(Minus, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsxs4(
                  "button",
                  {
                    type: "button",
                    onClick: resetView,
                    className: "thread-graph-image-lightbox-scale",
                    title: translate("files.resetZoom"),
                    "aria-label": translate("files.resetZoomCurrently", { value1: Math.round(scale * 100) }),
                    children: [
                      /* @__PURE__ */ jsx6(RotateCcw, { className: "h-3.5 w-3.5" }),
                      /* @__PURE__ */ jsxs4("span", { children: [
                        Math.round(scale * 100),
                        "%"
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    onClick: () => updateScale(scale + IMAGE_LIGHTBOX_SCALE_STEP),
                    disabled: scale >= IMAGE_LIGHTBOX_MAX_SCALE,
                    title: translate("files.zoomIn"),
                    "aria-label": translate("files.zoomIn"),
                    children: /* @__PURE__ */ jsx6(Plus, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "span",
                  {
                    className: "thread-graph-image-lightbox-divider",
                    "aria-hidden": "true"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    ref: closeButtonRef,
                    type: "button",
                    onClick: onClose,
                    title: translate("files.closeImagePreview"),
                    "aria-label": translate("files.closeImagePreview"),
                    children: /* @__PURE__ */ jsx6(X, { className: "h-4 w-4" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx6(
            "div",
            {
              ref: viewportRef,
              className: "thread-graph-image-lightbox-viewport",
              onClick: (event) => {
                if (event.target === event.currentTarget && backdropPointer.current && !moved.current) {
                  onClose();
                }
              },
              ...handlers,
              onPointerDown: (event) => {
                backdropPointer.current = event.target === event.currentTarget;
                handlers.onPointerDown(event);
              },
              children: /* @__PURE__ */ jsx6(
                "img",
                {
                  src,
                  alt,
                  draggable: false,
                  className: dragging ? "is-dragging" : "",
                  style: {
                    transform
                  }
                }
              )
            }
          )
        ]
      }
    ),
    document.body
  );
}
function ZoomableImage({
  alt,
  className,
  fullSrc,
  loading,
  src,
  width,
  height
}) {
  const { locale: i18nLocale } = useI18n();
  const triggerRef = useRef2(null);
  const [open, setOpen] = useState3(false);
  const insideLink = useContext(MarkdownImageLinkContext);
  const dimension = (value) => typeof value === "number" ? value : value && /^\d+(?:\.\d+)?%?$/.test(value) ? value.endsWith("%") ? value : Number(value) : void 0;
  const imageStyle = { width: dimension(width), height: dimension(height) };
  const image = /* @__PURE__ */ jsx6("img", { src, alt, className, loading, style: imageStyle });
  function closeLightbox() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }
  if (insideLink) return image;
  return /* @__PURE__ */ jsxs4(Fragment, { children: [
    /* @__PURE__ */ jsx6(
      "button",
      {
        ref: triggerRef,
        type: "button",
        className: "thread-graph-zoomable-image-trigger",
        style: { width: dimension(width) },
        onClick: () => setOpen(true),
        title: translate("files.openImagePreview"),
        "aria-label": translate("files.openImagePreview_bdac35", { value1: alt || translate("files.workspaceImage") }),
        children: image
      }
    ),
    open ? /* @__PURE__ */ jsx6(
      GraphWorkspaceImageLightbox,
      {
        src: fullSrc || src,
        alt,
        onClose: closeLightbox
      }
    ) : null
  ] });
}
function WorkspaceImagePreview({ src, alt }) {
  useI18n();
  const { viewportRef, scale, dragging, transform, reset, updateScale, handlers } = useImageViewport();
  const [open, setOpen] = useState3(false);
  return /* @__PURE__ */ jsxs4("div", { className: "workspace-image-preview", children: [
    /* @__PURE__ */ jsxs4("div", { className: "workspace-image-controls", role: "toolbar", "aria-label": translate("files.imageZoomControls"), children: [
      /* @__PURE__ */ jsx6("button", { type: "button", onClick: () => updateScale(scale - 0.25), disabled: scale <= IMAGE_LIGHTBOX_MIN_SCALE, "aria-label": translate("files.zoomOut"), children: /* @__PURE__ */ jsx6(Minus, { size: 14 }) }),
      /* @__PURE__ */ jsx6("button", { type: "button", onClick: reset, "aria-label": translate("files.resetZoom"), children: /* @__PURE__ */ jsxs4("span", { children: [
        Math.round(scale * 100),
        "%"
      ] }) }),
      /* @__PURE__ */ jsx6("button", { type: "button", onClick: () => updateScale(scale + 0.25), disabled: scale >= IMAGE_LIGHTBOX_MAX_SCALE, "aria-label": translate("files.zoomIn"), children: /* @__PURE__ */ jsx6(Plus, { size: 14 }) }),
      /* @__PURE__ */ jsx6("button", { type: "button", onClick: () => setOpen(true), "aria-label": translate("files.openImagePreview"), children: /* @__PURE__ */ jsx6(Maximize2, { size: 14 }) })
    ] }),
    /* @__PURE__ */ jsx6("div", { ref: viewportRef, className: "workspace-image-viewport", ...handlers, children: /* @__PURE__ */ jsx6("img", { src, alt, draggable: false, className: dragging ? "is-dragging" : "", style: { transform } }) }),
    open && /* @__PURE__ */ jsx6(GraphWorkspaceImageLightbox, { src, alt, onClose: () => setOpen(false) })
  ] });
}

// src/components/workbench/FilePanelContext.tsx
import { createContext as createContext2, useContext as useContext2 } from "react";
var FilePanelContext = createContext2(null);
var useFilePanel = () => useContext2(FilePanelContext);

// src/components/graph-chat/graphChatShiki.ts
var CSS_VARIABLES_SYNTAX_THEME = "pockymoe-css-variables";
function syntaxThemeFor(dark, themePreset) {
  if (themePreset === "plum-pocket") return CSS_VARIABLES_SYNTAX_THEME;
  return dark ? "ayu-dark" : "github-light-default";
}
var graphChatHighlighterPromise = null;
function getGraphChatHighlighter() {
  graphChatHighlighterPromise ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/themes/github-light-default.mjs"),
    import("shiki/themes/ayu-dark.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/tsx.mjs"),
    import("shiki/langs/jsx.mjs"),
    import("shiki/langs/python.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/bash.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/yaml.mjs"),
    import("shiki/langs/toml.mjs"),
    import("shiki/langs/markdown.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/css.mjs"),
    import("shiki/langs/sql.mjs"),
    import("shiki/langs/csv.mjs"),
    import("shiki/langs/ruby.mjs"),
    import("shiki/langs/rust.mjs"),
    import("shiki/langs/go.mjs"),
    import("shiki/langs/java.mjs"),
    import("shiki/langs/c.mjs"),
    import("shiki/langs/cpp.mjs"),
    import("shiki/langs/csharp.mjs"),
    import("shiki/langs/xml.mjs")
  ]).then(
    ([
      { createHighlighterCore, createCssVariablesTheme },
      { createJavaScriptRegexEngine },
      ayuLight,
      ayuDark,
      javascript,
      typescript,
      tsx,
      jsx8,
      python,
      json,
      bash,
      shellscript,
      yaml,
      toml,
      markdown,
      html,
      css,
      sql,
      csv,
      ruby,
      rust,
      go,
      java,
      c,
      cpp,
      csharp,
      xml
    ]) => createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [
        ayuLight.default,
        ayuDark.default,
        createCssVariablesTheme({ name: CSS_VARIABLES_SYNTAX_THEME, variablePrefix: "--shiki-", fontStyle: true })
      ],
      langs: [
        javascript.default,
        typescript.default,
        tsx.default,
        jsx8.default,
        python.default,
        json.default,
        bash.default,
        shellscript.default,
        yaml.default,
        toml.default,
        markdown.default,
        html.default,
        css.default,
        sql.default,
        csv.default,
        ruby.default,
        rust.default,
        go.default,
        java.default,
        c.default,
        cpp.default,
        csharp.default,
        xml.default
      ]
    })
  );
  return graphChatHighlighterPromise;
}

// src/components/externalLinkProps.ts
function externalLinkProps(href) {
  if (!href) return {};
  try {
    const origin = typeof window === "undefined" ? void 0 : window.location.origin;
    const url = new URL(href, origin);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin) {
      return { target: "_blank", rel: "noopener noreferrer" };
    }
  } catch {
  }
  return {};
}

// src/components/markdownHtml.ts
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
var schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []).filter((attribute) => attribute !== "align"), ["align", "left", "center", "right"]],
    code: [["className", /^language-./, "math-inline", "math-display"]],
    details: [...defaultSchema.attributes?.details ?? [], "open"]
  },
  strip: [...defaultSchema.strip ?? [], "style", "iframe", "object", "embed"],
  protocols: {
    ...defaultSchema.protocols,
    // Preserve adapter links and Windows drive paths; the URL transform still
    // rejects non-file drive schemes before any browser anchor is created.
    href: [...defaultSchema.protocols?.href ?? [], "file", "workspace-auto", ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"]
  }
};
var markdownHtmlPlugins = [rehypeRaw, [rehypeSanitize, schema]];

// src/components/WorkspaceFileLink.tsx
import { useEffect as useEffect4, useRef as useRef3, useState as useState4 } from "react";
import { createPortal as createPortal4 } from "react-dom";
import { Fragment as Fragment2, jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function WorkspaceFileLink({ path, line, children, onOpen, className = "thread-inline-link" }) {
  useI18n();
  const [menu, setMenu] = useState4(null);
  const [copyError, setCopyError] = useState4(false);
  const menuRef = useRef3(null);
  const displayPath = path.startsWith("/") || /^[a-z]:/i.test(path) ? path : `./${path.replace(/^\.\//, "")}`;
  const address = displayPath + (line ? `#L${line}` : "");
  useEffect4(() => {
    if (!menu) return;
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenu(null);
    };
    const key = (event) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", dismiss, true);
    menuRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [menu]);
  const open = () => {
    setMenu(null);
    onOpen({ path, ...line ? { line } : {} });
  };
  return /* @__PURE__ */ jsxs5(Fragment2, { children: [
    /* @__PURE__ */ jsx7(
      "a",
      {
        href: displayPath.split("/").map(encodeURIComponent).join("/") + (line ? `#L${line}` : ""),
        title: address,
        className,
        onClick: (event) => {
          event.preventDefault();
          open();
        },
        onContextMenu: (event) => {
          event.preventDefault();
          setCopyError(false);
          setMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 100) });
        },
        children
      }
    ),
    menu && createPortal4(/* @__PURE__ */ jsxs5("div", { ref: menuRef, role: "menu", "aria-label": translate("files.fileLink"), className: "thread-workspace-link-menu", style: { left: Math.max(8, menu.x), top: Math.max(8, menu.y) }, children: [
      /* @__PURE__ */ jsx7("button", { role: "menuitem", onClick: open, children: translate("files.openFile") }),
      /* @__PURE__ */ jsx7("button", { role: "menuitem", onClick: () => {
        void navigator.clipboard.writeText(address).then(() => setMenu(null)).catch(() => setCopyError(true));
      }, children: translate("files.copyLinkAddress") }),
      copyError && /* @__PURE__ */ jsx7("span", { role: "alert", children: translate("files.couldNotCopyPath") })
    ] }), document.body)
  ] });
}

export {
  cn,
  Button,
  MarkdownImageLinkContext,
  GraphWorkspaceImageLightbox,
  ZoomableImage,
  WorkspaceImagePreview,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  RenameDialog,
  FilePanelContext,
  useFilePanel,
  useTabScrollEdges,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  syntaxThemeFor,
  getGraphChatHighlighter,
  normalizeFileSystemPath,
  localFileHref,
  relativeWorkspacePath,
  MOLECULAR_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PDF_EXTENSIONS,
  collectArtifacts,
  extensionOf,
  workspaceTreeNodeToGraphNode,
  findFirstWorkspaceFile,
  workspaceRelativeFocusPath,
  ancestorDirectoryPaths,
  hasWorkspacePath,
  buildMoleculePreviewSnapshot,
  languageForPath,
  collectWorkspaceItems,
  flattenWorkspaceNodes,
  findFirstPreviewNode,
  collectAncestorPaths,
  externalLinkProps,
  markdownHtmlPlugins,
  WorkspaceFileLink,
  documentStores,
  documentListeners,
  isProtected,
  newDraft,
  editDraft,
  settleSave,
  confirmWorkspaceDocumentLeave,
  downloadDraft,
  ConfirmDialog
};
