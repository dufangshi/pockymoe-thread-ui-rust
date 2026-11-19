import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ThreadHistoryItemDto, ThreadPeerWorkDto, ThreadTurnDto } from '@pockymoe/shared';
import { BellRing, ChevronRight, MessageCircle, LoaderCircle } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import { ErrorMark } from '../copy/ErrorMark';
import { plainSearchText } from '../ConversationSearchControls';
import { GraphChatAgentMessageBody, MessagePreviewContext } from '../graph-chat/GraphChatMessageBody';
import { TokenUsageCost } from './TokenUsageCost';
import { delegateWakeMessages, wakeState } from './delegateWake';

/** A report's first line as plain words, for its one-line row. */
function firstLine(text: string | null | undefined) {
  const line = (text ?? '').split('\n').map(part => part.trim()).find(Boolean) ?? '';
  return plainSearchText(line);
}

// The reply below a wake is never folded by the message's own length rule:
// it is clipped to a few lines here instead, and opens in place.
const noMessageFold = () => Number.POSITIVE_INFINITY;

/** What the agent said after this wake, outside the wake's fold: the first
    lines with a fade, then all of it on request. */
function WakeReply({ reply, scrollRootRef }: { reply: ThreadHistoryItemDto; scrollRootRef: RefObject<HTMLDivElement | null> }) {
  useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || open) return;
    const measure = () => setClipped(node.scrollHeight > node.clientHeight + 2);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, reply.text]);
  return (
    <div className="thread-peer-wake-reply" data-message-id={reply.id}>
      <div ref={ref} className="thread-peer-wake-reply-body thread-graph-message-content is-assistant" data-clipped={!open && clipped ? true : undefined} data-open={open || undefined}>
        <MessagePreviewContext.Provider value={noMessageFold}>
          <GraphChatAgentMessageBody messageId={reply.id} text={reply.text} scrollRootRef={scrollRootRef} />
        </MessagePreviewContext.Provider>
      </div>
      {clipped || open ? (
        <button type="button" className="thread-graph-show-more timeline-meta-text thread-peer-wake-reply-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <ChevronRight size={14} aria-hidden="true" className={open ? 'rotate-90' : undefined} />
          <span>{open ? translate('chat.showLess') : translate('chat.showMore')}</span>
        </button>
      ) : null}
    </div>
  );
}

/** One delegate's report: a single row (name, state, first line) that opens
    to the whole closing message. A question stays open: it waits for an answer. */
function PeerReport({ message, source, scrollRootRef }: {
  message: ReturnType<typeof delegateWakeMessages>[number]; source: string; scrollRootRef: RefObject<HTMLDivElement | null>;
}) {
  const question = message.kind === 'question';
  const [open, setOpen] = useState(question);
  const name = message.name ?? message.fromThreadId?.slice(0, 8) ?? source;
  const state = question ? translate('chat.peerQuestion') : wakeState(message.state);
  const text = message.text ?? (question ? message.subject ?? '' : null);
  return (
    <div className={`thread-peer-question${question ? '' : ' thread-peer-report'}`} data-open={open || undefined}>
      {text ? (
        <button type="button" className="thread-peer-report-head" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <ChevronRight className={`thread-peer-report-chev${open ? ' rotate-90' : ''}`} aria-hidden="true" />
          <strong title={message.fromThreadId ?? undefined}>{name}</strong>
          <span className="thread-peer-source-state">{state}</span>
          {!open ? <span className="thread-peer-report-line">{firstLine(text)}</span> : null}
        </button>
      ) : (
        <div className="thread-peer-report-head is-static">
          <strong title={message.fromThreadId ?? undefined}>{name}</strong>
          <span className="thread-peer-source-state">{state}</span>
          <span className="thread-peer-report-line">{translate('chat.peerNoReport')}</span>
        </div>
      )}
      {open && text ? (
        // The report reads at the size of a reply in every theme.
        <div className="thread-peer-report-body">
          <div className="thread-graph-message-content is-assistant">
            <GraphChatAgentMessageBody messageId={message.id} text={text} scrollRootRef={scrollRootRef} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Earliest first; items without a time keep their place after timed ones. */
function byTime(a: ThreadHistoryItemDto, b: ThreadHistoryItemDto) {
  const at = Date.parse(a.createdAt ?? ''), bt = Date.parse(b.createdAt ?? '');
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
  return (a.sequence ?? 0) - (b.sequence ?? 0);
}

export function PeerWorkGroup({ turn, context, expanded, loading, error, onToggle, children, scrollRootRef, reply, prompts, renderPrompt }: {
  turn: ThreadTurnDto; context: ThreadPeerWorkDto; expanded: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>; loading: boolean; error?: string | undefined; onToggle: () => void; children?: ReactNode;
  /** The agent's reply after this wake. It stands outside the fold, so a folded
      wake still shows what the agent made of it (not passed when the reply is
      already the task's closing answer below). */
  reply?: ThreadHistoryItemDto | null | undefined;
  /** What the reader sent into this wake turn (steers, added prompts): outside
      the fold too, in time order with the reply, drawn like a turn's added prompt. */
  prompts?: ThreadHistoryItemDto[] | undefined;
  renderPrompt?: ((item: ThreadHistoryItemDto) => ReactNode) | undefined;
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
        {/* The chevron leads, then the kind's glyph (ui-principles §5). */}
        {loading ? <LoaderCircle className="request-spin" aria-hidden="true" /> : <ChevronRight className={expanded ? 'rotate-90' : ''} aria-hidden="true" />}
        {wake ? <BellRing aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span className="thread-peer-work-kind">{label}</span>
        <span className="thread-peer-work-title">{`${sources}${!wake && first.subject ? ` · ${first.subject}` : ''}`}</span>
      </button>
      {/* Its history did not load: why, and a retry (the toggle reads it again). */}
      {error ? <ErrorMark message={error} onRetry={onToggle} /> : null}
      <TokenUsageCost usage={turn.tokenUsage?.total} price={turn.priceEstimate} />
    </div>
    {expanded ? <div className="thread-peer-work-content">
      {wake ? <p className="thread-peer-wake-cause">{translate('chat.peerRegisteredWakeHint')}</p> : null}
      {messages.map(message => <PeerReport key={message.id} message={message} source={source} scrollRootRef={scrollRootRef} />)}
      <div className="thread-peer-processing-label">{translate(wake ? 'chat.peerAfterWake' : 'chat.peerQuestionHandling')}</div>
      <div className="thread-peer-work-operations">{children}</div>
    </div> : null}
    {[...(renderPrompt ? prompts ?? [] : []), ...(reply?.text.trim() ? [reply] : [])].sort(byTime).map(item => item === reply
      ? <WakeReply key={item.id} reply={item} scrollRootRef={scrollRootRef} />
      : <div key={item.id} className="thread-peer-wake-prompt">{renderPrompt!(item)}</div>)}
  </section>;
}
