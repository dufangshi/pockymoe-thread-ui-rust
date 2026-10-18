import { translate, useI18n } from '../../i18n';
import { useState, type PointerEvent, type ReactNode } from 'react';

/** Room a prompt's time and copy need beside its bubble. */
const SIDE_ACTIONS_WIDTH = 132;
import { CheckCircle2, Circle, CircleAlert, Loader2, XCircle } from 'lucide-react';
import { failureMessage } from './turnPrompts';
import { MessageSenderMark, type MessageSenderView } from './MessageSenderMark';

type GraphChatMessageKind = 'userMessage' | 'agentMessage';

function GraphChatRunningDots() {
  const { locale: i18nLocale } = useI18n();
  return (
    <span className="ml-1.5 inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-200/90"
          style={{ animationDelay: `${index * 180}ms` }}
        />
      ))}
    </span>
  );
}

export function GraphChatMessageStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  if (!status) {
    return null;
  }

  const label = status === 'Accepted' ? translate('chat.acceptedStatus')
    : status === 'Steering' ? translate('chat.steeringStatus')
    : status === 'Awaiting response' ? translate('chat.awaitingResponseStatus')
    : status === 'Completed' ? translate('chat.completed') : status;
  const normalized = status.toLowerCase();
  const isRunning =
    normalized.includes('running') ||
    normalized.includes('generating') ||
    normalized.includes('steering');
  const isFailed =
    normalized.includes('failed') || normalized.includes('error');
  const isCompleted =
    normalized.includes('accepted') || normalized.includes('complete');
  const className = isRunning
    ? 'ui-status-warning'
    : isFailed
      ? 'ui-status-danger'
      : isCompleted
        ? 'ui-status-success'
        : 'ui-status-neutral';
  const icon = isRunning ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : isFailed ? (
    <XCircle className="h-3.5 w-3.5" />
  ) : isCompleted ? (
    <CheckCircle2 className="h-3.5 w-3.5" />
  ) : (
    <Circle className="h-3.5 w-3.5" />
  );

  return (
    <span
      className={`thread-graph-message-status inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal ${className}`}
      title={label}
      aria-label={translate("chat.status", { value1: label })}
    >
      <span className="thread-graph-message-status-icon inline-flex shrink-0">
        {isRunning ? <GraphChatRunningDots /> : icon}
      </span>
      <span className="thread-graph-status-label">{label}</span>
    </span>
  );
}

