import { useState, type MouseEvent } from 'react';
import { GitFork, LoaderCircle, TriangleAlert } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { confirmAsync } from '../menu/confirmAsync';

/** Forks the thread at the turn this reply ends, after a confirmation. It is a
    copy-button twin: same look and the same hover/focus/tap appearance, beside
    the reply's copy button. A failure stays on the button with its reason. */
export function ForkTurnButton({ onFork }: { onFork: () => Promise<void> }) {
  useI18n();
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [error, setError] = useState('');
  const label = translate('chat.forkFromThisTurn');
  const note = state === 'failed' ? error || translate('chat.unableToForkThisTurnPleaseTry') : '';
  return (
    <button type="button" className="copy-button thread-graph-message-copy thread-graph-message-fork"
      data-state={state === 'failed' ? 'failed' : 'idle'} aria-label={label}
      title={state === 'failed' ? note : state === 'busy' ? translate('chat.forking') : label}
      aria-busy={state === 'busy'} disabled={state === 'busy'}
      onClick={async (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const confirmed = await confirmAsync({
          title: translate('chat.forkFromThisTurnTitle'),
          description: translate('chat.forkFromThisTurnBody'),
          confirmLabel: translate('chat.fork'),
          tone: 'primary',
        });
        if (!confirmed) return;
        setState('busy');
        try {
          await onFork();
          setState('idle');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '');
          setState('failed');
        }
      }}>
      {state === 'busy' ? <LoaderCircle className="animate-spin" aria-hidden="true" />
        : state === 'failed' ? <TriangleAlert aria-hidden="true" /> : <GitFork aria-hidden="true" />}
      {state === 'failed' ? <span className="copy-button-note" aria-hidden="true">{note}</span> : null}
      <span className="copy-button-status" role="status">{state === 'busy' ? translate('chat.forking') : note}</span>
    </button>
  );
}
