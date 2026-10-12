import { getLocale } from '../../i18n';
import { translate, useI18n } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import type { AgentSubscriptionUsageDto } from '@pockymoe/shared';

function resetLabel(value: string | null) {
  if (!value) return translate("chat.resetTimeUnavailable");
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? translate("chat.resetTimeUnavailable")
    : translate("chat.resets", { value1: date.toLocaleString(getLocale()) });
}

/** The (at most two) usage windows the composer badge shows. */
export function visibleSubscriptionWindows(usage?: AgentSubscriptionUsageDto | null) {
  if (!usage || usage.authKind !== 'subscription') return [];
  return usage.windows.filter(window => Number.isFinite(window.usedPercent) && window.usedPercent >= 0 && (!window.resetsAt || new Date(window.resetsAt).getTime() > Date.now())).slice(0, 2);
}

export function ComposerSubscriptionUsage({
  usage,
}: {
  usage?: AgentSubscriptionUsageDto | null;
}) {
  useI18n();
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const open = detailsVisible || hovered || keyboardFocused;
  const detailsId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => { setDetailsVisible(false); setHovered(false); setKeyboardFocused(false); };
    const outside = (event: PointerEvent) => { if (!ref.current?.parentElement?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);

  const windows = visibleSubscriptionWindows(usage);
  if (!usage || !windows.length) return null;
  const description = windows
    .map((window) => {
      const remaining = Math.max(0, 100 - window.usedPercent);
      return `${window.label}: ${remaining}% remaining, ${resetLabel(window.resetsAt)}`;
    })
    .join('. ');
  const observed = new Date(usage.observedAt);
  const updated = Number.isNaN(observed.getTime()) ? translate("chat.updateTimeUnavailable") : translate("chat.updated", { value1: observed.toLocaleString(getLocale()) });
  const freshness = `${usage.stale ? translate("chat.lastKnown") : ''}${updated}`;

  return (
    <>
    <button
      ref={ref}
      type="button"
      className="thread-subscription-usage"
      data-usage-stale={usage.stale ? 'true' : undefined}
      aria-label={translate("chat.subscriptionUsage", { value1: usage.provider, value2: description, value3: freshness })}
      data-composer-menu-trigger="true"
      aria-describedby={open ? detailsId : undefined}
      aria-expanded={open}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => setKeyboardFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setKeyboardFocused(false)}
      onClick={() => { setHovered(false); setKeyboardFocused(false); setDetailsVisible((current) => !current); }}
    >
      {windows.map((window) => {
        const remaining = Math.max(0, Math.min(100, 100 - window.usedPercent));
        const hue = Math.round(18 + (remaining / 100) * 190);
        return (
          <span key={window.id} className="thread-subscription-usage-window inline-flex items-center gap-0.5">
            <span className="font-normal tracking-[-0.01em]">{window.label}</span>
            <span
              data-subscription-window-track="true"
              className="h-0.5 w-6 overflow-hidden rounded-full bg-stone-600/55 sm:w-9"
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${remaining}%`,
                  backgroundImage: `linear-gradient(90deg, oklch(68% 0.17 ${hue}), oklch(82% 0.13 ${Math.min(hue + 18, 235)}))`,
                }}
              />
            </span>
          </span>
        );
      })}
      {usage.stale ? <span aria-hidden="true">~</span> : null}
    </button>
    {open ? (
      <ComposerMenuSurface id={detailsId} role="tooltip" align="end" anchorSelector=".thread-graph-composer-shell" className="thread-subscription-usage-details">
        {windows.map((window) => (
          <div key={window.id} className="thread-subscription-usage-detail-window">
            <div className="thread-subscription-usage-detail-heading">
              <span>{window.label}</span>
              <strong>{translate("chat.remainingPercentage", { value1: Math.max(0, Math.round(100 - window.usedPercent)) })}</strong>
            </div>
            <div className="thread-subscription-usage-detail-reset">{resetLabel(window.resetsAt)}</div>
          </div>
        ))}
        <div className="thread-subscription-usage-detail-freshness">{freshness}</div>
      </ComposerMenuSurface>
    ) : null}
    </>
  );
}
