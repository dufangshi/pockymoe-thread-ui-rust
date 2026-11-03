import type {
  WorkspaceDocumentSnapshot,
  WorkspaceSaveReceipt,
} from '../../../adapters';
import { translate } from '../../../i18n';

export interface WorkspaceDraft {
  key: string;
  snapshot: WorkspaceDocumentSnapshot;
  content: string;
  baseContent: string;
  revision: number;
  editing: boolean;
  phase: 'clean' | 'dirty' | 'saving' | 'conflict' | 'unknown' | 'error';
  needsVerification?: boolean;
  operationPending?: boolean;
  error: string | null;
  conflict?: WorkspaceDocumentSnapshot;
  /** What found the conflict: a save the disk refused, or a check of the disk. */
  conflictFrom?: 'save' | 'check';
  submitted?: { content: string; revision: number; operationId: string };
}
// Host and lazy workspace entries can be prebundled separately. Keep source
// isolation and navigation protection in one browser-global memory store.
const storeKey = Symbol.for('remote-codex.workspace-documents');
interface DocumentMemory {
  stores: Map<string, Map<string, WorkspaceDraft>>;
  listeners: Set<() => void>;
  unloadInstalled?: boolean;
  unloadApproval?: { doc: WorkspaceDraft; revision: number; content: string; baseContent: string; phase: WorkspaceDraft['phase'] }[];
}
const documentGlobal = globalThis as typeof globalThis & {
  [storeKey]?: DocumentMemory;
};
const memory: DocumentMemory = (documentGlobal[storeKey] ??= {
  stores: new Map(),
  listeners: new Set(),
});
export const documentStores = memory.stores;
export const documentListeners = memory.listeners;
// Panel visibility must not remove reload protection for its retained drafts.
if (typeof window !== 'undefined' && !memory.unloadInstalled) {
  memory.unloadInstalled = true;
  window.addEventListener('beforeunload', (event) => {
    const protectedDocs = protectedWorkspaceDocuments();
    const approval = memory.unloadApproval;
    const approved = approval && approvalMatches(approval, protectedDocs);
    if (approved) {
      // Native update preflight dispatches an untrusted synthetic event. Keep
      // approval for the actual browser unload, or revoke it when native aborts.
      if (event.isTrusted) delete memory.unloadApproval;
      return;
    }
    if (protectedDocs.length) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
function protectedWorkspaceDocuments(): WorkspaceDraft[] {
  return [...documentStores.values()].flatMap(store => [...store.values()]).filter(isProtected);
}
/** Count retained dirty/uncertain documents, including panels no longer visible. */
export function getDirtyWorkspaceDocumentCount(): number { return protectedWorkspaceDocuments().length; }
/** Consent applies only to these exact revisions, never to subsequent edits. */
function snapshotProtectedDocuments() {
  return protectedWorkspaceDocuments().map(doc => ({ doc, revision: doc.revision, content: doc.content, baseContent: doc.baseContent, phase: doc.phase }));
}
function approvalMatches(approval: NonNullable<DocumentMemory['unloadApproval']>, documents = protectedWorkspaceDocuments()): boolean {
  return approval.length === documents.length && documents.every(doc => approval.some(saved => saved.doc === doc && saved.revision === doc.revision && saved.content === doc.content && saved.baseContent === doc.baseContent && saved.phase === doc.phase));
}
export function approveWorkspaceDocumentUnloadOnce(): void { memory.unloadApproval = snapshotProtectedDocuments(); }
/** Capture before showing the dialog; edits arriving while it is open need new consent. */
export function prepareWorkspaceDocumentUnloadApproval(): () => boolean {
  const snapshot = snapshotProtectedDocuments();
  return () => {
    if (!approvalMatches(snapshot)) return false;
    memory.unloadApproval = snapshot;
    return true;
  };
}
export function revokeWorkspaceDocumentUnloadApproval(): void { delete memory.unloadApproval; }

export function isProtected(doc: WorkspaceDraft) {
  return (
    doc.content !== doc.baseContent ||
    ['saving', 'unknown', 'conflict'].includes(doc.phase)
  );
}
export function newDraft(
  key: string,
  snapshot: WorkspaceDocumentSnapshot,
): WorkspaceDraft {
  return {
    key,
    snapshot,
    content: snapshot.content ?? '',
    baseContent: snapshot.content ?? '',
    revision: 0,
    editing: false,
    phase: 'clean',
    error: null,
  };
}
export function editDraft(
  doc: WorkspaceDraft,
  content: string,
): WorkspaceDraft {
  return {
    ...doc,
    content,
    revision: doc.revision + 1,
    phase: ['saving', 'conflict', 'unknown'].includes(doc.phase)
      ? doc.phase
      : content === doc.baseContent
        ? 'clean'
        : 'dirty',
  };
}
export function settleSave(
  doc: WorkspaceDraft,
  receipt: WorkspaceSaveReceipt,
): WorkspaceDraft {
  const submitted = doc.submitted;
  if (
    !submitted ||
    submitted.operationId !== receipt.operationId ||
    submitted.revision !== receipt.draftRevision
  )
    return doc;
  if (
    receipt.status === 'saved' &&
    receipt.contentHash &&
    receipt.fileIdentity
  ) {
    return {
      ...doc,
      baseContent: submitted.content,
      snapshot: {
        ...doc.snapshot,
        content: submitted.content,
        contentHash: receipt.contentHash,
        fileIdentity: receipt.fileIdentity,
        size: receipt.size ?? doc.snapshot.size,
        workspaceRevision:
          receipt.workspaceRevision ?? doc.snapshot.workspaceRevision,
        encoding: receipt.encoding ?? doc.snapshot.encoding,
        bom: receipt.bom ?? doc.snapshot.bom,
        eol: receipt.eol ?? doc.snapshot.eol,
      },
      phase: doc.content === submitted.content ? 'clean' : 'dirty',
      submitted: undefined,
      conflict: undefined,
      needsVerification: false,
      operationPending: false,
      error: null,
    };
  }
  if (receipt.status === 'conflict')
    return {
      ...doc,
      phase: 'conflict',
      conflict: receipt.snapshot,
      conflictFrom: 'save',
      submitted: undefined,
      error: receipt.snapshot ? null : translate('files.safeMissing'),
    };
  if (receipt.status === 'failedBeforeWrite')
    return {
      ...doc,
      phase: 'error',
      submitted: undefined,
      snapshot:
        receipt.code === 'forbidden'
          ? { ...doc.snapshot, readOnlyReason: 'permissionDenied' }
          : doc.snapshot,
      error: receipt.message ?? translate('files.failedToSaveFile'),
    };
  return {
    ...doc,
    phase: 'unknown',
    operationPending: receipt.status === 'pending',
    error: translate(
      receipt.status === 'pending'
        ? 'files.safeWaitBeforeLeave'
        : 'files.safeUnknown',
    ),
  };
}
/** Drafts are only in memory; confirm before intentional app/source navigation. */
export function confirmWorkspaceDocumentLeave(): boolean {
  const protectedDocs = [...documentStores.values()]
    .flatMap((store) => [...store.values()])
    .filter(isProtected);
  if (!protectedDocs.length) return true;
  // A pending write cannot safely be abandoned as though it was cancelled.
  if (
    protectedDocs.some(
      (doc) => doc.phase === 'saving' || doc.phase === 'unknown',
    )
  ) {
    window.alert(translate('files.safeWaitBeforeLeave'));
    return false;
  }
  if (!window.confirm(translate('files.safeLeave'))) return false;
  for (const store of documentStores.values())
    for (const [path, doc] of store)
      if (isProtected(doc)) {
        store.delete(path);
        window.dispatchEvent(
          new CustomEvent('workspace-model-release', { detail: doc.key }),
        );
      }
  for (const listener of documentListeners) listener();
  return true;
}
export function downloadDraft(doc: WorkspaceDraft, disk = false) {
  const content = disk ? doc.conflict?.content : doc.content;
  if (content == null) return;
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.snapshot.name}.${disk ? 'disk-snapshot' : 'draft'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
