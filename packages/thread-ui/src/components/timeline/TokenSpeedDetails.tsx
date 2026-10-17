import { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Gauge, Timer } from 'lucide-react';
import type { ThreadTurnTokenUsageDto } from '@pockymoe/shared';
import { getLocale, translate, useI18n } from '../../i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '../graph-ui/Tooltip';
import { formatCompactTokenCount } from './tokenFormatting';

type Speed = NonNullable<ThreadTurnTokenUsageDto['generationSpeed']>;

// Prefill runs to thousands a second; a decimal there is noise.
const rate = (value: number) => translate('chat.turnHeadSpeed', {
  value: value >= 1000
    ? Math.round(value).toLocaleString(getLocale())
    : value.toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
});
const seconds = (ms: number) => ms < 60_000
  ? `${(ms / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 1 })} s`
  : `${Math.floor(ms / 60_000)}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`;
const known = (value: number | null | undefined): value is number => value != null && Number.isFinite(value) && value > 0;

/** The combined output speed; tapping it shows the time to first token, prefill
    and decode speeds, the way benchmarks report them. */
export function TokenSpeedDetails({ speed, value }: { speed: Speed; value: number }) {
  useI18n();
  const [open, setOpen] = useState(false);
  const openAtPointerDown = useRef(false);
  const modelMs = speed.outputTimeMs || speed.llmTimeMs;
  // Earlier snapshots timed replies that arrived in one piece as if they streamed.
  const measured = speed.splitMethod === 'streamedRequests';
  const split = measured && (known(speed.firstTokenMs) || known(speed.decodeTokensPerSecond));
  const bursts = measured ? speed.burstRequests ?? 0 : 0;
  const rows = !measured ? [] : [
    ...(known(speed.firstTokenMs) ? [{
      icon: Timer, label: translate('chat.speedFirstToken'),
      value: translate('chat.speedFirstTokenValue', { time: seconds(speed.firstTokenMs), count: speed.firstTokenRequests ?? 1 }),
    }] : []),
    ...(known(speed.prefillTokensPerSecond) ? [{
      icon: ArrowDownToLine, label: translate('chat.speedPrefill'),
      value: translate('chat.speedPrefillValue', { speed: rate(speed.prefillTokensPerSecond), tokens: formatCompactTokenCount(speed.prefillTokens ?? 0) }),
    }] : []),
    ...(known(speed.decodeTokensPerSecond) ? [{
      icon: ArrowUpFromLine, label: translate('chat.speedDecode'),
      value: translate('chat.speedDecodeValue', { speed: rate(speed.decodeTokensPerSecond), tokens: formatCompactTokenCount(speed.decodeTokens ?? 0), time: seconds(speed.decodeMs ?? 0) }),
    }] : []),
  ];
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" className="thread-turn-head-speed" aria-expanded={open}
          aria-label={translate('chat.showSpeedDetails', { speed: rate(value) })}
          onPointerDown={() => { openAtPointerDown.current = open; }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            // As with the cost: toggle from the press state, since touch focus can open it first.
            const pointer = event.detail !== 0;
            setOpen(current => !(pointer ? openAtPointerDown.current : current));
          }}>
          {rate(value)}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} collisionPadding={12} className="thread-usage-details thread-speed-details"
        style={{ zIndex: 80, maxWidth: 'min(320px, calc(100vw - 24px))' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
          <Gauge size={14} aria-hidden="true" />
          <span>{translate('chat.speedCombined')}</span>
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{rate(value)}</span>
        </div>
        <div className="thread-usage-details-total" style={{ paddingBottom: 8, marginBottom: split ? 8 : 0, fontSize: 12, opacity: 0.85 }}>
          {translate('chat.speedCombinedBasis', { tokens: formatCompactTokenCount(speed.outputTokens), time: seconds(modelMs) })}
        </div>
        {split ? (
          <div style={{ display: 'grid', gridTemplateColumns: '16px auto minmax(0, 1fr)', gap: '6px 8px', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {rows.map(({ icon: Icon, label, value: text }) => (
              <span key={label} style={{ display: 'contents' }}>
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
                <span style={{ textAlign: 'right' }}>{text}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.45, opacity: 0.75 }}>
          {split ? translate('chat.speedNote') : bursts > 0 ? translate('chat.speedAllBursts') : translate('chat.speedNoSplit')}
          {split && bursts > 0 ? ` ${translate('chat.speedSomeBursts', { count: bursts })}` : null}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
