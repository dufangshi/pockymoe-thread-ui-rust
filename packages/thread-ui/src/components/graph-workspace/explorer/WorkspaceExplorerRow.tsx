import { translate, useI18n } from '../../../i18n';
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  Folder,
  FolderOpen,
  FolderSymlink,
  LoaderCircle,
} from 'lucide-react';
import type { KeyboardEvent, ReactNode, Ref } from 'react';

import { extensionOf, type WorkspaceTreeNode } from '../workspaceTree';
import type { WorkspaceExplorerRowProjection } from './workspaceExplorerTypes';
import { WorkspaceNodeActions, type WorkspaceNodeActionProps } from './WorkspaceNodeActions';
import { LINKED_DIRECTORY_ID_PREFIX } from './workspaceLinkedFiles';

function iconForNode(node: WorkspaceTreeNode, expanded: boolean) {
  if (node.kind === 'directory') {
    return expanded ? (
      <FolderOpen className="workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" />
    ) : (
      <Folder className="workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" />
    );
  }
  const extension = extensionOf(node.name);
  if (extension === 'zip') {
    return <FileArchive className="workspace-node-icon is-archive h-4 w-4 text-amber-600" />;
  }
  if (
    node.kind === 'file' &&
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)
  ) {
    return <FileImage className="workspace-node-icon is-image h-4 w-4 text-sky-500" />;
  }
  if (
    node.kind === 'artifact' ||
    [
      'xyz',
      'extxyz',
      'cif',
      'pdf',
      'json',
      'ts',
      'tsx',
      'js',
      'jsx',
      'md',
      'yaml',
      'yml',
      'py',
    ].includes(extension)
  ) {
    return <FileCode2 className="workspace-node-icon is-code h-4 w-4 text-emerald-600" />;
  }
  return <File className="workspace-node-icon is-file h-4 w-4 text-slate-400 dark:text-slate-500" />;
}

export function WorkspaceExplorerRow({
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
  onDelete,
}: {
  row: WorkspaceExplorerRowProjection;
  selected: boolean;
  focused: boolean;
  loading: boolean;
  error?: string;
  rowRef?: Ref<HTMLDivElement>;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSelect: (node: WorkspaceTreeNode) => void;
  onToggle: (path: string) => void;
  onPreview?: (node: WorkspaceTreeNode) => void;
  onPin?: (node: WorkspaceTreeNode) => void;
  onRetry?: (path: string) => void;
  onDownload?: (node: WorkspaceTreeNode) => void;
} & WorkspaceNodeActionProps) {
  useI18n();
  const node: WorkspaceTreeNode = {
    ...row.node.source,
    children: [],
  };
  const isDirectory = node.kind === 'directory';
  const linkedDirectory = node.id.startsWith(LINKED_DIRECTORY_ID_PREFIX);
  const canToggleDirectory = isDirectory && Boolean(node.path);
  const expanded = Boolean(row.expanded);
  const paddingLeft = `${row.depth * 0.5 + 0.5}rem`;
  const displayName = row.compactPathSegments?.join('/') ?? node.name;
  const label = row.matchRanges?.length ? (
    <>
      {row.matchRanges.reduce<ReactNode[]>((parts, range, index) => {
        const previousEnd = row.matchRanges?.[index - 1]?.end ?? 0;
        if (range.start > previousEnd) {
          parts.push(displayName.slice(previousEnd, range.start));
        }
        parts.push(
          <span
            key={`${range.start}:${range.end}`}
            className="font-semibold text-[var(--theme-fg)]"
          >
            {displayName.slice(range.start, range.end)}
          </span>,
        );
        if (
          index === row.matchRanges!.length - 1 &&
          range.end < displayName.length
        ) {
          parts.push(displayName.slice(range.end));
        }
        return parts;
      }, [])}
    </>
  ) : (
    displayName
  );

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-label={displayName}
      aria-level={row.depth + 1}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-selected={selected}
      {...(isDirectory ? { 'aria-expanded': expanded } : {})}
      tabIndex={focused ? 0 : -1}
      data-explorer-node-id={node.id}
      data-explorer-path={node.path}
      className={`thread-graph-tree-row group relative flex min-w-0 items-center text-sm transition ${
        selected ? 'is-selected' : ''
      } ${focused ? 'is-focused' : ''}`}
      style={{ paddingLeft }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        if (isDirectory && node.path) {
          onToggle(node.path);
        } else if (!isDirectory) {
          onPin?.(node);
        }
      }}
    >
      {row.depth > 0 ? (
        <span
          className="thread-graph-tree-indent-guides pointer-events-none absolute inset-y-0 left-0"
          aria-hidden="true"
        >
          {Array.from({ length: row.depth }, (_, index) => (
            <span
              key={index}
              className="absolute inset-y-0 border-l"
              style={{ left: `${index * 0.5 + 0.75}rem` }}
            />
          ))}
        </span>
      ) : null}
      {canToggleDirectory ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${expanded ? translate("files.collapse") : translate("files.expand")} ${node.name}`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center sm:h-6 sm:w-6"
          onClick={() => {
            if (node.path) {
              onToggle(node.path);
            }
          }}
        >
          {loading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400 motion-reduce:animate-none" />
          ) : expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      ) : (
        <span className="h-7 w-7 shrink-0 sm:h-6 sm:w-6" aria-hidden="true" />
      )}
      <button
        type="button"
        tabIndex={-1}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left sm:min-h-7 sm:py-1"
        onClick={() => { onSelect(node); if (canToggleDirectory && window.matchMedia?.('(max-width: 639px)').matches) onToggle(node.path); }}
      >
        {linkedDirectory
          ? <FolderSymlink className="workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          : iconForNode(node, expanded)}
        {linkedDirectory ? (
          // Long host paths keep their meaningful tail visible.
          <span className="workspace-linked-directory-label min-w-0 flex-1" title={`${displayName}\n${translate('files.linkedFilesAreReadOnlyPreviews')}`}>
            <bdi>{displayName}</bdi>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate" title={displayName}>
            {label}
          </span>
        )}
      </button>
      {isDirectory && error && onRetry ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onRetry(node.path)}
          className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
          title={translate("files.retry_f4914f", { value1: error, value2: node.name })}
          aria-label={translate("files.retryLoading", { value1: node.name })}
        >
          <CircleAlert className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {!linkedDirectory && node.path ? <WorkspaceNodeActions node={node}
        {...(onDownload ? {onDownload} : {})} {...(onCopyPath ? {onCopyPath} : {})}
        {...(onRename && !node.path.startsWith('/') && !/^[a-z]:/i.test(node.path) ? {onRename} : {})}
        {...(onDelete && !node.path.startsWith('/') && !/^[a-z]:/i.test(node.path) ? {onDelete} : {})} /> : null}
    </div>
  );
}
