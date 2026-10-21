import type { ReactNode, RefObject } from 'react';
import type { ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';
import { BellRing, ChevronRight, MessageCircle, LoaderCircle } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { ErrorMark } from '../copy/ErrorMark';
import { GraphChatAgentMessageBody } from '../graph-chat/GraphChatMessageBody';
import { TokenUsageCost } from './TokenUsageCost';
import { delegateWakeMessages, wakeState } from './delegateWake';

export function PeerWorkGroup({ turn, context, expanded, loading, error, onToggle, children, scrollRootRef }: {
  turn: ThreadTurnDto; context: ThreadPeerWorkDto; expanded: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>; loading: boolean; error?: string | undefined; onToggle: () => void; children?: ReactNode;
}) {
  useI18n();
  const messages = delegateWakeMessages(turn, context);
  const first = messages[0]!;
  const source = first.name ?? first.fromThreadId?.slice(0, 8) ?? translate('chat.peerAgent');
  const wake = messages.every(message => message.kind === 'result');
  const sources = messages.map(message => message.name ?? message.fromThreadId?.slice(0, 8) ?? source).join('、');
  const label = translate(wake ? 'chat.peerRegisteredWake' : 'chat.peerQuestion');
  const title = `${label} · ${sources}${!wake && first.subject ? ` · ${first.subject}` : ''}`;
  return <section className="thread-peer-work" data-turn-id={turn.id}>
    <div className="thread-peer-work-heading">
      <button type="button" className="thread-peer-work-toggle" onClick={onToggle} aria-expanded={expanded} disabled={loading} title={title}>
        {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : wake ? <BellRing aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span className="thread-peer-work-kind">{label}</span>
        <span className="thread-peer-work-title">{`${sources}${!wake && first.subject ? ` · ${first.subject}` : ''}`}</span>
        <ChevronRight className={expanded ? 'rotate-90' : ''} aria-hidden="true" />
      </button>
      {/* Its history did not load: why, and a retry (the toggle reads it again). */}
      {error ? <ErrorMark message={error} onRetry={onToggle} /> : null}
      <TokenUsageCost usage={turn.tokenUsage?.total} price={turn.priceEstimate} />
    </div>
    {expanded ? <div className="thread-peer-work-content">
      {wake ? <p className="thread-peer-wake-cause">{translate('chat.peerRegisteredWakeHint')}</p> : null}
      {messages.map(message => <div className={`thread-peer-question${message.kind === 'result' ? ' thread-peer-report' : ''}`} key={message.id}>
        <div className="thread-peer-question-source">
          <strong title={message.fromThreadId ?? undefined}>{message.name ?? message.fromThreadId?.slice(0, 8) ?? source}</strong>
          <span className="thread-peer-source-state">{message.kind === 'question' ? translate('chat.peerQuestion') : wakeState(message.state)}</span>
        </div>
        {message.text || message.kind === 'question' ? <GraphChatAgentMessageBody messageId={message.id} text={message.text ?? message.subject ?? ''} scrollRootRef={scrollRootRef} />
          : <p className="thread-peer-report-empty">{translate('chat.peerNoReport')}</p>}
      </div>)}
      <div className="thread-peer-processing-label">{translate(wake ? 'chat.peerAfterWake' : 'chat.peerQuestionHandling')}</div>
      <div className="thread-peer-work-operations">{children}</div>
    </div> : null}
  </section>;
}
