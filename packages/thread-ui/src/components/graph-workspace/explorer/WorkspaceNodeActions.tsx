import { translate, useI18n } from '../../../i18n';
import {
  Copy,
  ClipboardCopy,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RenameDialog } from '../../RenameDialog';
import { ConfirmDialog } from '../../ConfirmDialog';
import type { WorkspaceTreeNode } from '../workspaceTree';
import { useDocumentThemePreset } from '../../themeHooks';

export interface WorkspaceNodeActionProps {
  onCopyPath?: (
    node: WorkspaceTreeNode,
    kind?: 'relative' | 'absolute',
  ) => void;
  onDownload?: (node: WorkspaceTreeNode) => void;
  onRename?: (node: WorkspaceTreeNode, name: string) => Promise<void>;
  onDelete?: (node: WorkspaceTreeNode) => Promise<void>;
}

export function WorkspaceNodeActions({
  node,
  onCopyPath,
  onDownload,
  onRename,
  onDelete,
}: WorkspaceNodeActionProps & { node: WorkspaceTreeNode }) {
  useI18n();
  // Plum Pocket keeps menu labels short; the node name stays in the accessible name.
  const shortLabels = useDocumentThemePreset() === 'plum-pocket';
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [name, setName] = useState(node.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const close = () => {
    setMenu(null);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (
        !popup.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const resize = () => setMenu(null);
    document.addEventListener('pointerdown', outside);
    // Capture: the row stops key events from bubbling past the actions.
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', resize);
    popup.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', resize);
    };
  }, [menu]);
  const actionClass =
    'thread-graph-tree-action flex shrink-0 items-center justify-center rounded transition';
  const mutate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'rename') await onRename?.(node, name);
      else await onDelete?.(node);
      setDialog(null);
      trigger.current?.focus();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : translate("files.fileOperationFailed"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="thread-graph-tree-actions flex shrink-0 items-center gap-0.5"
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {onCopyPath && (
        <>
          <button
            type="button"
            onClick={() => onCopyPath(node, 'relative')}
            className={`${actionClass} workspace-node-quick-action`}
            title={translate("files.copyRelativePathFor", { value1: node.name })}
            aria-label={translate("files.copyRelativePathFor", { value1: node.name })}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => onCopyPath(node, 'absolute')}
            className={`${actionClass} workspace-node-quick-action`}
            title={translate("files.copyAbsolutePathFor", { value1: node.name })}
            aria-label={translate("files.copyAbsolutePathFor", { value1: node.name })}
          >
            <ClipboardCopy size={14} />
          </button>
        </>
      )}
      {(onRename || onDelete || onCopyPath || onDownload) && (
        <button
          ref={trigger}
          type="button"
          aria-label={translate("files.moreActionsFor", { value1: node.name })}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          className={actionClass}
          onClick={() => {
            const box = trigger.current!.getBoundingClientRect();
            setMenu(
              menu
                ? null
                : {
                    left: Math.max(
                      8,
                      Math.min(box.right - 208, window.innerWidth - 216),
                    ),
                    top: Math.max(
                      8,
                      Math.min(box.bottom + 4, window.innerHeight - 260),
                    ),
                  },
            );
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
      {menu &&
        createPortal(
          <div
            ref={popup}
            role="menu"
            aria-label={translate("files.actionsFor", { value1: node.name })}
            className="thread-ui-shell workspace-node-menu"
            style={{
              position: 'fixed',
              left: menu.left,
              top: menu.top,
              zIndex: 1000,
              width: 208,
              maxHeight: 'calc(100dvh - 16px)',
              overflowY: 'auto',
              background: 'var(--theme-panel)',
              color: 'var(--theme-fg)',
              border: '1px solid var(--theme-border)',
              borderRadius: 8,
              padding: 4,
              boxShadow: '0 8px 24px #0004',
            }}
          >
            {onDownload && <button role="menuitem" type="button" onClick={() => { onDownload(node); close(); }}><Download size={16} />{translate('files.downloadFile')}</button>}
            {onCopyPath && <>
              <button role="menuitem" type="button" aria-label={shortLabels ? translate('files.copyRelativePathFor', { value1: node.name }) : undefined} onClick={() => { onCopyPath(node, 'relative'); close(); }}><Copy size={16} />{shortLabels ? translate('files.copyRelativePath') : translate('files.copyRelativePathFor', { value1: node.name })}</button>
              <button role="menuitem" type="button" aria-label={shortLabels ? translate('files.copyAbsolutePathFor', { value1: node.name }) : undefined} onClick={() => { onCopyPath(node, 'absolute'); close(); }}><ClipboardCopy size={16} />{shortLabels ? translate('files.copyAbsolutePath') : translate('files.copyAbsolutePathFor', { value1: node.name })}</button>
            </>}
            {onRename && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setName(node.name);
                  setError(null);
                  setDialog('rename');
                  setMenu(null);
                }}
              >
                <Pencil size={14} /> {translate("files.rename_d3f4cb")}</button>
            )}
            {onDelete && (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setError(null);
                  setDialog('delete');
                  setMenu(null);
                }}
              >
                <Trash2 size={14} /> {translate("files.delete")}</button>
            )}
          </div>,
          document.body,
        )}
      <RenameDialog
        open={dialog === 'rename'}
        title={translate("files.rename", { value1: node.kind === 'directory' ? 'folder' : 'file' })}
        label={translate("files.name")}
        value={name}
        onChange={setName}
        onCancel={() => setDialog(null)}
        onSubmit={mutate}
        busy={busy}
        error={error}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={translate("files.delete_c93ae0", { value1: node.kind === 'directory' ? 'folder' : 'file' })}
        description={translate("files.permanentlyDelete", { value1: node.path, value2: node.kind === 'directory' ? translate("files.andItsContents") : '' })}
        onCancel={() => setDialog(null)}
        onConfirm={mutate}
        busy={busy}
        error={error}
      />
    </div>
  );
}
