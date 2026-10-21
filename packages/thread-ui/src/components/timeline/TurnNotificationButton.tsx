import { Bell, Loader2 } from 'lucide-react';
import { ErrorMark } from '../copy/ErrorMark';
import { translate as t, useI18n } from '../../i18n';

/** Account persistence is supplied by the host; this control only renders state. */
export function TurnNotificationButton({ subscribed, busy = false, error, onToggle, onRetry }: {
  subscribed: boolean;
  busy?: boolean;
  error?: string | null;
  onToggle: () => void;
  onRetry: () => void;
}) {
  useI18n();
  return <span className="turn-notification-control">
    <button type="button" className="turn-notification-button" aria-pressed={subscribed}
      aria-label={t(subscribed ? 'chat.turnNotificationOn' : 'chat.turnNotificationOff')}
      title={t(subscribed ? 'chat.turnNotificationOn' : 'chat.turnNotificationOff')}
      disabled={busy} onClick={onToggle}>
      {busy ? <Loader2 size={15} className="is-spinning" aria-hidden="true" /> : <Bell size={15} fill={subscribed ? 'currentColor' : 'none'} aria-hidden="true" />}
    </button>
    <span className="turn-notification-feedback" role="status">{subscribed ? t('chat.turnNotificationOn') : ''}</span>
    {error && <ErrorMark message={error} onRetry={onRetry} retryLabel={t('settings.retry')} />}
  </span>;
}