export function GraphChatMessageFrame({
  children,
  copyButton,
  kind,
  metaControl,
  reasoning,
  status,
  timeLabel,
  timeTitle,
  actionsTime,
  failure,
  kicker,
  onBeforeResize,
  messageId,
  variant,
  sender,
}: {
  children: ReactNode;
  messageId?: string;
  /** Neutral styling hook for messages that are not replies, such as reasoning. */
  variant?: 'reasoning' | 'envelope' | 'notice' | undefined;
  copyButton?: ReactNode;
  kind: GraphChatMessageKind;
  metaControl?: ReactNode;
  reasoning?: ReactNode;
  status?: string | null | undefined;
  timeLabel?: ReactNode;
  timeTitle?: string | null | undefined;
  /** A short time beside the copy button; the full one stays in its title. */
  actionsTime?: string | null | undefined;
  /** The error of the failed turn this prompt started, behind a red mark. */
  failure?: string | null | undefined;
  /** A small line above the message, such as when a prompt was added mid-turn. */
  kicker?: ReactNode;
  onBeforeResize?: (() => void) | undefined;
  /** Who sent a prompt when it was not the device owner. */
  sender?: MessageSenderView | null | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const isUser = kind === 'userMessage';
  const [touchActionsVisible, setTouchActionsVisible] = useState(false);
  // A prompt's time and copy go in the free space left of its bubble, so they
  // never cover its text or failure mark; a bubble as wide as the row keeps them
  // inside, over a fade.
  const [actionsBeside, setActionsBeside] = useState(false);
  const placeActions = (bubble: HTMLElement) => {
    if (!isUser) return;
    const row = bubble.closest('.thread-graph-message')?.getBoundingClientRect();
    const box = bubble.getBoundingClientRect();
    setActionsBeside(Boolean(row && box.left - row.left >= SIDE_ACTIONS_WIDTH));
  };
  const [failureOpen, setFailureOpen] = useState(false);
  const failureText = failure ? failureMessage(failure) : null;
  const normalizedStatus = status?.trim().toLowerCase() ?? '';
  const showStatus = Boolean(
    isUser && status &&
    normalizedStatus !== 'complete' &&
    normalizedStatus !== 'completed',
  );
  const timeNode = timeLabel ? (
    <span
      title={timeTitle ?? undefined}
      className="thread-graph-message-time text-[10px] leading-none sm:text-[11px]"
    >
      {timeLabel}
    </span>
  ) : null;
  function handleMessagePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (
      event.target instanceof Element &&
      event.target.closest('a, button, input, summary, pre, .thread-graph-code-block')
    ) {
      return;
    }
    placeActions(event.currentTarget);
    setTouchActionsVisible((visible) => !visible);
  }

  return (
    <div
      data-testid="chat-message"
      data-message-id={messageId}
      data-role={isUser ? 'user' : 'assistant'}
      data-variant={variant}
      className={`thread-graph-message flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`thread-graph-message-stack min-w-0 ${isUser ? 'is-user' : 'is-assistant'}`}
      >
        {kicker ? <div className="thread-graph-message-kicker">{kicker}</div> : null}
        {timeNode ? <div className={`thread-graph-message-time-row ${isUser ? 'is-user' : ''}`}>{timeNode}</div> : null}
        <div
          data-touch-actions={touchActionsVisible ? 'true' : 'false'}
          data-actions-beside={actionsBeside || undefined}
          className={`thread-graph-message-bubble relative min-w-0 ${isUser ? 'is-user' : 'is-assistant'}`}
          onPointerUp={handleMessagePointerUp}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') {
              setTouchActionsVisible(false);
              placeActions(event.currentTarget);
            }
          }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setTouchActionsVisible(false); }}
          onFocus={(event) => placeActions(event.currentTarget)}
        >
          {isUser && sender ? <MessageSenderMark sender={sender} /> : null}
          {!isUser && metaControl ? (
            <div className="thread-graph-message-leading-actions">
              {metaControl}
            </div>
          ) : null}
          {reasoning}
          <div
            className={`thread-graph-message-content min-w-0 ${isUser ? 'is-user' : 'is-assistant'}`}
          >
            {children}
          </div>
          {isUser && failure ? (
            <button type="button" className="thread-graph-message-failure" aria-expanded={failureOpen}
              aria-label={translate('chat.turnFailedShow')} title={translate('chat.turnFailedShow')}
              onClick={() => { onBeforeResize?.(); setFailureOpen(open => !open); }}>
              <CircleAlert aria-hidden="true" />
            </button>
          ) : null}
          {copyButton || (!timeNode && timeTitle) ? (
            <div className="thread-graph-message-copy-desktop">
              {/* Without a visible label the time appears with the hover actions. */}
              {!timeNode && timeTitle ? <span className="thread-graph-message-hover-time" title={timeTitle}>{actionsTime || timeTitle}</span> : null}
              {copyButton}
            </div>
          ) : null}
        </div>
        {isUser && failure && failureOpen ? (
          <div className="thread-graph-message-failure-detail" role="note">
            <strong>{translate('chat.turnFailedTitle')}</strong>
            <p>{failureText}</p>
            {failureText !== failure.trim() ? <pre>{failure}</pre> : null}
          </div>
        ) : null}
        {isUser && showStatus ? (
          <div
            className={`thread-graph-message-user-meta flex items-center justify-end gap-2 ${showStatus || timeNode ? 'has-persistent-meta' : ''}`}
          >
            {showStatus ? (
              <GraphChatMessageStatusBadge status={status} />
            ) : null}

          </div>
        ) : null}
      </div>
    </div>
  );
}
