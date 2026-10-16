import { getLocale } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import { TokenMetricIcon } from './TokenMetricIcon';
import { TokenUsageCost } from './TokenUsageCost';
import type { TimelineTurn } from './timelineItems';
import { formatCompactTokenCount } from './tokenFormatting';

/** The model that ran; Claude names its API error replies' model "<synthetic>". */
export function knownTurnModel(turn: TimelineTurn) {
  const model = turn.model?.trim();
  return model && model !== '<synthetic>' ? model : null;
}

function turnModel(turn: TimelineTurn) {
  return knownTurnModel(turn) ?? translate("chat.modelUnavailable");
}

export function formatTurnRuntimeSummary(turn: TimelineTurn) {
  const model = turnModel(turn);
  const effort = turn.reasoningEffort?.trim();
  return effort ? `${model} · ${effort}` : model;
}

export function TurnUsageInline({
  turn,
  readOnly = false,
  speedMode = 'recent',
}: {
  turn: TimelineTurn;
  readOnly?: boolean;
  speedMode?: 'average' | 'recent';
}) {
  useI18n();
  const usage = turn.tokenUsage?.total;
  const price = turn.priceEstimate;
  const active = ['inProgress', 'sending', 'recovering'].includes(turn.status);
  const speed = turn.tokenUsage?.generationSpeed;
  const measured = speed?.latestOutputTokensPerSecond !== undefined;
  const recent = active && speedMode === 'recent';
  const rate = recent
    ? measured
      ? speed?.latestOutputTokensPerSecond
      : speed?.recentTokensPerSecond
    : (speed?.averageOutputTokensPerSecond ?? speed?.averageTokensPerSecond);
  const speedTitle = measured
    ? recent
      ? translate("chat.latestConfirmedResponseSecondsActualOutputTokens", { value1: ((speed?.latestOutputTimeMs ?? 0) / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 1 }), value2: speed?.latestOutputMeasuredAt ? translate('chat.measuredAt', { time: new Date(speed.latestOutputMeasuredAt).toLocaleTimeString(getLocale()) }) : '' })
      : translate('chat.responseAverage')
    : translate('chat.responseSpeed', { period: recent ? translate('chat.responseRecent') : translate('chat.responseWhole') });

  return (
    <span className="thread-turn-usage" data-testid="turn-usage">
      <span
        className="thread-turn-usage-model"
        title={formatTurnRuntimeSummary(turn)}
      >
        <span className="thread-turn-usage-model-name">
          {turnModel(turn)}
        </span>
        {turn.reasoningEffort?.trim() ? (
          <span className="thread-turn-usage-effort">
            {' '}
            · {turn.reasoningEffort.trim()}
          </span>
        ) : null}
      </span>
      {usage ? (
        <span
          className="thread-turn-usage-tokens"
          aria-label={translate("chat.totalTokens", { value1: usage.totalTokens.toLocaleString(getLocale()) })}
        >
          <span
            title={translate("chat.totalTokens", { value1: usage.totalTokens.toLocaleString(getLocale()) })}
          >
            <TokenMetricIcon />
            <span className="thread-turn-usage-value">
              {formatCompactTokenCount(usage.totalTokens)}
            </span>
          </span>
        </span>
      ) : null}
      <TokenUsageCost usage={usage} price={price} readOnly={readOnly} />
      {active || speed ? (
        <span
          className="thread-turn-token-speed"
          data-testid="turn-token-speed"
          aria-label={
            recent
              ? measured
                ? translate("chat.latestConfirmedOutputTokenSpeed")
                : translate("chat.recentOutputTokenSpeed")
              : translate("chat.averageOutputTokenSpeed")
          }
          title={`${translate("chat.tokenSpeedUnits")} · ${speedTitle}${rate == null ? translate("chat.waitingForTheFirstOutputTokenUsage") : ''}`}
        >
          <TokenMetricIcon speed />
          {rate != null && Number.isFinite(rate) && rate >= 0
            ? rate.toLocaleString(getLocale(), {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })
            : '—'}
        </span>
      ) : null}
    </span>
  );
}
