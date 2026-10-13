import { translate, useI18n } from '../i18n';

export function ThreadLoadingIndicator({ inline = false, label }: { inline?: boolean; label?: string }) {
  useI18n();
  return <span className={`thread-loading-indicator${inline ? ' is-inline' : ''}`} role="status" aria-live="polite" aria-busy="true">
    <span className="thread-loading-caption">
      <span className="thread-loading-ring" aria-hidden="true" />
      <span>{label ?? translate('workbench.loadingThreadDetail')}</span>
    </span>
    {!inline && <span className="thread-loading-lines" aria-hidden="true"><i /><i /><i /></span>}
  </span>;
}
