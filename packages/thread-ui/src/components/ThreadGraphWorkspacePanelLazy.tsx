import { translate, useI18n } from '../i18n';
import {
  lazy,
  memo,
  Suspense,
} from 'react';

import type {
  ThreadGraphWorkspacePanelProps,
} from './ThreadGraphWorkspacePanel';
import { RenderErrorBoundary } from './RenderErrorBoundary';

const loadWorkspacePanel = () => import('../workspace-panel');
const LazyThreadGraphWorkspacePanel = lazy(async () => {
  const module = await loadWorkspacePanel();
  return { default: module.ThreadGraphWorkspacePanel };
});
// Fetch the Files code once the page is idle, so its first opening shows the
// list instead of a loading skeleton. Without idle callbacks it loads on demand.
if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(() => { void loadWorkspacePanel().catch(() => { /* Loaded on demand instead. */ }); });
}

/** The same skeleton the file list shows while it loads, so opening Files the
    first time goes skeleton → list instead of text → skeleton → list. */
export function ThreadGraphWorkspaceLoadingFallback() {
  useI18n();
  return (
    <div className="workspace-loading-skeleton flex h-full min-h-0 flex-1 flex-col" role="status" aria-label={translate("files.loadingWorkspace")}>
      <div className="workspace-loading-skeleton-bar" />
      <div className="flex-1 space-y-1 px-3 py-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="h-7 animate-pulse rounded bg-[var(--theme-surface-strong)] motion-reduce:animate-none" style={{ width: `${72 - index * 6}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ThreadGraphWorkspacePanel(
  props: ThreadGraphWorkspacePanelProps,
) {
  const { locale: i18nLocale } = useI18n();
  return (
    <RenderErrorBoundary className="h-full min-h-0 flex-1">
      <Suspense fallback={<ThreadGraphWorkspaceLoadingFallback />}>
        <LazyThreadGraphWorkspacePanel {...props} />
      </Suspense>
    </RenderErrorBoundary>
  );
}

export const MemoizedThreadGraphWorkspacePanel = memo(
  ThreadGraphWorkspacePanel,
);

export type {
  ThreadGraphWorkspaceFeatures,
  ThreadGraphWorkspacePanelProps,
  WorkspaceTab,
} from './ThreadGraphWorkspacePanel';
