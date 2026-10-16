import { useState, type ReactNode } from 'react';
import { getLocale, translate, useI18n } from '../../i18n';
import { formatLongTimestamp, formatMessageTimestamp } from '../threadPresentation';
import { Collapse } from './Collapse';
import type { TimelineTurn } from './timelineItems';
import { TokenSpeedDetails } from './TokenSpeedDetails';
import { TokenUsageCost } from './TokenUsageCost';
import { formatCompactTokenCount } from './tokenFormatting';
import { formatElapsedDuration, useSecondClock } from './turnStatus';
import { knownTurnModel } from './TurnUsageInline';

/** The top of a turn: when it started, the model, what it cost and how fast it
    answered. Tapping it shows the start and end, the time taken and the tokens. */
export function TurnHead({ turn, active, added, onBeforeResize }: {
  turn: TimelineTurn;
  active: boolean;
  /** Prompts added while the turn was working. */
  added: number;
  onBeforeResize?: ((anchor?: Element | null) => void) | undefined;
}) {
  useI18n();
  const [open, setOpen] = useState(false);
  const now = useSecondClock(active);
  const started = turn.startedAt;
  const model = knownTurnModel(turn);
  const effort = turn.reasoningEffort?.trim();
  const usage = turn.tokenUsage?.total;
  const speed = turn.tokenUsage?.generationSpeed;
  const rate = speed?.averageOutputTokensPerSecond ?? speed?.averageTokensPerSecond;
  const rateText = rate != null && Number.isFinite(rate) && rate > 0
    ? translate('chat.turnHeadSpeed', { value: rate.toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })
    : null;
  const took = formatElapsedDuration(started, active ? now : Date.parse(turn.completedAt ?? ''));
  const runModel = model ? `${model}${effort ? ` · ${effort}` : ''}` : null;
  const priced = !active && turn.priceEstimate;

  const details: [string, ReactNode][] = [
    ...(started ? [[translate('chat.turnHeadStarted'), formatLongTimestamp(started)] as [string, ReactNode]] : []),
    ...(!active && turn.completedAt ? [[translate('chat.turnHeadFinished'), formatLongTimestamp(turn.completedAt)] as [string, ReactNode]] : []),
    ...(took ? [[translate('chat.turnHeadTook'), took] as [string, ReactNode]] : []),
    ...(runModel ? [[translate('chat.model'), runModel] as [string, ReactNode]] : []),
    ...(usage ? [[translate('chat.turnHeadTokens'), translate('chat.turnHeadTokensValue', {
      total: formatCompactTokenCount(usage.totalTokens),
      input: formatCompactTokenCount(usage.inputTokens),
      output: formatCompactTokenCount(usage.outputTokens),
    })] as [string, ReactNode]] : []),
    ...(rateText ? [[translate('chat.turnHeadSpeedLabel'), translate('chat.turnHeadSpeedValue', { speed: rateText })] as [string, ReactNode]] : []),
    ...(added ? [[translate('chat.turnHeadAdded'), translate('chat.turnHeadAddedValue', { count: added })] as [string, ReactNode]] : []),
  ];

  return (
    <div className="thread-turn-head-block">
      <div className="thread-turn-head" data-active={active || undefined}>
        <button type="button" className="thread-turn-head-main" aria-expanded={open} title={translate('chat.turnHeadDetails')}
          onClick={(event) => { onBeforeResize?.(event.currentTarget); setOpen(value => !value); }}>
          {started ? <time dateTime={started}>{formatMessageTimestamp(started)}</time> : null}
          {runModel ? <span className="thread-turn-head-model">{runModel}</span> : null}
          {/* Running reads as a pulsing dot and the time so far. */}
          {active && took ? <span className="thread-turn-head-live" role="timer" aria-label={translate('chat.turnHeadRunning', { elapsed: took })}><i aria-hidden="true" />{took}</span> : null}
        </button>
        {priced ? <span className="thread-turn-head-cost"><TokenUsageCost usage={usage} price={turn.priceEstimate} /></span> : null}
        {!active && speed && rate != null && rateText ? <TokenSpeedDetails speed={speed} value={rate} /> : null}
      </div>
      <Collapse open={open}>
        <dl className="thread-turn-head-detail">
          {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </Collapse>
    </div>
  );
}
