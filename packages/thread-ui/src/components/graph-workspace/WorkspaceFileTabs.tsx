import { translate, useI18n } from '../../i18n';
import { useTabScrollEdges } from '../useTabScrollEdges';
import { TabScrollButtons } from '../TabScrollButtons';
import { ConfirmDialog } from '../ConfirmDialog';
import { Circle, FileCode2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MiddleName } from '../copy/MiddleName';

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
                  <MiddleName name={tab.name} className="workspace-file-tab-name" />
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
        <TabScrollButtons targetRef={tabsRef} edges={scrollEdges} />
        </div>
        {trailingAction ? (
          <div className="thread-graph-editor-tabs-action flex h-8 shrink-0 items-center px-1">
            {trailingAction}
          </div>
        ) : null}
      </div>
      {/* Closing a tab with a draft asks in the app's confirmation window:
          keep editing (Esc), save and close, or discard. */}
      <ConfirmDialog
        open={Boolean(pendingTab)}
        title={pendingTab ? `${translate("files.discardUnsavedChangesIn")} ${pendingTab.name}?` : ''}
        description={translate('files.safeDiscard')}
        cancelLabel={translate("files.keepEditing")}
        confirmLabel={translate("files.discard")}
        busy={savingClose}
        {...(onSaveAndClose && pendingTab && !blockedClosePaths.has(pendingTab.path) ? {
          secondaryLabel: translate('files.safeSaveClose'),
          onSecondary: async () => { setSavingClose(true); try { await onSaveAndClose(pendingTab.path); } finally { setSavingClose(false); setPendingClosePath(null); } },
        } : {})}
        onCancel={() => setPendingClosePath(null)}
        onConfirm={() => {
          if (!pendingTab || blockedClosePaths.has(pendingTab.path)) return;
          setPendingClosePath(null);
          onClose(pendingTab.path);
        }}
      />
    </div>
  );
}
