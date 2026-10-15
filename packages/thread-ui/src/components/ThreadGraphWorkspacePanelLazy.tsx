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

const LazyThreadGraphWorkspacePanel = lazy(async () => {
  const module = await import('../workspace-panel');
  return { default: module.ThreadGraphWorkspacePanel };
});

export function ThreadGraphWorkspaceLoadingFallback() {
  const { locale: i18nLocale } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center px-4 text-sm text-[var(--theme-fg-muted)]">
      {translate("files.loadingWorkspace")}</div>
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
