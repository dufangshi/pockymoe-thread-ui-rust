import { Bell, Loader2, RotateCcw } from 'lucide-react';
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
    {error && <span className="turn-notification-error" role="alert">{error}<button type="button" onClick={onRetry} aria-label={t('settings.retry')}><RotateCcw size={14} />{t('settings.retry')}</button></span>}
  </span>;
}
