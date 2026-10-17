import { useCallback, useEffect, useReducer } from 'react';
import type {
  ThreadWorkspaceAdapter,
  WorkspaceDocumentSnapshot,
} from '../../../adapters';
import type { WorkspaceExplorerIdentity } from './useWorkspaceExplorerPersistence';
import { translate } from '../../../i18n';
import {
  documentStores,
  documentListeners,
  newDraft,
  editDraft,
  settleSave,
  isProtected,
  type WorkspaceDraft,
} from './workspaceDocuments';

// Notify all views sharing one workspace, including split panes.
const listeners = documentListeners;
const notify = () => {
  for (const listener of listeners) listener();
};
export function useWorkspaceDocuments(
  adapter: ThreadWorkspaceAdapter | null | undefined,
  identity: WorkspaceExplorerIdentity,
) {
  const source = JSON.stringify([
    adapter?.resourceScopeKey ?? identity.threadId,
    identity.workspaceId,
  ]);
  let store = documentStores.get(source);
  if (!store) {
    store = new Map();
    documentStores.set(source, store);
  }
  const documents = store;
  function replaceDocument(path: string, next: WorkspaceDraft) {
    const previous = documents.get(path);
    const key = JSON.stringify([source, next.snapshot.workspaceRevision, path]);
    if (previous && previous.key !== key)
      window.dispatchEvent(
        new CustomEvent('workspace-model-release', { detail: previous.key }),
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
    async (path: string, signal?: AbortSignal) => {
      if (!adapter?.readDocument) return null;
      const existing = documents.get(path);
      if (existing) return existing.snapshot;
      const snapshot = await adapter.readDocument({
        ...identity,
        path,
        signal,
      });
      if (signal?.aborted) return null;
      // Resolve concurrent reads without replacing a newly edited draft.
      if (!documents.has(path)) {
        const all = [...documentStores.values()].flatMap((store) =>
          [...store].map(([path, doc]) => ({ store, path, doc })),
        );
        if (all.length >= 32) {
          const clean = all.find(
            ({ doc }) => !isProtected(doc) && !doc.editing,
          );
          if (clean) {
            clean.store.delete(clean.path);
            window.dispatchEvent(
              new CustomEvent('workspace-model-release', {
                detail: clean.doc.key,
              }),
            );
          } else throw new Error(translate('files.safeDraftBudget'));
        }
        documents.set(
          path,
          newDraft(
            JSON.stringify([source, snapshot.workspaceRevision, path]),
            snapshot,
          ),
        );
        notify();
      }
      return documents.get(path)!.snapshot;
    },
    [adapter, documents, identity, source],
  );
  function change(path: string, content: string) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, editDraft(doc, content));
    notify();
  }
  function setEditing(path: string, editing: boolean) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, { ...doc, editing });
    notify();
  }
  function discard(path: string) {
    const doc = documents.get(path);
    if (!doc) return true;
    if (doc.phase === 'saving' || doc.phase === 'unknown') return false;
    documents.delete(path);
    window.dispatchEvent(
      new CustomEvent('workspace-model-release', { detail: doc.key }),
    );
    notify();
    return true;
  }
  async function reconcile(path: string) {
    const doc = documents.get(path);
    if (!doc?.submitted || !adapter?.getSaveOperation) return false;
    try {
      const receipt = await adapter.getSaveOperation({
        ...identity,
        operationId: doc.submitted.operationId,
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
      return receipt.status === 'saved';
    } catch {
      const current = documents.get(path);
      if (current)
        documents.set(path, {
          ...current,
          phase: 'unknown',
          error: translate('files.safeUnknown'),
        });
      notify();
      return false;
    }
  }
  async function save(path: string, useConflict = false) {
    const doc = documents.get(path);
    if (
      !doc ||
      !adapter?.saveDocument ||
      ['saving', 'unknown'].includes(doc.phase) ||
      doc.snapshot.readOnlyReason
    )
      return false;
    const base = useConflict ? doc.conflict : doc.snapshot;
    if (!base?.contentHash || (useConflict && base.readOnlyReason))
      return false;
    const operationCreatedAt = Date.now();
    const submitted = {
      content: doc.content,
      revision: doc.revision,
      operationId: crypto.randomUUID(),
    };
    documents.set(path, { ...doc, phase: 'saving', submitted, error: null });
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
        expectedHash: base.contentHash,
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (!current) return false;
      // Adapter classifies known rejections as receipts. All thrown transport
      // failures are unknown until the original operation is queried.
      documents.set(path, {
        ...current,
        phase: 'unknown',
        error:
          error instanceof Error
            ? error.message
            : translate('files.safeUnknown'),
      });
      notify();
      await reconcile(path);
    }
    const latest = documents.get(path);
    return latest?.phase === 'clean' && latest.revision === submitted.revision;
  }
  function adoptDisk(path: string, revision: number) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (
      !doc ||
      !disk ||
      disk.content == null ||
      doc.revision !== revision ||
      doc.phase === 'saving'
    )
      return;
    replaceDocument(path, {
      ...newDraft(JSON.stringify([source, disk.workspaceRevision, path]), disk),
      revision: doc.revision + 1,
      editing: doc.editing,
      needsVerification: true,
    });
    notify();
  }
  async function checkDisk(path: string) {
    const doc = documents.get(path);
    if (!doc || !adapter?.readDocument || doc.phase === 'saving') return;
    const revision = doc.revision;
    try {
      const disk = await adapter.readDocument({ ...identity, path });
      const current = documents.get(path);
      if (!current) return;
      if (current.error) current.error = null;
      if (isProtected(current) || current.revision !== revision) {
        if (
          current.phase === 'unknown' ||
          disk.contentHash !== current.snapshot.contentHash ||
          disk.fileIdentity !== current.snapshot.fileIdentity
        )
          documents.set(path, {
            ...current,
            phase: current.phase === 'unknown' ? 'unknown' : 'conflict',
            conflict: disk,
            conflictFrom: current.phase === 'conflict' && current.conflictFrom === 'save' ? 'save' : 'check',
          });
      } else
        replaceDocument(path, {
          ...newDraft(
            JSON.stringify([source, disk.workspaceRevision, path]),
            disk,
          ),
          revision: current.revision + 1,
          editing: current.editing,
        });
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (current) {
        documents.set(path, {
          ...current,
          error:
            error instanceof Error
              ? error.message
              : translate('files.safeMissing'),
        });
        notify();
      }
    }
  }
  function acceptVerifiedDisk(path: string) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (!doc || !disk || doc.phase !== 'unknown' || doc.operationPending) return;
    // Manual rebase does not claim the old operation executed; retain the draft.
    replaceDocument(path, {
      ...doc,
      snapshot: disk,
      baseContent: disk.content ?? '',
      submitted: undefined,
      phase: doc.content === disk.content ? 'clean' : 'dirty',
      conflict: undefined,
      error: null,
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
    source,
  };
}
export type WorkspaceDocuments = ReturnType<typeof useWorkspaceDocuments>;
