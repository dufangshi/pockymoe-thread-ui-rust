import { translate, useI18n } from '../../../i18n';
import { measureElement, useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react';

import type { WorkspaceTreeNode } from '../workspaceTree';
import { createWorkspaceExplorerModel } from './workspaceExplorerModel';
import { projectWorkspaceExplorerRows } from './workspaceExplorerProjection';
import { workspaceExplorerCommandForKey } from './workspaceExplorerCommands';
import { WorkspaceExplorerRow } from './WorkspaceExplorerRow';
import type { WorkspaceNodeActionProps } from './WorkspaceNodeActions';

export function WorkspaceExplorerTree({
  tree,
  expandedPaths,
  filterMode = 'filter',
  filterQuery = '',
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
  virtualize = true,
}: {
  tree: WorkspaceTreeNode;
  expandedPaths: ReadonlySet<string>;
  filterMode?: 'highlight' | 'filter';
  filterQuery?: string;
  compactFolders?: boolean;
  directoryErrors?: ReadonlyMap<string, string>;
  loadingPaths: ReadonlySet<string>;
  selectedNodeId: string | null;
  revealRequestKey?: number | undefined;
  scrollerRef: MutableRefObject<HTMLDivElement | null>;
  scrollTopRef?: MutableRefObject<number>;
  onDownload?: (node: WorkspaceTreeNode) => void;
  onOpenFilter?: () => void;
  onFilterResultsChange?: (input: {
    matchCount: number;
    hasUnresolvedDirectories: boolean;
  }) => void;
  onPreview?: (node: WorkspaceTreeNode) => void;
  onPin?: (node: WorkspaceTreeNode) => void;
  onRetryDirectory?: (path: string) => void;
  onSelect: (node: WorkspaceTreeNode) => void;
  onToggle: (path: string) => void;
  virtualize?: boolean;
} & WorkspaceNodeActionProps) {
  useI18n();
  const model = useMemo(() => createWorkspaceExplorerModel(tree), [tree]);
  const projection = useMemo(
    () =>
      projectWorkspaceExplorerRows(model, expandedPaths, {
        filterMode,
        filterQuery,
        compactFolders,
      }),
    [compactFolders, expandedPaths, filterMode, filterQuery, model],
  );
  const { rows } = projection;
  const [focusedId, setFocusedId] = useState<string | null>(
    () => selectedNodeId ?? rows[0]?.id ?? null,
  );
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  const canVirtualize =
    virtualize && typeof window !== 'undefined' && 'ResizeObserver' in window;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    getItemKey: (index) => rows[index]?.id ?? index,
    estimateSize: () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(max-width: 639px)').matches
        ? 44
        : 28,
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
    },
  });
  const lastVisibleScrollTopRef = useRef(0);

  // Hiding the drawer can also reset scrollTop without a scroll event (WebKit),
  // leaving the virtualizer rendering rows for a stale offset: a blank band.
  // Restore the last visible position and resync the virtualizer when shown.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!canVirtualize || !scroller) return;
    let hidden = scroller.clientHeight === 0;
    const observer = new ResizeObserver(() => {
      const nowHidden = scroller.clientHeight === 0;
      if (hidden && !nowHidden) {
        const target = lastVisibleScrollTopRef.current;
        if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target;
        scroller.dispatchEvent(new Event('scroll'));
      }
      hidden = nowHidden;
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [canVirtualize, scrollerRef]);

  useEffect(() => {
    onFilterResultsChange?.({
      matchCount: projection.matchCount,
      hasUnresolvedDirectories: projection.hasUnresolvedDirectories,
    });
  }, [
    onFilterResultsChange,
    projection.hasUnresolvedDirectories,
    projection.matchCount,
  ]);

  useEffect(() => {
    if (focusedId && projection.indexById.has(focusedId)) {
      return;
    }
    setFocusedId(
      selectedNodeId && projection.indexById.has(selectedNodeId)
        ? selectedNodeId
        : (rows[0]?.id ?? null),
    );
  }, [focusedId, projection.indexById, rows, selectedNodeId]);

  const focusRow = useCallback(
    (id: string) => {
      setFocusedId(id);
      const index = projection.indexById.get(id);
      if (canVirtualize && index !== undefined) {
        virtualizer.scrollToIndex(index, { align: 'auto' });
      }
      window.requestAnimationFrame(() =>
        rowElementsRef.current.get(id)?.focus(),
      );
    },
    [canVirtualize, projection.indexById, virtualizer],
  );

  const revealedSelectionRef = useRef<string | null>(null);
  // A link opened into the tree brings its target near the top, one row of
  // context above it, and keeps it there while the folders around it load.
  const revealUntilRef = useRef(0);
  const revealTarget = useCallback((id: string, toTop: boolean) => {
    const index = projection.indexById.get(id);
    if (index === undefined) return false;
    if (!toTop) {
      // Selecting a row the reader can see moves nothing.
      if (canVirtualize) virtualizer.scrollToIndex(index, {align: 'auto'});
      else rowElementsRef.current.get(id)?.scrollIntoView?.({block: 'nearest'});
    } else if (canVirtualize) {
      virtualizer.scrollToIndex(Math.max(0, index - 1), {align: 'start'});
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
  // A tree opened by a link reveals that target as a new request.
  const revealedRequestRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const key = `${selectedNodeId}:${revealRequestKey ?? 0}`;
    if (!selectedNodeId || revealedSelectionRef.current === key) return;
    const requested = revealRequestKey !== undefined && revealRequestKey !== revealedRequestRef.current;
    if (!revealTarget(selectedNodeId, requested)) return;
    revealedSelectionRef.current = key;
    revealedRequestRef.current = revealRequestKey;
    setFocusedId(selectedNodeId);
    revealUntilRef.current = requested ? performance.now() + 1500 : 0;
  }, [selectedNodeId, revealRequestKey, revealTarget]);
  useEffect(() => {
    if (!selectedNodeId || performance.now() > revealUntilRef.current) return;
    const frame = window.requestAnimationFrame(() => revealTarget(selectedNodeId, true));
    return () => window.cancelAnimationFrame(frame);
  }, [projection, selectedNodeId, revealTarget]);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const stop = () => { revealUntilRef.current = 0; };
    scroller.addEventListener('wheel', stop, { passive: true });
    scroller.addEventListener('touchstart', stop, { passive: true });
    scroller.addEventListener('keydown', stop);
    return () => {
      scroller.removeEventListener('wheel', stop);
      scroller.removeEventListener('touchstart', stop);
      scroller.removeEventListener('keydown', stop);
    };
  }, [scrollerRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const command = workspaceExplorerCommandForKey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        focusedId,
        rows,
      });
      if (!command) {
        return;
      }
      event.preventDefault();
      switch (command.type) {
        case 'focus':
          focusRow(command.id);
          break;
        case 'expand':
        case 'collapse':
          onToggle(command.path);
          break;
        case 'activate': {
          const row = model.nodes.get(command.id);
          if (!row) {
            break;
          }
          if (row.kind === 'directory' && row.path) {
            onToggle(row.path);
          } else {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case 'select': {
          const row = model.nodes.get(command.id);
          if (row) {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case 'open-filter':
          onOpenFilter?.();
          break;
      }
    },
    [focusRow, focusedId, model.nodes, onOpenFilter, onSelect, onToggle, rows],
  );

  const virtualItems = canVirtualize ? virtualizer.getVirtualItems() : [];
  const renderedRows = canVirtualize
    ? virtualItems.map((item) => ({
        index: item.index,
        key: item.key,
        start: item.start,
      }))
    : rows.map((row, index) => ({ index, key: row.id, start: 0 }));

  return (
    <div
      ref={scrollerRef}
      role="tree"
      aria-label={translate("files.workspaceFiles")}
      className="thread-graph-workspace-tree-scroll min-h-0 flex-1 overflow-y-auto py-1 outline-none"
      onScroll={(event) => {
        if (event.currentTarget.clientHeight > 0) {
          lastVisibleScrollTopRef.current = event.currentTarget.scrollTop;
        }
        if (scrollTopRef) {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }
      }}
    >
      <div
        style={
          canVirtualize
            ? {
                height: `${virtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }
            : undefined
        }
      >
        {renderedRows.map((rendered) => {
          const row = rows[rendered.index];
          if (!row) {
            return null;
          }
          return (
            <div
              key={rendered.key}
              role={"none"}
              data-index={rendered.index}
              ref={canVirtualize ? virtualizer.measureElement : undefined}
              style={
                canVirtualize
                  ? {
                      left: 0,
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${rendered.start}px)`,
                      width: '100%',
                    }
                  : undefined
              }
            >
              <WorkspaceExplorerRow
                row={row}
                selected={selectedNodeId === row.id}
                focused={focusedId === row.id}
                loading={loadingPaths.has(row.node.path)}
                {...(directoryErrors?.get(row.node.path)
                  ? { error: directoryErrors.get(row.node.path)! }
                  : {})}
                rowRef={(element) => {
                  if (element) {
                    rowElementsRef.current.set(row.id, element);
                  } else {
                    rowElementsRef.current.delete(row.id);
                  }
                }}
                onFocus={() => setFocusedId(row.id)}
                onKeyDown={handleKeyDown}
                onSelect={onSelect}
                onToggle={onToggle}
                {...(onPreview ? { onPreview } : {})}
                {...(onPin ? { onPin } : {})}
                {...(onRetryDirectory ? { onRetry: onRetryDirectory } : {})}
                {...(onDownload ? { onDownload } : {})}
                {...(onCopyPath ? { onCopyPath } : {})}
                {...(onRename ? { onRename } : {})}
                {...(onDelete ? { onDelete } : {})}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
