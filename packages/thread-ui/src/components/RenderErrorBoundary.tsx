import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate, useI18n } from '../i18n';

/** A page opened before a deployment asks for a build chunk that no longer exists. */
export function isStaleBuildError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(message);
}

export function RenderErrorFallback({ error, className = '' }: { error: unknown; className?: string }) {
  useI18n();
  const stale = isStaleBuildError(error);
  return (
    <div className={`render-error-fallback flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-sm ${className}`} role="alert">
      <p className="font-medium text-[var(--theme-fg)]">{translate(stale ? 'common.updatedTitle' : 'common.errorTitle')}</p>
      <p className="text-[var(--theme-fg-muted)]">{translate(stale ? 'common.updatedBody' : 'common.errorBody')}</p>
      <button
        className="mt-1 rounded-full border border-[var(--theme-border)] px-4 py-2 font-medium text-[var(--theme-fg)] hover:bg-[var(--theme-hover)]"
        onClick={() => window.location.reload()}
        type="button"
      >
        {translate('common.reload')}
      </button>
    </div>
  );
}

/** Keeps a failed part of the page from unmounting everything around it. */
export class RenderErrorBoundary extends Component<
  { children: ReactNode; className?: string },
  { failed: boolean; error: unknown }
> {
  override state = { failed: false, error: undefined as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    return this.state.failed
      ? <RenderErrorFallback className={this.props.className ?? ''} error={this.state.error} />
      : this.props.children;
  }
}
