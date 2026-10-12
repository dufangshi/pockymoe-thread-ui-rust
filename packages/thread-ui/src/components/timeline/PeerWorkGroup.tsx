import type { ReactNode, RefObject } from 'react';
import type { ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';
import { ChevronRight, MessageCircle, LoaderCircle } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { GraphChatAgentMessageBody } from '../graph-chat/GraphChatMessageBody';
import { TokenUsageCost } from './TokenUsageCost';

export function PeerWorkGroup({ turn, context, expanded, loading, error, onToggle, children, scrollRootRef }: {
  turn: ThreadTurnDto; context: ThreadPeerWorkDto; expanded: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>; loading: boolean; error?: string | undefined; onToggle: () => void; children?: ReactNode;
}) {
  useI18n();
  const first = context.messages[0]!;
  const source = first.name ?? first.fromThreadId?.slice(0, 8) ?? translate('chat.peerAgent');
  const title = `${source}${context.messages.length > 1 ? ` +${context.messages.length - 1}` : ''} · ${first.subject ?? translate('chat.peerUpdates')}`;
  return <section className="thread-peer-work" data-turn-id={turn.id}>
    <div className="thread-peer-work-heading">
      <button type="button" className="thread-peer-work-toggle" onClick={onToggle} aria-expanded={expanded} disabled={loading} title={title}>
        {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span className="thread-peer-work-title">{error ? translate('chat.historyUnavailableRetry') : title}</span>
        <ChevronRight className={expanded ? 'rotate-90' : ''} aria-hidden="true" />
      </button>
      <TokenUsageCost usage={turn.tokenUsage?.total} price={turn.priceEstimate} />
    </div>
    {expanded ? <div className="thread-peer-work-content">
      {context.messages.map(message => <div className="thread-peer-question" key={message.id}>
        <div className="thread-peer-question-source">{message.name ?? message.fromThreadId?.slice(0, 8) ?? source} · {translate(message.kind === 'question' ? 'chat.peerQuestion' : 'chat.peerUpdates')}</div>
        <GraphChatAgentMessageBody messageId={message.id} text={message.text ?? message.subject ?? ''} scrollRootRef={scrollRootRef} />
      </div>)}
      <div className="thread-peer-work-operations">{children}</div>
    </div> : null}
  </section>;
}
