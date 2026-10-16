import { useState, useSyncExternalStore, type MouseEvent } from 'react';
import { getLocale, translate, useI18n } from '../../i18n';
import { formatLongTimestamp } from '../threadPresentation';
import { AddedPromptIcon } from './AddedPromptIcon';
import { Collapse } from './Collapse';
import type { TimelineTurn } from './timelineItems';
import { TokenSpeedDetails } from './TokenSpeedDetails';
import { TokenUsageCost } from './TokenUsageCost';
import { formatElapsedDuration, useSecondClock } from './turnStatus';
import { knownTurnModel } from './TurnUsageInline';

/** "claude-opus-5-5" reads "opus 5.5" and "gpt-6-astra" "6 astra": the vendor
    part goes, a date stamp goes, and numbered parts join into a version. */
export function shortModelName(model: string) {
  const parts = model.split('-').filter(Boolean);
  if (parts.length < 2) return model;
  const words: string[] = [];
  for (const part of parts.slice(1)) {
    if (/^\d{8}$/.test(part)) continue;
    const previous = words.at(-1);
    if (previous && /^\d+(\.\d+)*$/.test(part) && /^\d+(\.\d+)*$/.test(previous)) words[words.length - 1] = `${previous}.${part}`;
    else words.push(part);
  }
  return words.length ? words.join(' ') : model;
}

// A wide screen has room for the whole head on one line; a phone opens the rest on tap.
const wideQuery = '(min-width: 640px)';
const subscribeWide = (change: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(wideQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};
const readWide = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(wideQuery).matches;
const useWideScreen = () => useSyncExternalStore(subscribeWide, readWide, () => false);

const clock = (at: string) => new Date(at).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' });
const dated = (at: string) => new Date(at).toLocaleString(getLocale(), {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  ...(new Date(at).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
});

/** The top of a turn: a dot with the time it has worked, its cost, when it
    started, the model, the speed and the prompts added while it worked. On a
    phone only the dot, time and cost show; tapping the line opens the rest on
    one more line. */
export function TurnHead({ turn, active, added, onBeforeResize }: {
  turn: TimelineTurn;
  active: boolean;
  /** Prompts added while the turn was working. */
  added: number;
  onBeforeResize?: ((anchor?: Element | null) => void) | undefined;
}) {
  useI18n();
  const wide = useWideScreen();
  const [open, setOpen] = useState(false);
  const [withDate, setWithDate] = useState(false);
  const now = useSecondClock(active);
  const started = turn.startedAt;
  const took = formatElapsedDuration(started, active ? now : Date.parse(turn.completedAt ?? ''));
  const model = knownTurnModel(turn);
  const effort = turn.reasoningEffort?.trim();
  const usage = turn.tokenUsage?.total;
  const speed = turn.tokenUsage?.generationSpeed;
  const rate = speed?.averageOutputTokensPerSecond ?? speed?.averageTokensPerSecond;
  const toggle = (event: MouseEvent<HTMLElement>) => {
    // The cost is a control of its own.
    if (event.target instanceof Element && event.target.closest('.thread-usage-cost')) return;
    onBeforeResize?.(event.currentTarget);
    setOpen(value => !value);
  };

  const worked = took ? translate(active ? 'chat.turnHeadRunning' : 'chat.turnHeadWorked', { elapsed: took }) : null;
  const dot = <>
    <i className="thread-turn-head-dot" aria-hidden="true" />
    {took ? <span className="thread-turn-head-took">{took}</span> : null}
  </>;
  const cost = usage || turn.priceEstimate ? <TokenUsageCost usage={usage} price={turn.priceEstimate} /> : null;
  const more = <>
    {started ? (
      <button type="button" className="thread-turn-head-time" title={formatLongTimestamp(started)} aria-pressed={withDate}
        onClick={() => setWithDate(value => !value)}>
        <time dateTime={started}>{withDate ? dated(started) : clock(started)}</time>
      </button>
    ) : null}
    {model ? <span className="thread-turn-head-model" title={model}>{shortModelName(model)}{effort ? ` · ${effort}` : ''}</span> : null}
    {!active && speed && rate != null && Number.isFinite(rate) && rate > 0 ? <TokenSpeedDetails speed={speed} value={rate} /> : null}
    {added ? (
      <span className="thread-turn-head-added" role="img" title={translate('chat.turnHeadAddedValue', { count: added })}
        aria-label={translate('chat.turnHeadAddedValue', { count: added })}>
        <AddedPromptIcon />{added}
      </span>
    ) : null}
  </>;

  if (wide) return (
    <div className="thread-turn-head-block">
      <div className="thread-turn-head is-wide" data-active={active || undefined} data-status={turn.status}>
        <span className="thread-turn-head-main" role={worked ? 'img' : undefined} aria-label={worked ?? undefined}>{dot}</span>
        {cost}
        {more}
      </div>
    </div>
  );

  return (
    <div className="thread-turn-head-block">
      <div className="thread-turn-head" data-active={active || undefined} data-status={turn.status} onClick={toggle}>
        <button type="button" className="thread-turn-head-main" aria-expanded={open} title={translate('chat.turnHeadDetails')}
          aria-label={worked ?? translate('chat.turnHeadDetails')}>
          {dot}
        </button>
        {cost}
      </div>
      <Collapse open={open}>
        <div className="thread-turn-head-more">{more}</div>
      </Collapse>
    </div>
  );
}
