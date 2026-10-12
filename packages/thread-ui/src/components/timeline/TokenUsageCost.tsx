import { getLocale } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import { useRef, useState } from 'react';
import {
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Brain,
  Save,
} from 'lucide-react';
import type {
  ThreadTurnTokenBreakdownDto,
  ThreadTurnPriceEstimateDto,
} from '@pockymoe/shared';
import { Tooltip, TooltipTrigger, TooltipContent } from '../graph-ui/Tooltip';
import { formatCompactTokenCount, formatCompactUsd } from './tokenFormatting';

export interface TokenUsageCostProps {
  usage?: ThreadTurnTokenBreakdownDto | null;
  price?: Pick<
    ThreadTurnPriceEstimateDto,
    | 'totalUsd'
    | 'inputUsd'
    | 'cachedInputUsd'
    | 'cacheWriteInputUsd'
    | 'outputUsd'
  > | null;
  readOnly?: boolean;
  costLabel?: string;
  detailsNote?: string;
  tooltipZIndex?: number;
}

export function TokenUsageCost({
  usage,
  price,
  readOnly = false,
  costLabel = translate("chat.aPICost"),
  detailsNote,
  tooltipZIndex = 80,
}: TokenUsageCostProps) {
  useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const openAtPointerDown = useRef(false);
  const uncachedInput = usage
    ? Math.max(
        0,
        usage.inputTokens -
          usage.cachedInputTokens -
          (usage.cacheWriteInputTokens ?? 0),
      )
    : 0;
  const reasoning = usage
    ? Math.min(usage.outputTokens, usage.reasoningOutputTokens ?? 0)
    : 0;
  const reasoningUsd =
    usage?.outputTokens && price
      ? (price.outputUsd * reasoning) / usage.outputTokens
      : 0;
  const hasPrice =
    price && Number.isFinite(price.totalUsd) && price.totalUsd >= 0;
  const priceTitle = translate("chat.aPIPriceUnavailableForThisModelOr");
  const details = usage
    ? [
        {
          label: translate("chat.uncachedInput"),
          icon: ArrowDownToLine,
          value: uncachedInput,
          usd: price?.inputUsd,
        },
        {
          label: translate("chat.cacheRead"),
          icon: Database,
          value: usage.cachedInputTokens,
          usd: price?.cachedInputUsd,
        },
        ...(usage.cacheWriteInputTokens
          ? [{
              label: translate("chat.cacheWrite"),
              icon: Save,
              value: usage.cacheWriteInputTokens,
              usd: price?.cacheWriteInputUsd,
            }]
          : []),
        {
          label: translate("chat.output"),
          icon: ArrowUpFromLine,
          value: usage.outputTokens - reasoning,
          usd: price ? price.outputUsd - reasoningUsd : undefined,
        },
        ...(usage.reasoningOutputTokens > 0
          ? [
              {
                label: translate("chat.reasoning"),
                icon: Brain,
                value: reasoning,
                usd: price ? reasoningUsd : undefined,
              },
            ]
          : []),
      ]
    : [];
  return (
    <span className="thread-usage-cost">
      {hasPrice && readOnly ? (
        <span className="thread-turn-usage-price">
          {formatCompactUsd(price.totalUsd)}
        </span>
      ) : hasPrice || usage ? (
        <Tooltip open={detailsOpen} onOpenChange={setDetailsOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={
                hasPrice
                  ? 'thread-turn-usage-price'
                  : 'thread-turn-usage-unavailable'
              }
              aria-label={translate("chat.showTokenDetails", { value1: hasPrice ? `${costLabel} ${formatCompactUsd(price.totalUsd)}` : translate("chat.aPIPriceUnavailable") })}
              aria-expanded={detailsOpen}
              onPointerDown={() => {
                openAtPointerDown.current = detailsOpen;
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                // Touch focus can open the tooltip between pointer-up and click.
                // Toggle from the press state; keyboard clicks use current state.
                const pointer = event.detail !== 0;
                setDetailsOpen(
                  (open) => !(pointer ? openAtPointerDown.current : open),
                );
              }}
            >
              {hasPrice
                ? formatCompactUsd(price.totalUsd)
                : translate("chat.priceUnavailable")}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            collisionPadding={12}
            className="thread-usage-details"
            style={{
              zIndex: tooltipZIndex,
              maxWidth: 'calc(100vw - 24px)',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <DollarSign size={14} aria-hidden="true" />
              <span>{costLabel}</span>
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {hasPrice ? formatCompactUsd(price.totalUsd) : priceTitle}
              </span>
            </div>
            {usage && <div className="thread-usage-details-total" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, marginBottom: 8 }}>
              <span>{translate('chat.totalInput')}</span>
              <span aria-label={translate('chat.tokens', { value1: translate('chat.totalInput'), value2: usage.inputTokens.toLocaleString(getLocale()) })} title={usage.inputTokens.toLocaleString(getLocale())} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatCompactTokenCount(usage.inputTokens)}
              </span>
            </div>}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '16px minmax(0, 1fr) auto auto',
                gap: '6px 8px',
                alignItems: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {details.map(({ label, icon: Icon, value, usd }) => (
                <span key={label} style={{ display: 'contents' }}>
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}{Icon === Save && usage?.cacheWriteOneHourInputTokens === usage?.cacheWriteInputTokens && usage?.cacheWriteOneHourInputTokens
                    ? <small style={{ opacity: 0.65, marginLeft: 4 }}>1h</small> : null}</span>
                  <span
                    aria-label={translate("chat.tokens", { value1: label, value2: value.toLocaleString(getLocale()) })}
                    title={`${label}: ${value.toLocaleString(getLocale())}`}
                    style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    {formatCompactTokenCount(value)}
                  </span>
                  <span
                    aria-label={translate("chat.cost", { value1: label })}
                    title={
                      Icon === Brain
                        ? translate("chat.includedInOutputChargesNotAnAdditional")
                        : undefined
                    }
                    style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    {usd == null ? '—' : formatCompactUsd(usd)}
                  </span>
                </span>
              ))}
            </div>
            {detailsNote ? (
              <p className="mt-2 max-w-xs text-xs">{detailsNote}</p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
