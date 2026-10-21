import { translate, useI18n } from '../../i18n';
import { type ReactNode, type RefCallback } from 'react';
import { ErrorMark } from '../copy/ErrorMark';

export interface GraphChatTurnFrameProps {
  absoluteIndex: number;
  body: ReactNode;
  collapsed: boolean;
  collapsedBody?: ReactNode;
  error?: string | null;
  footer?: ReactNode;
  /** The turn's own line above its prompt: start time, model and usage. */
  head?: ReactNode;
  headerStatus?: ReactNode;
  isActive?: boolean;
  refCallback?: RefCallback<HTMLElement> | undefined;
  startedAt?: string | null;
  status?: string | null | undefined;
  timeLabel: string;
  timeTitle: string;
  tokenSummary?: ReactNode;
}

export function GraphChatTurnFrame({
  absoluteIndex,
  body,
  collapsed,
  collapsedBody,
  error,
  footer,
  head,
  headerStatus,
  isActive = false,
  refCallback,
  startedAt,
  status,
  timeLabel,
  timeTitle,
  tokenSummary,
}: GraphChatTurnFrameProps) {
  useI18n();
  return (
    <article
      ref={refCallback}
      data-testid="chat-turn"
      data-turn-active={isActive ? 'true' : 'false'}
      data-turn-status={status ?? undefined}
      className="thread-graph-turn px-3 py-2 sm:px-5 sm:py-3"
    >
      <div className="thread-graph-turn-header flex items-start justify-between gap-2">
        <div className="min-w-0 flex flex-1 items-start gap-1.5">
          <div className="min-w-0 flex flex-1 items-center gap-1.5 overflow-hidden">
            <span className="thread-graph-turn-index rounded-[0.6rem] border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]">
              {translate("chat.turn")} {absoluteIndex}
            </span>
            <time
              dateTime={startedAt ?? undefined}
              title={timeTitle}
              className="thread-graph-turn-time shrink-0 text-[10px] sm:text-[11px]"
            >
              {timeLabel}
            </time>
            {headerStatus}
          </div>
          {tokenSummary}
        </div>
      </div>

      <div className="thread-graph-turn-body mt-2 space-y-2">
        {/* Why the turn failed (when its prompt does not say): a mark at the end
            of the turn's head line, since the shell styles hide the header above. */}
        {error ? (
          <div className="thread-graph-turn-head-row flex items-center gap-1">
            <div className="min-w-0 flex-1">{head}</div>
            <ErrorMark message={error} announce={false} />
          </div>
        ) : head}
        {collapsed ? collapsedBody : body}
        {!collapsed ? footer : null}
      </div>
    </article>
  );
}
