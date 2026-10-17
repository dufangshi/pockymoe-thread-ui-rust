import { translate, useI18n } from '../i18n';

/** What each navigation status is called (see docs/ui-principles.md §6). */
export function navigationStatusLabel(status: string) {
  switch (status) {
    case 'running': return translate('workbench.running');
    case 'unread': return translate('workbench.completedUnread');
    case 'idle': return translate('workbench.idleRead');
    case 'failed': return translate('workbench.failed');
    case 'interrupted': return translate('workbench.interrupted');
    case 'agents-running': return translate('workbench.agentThreadsRunningShort');
    default: return translate('workbench.statusUnavailable');
  }
}

/** The one thread status mark: spinner ring, green dot, hollow dot, amber square,
    red diamond or orange hollow square, with its name for assistive technology. */
export function StatusMark({ status, label }: { status: string; label?: string | undefined }) {
  useI18n();
  return <span className="matter-status-dot" data-status={status} role="img" aria-label={label ?? navigationStatusLabel(status)} />;
}
