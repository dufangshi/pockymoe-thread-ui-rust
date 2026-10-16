import { translate, useI18n } from '../../i18n';
import { useTabScrollEdges } from '../useTabScrollEdges';
import { Circle, FileCode2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface WorkspaceFileTab {
  name: string;
  path: string;
  pinned: boolean;
}

export function WorkspaceFileTabs({
  activePath,
  dirtyPaths,
  onClose,
  onSelect,
  tabs,
  trailingAction,
  leadingAction,
  onSaveAndClose,
  blockedClosePaths = new Set(),
}: {
  activePath: string | null;
  dirtyPaths: ReadonlySet<string>;
  onClose: (path: string) => void;
  onSelect: (path: string) => void;
  tabs: WorkspaceFileTab[];
  trailingAction?: ReactNode;
  leadingAction?: ReactNode;
  onSaveAndClose?: (path: string) => Promise<void>;
  blockedClosePaths?: ReadonlySet<string>;
}) {
  useI18n();
  const tabsRef = useRef<HTMLDivElement>(null);
  const scrollEdges = useTabScrollEdges(tabsRef);
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [activePath, tabs.length]);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [savingClose, setSavingClose] = useState(false);
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) ?? null;

  if (tabs.length === 0) {
    return null;
  }

  function requestClose(path: string) {
    if (dirtyPaths.has(path)) {
      setPendingClosePath(path);
      return;
    }
    onClose(path);
  }

  return (
    <div className="thread-graph-editor-tabs-shell shrink-0">
      <div className="workspace-file-toolbar flex min-w-0 border-b border-[var(--theme-border)]">
        {leadingAction && <div className="workspace-file-navigation flex shrink-0 items-center">{leadingAction}</div>}
        <div className="tab-scroll-surface workspace-tab-scroll" {...scrollEdges}>
        <div
          ref={tabsRef}
          className="thread-graph-editor-tabs flex min-w-0 flex-1 overflow-x-auto"
          role="tablist"
          aria-label={translate("files.openWorkspaceFiles")}
        >
          {tabs.map((tab) => {
            const active = tab.path === activePath;
            const dirty = dirtyPaths.has(tab.path);
            return (
              <div
                key={tab.path}
                className={`thread-graph-editor-tab group/tab flex h-8 min-w-0 max-w-52 shrink-0 items-center border-r ${active ? 'is-active' : ''} ${tab.pinned ? 'is-pinned' : 'is-preview'}`}
                role="presentation"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={tab.path}
                  onClick={() => onSelect(tab.path)}
                  className={`flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left text-xs ${tab.pinned ? '' : 'italic'}`}
                >
                  <FileCode2 data-icon="code" className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="workspace-file-tab-name" dir="rtl"><bdi dir="ltr">{tab.name}</bdi></span>
                </button>
                <button
                  type="button"
                  onClick={() => requestClose(tab.path)}
                  className="thread-graph-editor-tab-close mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  title={translate("files.close_069e97", { value1: tab.name })}
                  aria-label={translate("files.close_069e97", { value1: tab.name })}
                >
                  {dirty ? (
                    <Circle data-icon="unsaved" className="h-2.5 w-2.5 fill-current" />
                  ) : (
                    <X data-icon="close" className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        </div>
        {trailingAction ? (
          <div className="thread-graph-editor-tabs-action flex h-8 shrink-0 items-center px-1">
            {trailingAction}
          </div>
        ) : null}
      </div>
      {pendingTab ? (
        <div
          className="thread-graph-editor-close-confirm flex flex-wrap min-h-10 items-center justify-between gap-3 border-b px-3 py-1.5 text-xs"
          role="alert"
        >
          <span className="min-w-0 truncate">
            {translate("files.discardUnsavedChangesIn")} {pendingTab.name}?
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPendingClosePath(null)}
              className="h-7 rounded px-2 hover:bg-[var(--theme-hover)]"
            >
              {translate("files.keepEditing")}</button>
            {onSaveAndClose ? <button type="button" disabled={savingClose || blockedClosePaths.has(pendingTab.path)} onClick={async () => {setSavingClose(true); try {await onSaveAndClose(pendingTab.path);} finally {setSavingClose(false);}}}>{translate('files.safeSaveClose')}</button> : null}
            <button
              type="button"
              disabled={savingClose || blockedClosePaths.has(pendingTab.path)}
              onClick={() => {
                setPendingClosePath(null);
                onClose(pendingTab.path);
              }}
              className="h-7 rounded bg-rose-500/15 px-2 text-rose-700 hover:bg-rose-500/25 dark:text-rose-200"
            >
              {translate("files.discard")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
