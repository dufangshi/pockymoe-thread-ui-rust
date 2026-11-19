import { useContext, useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { Collapse } from './Collapse';
import { TranscriptLogContext } from './TranscriptLog';
import { describeTurnError } from './turnErrors';

/** Why an ended turn recorded nothing: one readable sentence, Retry (sends the
    same prompt again) and the original error folded away in small type. */
export function TurnFailureNote({ error, prompt }: { error: string; prompt?: string | null | undefined }) {
  useI18n();
  const actions = useContext(TranscriptLogContext);
  const [rawOpen, setRawOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { message, detail } = describeTurnError(error);
  const retry = actions?.retryPrompt && prompt?.trim() ? actions.retryPrompt : null;
  return (
    <div className="thread-turn-failure">
      <p className="thread-turn-failure-message">{message}</p>
      {retry || detail ? (
        <div className="thread-turn-failure-actions">
          {retry ? (
            <button type="button" className="thread-turn-failure-retry" disabled={retrying} aria-busy={retrying}
              onClick={async () => {
                setRetrying(true);
                try { await retry(prompt!); } finally { setRetrying(false); }
              }}>
              <RotateCcw aria-hidden="true" />{translate('chat.retryPrompt')}
            </button>
          ) : null}
          {detail ? (
            <button type="button" className="thread-turn-failure-raw-toggle" aria-expanded={rawOpen} onClick={() => setRawOpen(open => !open)}>
              <ChevronRight className={rawOpen ? 'rotate-90' : ''} aria-hidden="true" />{translate('chat.rawError')}
            </button>
          ) : null}
        </div>
      ) : null}
      {detail ? <Collapse open={rawOpen}><pre className="thread-turn-failure-raw">{detail}</pre></Collapse> : null}
    </div>
  );
}
